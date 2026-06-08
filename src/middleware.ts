import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/jwt'
import { checkRateLimit, generateRateLimitKey, RATE_LIMIT_CONFIGS, type RateLimitType } from '@/lib/rate-limit'

// Rutas públicas que no requieren autenticación
const PUBLIC_ROUTES = [
  '/api/auth',
  '/api/sistema/status',
]

// Rutas de solo lectura (GET) que no requieren permisos específicos
// (cualquier operador autenticado puede consultar)
const READ_ONLY_NO_PERM = [
  '/api/configuracion',
  '/api/indicadores',
]

// Rutas que requieren rol ADMINISTRADOR para escritura (POST/PUT/DELETE/PATCH)
const ADMIN_ONLY_ROUTES = [
  '/api/operadores',
  '/api/seguridad',
  '/api/admin',
  '/api/sistema/backup',
  '/api/backup',
  '/api/puente-web',
]

// Nota: Los permisos granulares por ruta se validan a nivel de página/componente
// mediante el sistema canAccess/hasPermission en page.tsx.
// Este middleware solo gestiona autenticación JWT y rate limiting.

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route))
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

/**
 * Validar Origin/Referer para protección CSRF en operaciones de escritura.
 * Se asegura que las peticiones mutating (POST/PUT/DELETE/PATCH) provengan
 * del dominio legítimo de la aplicación, evitando ataques CSRF cross-origin.
 * En desarrollo se permite localhost y la URL configurada.
 */
function isOriginAllowed(request: NextRequest): boolean {
  // Los GET son safe methods, no necesitan validación CSRF
  const method = request.method
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true
  }

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const host = request.headers.get('host')

  // Orígenes permitidos (sin protocolo)
  const allowedHosts: string[] = []

  // Agregar la URL configurada de la app
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    try {
      const parsed = new URL(appUrl)
      allowedHosts.push(parsed.host)
    } catch {
      // Ignorar si la URL es inválida
    }
  }

  // En desarrollo, siempre permitir localhost y cualquier IP local
  if (process.env.NODE_ENV === 'development') {
    allowedHosts.push('localhost:3000', 'localhost:3001', '127.0.0.1:3000', '127.0.0.1:3001')
    // Permitir cualquier host en desarrollo (red local, IP dinámica, etc.)
    if (host) allowedHosts.push(host)
  }

  // Si no hay Origin ni Referer, verificar si el Host coincide
  if (!origin && !referer) {
    // En desarrollo, permitir requests sin origin (ej: Postman, fetch directo)
    if (process.env.NODE_ENV === 'development') {
      return true
    }
    // En producción, si el host está en la lista permitida, confiar
    if (host && allowedHosts.includes(host)) {
      return true
    }
    return false
  }

  // Verificar Origin (header prioritario para CORS/CSRF)
  if (origin) {
    try {
      const originHost = new URL(origin).host
      if (allowedHosts.includes(originHost)) {
        return true
      }
      // Permitir si el origin coincide con el host del request (same-origin)
      if (host && originHost === host) {
        return true
      }
    } catch {
      // Origin inválido
      return false
    }
  }

  // Fallback: verificar Referer
  if (referer) {
    try {
      const refererHost = new URL(referer).host
      if (allowedHosts.includes(refererHost)) {
        return true
      }
      if (host && refererHost === host) {
        return true
      }
    } catch {
      // Referer inválido
      return false
    }
  }

  return false
}

function getRateLimitType(pathname: string, method: string): RateLimitType {
  // Auth routes: only apply strict limits to actual login attempts (POST/PUT/DELETE)
  // GET and PATCH are session validation/refresh and should NOT consume the login rate limit
  if (pathname.startsWith('/api/auth')) {
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      return 'AUTH_LOGIN'
    }
    // Session validation (GET) and refresh (PATCH) use general limit (much more lenient)
    return 'API_GENERAL'
  }
  // Write operations get lower limits
  if (method !== 'GET') {
    return 'API_WRITE'
  }
  // Default: general API limit
  return 'API_GENERAL'
}

function isAdminOnlyRoute(pathname: string): boolean {
  return ADMIN_ONLY_ROUTES.some(route => pathname.startsWith(route))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method

  // Skip non-API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // ========================================
  // RATE LIMITING
  // ========================================
  const clientIp = getClientIp(request)
  const rateLimitType = getRateLimitType(pathname, method)
  const rateLimitKey = generateRateLimitKey(clientIp, pathname)
  const rateLimitResult = checkRateLimit(rateLimitKey, rateLimitType)
  const rateLimitConfig = RATE_LIMIT_CONFIGS[rateLimitType]

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: rateLimitResult.blocked
          ? 'Demasiados intentos. Intente más tarde.'
          : 'Rate limit excedido',
        retryAfter: rateLimitResult.retryAfter
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.retryAfter || 60),
          'X-RateLimit-Limit': String(rateLimitConfig.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rateLimitResult.resetAt / 1000)),
        },
      }
    )
  }

  // ========================================
  // CSRF PROTECTION (Origin validation for mutating requests)
  // ========================================
  if (!isOriginAllowed(request)) {
    return NextResponse.json(
      { success: false, error: 'Origen no permitido - posible ataque CSRF' },
      { status: 403 }
    )
  }

  // Allow public routes
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Limit', String(rateLimitConfig.maxRequests))
    response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetAt / 1000)))
    return response
  }

  // Allow GET requests on read-only-no-perm routes
  if (method === 'GET' && READ_ONLY_NO_PERM.some(route => pathname.startsWith(route))) {
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Limit', String(rateLimitConfig.maxRequests))
    response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetAt / 1000)))
    return response
  }

  // ========================================
  // JWT AUTHENTICATION (primary method)
  // ========================================
  let operadorId: string | null = null
  let operadorRol: string | null = null
  
  // Try JWT cookie first (secure method)
  const token = request.cookies.get('session_token')?.value
  if (token) {
    const payload = await verifySessionToken(token)
    if (payload) {
      operadorId = payload.operadorId
      operadorRol = payload.rol
    }
  }
  
  // LEGACY AUTH REMOVIDO - Solo se acepta JWT via cookie session_token
  // Antes se aceptaba x-operador-id header / operadorId query param (session hijacking risk)

  // Para TODOS los métodos: exigir autenticación JWT
  if (!operadorId) {
    return NextResponse.json(
      { success: false, error: 'No autenticado - inicie sesión' },
      { status: 401 }
    )
  }

  // Para escritura (POST/PUT/DELETE/PATCH): verificar permisos adicionales
  if (method !== 'GET') {

    // Verificar rutas admin: exigir rol ADMINISTRADOR
    if (isAdminOnlyRoute(pathname)) {
      if (operadorRol !== 'ADMINISTRADOR') {
        return NextResponse.json(
          { success: false, error: 'Se requiere rol ADMINISTRADOR para esta operación' },
          { status: 403 }
        )
      }
    }
  }

  // Para GET: autenticación ya verificada arriba, propagar identity

  // Propagar identidad del operador autenticado via headers
  const response = NextResponse.next()
  response.headers.set('x-operador-id', operadorId!)
  if (operadorRol) {
    response.headers.set('x-operador-rol', operadorRol)
  }
  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', String(rateLimitConfig.maxRequests))
  response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetAt / 1000)))

  return response
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
}

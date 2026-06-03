import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { checkRateLimit, resetRateLimit, generateRateLimitKey } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { createSessionToken, getSessionCookieConfig, getLogoutCookieConfig, verifySessionToken } from '@/lib/jwt'

const logger = createLogger('API:Auth')

// Helper para obtener IP del cliente
function getClientIP(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    return xff.split(',')[0].trim()
  }
  return '127.0.0.1'
}

// Helper para construir el objeto de permisos del operador
function buildPermisos(operador: any) {
  return {
    puedePesajeCamiones: operador.puedePesajeCamiones,
    puedePesajeIndividual: operador.puedePesajeIndividual,
    puedeMovimientoHacienda: operador.puedeMovimientoHacienda,
    puedeListaFaena: operador.puedeListaFaena,
    puedeRomaneo: operador.puedeRomaneo,
    puedeIngresoCajon: operador.puedeIngresoCajon,
    puedeCuarteo: operador.puedeCuarteo,
    puedeDesposte: operador.puedeDesposte,
    puedeEmpaque: operador.puedeEmpaque,
    puedeExpedicionC2: operador.puedeExpedicionC2,
    puedeMenudencias: operador.puedeMenudencias,
    puedeStock: operador.puedeStock,
    puedeReportes: operador.puedeReportes,
    puedeCCIR: operador.puedeCCIR,
    puedeFacturacion: operador.puedeFacturacion,
    puedeConfiguracion: operador.puedeConfiguracion,
    puedeCalidad: operador.puedeCalidad,
    puedeAutorizarReportes: operador.puedeAutorizarReportes
  }
}

// GET - Validate operator session (verifies JWT cookie, no DB query)
// Los datos del operador vienen del payload JWT (firmado y verificado).
// Si un operador es desactivado, su sesión expira con el JWT (24h max).
export async function GET(request: NextRequest) {
  try {
    const cookieConfig = getSessionCookieConfig()
    const token = request.cookies.get(cookieConfig.name)?.value
    
    if (token) {
      const payload = await verifySessionToken(token)
      if (payload) {
        // JWT válido — devolver datos directamente del payload sin consultar DB
        return NextResponse.json({
          success: true,
          data: {
            id: payload.operadorId,
            nombre: payload.nombre,
            usuario: payload.usuario,
            rol: payload.rol,
            email: payload.email,
            permisos: payload.permisos
          }
        })
      }
    }
    
    // LEGACY AUTH REMOVIDO - Solo se acepta JWT via cookie session_token
    return NextResponse.json(
      { success: false, error: 'No hay sesión activa' },
      { status: 401 }
    )
  } catch (error) {
    logger.error('Error validando operador', error)
    return NextResponse.json(
      { success: false, error: 'Error de servidor' },
      { status: 500 }
    )
  }
}

// POST - Login con usuario/password o PIN (now issues JWT in httpOnly cookie)
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  
  try {
    const body = await request.json()
    const { usuario, password, pin } = body
    
    logger.info('Intento de login', { usuario, hasPassword: !!password, hasPin: !!pin, ip })
    
    // Login con usuario y password
    if (usuario && password) {
      // Verificar rate limit
      const rateLimitKey = generateRateLimitKey(ip, 'auth:login', usuario)
      const rateLimit = checkRateLimit(rateLimitKey, 'AUTH_LOGIN')
      
      if (!rateLimit.allowed) {
        logger.warn('Rate limit excedido', { usuario, ip, blocked: rateLimit.blocked })
        return NextResponse.json(
          { 
            success: false, 
            error: rateLimit.blocked 
              ? 'Cuenta bloqueada temporalmente. Intente más tarde.' 
              : 'Demasiados intentos. Intente más tarde.',
            retryAfter: rateLimit.retryAfter
          },
          { 
            status: 429,
            headers: {
              'Retry-After': String(rateLimit.retryAfter || 60)
            }
          }
        )
      }
      
      logger.debug('Buscando usuario', { usuario: String(usuario).toLowerCase() })
      
      const operador = await db.operador.findFirst({
        where: {
          usuario: String(usuario).toLowerCase(),
          activo: true
        }
      })
      
      if (!operador) {
        logger.warn('Usuario no encontrado', { usuario, ip })
        return NextResponse.json(
          { success: false, error: 'Usuario no encontrado o inactivo' },
          { status: 401 }
        )
      }
      
      const validPassword = await bcrypt.compare(password, operador.password)
      
      if (!validPassword) {
        logger.warn('Contraseña incorrecta', { usuario, ip })
        return NextResponse.json(
          { success: false, error: 'Contraseña incorrecta' },
          { status: 401 }
        )
      }
      
      // Login exitoso - resetear rate limit
      resetRateLimit(rateLimitKey)
      
      // Crear JWT token
      const permisos = buildPermisos(operador)
      const token = await createSessionToken({
        operadorId: operador.id,
        nombre: operador.nombre,
        usuario: operador.usuario,
        rol: operador.rol,
        email: operador.email ?? undefined,
        permisos
      })

      // Registrar login en auditoría
      await db.auditoria.create({
        data: {
          operadorId: operador.id,
          modulo: 'AUTH',
          accion: 'LOGIN',
          entidad: 'Operador',
          entidadId: operador.id,
          descripcion: `Login exitoso: ${operador.nombre} (${operador.usuario})`,
          ip
        }
      })
      
      logger.info('Login exitoso', { usuario: operador.usuario, nombre: operador.nombre, ip })
      
      // Set JWT in httpOnly cookie
      const cookieConfig = getSessionCookieConfig()
      const response = NextResponse.json({
        success: true,
        data: {
          id: operador.id,
          nombre: operador.nombre,
          usuario: operador.usuario,
          rol: operador.rol,
          email: operador.email,
          permisos
        }
      })
      response.cookies.set(cookieConfig.name, token, cookieConfig.options)
      
      return response
    }
    
    // Login con PIN (alternativa rápida)
    if (pin) {
      // Verificar rate limit para PIN
      const rateLimitKey = generateRateLimitKey(ip, 'auth:pin')
      const rateLimit = checkRateLimit(rateLimitKey, 'AUTH_PIN')
      
      if (!rateLimit.allowed) {
        logger.warn('Rate limit PIN excedido', { ip, blocked: rateLimit.blocked })
        return NextResponse.json(
          { 
            success: false, 
            error: rateLimit.blocked 
              ? 'Demasiados intentos fallidos. Espere antes de reintentar.' 
              : 'Demasiados intentos. Intente más tarde.',
            retryAfter: rateLimit.retryAfter
          },
          { 
            status: 429,
            headers: {
              'Retry-After': String(rateLimit.retryAfter || 60)
            }
          }
        )
      }
      
      // Look up operator by PIN with bcrypt-aware comparison
      // Find all active operators that have a PIN set
      const operadoresConPin = await db.operador.findMany({
        where: {
          pin: { not: null },
          activo: true
        },
        select: {
          id: true,
          nombre: true,
          usuario: true,
          rol: true,
          email: true,
          pin: true,
          puedePesajeCamiones: true,
          puedePesajeIndividual: true,
          puedeMovimientoHacienda: true,
          puedeListaFaena: true,
          puedeRomaneo: true,
          puedeIngresoCajon: true,
          puedeCuarteo: true,
          puedeDesposte: true,
          puedeEmpaque: true,
          puedeExpedicionC2: true,
          puedeMenudencias: true,
          puedeStock: true,
          puedeReportes: true,
          puedeCCIR: true,
          puedeFacturacion: true,
          puedeConfiguracion: true,
          puedeCalidad: true,
          puedeAutorizarReportes: true
        }
      })

      let operador: typeof operadoresConPin[0] | null = null
      let needsRehash = false

      for (const op of operadoresConPin) {
        const storedPin = op.pin!
        if (storedPin.startsWith('$2')) {
          // Stored PIN is a bcrypt hash - use bcrypt.compare
          const match = await bcrypt.compare(String(pin), storedPin)
          if (match) {
            operador = op
            break
          }
        } else {
          // Legacy plaintext PIN - compare directly
          if (storedPin === String(pin)) {
            operador = op
            needsRehash = true
            break
          }
        }
      }

      if (!operador) {
        logger.warn('PIN inválido', { ip })
        return NextResponse.json(
          { success: false, error: 'PIN inválido o operador inactivo' },
          { status: 401 }
        )
      }

      // If PIN was stored in plaintext, re-hash it with bcrypt
      if (needsRehash) {
        const hashedPin = await bcrypt.hash(String(pin), 10)
        await db.operador.update({
          where: { id: operador.id },
          data: { pin: hashedPin }
        })
        logger.info('PIN re-hashed con bcrypt', { operadorId: operador.id })
      }
      
      // Login exitoso - resetear rate limit
      resetRateLimit(rateLimitKey)
      
      // Crear JWT token
      const permisos = buildPermisos(operador)
      const token = await createSessionToken({
        operadorId: operador.id,
        nombre: operador.nombre,
        usuario: operador.usuario,
        rol: operador.rol,
        email: operador.email ?? undefined,
        permisos
      })

      // Registrar login en auditoría
      await db.auditoria.create({
        data: {
          operadorId: operador.id,
          modulo: 'AUTH',
          accion: 'LOGIN_PIN',
          entidad: 'Operador',
          entidadId: operador.id,
          descripcion: `Login con PIN: ${operador.nombre}`,
          ip
        }
      })
      
      logger.info('Login con PIN exitoso', { usuario: operador.usuario, ip })
      
      // Set JWT in httpOnly cookie
      const cookieConfig = getSessionCookieConfig()
      const response = NextResponse.json({
        success: true,
        data: {
          id: operador.id,
          nombre: operador.nombre,
          usuario: operador.usuario,
          rol: operador.rol,
          email: operador.email,
          permisos
        }
      })
      response.cookies.set(cookieConfig.name, token, cookieConfig.options)
      
      return response
    }
    
    return NextResponse.json(
      { success: false, error: 'Debe proporcionar usuario/password o PIN' },
      { status: 400 }
    )
  } catch (error) {
    logger.error('Error en login', error)
    return NextResponse.json(
      { success: false, error: 'Error de servidor' },
      { status: 500 }
    )
  }
}

// PATCH - Refresh session token (renew JWT without DB query)
// Called periodically by the client to keep the session alive.
// Los datos del operador se leen del JWT existente (firmado, válido).
// No se consulta la DB — si el operador fue desactivado, expira con el JWT (24h max).
export async function PATCH(request: NextRequest) {
  try {
    const cookieConfig = getSessionCookieConfig()
    const token = request.cookies.get(cookieConfig.name)?.value

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No hay sesión activa' },
        { status: 401 }
      )
    }

    const payload = await verifySessionToken(token)
    if (!payload) {
      // Token expired or invalid - clear cookie
      const logoutConfig = getLogoutCookieConfig()
      const response = NextResponse.json(
        { success: false, error: 'Sesión expirada' },
        { status: 401 }
      )
      response.cookies.set(logoutConfig.name, '', logoutConfig.options)
      return response
    }

    // Re-emitar un nuevo JWT con los datos del payload actual (sin consultar DB)
    const newToken = await createSessionToken({
      operadorId: payload.operadorId,
      nombre: payload.nombre,
      usuario: payload.usuario,
      rol: payload.rol,
      email: payload.email,
      permisos: payload.permisos
    })

    const response = NextResponse.json({
      success: true,
      data: {
        id: payload.operadorId,
        nombre: payload.nombre,
        usuario: payload.usuario,
        rol: payload.rol,
        email: payload.email,
        permisos: payload.permisos
      }
    })
    // Set new token cookie (replaces the old one)
    response.cookies.set(cookieConfig.name, newToken, cookieConfig.options)

    return response
  } catch (error) {
    logger.error('Error refreshing session', error)
    return NextResponse.json(
      { success: false, error: 'Error de servidor' },
      { status: 500 }
    )
  }
}

// DELETE - Logout (clear JWT cookie)
export async function DELETE(request: NextRequest) {
  const ip = getClientIP(request)
  
  try {
    // Get operadorId from JWT cookie before clearing
    const cookieConfig = getSessionCookieConfig()
    const token = request.cookies.get(cookieConfig.name)?.value
    let operadorId: string | null = null
    
    if (token) {
      const payload = await verifySessionToken(token)
      if (payload) {
        operadorId = payload.operadorId
      }
    }
    
    // Registrar logout en auditoría si hay operador identificado
    if (operadorId) {
      await db.auditoria.create({
        data: {
          operadorId,
          modulo: 'AUTH',
          accion: 'LOGOUT',
          entidad: 'Operador',
          entidadId: operadorId,
          descripcion: 'Logout',
          ip
        }
      })
      
      logger.info('Logout', { operadorId, ip })
    }
    
    // Clear JWT cookie
    const logoutConfig = getLogoutCookieConfig()
    const response = NextResponse.json({ success: true })
    response.cookies.set(logoutConfig.name, '', logoutConfig.options)
    
    return response
  } catch (error) {
    logger.error('Error en logout', error)
    // Still clear cookie even on error
    const logoutConfig = getLogoutCookieConfig()
    const response = NextResponse.json({ success: true })
    response.cookies.set(logoutConfig.name, '', logoutConfig.options)
    return response
  }
}

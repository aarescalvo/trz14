import { SignJWT, jwtVerify } from 'jose'

// JWT configuration
const getJwtSecret = (): Uint8Array => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is not set. ' +
      'Please set it in your .env file. ' +
      'Example: JWT_SECRET=traza123'
    );
  }
  return new TextEncoder().encode(secret);
}

const JWT_EXPIRES_IN = '24h' // 24 hours session (covers full production shifts)
const COOKIE_NAME = 'session_token'

export interface SessionPayload {
  operadorId: string
  nombre: string
  usuario: string
  rol: string
  email?: string
  permisos: Record<string, boolean>
}

/**
 * Create a signed JWT token with operator session data
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ 
    operadorId: payload.operadorId,
    nombre: payload.nombre,
    usuario: payload.usuario,
    rol: payload.rol,
    email: payload.email,
    permisos: payload.permisos
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(getJwtSecret())
}

/**
 * Verify and decode a JWT token
 * Returns the payload or null if invalid/expired
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as unknown as SessionPayload
  } catch (error) {
    // Token expired, invalid, or malformed
    return null
  }
}

/**
 * Get cookie configuration for session token
 */
export function getSessionCookieConfig() {
  return {
    name: COOKIE_NAME,
    options: {
      httpOnly: true,
      // secure: true requires HTTPS. In local/intranet deployments over HTTP,
      // the cookie would never be sent back by the browser.
      // Only enable secure when explicitly configured via env var.
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours in seconds
    }
  }
}

/**
 * Create a logout cookie (expires immediately)
 */
export function getLogoutCookieConfig() {
  return {
    name: COOKIE_NAME,
    options: {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 0, // Expire immediately
    }
  }
}

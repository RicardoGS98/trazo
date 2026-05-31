import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { VercelRequest } from '@vercel/node'

/**
 * Guardas reutilizables para el endpoint /api/tracking.
 * Objetivo: subir el listón frente al abuso (proxy abierto, enumeración,
 * martilleo) sin romper el uso legítimo desde la SPA same-origin.
 */

// ---- Rate limiter (Upstash Redis) ------------------------------------------
// La integración de Upstash en Vercel provee UPSTASH_REDIS_REST_*; algunas
// integraciones más antiguas usan KV_REST_API_*. Soportamos ambas.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN

// Peticiones permitidas por IP en una ventana de 60s (override con RL_MAX).
const RL_MAX = Number(process.env.RL_MAX ?? 20)

// Se crea una sola vez por instancia (Fluid Compute reutiliza instancias) y
// solo si hay credenciales: así el deploy sigue funcionando aunque Upstash
// todavía no esté provisto (en ese caso, simplemente no se limita).
const ratelimiter =
  REDIS_URL && REDIS_TOKEN
    ? new Ratelimit({
        redis: new Redis({ url: REDIS_URL, token: REDIS_TOKEN }),
        limiter: Ratelimit.slidingWindow(RL_MAX, '60 s'),
        prefix: 'trazo:tracking',
        analytics: false,
        ephemeralCache: new Map(), // cachea contadores en memoria de la instancia
      })
    : null

export const rateLimitConfigured = ratelimiter !== null

export interface RateResult {
  ok: boolean
  limit: number
  remaining: number
  reset: number // epoch ms en que se libera la ventana (0 si no aplica)
}

export async function checkRateLimit(ip: string): Promise<RateResult> {
  // Sin Upstash configurado → no limitamos (fail-open explícito y documentado).
  if (!ratelimiter) return { ok: true, limit: RL_MAX, remaining: RL_MAX, reset: 0 }
  try {
    const r = await ratelimiter.limit(ip)
    return { ok: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset }
  } catch {
    // Si Redis falla puntualmente, no tiramos la app: permitimos pero avisamos.
    console.warn('[tracking] rate limiter no disponible; se permite la petición')
    return { ok: true, limit: RL_MAX, remaining: RL_MAX, reset: 0 }
  }
}

// ---- IP del cliente ---------------------------------------------------------
export function clientIp(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for']
  const first = Array.isArray(xff) ? xff[0] : xff?.split(',')[0]
  const real = req.headers['x-real-ip']
  return (first || (Array.isArray(real) ? real[0] : real) || 'desconocido').trim()
}

// ---- Comprobación de origen -------------------------------------------------
// La app es same-origin: el navegador envía Origin (en POST) o al menos Referer.
// Aceptamos si el host de Origin/Referer coincide con el del propio deploy
// (cubre producción, previews y dominios propios sin hardcodear nada) o si está
// en ALLOWED_ORIGINS. Un cliente que no manda ninguno (curl pelado) se rechaza.
// Nota honesta: Origin/Referer son falsificables por clientes no-navegador;
// esto corta el abuso casual y el uso cross-site, no a un atacante decidido.
const EXTRA_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

function hostOf(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).host.toLowerCase()
  } catch {
    return null
  }
}

export function isAllowedOrigin(req: VercelRequest): boolean {
  const selfHost = (
    ((req.headers['x-forwarded-host'] as string) || req.headers.host) ?? ''
  ).toLowerCase()
  const originHeader = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin

  const candidateHost = hostOf(originHeader) ?? hostOf(req.headers.referer)
  if (!candidateHost) return false // sin Origin ni Referer → fuera
  if (selfHost && candidateHost === selfHost) return true
  if (originHeader && EXTRA_ORIGINS.has(originHeader)) return true
  return false
}

// ---- Validación del código --------------------------------------------------
// Formato esperado de HBL: alfanumérico (ej. CM915528340AP), con guiones
// opcionales. Acota la superficie y limita la enumeración de payloads raros.
const CODE_RE = /^[A-Z0-9-]{3,40}$/

export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase()
  return CODE_RE.test(code) ? code : null
}

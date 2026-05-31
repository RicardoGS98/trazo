import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkRateLimit, clientIp, isAllowedOrigin, normalizeCode } from './_lib/guard.js'
import { fetchTrackingInfo } from './_lib/upstream.js'

const MAX_BODY_BYTES = 1024

/**
 * Proxy serverless. El navegador llama same-origin a POST /api/tracking { code }
 * y aquí consultamos el API real del carrier (GET ?hbl=) desde el servidor,
 * devolviendo la respuesta NORMALIZADA (ver TrackingInfo). Defensa en capas:
 *   1) solo POST   2) solo nuestro origen   3) cuerpo diminuto
 *   4) rate limit por IP (Upstash)   5) validación estricta del code
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex')

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }
  if (!isAllowedOrigin(req)) {
    sendJson(res, 403, { error: 'Origen no permitido.' })
    return
  }
  if (Number(req.headers['content-length'] ?? 0) > MAX_BODY_BYTES) {
    sendJson(res, 413, { error: 'Petición demasiado grande.' })
    return
  }

  const rl = await checkRateLimit(clientIp(req))
  res.setHeader('X-RateLimit-Limit', String(rl.limit))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, rl.remaining)))
  if (!rl.ok) {
    const retry = rl.reset ? Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)) : 60
    res.setHeader('Retry-After', String(retry))
    sendJson(res, 429, { error: 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.' })
    return
  }

  const code = normalizeCode((req.body as { code?: unknown } | undefined)?.code)
  if (!code) {
    sendJson(res, 400, { error: 'Código inválido.' })
    return
  }

  try {
    const info = await fetchTrackingInfo(code)
    if (!info.ok || !info.data) {
      sendJson(res, 404, { error: 'No encontrado.' })
      return
    }
    sendJson(res, 200, info.data)
  } catch {
    sendJson(res, 502, { error: 'No se pudo contactar con el servicio de envíos.' })
  }
}

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

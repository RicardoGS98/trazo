import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkRateLimit, clientIp, isAllowedOrigin, normalizeCode } from './_lib/guard.js'

const UPSTREAM = 'https://emarket-services.com/api/orders/delivery_status_by_code/'
const MAX_BODY_BYTES = 1024

/**
 * Proxy serverless. El navegador llama same-origin a POST /api/tracking { code }
 * (sin CORS) y aquí reenviamos el POST al API real desde el servidor, donde CORS
 * no aplica. Devolvemos la respuesta tal cual:
 *   [ { "notes": null, "tracking_data": [ { "date", "status" } ] } ]
 *
 * El endpoint es público (la app no tiene login), así que en lugar de "cerrarlo"
 * —imposible sin auth— aplicamos defensa en capas para frenar el abuso:
 *   1) solo POST                       4) rate limit por IP (Upstash)
 *   2) solo desde nuestro propio origen 5) validación estricta del code
 *   3) cuerpo diminuto
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Cabeceras de seguridad en toda respuesta del endpoint.
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // 1) Solo desde nuestra propia app (corta uso cross-site y curl pelado).
  if (!isAllowedOrigin(req)) {
    res.status(403).json({ error: 'Origen no permitido.' })
    return
  }

  // 2) Cuerpo diminuto: nada de payloads enormes.
  if (Number(req.headers['content-length'] ?? 0) > MAX_BODY_BYTES) {
    res.status(413).json({ error: 'Petición demasiado grande.' })
    return
  }

  // 3) Rate limit por IP (Upstash). Si no está configurado, no limita.
  const rl = await checkRateLimit(clientIp(req))
  res.setHeader('X-RateLimit-Limit', String(rl.limit))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, rl.remaining)))
  if (!rl.ok) {
    const retry = rl.reset ? Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)) : 60
    res.setHeader('Retry-After', String(retry))
    res.status(429).json({ error: 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.' })
    return
  }

  // 4) Validación estricta del código (formato y longitud).
  const code = normalizeCode((req.body as { code?: unknown } | undefined)?.code)
  if (!code) {
    res.status(400).json({ error: 'Código inválido.' })
    return
  }

  // 5) Reenvío al API real.
  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch {
    res.status(502).json({ error: 'No se pudo contactar con el servicio de envíos.' })
  }
}

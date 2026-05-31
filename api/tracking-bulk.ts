import type { VercelRequest, VercelResponse } from '@vercel/node'
import { BULK_MAX_CODES, checkBulkRateLimit, clientIp, isAllowedOrigin, normalizeCodes } from './_lib/guard.js'

const UPSTREAM = 'https://emarket-services.com/api/orders/delivery_status_by_code/'
const MAX_BODY_BYTES = 4096 // 10 códigos + JSON; holgado pero acotado
const CONCURRENCY = 5 // peticiones simultáneas al upstream
const PER_CALL_TIMEOUT_MS = 8000 // timeout por código (dentro del límite de la función)

interface BulkItem {
  code: string
  ok: boolean
  status: number
  data?: unknown
}

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

/** Consulta un código en el upstream con timeout; nunca lanza (resultado parcial). */
async function fetchOne(code: string): Promise<BulkItem> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PER_CALL_TIMEOUT_MS)
  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: ctrl.signal,
    })
    const data = await upstream.json().catch(() => null)
    return { code, ok: upstream.ok, status: upstream.status, data: upstream.ok ? data : undefined }
  } catch {
    return { code, ok: false, status: 0 } // timeout o error de red
  } finally {
    clearTimeout(timer)
  }
}

/** Ejecuta `fn` sobre `items` con como mucho `limit` en vuelo a la vez. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/**
 * Refresco masivo: el navegador envía POST /api/tracking-bulk { codes: [...] }
 * y reenviamos cada código al API real (en paralelo limitado), devolviendo un
 * resultado por código para que el cliente actualice los que respondan.
 * Mismas guardas que /api/tracking + rate limit propio (1/min) y tope de 10.
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

  // Rate limit propio: 1 lote por minuto e IP.
  const rl = await checkBulkRateLimit(clientIp(req))
  res.setHeader('X-RateLimit-Limit', String(rl.limit))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, rl.remaining)))
  if (!rl.ok) {
    const retry = rl.reset ? Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)) : 60
    res.setHeader('Retry-After', String(retry))
    sendJson(res, 429, { error: 'Solo puedes actualizar todos los envíos una vez por minuto.' })
    return
  }

  // Valida, normaliza y deduplica; tope de 10 códigos.
  const codes = normalizeCodes((req.body as { codes?: unknown } | undefined)?.codes, BULK_MAX_CODES)
  if (!codes) {
    sendJson(res, 400, { error: `Lista de códigos inválida (máximo ${BULK_MAX_CODES}).` })
    return
  }

  const results = await mapLimit(codes, CONCURRENCY, fetchOne)
  sendJson(res, 200, { results })
}

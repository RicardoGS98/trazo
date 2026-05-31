import type { VercelRequest, VercelResponse } from '@vercel/node'
import { BULK_MAX_CODES, checkBulkRateLimit, clientIp, isAllowedOrigin, normalizeCodes } from './_lib/guard.js'
import { fetchTrackingInfo, type TrackingInfo } from './_lib/upstream.js'

const MAX_BODY_BYTES = 4096
const CONCURRENCY = 5
const PER_CALL_TIMEOUT_MS = 8000

interface BulkItem {
  code: string
  ok: boolean
  status: number
  data?: TrackingInfo
}

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

/** Consulta un código con timeout; nunca lanza (resultado parcial). */
async function one(code: string): Promise<BulkItem> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PER_CALL_TIMEOUT_MS)
  try {
    const r = await fetchTrackingInfo(code, ctrl.signal)
    return { code, ok: r.ok, status: r.status, data: r.data }
  } catch {
    return { code, ok: false, status: 0 }
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
 * Refresco masivo: POST /api/tracking-bulk { codes: [...] } → un resultado
 * normalizado por código (parcial: los fallos no tumban el lote). Mismas
 * guardas que /api/tracking + rate limit propio (1/min) y tope de 10.
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

  const rl = await checkBulkRateLimit(clientIp(req))
  res.setHeader('X-RateLimit-Limit', String(rl.limit))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, rl.remaining)))
  if (!rl.ok) {
    const retry = rl.reset ? Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)) : 60
    res.setHeader('Retry-After', String(retry))
    sendJson(res, 429, { error: 'Solo puedes actualizar todos los envíos una vez por minuto.' })
    return
  }

  const codes = normalizeCodes((req.body as { codes?: unknown } | undefined)?.codes, BULK_MAX_CODES)
  if (!codes) {
    sendJson(res, 400, { error: `Lista de códigos inválida (máximo ${BULK_MAX_CODES}).` })
    return
  }

  const results = await mapLimit(codes, CONCURRENCY, one)
  sendJson(res, 200, { results })
}

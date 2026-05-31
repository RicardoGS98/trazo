import type { TrackingInfo } from '../types'
import { t } from './i18n'

/**
 * Integración con el backend. El navegador llama SIEMPRE same-origin para
 * evitar CORS; el proxy serverless consulta el API real y devuelve la forma
 * NORMALIZADA (TrackingInfo).
 *  - dev:  Vite proxya /api/tracking (ver vite.config.ts)
 *  - prod: funciones serverless api/tracking.ts y api/tracking-bulk.ts
 */
export async function fetchTracking(code: string): Promise<TrackingInfo> {
  const res = await fetch('/api/tracking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.trim() }),
  })
  if (!res.ok) {
    if (res.status === 429) throw new Error(t('error.rateLimitSingle'))
    if (res.status === 404) throw new Error(t('error.notFound'))
    throw new Error(t('error.lookupFailed'))
  }
  return (await res.json()) as TrackingInfo
}

/** Tope de envíos por lote en el refresco masivo (debe coincidir con el backend). */
export const BULK_MAX_CODES = 10

/** Resultado por código que devuelve /api/tracking-bulk. */
export interface BulkResult {
  code: string
  ok: boolean
  status: number
  data?: TrackingInfo
}

/**
 * Refresco masivo: envía varios códigos a POST /api/tracking-bulk y devuelve un
 * resultado por código (parcial: algunos pueden fallar sin tumbar el resto).
 */
export async function fetchTrackingBulk(codes: string[]): Promise<BulkResult[]> {
  const res = await fetch('/api/tracking-bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codes }),
  })
  if (!res.ok) {
    if (res.status === 429) throw new Error(t('error.bulkRateLimit'))
    throw new Error(t('error.bulkFailed'))
  }
  const json = (await res.json()) as { results?: BulkResult[] }
  return json.results ?? []
}

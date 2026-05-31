import type { TrackingResponse } from '../types'
import { t } from './i18n'

/**
 * Punto único de integración con el backend.
 * El navegador llama SIEMPRE a /api/tracking (mismo origen) para evitar CORS:
 *  - dev:  lo resuelve el server.proxy de Vite (ver vite.config.ts)
 *  - prod: lo resuelve la función serverless api/tracking.ts (Vercel)
 * Ambos reenvían el POST a emarket-services.com con el mismo cuerpo { code }.
 */
export async function fetchTracking(code: string): Promise<TrackingResponse> {
  const res = await fetch('/api/tracking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.trim() }),
  })
  if (!res.ok) {
    if (res.status === 429) throw new Error(t('error.rateLimitSingle'))
    throw new Error(t('error.lookupFailed'))
  }
  return (await res.json()) as TrackingResponse
}

/** Tope de envíos por lote en el refresco masivo (debe coincidir con el backend). */
export const BULK_MAX_CODES = 10

/** Resultado por código que devuelve /api/tracking-bulk. */
export interface BulkResult {
  code: string
  ok: boolean
  status: number
  data?: TrackingResponse
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

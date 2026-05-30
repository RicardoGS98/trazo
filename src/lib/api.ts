import type { TrackingResponse } from '../types'

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
    throw new Error('No se pudo consultar el envío. Inténtalo de nuevo.')
  }
  return (await res.json()) as TrackingResponse
}

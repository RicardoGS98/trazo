/**
 * Limitador de frecuencia en el cliente (ventana deslizante) persistido en
 * localStorage. Es una salvaguarda de UX, NO de seguridad: el límite real lo
 * impone el backend. Persistirlo evita que recargar la página resetee el límite.
 */
const PREFIX = 'trazo:rl:'

export const WINDOW = 60_000 // 1 minuto
export const SHIP_MAX = 3 // refrescos por envío y minuto
export const BULK_KEY = 'bulk'
export const shipKey = (hbl: string): string => `ship:${hbl}`

function read(key: string): number[] {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(arr) ? arr.filter((n): n is number => typeof n === 'number') : []
  } catch {
    return []
  }
}

function write(key: string, ts: number[]): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(ts))
  } catch {
    /* almacenamiento lleno/no disponible: el límite de cliente es best-effort */
  }
}

export interface RlState {
  ok: boolean
  /** ms hasta que se libere un hueco (0 si ok). */
  retryMs: number
}

/** ¿Queda hueco para una acción más en la ventana? */
export function check(key: string, max: number, windowMs = WINDOW): RlState {
  const now = Date.now()
  const hits = read(key).filter((t) => now - t < windowMs)
  if (hits.length < max) return { ok: true, retryMs: 0 }
  const oldest = Math.min(...hits)
  return { ok: false, retryMs: Math.max(0, oldest + windowMs - now) }
}

/** Registra una acción (llámalo al iniciar el refresco). */
export function record(key: string, windowMs = WINDOW): void {
  const now = Date.now()
  const hits = read(key).filter((t) => now - t < windowMs)
  hits.push(now)
  write(key, hits)
}

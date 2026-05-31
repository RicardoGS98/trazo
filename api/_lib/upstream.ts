/**
 * Cliente de los endpoints de tracking del carrier y normalización/FUSIÓN a una
 * forma estable (sin metadata interna). La usan /api/tracking y /api/tracking-bulk.
 *
 * Fusionamos DOS feeds del mismo carrier porque son complementarios:
 *  - GET  tracking/?hbl=…           → estructurado (códigos, fases con icono/color/
 *                                      step, bultos, is_delivered, timestamps UTC),
 *                                      pero refleja sobre todo el tramo origen/tránsito.
 *  - POST delivery_status_by_code/  → texto libre en español, SIN zona horaria (es
 *                                      hora de Cuba) y sin estructura, pero más FRESCO:
 *                                      el recorrido por Cuba (Habana → provincia →
 *                                      última milla → entregado).
 *
 * Reglas (acordadas con el usuario):
 *  1) Las fechas del POST se interpretan en hora de La Habana y se pasan a UTC.
 *  2) El estado actual lo determina el evento MÁS RECIENTE de la unión de ambos.
 *  3) Los estados se normalizan a códigos unificados (para traducir, deduplicar el
 *     hito compartido —p. ej. Entregado— y enriquecer con fase/color).
 */
const GET_BASE = 'https://emarket-services.com/api/orders/tracking/'
const POST_URL = 'https://emarket-services.com/api/orders/delivery_status_by_code/'

export interface Phase {
  code: string
  name: string
  icon: string
  color: string
  step: number
}

export interface TrackingEvent {
  statusCode: string
  statusName: string
  phase: Phase
  occurredAt: string
}

export interface TrackingInfo {
  hbl: string
  status: { code: string; name: string }
  phase: Phase
  isDelivered: boolean
  isPartiallyDelivered: boolean
  totalParcels: number
  deliveredParcels: number
  firstEventAt: string | null
  lastEventAt: string | null
  timeline: TrackingEvent[]
}

export interface FetchResult {
  ok: boolean
  status: number
  data?: TrackingInfo
}

// Tabla canónica de fases (para enriquecer eventos del POST, que no traen fase).
// Valores observados en respuestas reales del GET. Falta el step 3.
const PHASES: Record<string, Phase> = {
  ORIGIN: { code: 'ORIGIN', name: 'Origen', icon: '📦', color: '#7C3AED', step: 1 },
  IN_TRANSIT: { code: 'IN_TRANSIT', name: 'En Viaje', icon: '✈️', color: '#0284C7', step: 2 },
  DISTRIBUTION: { code: 'DISTRIBUTION', name: 'Distribución', icon: '🚛', color: '#DC2626', step: 4 },
  DELIVERED: { code: 'DELIVERED', name: 'Entregado', icon: '✅', color: '#059669', step: 5 },
}

interface RawPhase {
  code?: string
  name?: string
  icon?: string
  color?: string
  step?: number
}

function phaseOf(pd: RawPhase | null | undefined): Phase {
  return {
    code: pd?.code ?? '',
    name: pd?.name ?? '',
    icon: pd?.icon ?? '',
    color: pd?.color ?? '',
    step: pd?.step ?? 0,
  }
}

const ms = (s: string | null): number => (s ? new Date(s).getTime() || 0 : 0)

// --- Hora de Cuba → UTC -----------------------------------------------------

/** Offset de America/Havana en minutos para un instante dado (incluye DST). */
function havanaOffsetMinutes(utcMs: number): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Havana',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const p = dtf.formatToParts(new Date(utcMs))
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value)
  const asLocal = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asLocal - utcMs) / 60_000)
}

/**
 * Interpreta "YYYY-MM-DD HH:mm:ss" como hora local de La Habana y devuelve un ISO
 * en UTC (con Z). Determinista → clave de dedupe estable en IndexedDB. '' si no parsea.
 */
function havanaToUtcIso(raw: string): string {
  const m = String(raw).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (!m) return ''
  const asIfUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
  // wall-clock(Habana) = UTC + offset  ⇒  UTC = wall-clock - offset
  const offset = havanaOffsetMinutes(asIfUtc)
  return new Date(asIfUtc - offset * 60_000).toISOString()
}

// --- Normalización del estado libre del POST a código/fase unificados -------

/** minúsculas, sin acentos, sin paréntesis y espacios colapsados. */
function canon(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Mapea el texto libre del POST (lado Cuba) a { code, phase } unificados. */
function normalizePostStatus(raw: string): { code: string; phase: Phase } {
  const c = canon(raw)
  if (/entreg/.test(c)) return { code: 'DELIVERED', phase: PHASES.DELIVERED }
  if (/ultima milla|reparto/.test(c)) return { code: 'LAST_MILE', phase: PHASES.DISTRIBUTION }
  if (/deposito en provincia|en provincia/.test(c)) return { code: 'AT_PROVINCE_WAREHOUSE', phase: PHASES.DISTRIBUTION }
  if (/transporte.*prov|transito.*prov/.test(c)) return { code: 'TRANSPORT_TO_PROVINCE', phase: PHASES.DISTRIBUTION }
  if (/distribucion|almacen|habana/.test(c)) return { code: 'HAVANA_WAREHOUSE', phase: PHASES.DISTRIBUTION }
  return { code: '', phase: PHASES.DISTRIBUTION } // el POST es siempre lado-destino (Cuba)
}

// --- Llamadas a cada feed ---------------------------------------------------

interface GetParsed {
  hbl: string
  status: { code: string; name: string }
  phase: Phase
  isDelivered: boolean
  isPartiallyDelivered: boolean
  totalParcels: number
  deliveredParcels: number
  events: TrackingEvent[]
}

/** GET estructurado. Devuelve el status HTTP y los datos parseados (o null). */
async function fetchGet(code: string, signal?: AbortSignal): Promise<{ status: number; parsed: GetParsed | null }> {
  let r: Response
  try {
    r = await fetch(GET_BASE + '?hbl=' + encodeURIComponent(code), { signal })
  } catch {
    return { status: 0, parsed: null }
  }
  if (!r.ok) return { status: r.status, parsed: null }
  const j = (await r.json().catch(() => null)) as
    | { shipping_code?: string; summary?: Record<string, unknown>; timeline?: unknown[] }
    | null
  const s = j?.summary as Record<string, unknown> | undefined
  if (!s || !s.current_status) return { status: r.status, parsed: null }
  const timeline = Array.isArray(j?.timeline) ? (j!.timeline as Record<string, unknown>[]) : []
  return {
    status: r.status,
    parsed: {
      hbl: (j?.shipping_code as string) || code,
      status: { code: String(s.current_status), name: String(s.current_status_name ?? '') },
      phase: phaseOf(s.current_phase_display as RawPhase),
      isDelivered: !!s.is_delivered,
      isPartiallyDelivered: !!s.is_partially_delivered,
      totalParcels: Number(s.total_parcels ?? 0),
      deliveredParcels: Number(s.delivered_parcels ?? 0),
      events: timeline.map((e) => ({
        statusCode: String(e.status ?? ''),
        statusName: String(e.status_name ?? ''),
        phase: phaseOf(e.phase_display as RawPhase),
        occurredAt: String(e.occurred_at ?? ''),
      })),
    },
  }
}

/** POST (texto libre). Normaliza a eventos. Fail-soft: nunca lanza, [] si falla. */
async function fetchPostEvents(code: string, signal?: AbortSignal): Promise<TrackingEvent[]> {
  let td: Array<{ date?: string; status?: string }> = []
  try {
    const r = await fetch(POST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal,
    })
    if (!r.ok) return []
    const j = (await r.json().catch(() => null)) as Array<{ tracking_data?: typeof td }> | null
    const data = Array.isArray(j) ? j[0]?.tracking_data : undefined
    if (Array.isArray(data)) td = data
  } catch {
    return []
  }
  const out: TrackingEvent[] = []
  for (const e of td) {
    const occurredAt = havanaToUtcIso(String(e.date ?? ''))
    if (!occurredAt) continue
    const name = String(e.status ?? '').trim()
    const { code: statusCode, phase } = normalizePostStatus(name)
    out.push({ statusCode, statusName: name, phase, occurredAt })
  }
  return out
}

// --- Fusión -----------------------------------------------------------------

/**
 * Une los timelines del GET y del POST. Dedupe por código: si un hito aparece en
 * ambos (p. ej. Entregado), se conserva el MÁS RECIENTE y, a igualdad de fecha, el
 * que tenga fase con color (el del GET, estructurado). Los eventos sin código se
 * mantienen por nombre+fecha. Orden descendente por fecha.
 */
function mergeTimelines(getEvents: TrackingEvent[], postEvents: TrackingEvent[]): TrackingEvent[] {
  const byKey = new Map<string, TrackingEvent>()
  const keyOf = (e: TrackingEvent) => e.statusCode || `~${e.statusName}|${e.occurredAt}`
  for (const e of [...getEvents, ...postEvents]) {
    const k = keyOf(e)
    const cur = byKey.get(k)
    if (!cur) {
      byKey.set(k, e)
      continue
    }
    const newer = ms(e.occurredAt) > ms(cur.occurredAt)
    const tieRicher = ms(e.occurredAt) === ms(cur.occurredAt) && !!e.phase.color && !cur.phase.color
    if (newer || tieRicher) byKey.set(k, e)
  }
  return [...byKey.values()].sort((a, b) => ms(b.occurredAt) - ms(a.occurredAt))
}

/** Construye el TrackingInfo final a partir de los dos feeds. null si no hay nada. */
function buildInfo(code: string, get: GetParsed | null, postEvents: TrackingEvent[]): TrackingInfo | null {
  const getEvents = get?.events ?? []
  if (!get && postEvents.length === 0) return null

  const timeline = mergeTimelines(getEvents, postEvents)
  const newest = timeline[0]

  // Titular por recencia: lo manda el evento más reciente de la unión.
  const status = newest ? { code: newest.statusCode, name: newest.statusName } : get?.status ?? { code: '', name: '' }
  const phase = newest ? newest.phase : get?.phase ?? phaseOf(null)
  const isDelivered = newest?.statusCode === 'DELIVERED' || !!get?.isDelivered

  const totalParcels = get?.totalParcels ?? 0
  const deliveredParcels = isDelivered && totalParcels ? totalParcels : get?.deliveredParcels ?? 0

  return {
    hbl: get?.hbl || code,
    status,
    phase,
    isDelivered,
    isPartiallyDelivered: !!get?.isPartiallyDelivered,
    totalParcels,
    deliveredParcels,
    firstEventAt: timeline.length ? timeline[timeline.length - 1].occurredAt : null,
    lastEventAt: timeline.length ? timeline[0].occurredAt : null,
    timeline,
  }
}

/**
 * Consulta un HBL en AMBOS feeds (en paralelo) y devuelve la info fusionada y
 * normalizada. `ok:false` si ninguno aporta datos. Fail-open: si un feed falla,
 * se usa el otro.
 */
export async function fetchTrackingInfo(code: string, signal?: AbortSignal): Promise<FetchResult> {
  const [getRes, postEvents] = await Promise.all([fetchGet(code, signal), fetchPostEvents(code, signal)])
  const data = buildInfo(code, getRes.parsed, postEvents)
  if (!data) return { ok: false, status: getRes.status || 404 }
  return { ok: true, status: 200, data }
}

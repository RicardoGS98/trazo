/**
 * Cliente del endpoint de tracking del carrier y normalización de su respuesta
 * a una forma estable (sin metadata interna). La usan /api/tracking (single) y
 * /api/tracking-bulk (masivo).
 */
const BASE = 'https://emarket-services.com/api/orders/tracking/'

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

export interface FetchResult {
  ok: boolean
  status: number
  data?: TrackingInfo
}

/** Consulta un HBL y normaliza. `ok:false` si no existe o el upstream falla. */
export async function fetchTrackingInfo(code: string, signal?: AbortSignal): Promise<FetchResult> {
  let r: Response
  try {
    r = await fetch(BASE + '?hbl=' + encodeURIComponent(code), { signal })
  } catch {
    return { ok: false, status: 0 }
  }
  if (!r.ok) return { ok: false, status: r.status }
  const j = (await r.json().catch(() => null)) as
    | { shipping_code?: string; summary?: Record<string, unknown>; timeline?: unknown[] }
    | null
  const s = j?.summary as Record<string, unknown> | undefined
  if (!s || !s.current_status) return { ok: false, status: r.status } // no encontrado / vacío

  const timeline = Array.isArray(j?.timeline) ? (j!.timeline as Record<string, unknown>[]) : []
  const data: TrackingInfo = {
    hbl: (j?.shipping_code as string) || code,
    status: { code: String(s.current_status), name: String(s.current_status_name ?? '') },
    phase: phaseOf(s.current_phase_display as RawPhase),
    isDelivered: !!s.is_delivered,
    isPartiallyDelivered: !!s.is_partially_delivered,
    totalParcels: Number(s.total_parcels ?? 0),
    deliveredParcels: Number(s.delivered_parcels ?? 0),
    firstEventAt: (s.first_event_at as string) ?? null,
    lastEventAt: (s.last_event_at as string) ?? null,
    timeline: timeline.map((e) => ({
      statusCode: String(e.status ?? ''),
      statusName: String(e.status_name ?? ''),
      phase: phaseOf(e.phase_display as RawPhase),
      occurredAt: String(e.occurred_at ?? ''),
    })),
  }
  return { ok: true, status: 200, data }
}

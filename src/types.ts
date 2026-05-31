/** Fase del envío (datos de presentación que da el propio API). */
export interface Phase {
  code: string
  /** Nombre en español tal cual lo da el API (status_name / phase name). */
  name: string
  icon: string // emoji
  color: string // hex
  step: number
}

/** Un evento de la línea de tiempo. */
export interface TrackingEvent {
  statusCode: string
  statusName: string // español del API
  phase: Phase
  occurredAt: string // ISO 8601 en UTC
}

/**
 * Forma NORMALIZADA que devuelve el proxy (/api/tracking y /api/tracking-bulk),
 * derivada del endpoint nuevo del carrier. Sin metadata interna (manifiestos,
 * ids de oficina, etc.).
 */
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

/** Registro persistido en IndexedDB (un envío rastreado por el usuario). */
export interface Shipment {
  /** Código/HBL en mayúsculas — clave primaria del store. */
  hbl: string
  /** Nombre amigable editable por el usuario. */
  alias: string
  savedAt: number
  updatedAt: number
  /**
   * Datos normalizados del envío. Opcional: las entradas guardadas en el
   * formato antiguo no lo tienen hasta que se migran (auto-refresco al abrir).
   */
  info?: TrackingInfo
}

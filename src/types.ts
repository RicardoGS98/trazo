/** Formato exacto que devuelve el API de tracking (y la función proxy /api/tracking). */
export interface TrackingEvent {
  date: string
  /** Texto libre — puede ser cualquier estado. */
  status: string
}

export interface TrackingGroup {
  notes: string | null
  tracking_data: TrackingEvent[]
}

export type TrackingResponse = TrackingGroup[]

/** Registro persistido en IndexedDB (un envío rastreado por el usuario). */
export interface Shipment {
  /** Código/HBL en mayúsculas — clave primaria del store. */
  hbl: string
  /** Nombre amigable editable por el usuario. */
  alias: string
  savedAt: number
  updatedAt: number
  data: TrackingResponse
  /** Estado más reciente (cacheado para la lista de inicio). */
  latestStatus: string
  /** Fecha del evento más reciente, o null si no hay eventos. */
  latestDate: string | null
}

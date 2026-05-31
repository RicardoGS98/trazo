import { openDB } from 'idb'
import type { IDBPDatabase } from 'idb'
import type { Shipment, TrackingInfo, TrackingEvent } from '../types'

const DB_NAME = 'trazo'
const STORE = 'shipments'
const VERSION = 1

let dbp: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(DB_NAME, VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: 'hbl' })
        }
      },
    })
  }
  return dbp
}

export async function getAll(): Promise<Shipment[]> {
  const d = await db()
  return (await d.getAll(STORE)) as Shipment[]
}

export async function get(hbl: string): Promise<Shipment | undefined> {
  const d = await db()
  return (await d.get(STORE, hbl.toUpperCase())) as Shipment | undefined
}

const ms = (s: string | null): number => (s ? new Date(s).getTime() || 0 : 0)
const evKey = (e: TrackingEvent): string => `${e.statusCode}|${e.occurredAt}`

/**
 * Fusiona la info previa con la nueva SIN perder historial: el estado/fase/
 * bultos/fechas reflejan la respuesta nueva, pero el timeline es la UNIÓN de
 * eventos (dedupe por statusCode+fecha). Así, si el endpoint deja de devolver
 * etapas anteriores (p. ej. al entregarse), no se borran del historial.
 */
function mergeInfo(prev: TrackingInfo | undefined, next: TrackingInfo): TrackingInfo {
  if (!prev) return next
  const byKey = new Map<string, TrackingEvent>()
  for (const e of prev.timeline) byKey.set(evKey(e), e)
  for (const e of next.timeline) byKey.set(evKey(e), e) // los nuevos pisan a los viejos con misma clave
  const timeline = [...byKey.values()].sort((a, b) => ms(b.occurredAt) - ms(a.occurredAt))
  const firstA = ms(prev.firstEventAt)
  const firstB = ms(next.firstEventAt)
  return {
    ...next,
    firstEventAt: firstA && firstB ? (firstA <= firstB ? prev.firstEventAt : next.firstEventAt) : next.firstEventAt || prev.firstEventAt,
    lastEventAt: ms(next.lastEventAt) >= ms(prev.lastEventAt) ? next.lastEventAt : prev.lastEventAt,
    timeline,
  }
}

/** Inserta o actualiza un envío, fusionando el historial y conservando el alias. */
export async function upsert(hbl: string, info: TrackingInfo): Promise<Shipment> {
  const key = hbl.toUpperCase()
  const d = await db()
  const existing = (await d.get(STORE, key)) as Shipment | undefined
  const entry: Shipment = {
    hbl: key,
    alias: existing?.alias ?? '',
    savedAt: existing?.savedAt ?? Date.now(),
    updatedAt: Date.now(),
    info: mergeInfo(existing?.info, info),
  }
  await d.put(STORE, entry)
  return entry
}

export async function setAlias(hbl: string, alias: string): Promise<void> {
  const d = await db()
  const e = (await d.get(STORE, hbl.toUpperCase())) as Shipment | undefined
  if (e) {
    e.alias = alias
    await d.put(STORE, e)
  }
}

export async function remove(hbl: string): Promise<void> {
  const d = await db()
  await d.delete(STORE, hbl.toUpperCase())
}

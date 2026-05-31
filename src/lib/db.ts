import { openDB } from 'idb'
import type { IDBPDatabase } from 'idb'
import type { Shipment, TrackingInfo } from '../types'

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

/** Inserta o actualiza un envío con su info normalizada, conservando el alias. */
export async function upsert(hbl: string, info: TrackingInfo): Promise<Shipment> {
  const key = hbl.toUpperCase()
  const d = await db()
  const existing = (await d.get(STORE, key)) as Shipment | undefined
  const entry: Shipment = {
    hbl: key,
    alias: existing?.alias ?? '',
    savedAt: existing?.savedAt ?? Date.now(),
    updatedAt: Date.now(),
    info,
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

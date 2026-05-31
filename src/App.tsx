import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import type { Shipment } from './types'
import * as db from './lib/db'
import * as rl from './lib/rateLimit'
import { fetchTracking, fetchTrackingBulk, BULK_MAX_CODES } from './lib/api'
import { parseDate } from './lib/date'
import { Home } from './components/Home'
import { Detail } from './components/Detail'
import { Skeleton } from './components/Skeleton'
import { IconLock } from './components/Icons'

type View = 'home' | 'detail'

/** Epoch ms del último evento, o 0 si no hay (para ordenar). */
function ts(date: string | null): number {
  return date ? parseDate(date).getTime() : 0
}

export default function App() {
  const [view, setView] = useState<View>('home')
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [activeHbl, setActiveHbl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshingHbls, setRefreshingHbls] = useState<Set<string>>(() => new Set())
  const [bulkRefreshing, setBulkRefreshing] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastQuery, setLastQuery] = useState('')

  // Hidratar la lista desde IndexedDB al arrancar.
  useEffect(() => { void reload() }, [])

  // El mensaje de resultado del refresco masivo se desvanece solo.
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 5000)
    return () => clearTimeout(id)
  }, [flash])

  // Lista ordenada por "Actualizado hace" (fecha del último evento), desc.
  async function reload() {
    const all = await db.getAll()
    all.sort((a, b) => ts(b.latestDate) - ts(a.latestDate))
    setShipments(all)
  }

  async function lookup(code: string) {
    const c = (code || '').trim().toUpperCase()
    if (!c) return
    setError(null)
    setLastQuery(c)
    setLoading(true)
    setView('detail')
    try {
      const data = await fetchTracking(c)
      const events = data?.[0]?.tracking_data
      if (!data || !data.length || !events || !events.length) {
        throw new Error('No encontramos información para ese número HBL. Revisa que esté bien escrito.')
      }
      await db.upsert(c, data)
      await reload()
      setActiveHbl(c)
      setLoading(false)
    } catch (err) {
      setLoading(false)
      setView('home')
      setError(err instanceof Error ? err.message : 'No se pudo consultar el envío. Inténtalo de nuevo.')
    }
  }

  // Refresco de UN envío (Detalle y card comparten esto). Límite 3/min por HBL,
  // y no se dispara en vuelo ni sin conexión.
  async function refreshOne(hbl: string) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    if (refreshingHbls.has(hbl)) return
    if (!rl.check(rl.shipKey(hbl), rl.SHIP_MAX).ok) return
    rl.record(rl.shipKey(hbl))
    setRefreshingHbls((s) => new Set(s).add(hbl))
    try {
      const data = await fetchTracking(hbl)
      const events = data?.[0]?.tracking_data
      if (data && data.length && events && events.length) {
        await db.upsert(hbl, data)
        await reload()
      }
    } catch {
      /* refresco silencioso: si falla, conservamos lo que ya había */
    } finally {
      setRefreshingHbls((s) => {
        const n = new Set(s)
        n.delete(hbl)
        return n
      })
    }
  }

  // Refresco masivo: los más recientes de una vez (máx BULK_MAX_CODES). Límite
  // 1/min (cliente + servidor); off en vuelo / sin conexión / lista vacía.
  async function refreshAll() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    if (bulkRefreshing || !shipments.length) return
    if (!rl.check(rl.BULK_KEY, 1).ok) return
    rl.record(rl.BULK_KEY)
    setBulkRefreshing(true)
    setFlash(null)
    const codes = shipments.slice(0, BULK_MAX_CODES).map((s) => s.hbl)
    try {
      const results = await fetchTrackingBulk(codes)
      let ok = 0
      for (const r of results) {
        const events = r.data?.[0]?.tracking_data
        if (r.ok && r.data && events && events.length) {
          await db.upsert(r.code, r.data)
          ok++
        }
      }
      await reload()
      setFlash(`Actualizados ${ok} de ${codes.length} envíos.`)
    } catch (err) {
      setFlash(err instanceof Error ? err.message : 'No se pudieron actualizar los envíos.')
    } finally {
      setBulkRefreshing(false)
    }
  }

  function openSaved(hbl: string) {
    setActiveHbl(hbl)
    setError(null)
    setView('detail')
  }

  function back() {
    setView('home')
    setError(null)
    window.scrollTo({ top: 0 })
  }

  async function del(hbl: string) {
    await db.remove(hbl)
    await reload()
    setView('home')
  }

  async function saveAlias(hbl: string, alias: string) {
    await db.setAlias(hbl, alias)
    await reload()
  }

  const active = activeHbl ? shipments.find((s) => s.hbl === activeHbl) : undefined

  function renderContent() {
    if (view === 'detail' && loading) return <Skeleton onBack={back} />
    if (view === 'detail' && active) {
      return (
        <Detail
          key={active.hbl}
          shipment={active}
          refreshing={refreshingHbls.has(active.hbl)}
          onBack={back}
          onAlias={saveAlias}
          onRefresh={refreshOne}
          onDelete={del}
        />
      )
    }
    return (
      <Home
        shipments={shipments}
        error={error}
        lastQuery={lastQuery}
        onSearch={lookup}
        onOpen={openSaved}
        onRefreshOne={refreshOne}
        refreshingHbls={refreshingHbls}
        onRefreshAll={refreshAll}
        bulkRefreshing={bulkRefreshing}
        flash={flash}
      />
    )
  }

  return (
    <div className="shell">
      <div className="brand">
        <div className="brand-mark"><span></span></div>
        <div>
          <div className="brand-name">Trazo</div>
          <div className="brand-tag">Seguimiento de envíos</div>
        </div>
      </div>
      {renderContent()}
      <div className="foot">
        <span>
          <IconLock /> Tus envíos se guardan solo en este navegador
        </span>
      </div>
      <Analytics />
      <SpeedInsights />
    </div>
  )
}

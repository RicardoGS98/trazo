import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import type { Shipment } from './types'
import * as db from './lib/db'
import * as rl from './lib/rateLimit'
import { fetchTracking, fetchTrackingBulk, BULK_MAX_CODES } from './lib/api'
import { parseDate } from './lib/date'
import { t } from './lib/i18n'
import { Home } from './components/Home'
import { Detail } from './components/Detail'
import { Skeleton } from './components/Skeleton'
import { IconLock } from './components/Icons'

type View = 'home' | 'detail'

/** Clave de orden: epoch ms del último evento; cae a updatedAt si no hay info. */
function sortKey(s: Shipment): number {
  return s.info?.lastEventAt ? parseDate(s.info.lastEventAt).getTime() : s.updatedAt || 0
}

export default function App() {
  const [view, setView] = useState<View>('home')
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [activeHbl, setActiveHbl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshingHbls, setRefreshingHbls] = useState<Set<string>>(() => new Set())
  const [changedHbls, setChangedHbls] = useState<Set<string>>(() => new Set())
  const [bulkRefreshing, setBulkRefreshing] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastQuery, setLastQuery] = useState('')

  // Hidratar desde IndexedDB y migrar las entradas en formato antiguo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void init() }, [])

  // El mensaje de resultado del refresco masivo se desvanece solo.
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 5000)
    return () => clearTimeout(id)
  }, [flash])

  async function init() {
    await reload()
    await migrateStale()
  }

  // Lista ordenada por "Actualizado" (último evento), desc.
  async function reload() {
    const all = await db.getAll()
    all.sort((a, b) => sortKey(b) - sortKey(a))
    setShipments(all)
  }

  // Auto-actualiza al abrir los envíos guardados sin `info` (formato antiguo).
  async function migrateStale() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    const stale = (await db.getAll()).filter((s) => !s.info).slice(0, BULK_MAX_CODES)
    if (!stale.length) return
    await Promise.all(
      stale.map(async (s) => {
        try {
          const info = await fetchTracking(s.hbl)
          await db.upsert(s.hbl, info)
        } catch {
          /* se reintenta en la próxima carga o al refrescar */
        }
      }),
    )
    await reload()
  }

  // Resalta unos segundos los envíos cuyo estado acaba de cambiar.
  function markChanged(hbls: string[]) {
    if (!hbls.length) return
    setChangedHbls((prev) => {
      const n = new Set(prev)
      hbls.forEach((h) => n.add(h))
      return n
    })
    setTimeout(() => {
      setChangedHbls((prev) => {
        const n = new Set(prev)
        hbls.forEach((h) => n.delete(h))
        return n
      })
    }, 3500)
  }

  async function lookup(code: string) {
    const c = (code || '').trim().toUpperCase()
    if (!c) return
    setError(null)
    setLastQuery(c)
    setLoading(true)
    setView('detail')
    try {
      const info = await fetchTracking(c)
      await db.upsert(c, info)
      await reload()
      setActiveHbl(c)
      setLoading(false)
    } catch (err) {
      setLoading(false)
      setView('home')
      setError(err instanceof Error ? err.message : t('error.lookupFailed'))
    }
  }

  // Refresco de UN envío (Detalle y card). Límite 3/min por HBL; off en vuelo
  // o sin conexión. Resalta si el código de estado cambia.
  async function refreshOne(hbl: string) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    if (refreshingHbls.has(hbl)) return
    if (!rl.check(rl.shipKey(hbl), rl.SHIP_MAX).ok) return
    rl.record(rl.shipKey(hbl))
    const prev = shipments.find((s) => s.hbl === hbl)?.info?.status.code
    setRefreshingHbls((s) => new Set(s).add(hbl))
    try {
      const info = await fetchTracking(hbl)
      await db.upsert(hbl, info)
      await reload()
      if (prev !== undefined && info.status.code !== prev) markChanged([hbl])
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

  // Refresco masivo: los más recientes (máx BULK_MAX_CODES). Límite 1/min.
  async function refreshAll() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    if (bulkRefreshing || !shipments.length) return
    if (!rl.check(rl.BULK_KEY, 1).ok) return
    rl.record(rl.BULK_KEY)
    setBulkRefreshing(true)
    setFlash(null)
    const codes = shipments.slice(0, BULK_MAX_CODES).map((s) => s.hbl)
    const prev = new Map(shipments.map((s) => [s.hbl, s.info?.status.code]))
    try {
      const results = await fetchTrackingBulk(codes)
      const changed: string[] = []
      let ok = 0
      for (const r of results) {
        if (r.ok && r.data) {
          await db.upsert(r.code, r.data)
          if (prev.get(r.code) !== r.data.status.code) changed.push(r.code)
          ok++
        }
      }
      await reload()
      markChanged(changed)
      setFlash(t('flash.bulkResult', { ok, total: codes.length }))
    } catch (err) {
      setFlash(err instanceof Error ? err.message : t('flash.bulkError'))
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
          changed={changedHbls.has(active.hbl)}
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
        changedHbls={changedHbls}
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
          <div className="brand-tag">{t('brand.tag')}</div>
        </div>
      </div>
      {renderContent()}
      <div className="foot">
        <span>
          <IconLock /> {t('footer.privacy')}
        </span>
      </div>
      <Analytics />
      <SpeedInsights />
    </div>
  )
}

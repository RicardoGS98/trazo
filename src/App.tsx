import { useEffect, useState } from 'react'
import type { Shipment } from './types'
import * as db from './lib/db'
import { fetchTracking } from './lib/api'
import { Home } from './components/Home'
import { Detail } from './components/Detail'
import { Skeleton } from './components/Skeleton'
import { IconLock } from './components/Icons'

type View = 'home' | 'detail'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [activeHbl, setActiveHbl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastQuery, setLastQuery] = useState('')

  // Hidratar la lista desde IndexedDB al arrancar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void reload() }, [])

  async function reload() {
    const all = await db.getAll()
    all.sort((a, b) => (b.updatedAt || b.savedAt) - (a.updatedAt || a.savedAt))
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
      setActiveHbl(c.toUpperCase())
      setLoading(false)
    } catch (err) {
      setLoading(false)
      setView('home')
      setError(err instanceof Error ? err.message : 'No se pudo consultar el envío. Inténtalo de nuevo.')
    }
  }

  async function refresh() {
    if (!activeHbl) return
    setRefreshing(true)
    try {
      const data = await fetchTracking(activeHbl)
      const events = data?.[0]?.tracking_data
      if (data && data.length && events && events.length) {
        await db.upsert(activeHbl, data)
        await reload()
      }
    } catch {
      /* refrescar en silencio: si falla, conservamos lo que ya había */
    }
    setRefreshing(false)
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
          refreshing={refreshing}
          onBack={back}
          onAlias={saveAlias}
          onRefresh={refresh}
          onDelete={del}
        />
      )
    }
    return <Home shipments={shipments} error={error} lastQuery={lastQuery} onSearch={lookup} onOpen={openSaved} />
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
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { Shipment } from '../types'
import { parseDate, rel, isDelivered } from '../lib/date'
import { BULK_MAX_CODES } from '../lib/api'
import { IconSearch, IconChev, IconBox, IconAlert } from './Icons'
import { RefreshButton, BulkRefreshButton } from './RefreshButtons'

interface HomeProps {
  shipments: Shipment[]
  error: string | null
  lastQuery: string
  onSearch: (code: string) => void
  onOpen: (hbl: string) => void
  onRefreshOne: (hbl: string) => void
  refreshingHbls: Set<string>
  onRefreshAll: () => void
  bulkRefreshing: boolean
  flash: string | null
}

export function Home({
  shipments,
  error,
  lastQuery,
  onSearch,
  onOpen,
  onRefreshOne,
  refreshingHbls,
  onRefreshAll,
  bulkRefreshing,
  flash,
}: HomeProps) {
  const [q, setQ] = useState(error ? lastQuery : '')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (error) inputRef.current?.focus()
  }, [error])

  return (
    <>
      <div className="hero">
        <h1>
          Sigue tus envíos<br />en tiempo real.
        </h1>
        <p className="sub">Introduce tu número HBL y consulta el recorrido completo de tu paquete, paso a paso.</p>
        <form className="search" onSubmit={(e) => { e.preventDefault(); onSearch(q) }} autoComplete="off">
          <span className="ico"><IconSearch /></span>
          <input
            ref={inputRef}
            name="hbl"
            placeholder="Número HBL — ej. CM915528340AP"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            spellCheck={false}
          />
          <button className="btn-go" type="submit">Rastrear</button>
        </form>
        {error && (
          <div className="errbox" style={{ marginTop: 16 }}>
            <IconAlert />
            <div>{error}</div>
          </div>
        )}
      </div>

      <div className="sec-head">
        <div className="sec-title">Tus envíos</div>
        <div className="sec-actions">
          {shipments.length > 0 && (
            <BulkRefreshButton
              count={shipments.length}
              max={BULK_MAX_CODES}
              refreshing={bulkRefreshing}
              onRefreshAll={onRefreshAll}
            />
          )}
          <span className="sec-count">{shipments.length ? shipments.length : ''}</span>
        </div>
      </div>

      {flash && <div className="flash">{flash}</div>}

      {!shipments.length ? (
        <div className="empty">
          <div className="em-ico"><IconBox /></div>
          <p>
            Aún no has rastreado ningún envío.<br />Busca un HBL para empezar a seguirlo.
          </p>
        </div>
      ) : (
        <div className="list">
          {shipments.map((s) => {
            const d = s.latestDate ? parseDate(s.latestDate) : null
            const done = isDelivered(s.latestStatus)
            const dotCol = done ? 'var(--green)' : 'var(--accent)'
            return (
              <div key={s.hbl} className="ship">
                <button className="ship-open" onClick={() => onOpen(s.hbl)} aria-label={`Abrir ${s.alias || s.hbl}`}>
                  <span className="ship-head">
                    <span className="dot" style={{ background: dotCol }}></span>
                    <span className="ship-name">{s.alias || s.hbl}</span>
                  </span>
                  {s.alias && <span className="ship-code">{s.hbl}</span>}
                  <span className="ship-status">{s.latestStatus || '—'}</span>
                  <span className="ship-when">{d ? `Actualizado ${rel(d)}` : ''}</span>
                </button>
                <span className="ship-actions">
                  <RefreshButton
                    variant="card"
                    hbl={s.hbl}
                    refreshing={refreshingHbls.has(s.hbl)}
                    onRefresh={onRefreshOne}
                  />
                  <span className="chev"><IconChev /></span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

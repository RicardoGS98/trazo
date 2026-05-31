import { useState, useRef } from 'react'
import type { Shipment } from '../types'
import { parseDate, rel, isDelivered } from '../lib/date'
import { Timeline } from './Timeline'
import { RefreshButton } from './RefreshButtons'
import { IconBack, IconCopy, IconCheck, IconTrash, IconPencil } from './Icons'

interface DetailProps {
  shipment: Shipment
  refreshing: boolean
  onBack: () => void
  onAlias: (hbl: string, alias: string) => void
  onRefresh: (hbl: string) => void
  onDelete: (hbl: string) => void
}

export function Detail({ shipment, refreshing, onBack, onAlias, onRefresh, onDelete }: DetailProps) {
  const [alias, setAliasText] = useState(shipment.alias)
  const aliasRef = useRef<HTMLInputElement | null>(null)

  const events = [...(shipment.data[0]?.tracking_data ?? [])].sort(
    (a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime(),
  )
  const notes = shipment.data[0]?.notes
  const latest = events[0]
  const done = !!latest && isDelivered(latest.status)
  const latestDate = latest ? parseDate(latest.date) : null

  return (
    <>
      <button className="back" onClick={onBack}>
        <IconBack /> Volver
      </button>
      <div className="card">
        <div className="card-head">
          <div className="eyebrow">Envío</div>
          <div className="alias-row">
            <input
              ref={aliasRef}
              className="alias"
              value={alias}
              placeholder="Paquete con EcoFlow :)"
              aria-label="Nombre del envío (editable)"
              onChange={(e) => setAliasText(e.target.value)}
              onBlur={() => onAlias(shipment.hbl, alias.trim())}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            />
            <button
              type="button"
              className="alias-edit"
              aria-label="Editar nombre del envío"
              onClick={() => aliasRef.current?.focus()}
            >
              <IconPencil />
            </button>
          </div>
          <div className="hbl-row">
            <span className="hbl-pill">
              {shipment.hbl}
              <CopyButton value={shipment.hbl} />
            </span>
          </div>
          <div className="status-row">
            <span className={`badge ${done ? 'is-done' : ''}`}>
              <span className={done ? 'bd-dot' : 'pulse'}></span>
              {latest ? latest.status : 'Sin información'}
            </span>
          </div>
          <div className="upd" style={{ marginTop: 9 }}>
            {latestDate ? `Última actualización ${rel(latestDate)}` : ''}
          </div>
        </div>
        <div className="tl">
          {events.length ? (
            <Timeline events={events} done={done} />
          ) : (
            <div style={{ color: 'var(--faint)', padding: '20px 0', fontSize: 14 }}>Sin eventos de seguimiento.</div>
          )}
        </div>
        {notes && (
          <div className="notes">
            <b>Nota:</b> {notes}
          </div>
        )}
        <div className="card-foot">
          <RefreshButton variant="detail" hbl={shipment.hbl} refreshing={refreshing} onRefresh={onRefresh} />
          <button className="fbtn danger" onClick={() => onDelete(shipment.hbl)}>
            <IconTrash /> Quitar
          </button>
        </div>
      </div>
    </>
  )
}

function CopyButton({ value }: { value: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      className={`copy ${ok ? 'ok' : ''}`}
      title="Copiar"
      onClick={() => {
        navigator.clipboard?.writeText(value)
        setOk(true)
        setTimeout(() => setOk(false), 1400)
      }}
    >
      {ok ? <IconCheck /> : <IconCopy />}
    </button>
  )
}

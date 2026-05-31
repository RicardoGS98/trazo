import { useState, useRef } from 'react'
import type { Shipment } from '../types'
import { parseDate, rel } from '../lib/date'
import { statusName, phaseName, phaseChipStyle } from '../lib/status'
import { t } from '../lib/i18n'
import { Timeline } from './Timeline'
import { RefreshButton } from './RefreshButtons'
import { IconBack, IconCopy, IconCheck, IconTrash, IconPencil } from './Icons'

interface DetailProps {
  shipment: Shipment
  refreshing: boolean
  changed: boolean
  onBack: () => void
  onAlias: (hbl: string, alias: string) => void
  onRefresh: (hbl: string) => void
  onDelete: (hbl: string) => void
}

export function Detail({ shipment, refreshing, changed, onBack, onAlias, onRefresh, onDelete }: DetailProps) {
  const [alias, setAliasText] = useState(shipment.alias)
  const aliasRef = useRef<HTMLInputElement | null>(null)

  const info = shipment.info
  const events = info ? [...info.timeline].sort((a, b) => parseDate(b.occurredAt).getTime() - parseDate(a.occurredAt).getTime()) : []
  const delivered = !!info?.isDelivered
  const phase = info?.phase
  const lastDate = info?.lastEventAt ? parseDate(info.lastEventAt) : null
  const sName = info ? statusName(info.status.code, info.status.name) : t('detail.noInfo')
  const pName = phase ? phaseName(phase.code, phase.name) : ''
  const showPhase = !!phase?.code && pName !== sName

  return (
    <>
      <button className="back" onClick={onBack}>
        <IconBack /> {t('detail.back')}
      </button>
      <div className="card">
        <div className="card-head">
          <div className="eyebrow">{t('detail.eyebrow')}</div>
          <div className="alias-row">
            <input
              ref={aliasRef}
              className="alias"
              value={alias}
              placeholder={t('detail.aliasPlaceholder')}
              aria-label={t('detail.aliasAria')}
              onChange={(e) => setAliasText(e.target.value)}
              onBlur={() => onAlias(shipment.hbl, alias.trim())}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            />
            <button
              type="button"
              className="alias-edit"
              aria-label={t('detail.aliasEditAria')}
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
            <span
              className={`badge ${delivered ? 'is-done' : ''}${changed ? ' flash-change-badge' : ''}`}
              style={!delivered && phase?.color ? phaseChipStyle(phase.color) : undefined}
            >
              {delivered ? <span className="bd-emoji">{phase?.icon || '✅'}</span> : <span className="pulse"></span>}
              {sName}
            </span>
            {showPhase && (
              <span className="phase-chip lg" style={phaseChipStyle(phase!.color)}>
                {phase!.icon && <span className="pc-ico">{phase!.icon}</span>}
                {pName}
              </span>
            )}
          </div>
          {info && (
            <div className="parcels">
              📦 {info.totalParcels > 1 ? t('parcels.summary', { d: info.deliveredParcels, t: info.totalParcels }) : t('parcels.one')}
            </div>
          )}
          <div className="upd" style={{ marginTop: 9 }}>
            {lastDate ? t('detail.lastUpdate', { rel: rel(lastDate) }) : ''}
          </div>
        </div>
        <div className="tl">
          {events.length ? (
            <Timeline events={events} />
          ) : (
            <div style={{ color: 'var(--faint)', padding: '20px 0', fontSize: 14 }}>{t('detail.noEvents')}</div>
          )}
        </div>
        <div className="card-foot">
          {!delivered && <RefreshButton variant="detail" hbl={shipment.hbl} refreshing={refreshing} onRefresh={onRefresh} />}
          <button className="fbtn danger" onClick={() => onDelete(shipment.hbl)}>
            <IconTrash /> {t('detail.remove')}
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
      title={t('copy.title')}
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

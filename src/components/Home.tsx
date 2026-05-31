import { useEffect, useRef, useState } from 'react'
import type { Shipment } from '../types'
import { parseDate, rel } from '../lib/date'
import { statusName, phaseName, phaseChipStyle } from '../lib/status'
import { t } from '../lib/i18n'
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
  changedHbls: Set<string>
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
  changedHbls,
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
          {t('hero.title1')}<br />{t('hero.title2')}
        </h1>
        <p className="sub">{t('hero.sub')}</p>
        <form className="search" onSubmit={(e) => { e.preventDefault(); onSearch(q) }} autoComplete="off">
          <span className="ico"><IconSearch /></span>
          <input
            ref={inputRef}
            name="hbl"
            placeholder={t('search.placeholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            spellCheck={false}
          />
          <button className="btn-go" type="submit">{t('search.button')}</button>
        </form>
        {error && (
          <div className="errbox" style={{ marginTop: 16 }}>
            <IconAlert />
            <div>{error}</div>
          </div>
        )}
      </div>

      <div className="sec-head">
        <div className="sec-title">{t('list.title')}</div>
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
            {t('list.empty1')}<br />{t('list.empty2')}
          </p>
        </div>
      ) : (
        <div className="list">
          {shipments.map((s) => {
            const info = s.info
            const delivered = !!info?.isDelivered
            const phase = info?.phase
            const dotCol = delivered ? 'var(--green)' : phase?.color || 'var(--accent)'
            const updated = info?.lastEventAt ? parseDate(info.lastEventAt) : null
            const sName = info ? statusName(info.status.code, info.status.name) : '—'
            const pName = phase ? phaseName(phase.code, phase.name) : ''
            const showPhase = !!phase?.code && pName !== sName
            const showParcels = !!info && info.totalParcels > 1
            return (
              <div key={s.hbl} className="ship">
                <button className="ship-open" onClick={() => onOpen(s.hbl)} aria-label={t('card.openAria', { name: s.alias || s.hbl })}>
                  <span className="ship-head">
                    <span className="dot" style={{ background: dotCol }}></span>
                    <span className="ship-name">{s.alias || s.hbl}</span>
                  </span>
                  {s.alias && <span className="ship-code">{s.hbl}</span>}
                  <span className={`ship-status${delivered ? ' is-delivered' : ''}${changedHbls.has(s.hbl) ? ' flash-change' : ''}`}>
                    {delivered ? '✅ ' : ''}{sName}
                  </span>
                  {(showPhase || showParcels) && (
                    <span className="ship-meta">
                      {showPhase && (
                        <span className="phase-chip" style={phaseChipStyle(phase!.color)}>
                          {phase!.icon && <span className="pc-ico">{phase!.icon}</span>}
                          {pName}
                        </span>
                      )}
                      {showParcels && (
                        <span className="parcels-chip">📦 {info!.deliveredParcels}/{info!.totalParcels}</span>
                      )}
                    </span>
                  )}
                  <span className="ship-when">{updated ? t('card.updated', { rel: rel(updated) }) : ''}</span>
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

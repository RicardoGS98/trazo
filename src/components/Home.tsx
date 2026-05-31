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
  const [tab, setTab] = useState<'active' | 'delivered'>('active')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (error) inputRef.current?.focus()
  }, [error])

  const active = shipments.filter((s) => !s.info?.isDelivered)
  const delivered = shipments.filter((s) => s.info?.isDelivered)
  const list = tab === 'active' ? active : delivered

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
        {shipments.length > 0 && <span className="sec-count">{shipments.length}</span>}
      </div>

      {shipments.length === 0 ? (
        <div className="empty">
          <div className="em-ico"><IconBox /></div>
          <p>
            {t('list.empty1')}<br />{t('list.empty2')}
          </p>
        </div>
      ) : (
        <>
          <div className="tabs">
            <div className="tab-row">
              <button type="button" className={`tab ${tab === 'active' ? 'on' : ''}`} onClick={() => setTab('active')}>
                {t('tabs.active')} <span className="tab-n">{active.length}</span>
              </button>
              <button type="button" className={`tab ${tab === 'delivered' ? 'on' : ''}`} onClick={() => setTab('delivered')}>
                {t('tabs.delivered')} <span className="tab-n">{delivered.length}</span>
              </button>
            </div>
            {tab === 'active' && active.length > 0 && (
              <BulkRefreshButton
                count={active.length}
                max={BULK_MAX_CODES}
                refreshing={bulkRefreshing}
                onRefreshAll={onRefreshAll}
              />
            )}
          </div>

          {flash && <div className="flash">{flash}</div>}

          {list.length === 0 ? (
            <div className="empty">
              <div className="em-ico"><IconBox /></div>
              <p>{tab === 'active' ? t('tabs.emptyActive') : t('tabs.emptyDelivered')}</p>
            </div>
          ) : (
            <div className="list">
              {list.map((s) => {
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
                      {!delivered && (
                        <RefreshButton
                          variant="card"
                          hbl={s.hbl}
                          refreshing={refreshingHbls.has(s.hbl)}
                          onRefresh={onRefreshOne}
                        />
                      )}
                      <span className="chev"><IconChev /></span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </>
  )
}

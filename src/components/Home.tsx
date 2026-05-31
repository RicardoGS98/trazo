import { useEffect, useRef, useState } from 'react'
import type { Shipment } from '../types'
import { parseDate, rel, isDelivered } from '../lib/date'
import { translateStatus } from '../lib/status'
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
            const d = s.latestDate ? parseDate(s.latestDate) : null
            const done = isDelivered(s.latestStatus)
            const dotCol = done ? 'var(--green)' : 'var(--accent)'
            return (
              <div key={s.hbl} className="ship">
                <button className="ship-open" onClick={() => onOpen(s.hbl)} aria-label={t('card.openAria', { name: s.alias || s.hbl })}>
                  <span className="ship-head">
                    <span className="dot" style={{ background: dotCol }}></span>
                    <span className="ship-name">{s.alias || s.hbl}</span>
                  </span>
                  {s.alias && <span className="ship-code">{s.hbl}</span>}
                  <span className={`ship-status${changedHbls.has(s.hbl) ? ' flash-change' : ''}`}>
                    {translateStatus(s.latestStatus) || '—'}
                  </span>
                  <span className="ship-when">{d ? t('card.updated', { rel: rel(d) }) : ''}</span>
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

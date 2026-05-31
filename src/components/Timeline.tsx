import type { TrackingEvent } from '../types'
import { parseDate, fmtDate, fmtTime, hasTime } from '../lib/date'
import { statusName } from '../lib/status'

/** Timeline vertical: el evento más reciente primero (i === 0), destacado. */
export function Timeline({ events }: { events: TrackingEvent[] }) {
  return (
    <>
      {events.map((e, i) => {
        const d = parseDate(e.occurredAt)
        const latest = i === 0
        const c = e.phase.color
        const nodeStyle = c
          ? {
              borderColor: c,
              background: latest ? c : 'var(--surface)',
              boxShadow: latest ? `0 0 0 4px ${c}2e` : undefined,
            }
          : undefined
        return (
          <div key={i} className={`ev${latest ? ' latest' : ''} anim-in`} style={{ animationDelay: `${i * 45}ms` }}>
            <span className="node" style={nodeStyle}></span>
            <div className="ev-status">
              {e.phase.icon && <span className="ev-icon">{e.phase.icon}</span>}
              {statusName(e.statusCode, e.statusName)}
            </div>
            <div className="ev-date">
              <b>{fmtDate(d)}</b>
              {hasTime(e.occurredAt) && <> · {fmtTime(d)}</>}
            </div>
          </div>
        )
      })}
    </>
  )
}

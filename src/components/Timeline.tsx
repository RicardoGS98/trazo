import type { TrackingEvent } from '../types'
import { parseDate, fmtDate, fmtTime, hasTime } from '../lib/date'
import { translateStatus } from '../lib/status'

/** Timeline vertical: el evento más reciente primero (i === 0), destacado. */
export function Timeline({ events, done }: { events: TrackingEvent[]; done: boolean }) {
  return (
    <>
      {events.map((e, i) => {
        const d = parseDate(e.date)
        const cls = `ev${i === 0 ? ' latest' : ''}${i === 0 && done ? ' done' : ''} anim-in`
        return (
          <div key={i} className={cls} style={{ animationDelay: `${i * 45}ms` }}>
            <span className="node"></span>
            <div className="ev-status">{translateStatus(e.status)}</div>
            <div className="ev-date">
              <b>{fmtDate(d)}</b>
              {hasTime(e.date) && <> · {fmtTime(d)}</>}
            </div>
          </div>
        )
      })}
    </>
  )
}

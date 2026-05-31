import { useEffect, useState } from 'react'
import { IconRefresh, IconInfo } from './Icons'
import * as rl from '../lib/rateLimit'

/** navigator.onLine reactivo. */
function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

/** Re-renderiza cada segundo mientras `active` (para la cuenta atrás). */
function useSecondTick(active: boolean): void {
  const [, setN] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setN((n) => (n + 1) % 1_000_000), 1000)
    return () => window.clearInterval(id)
  }, [active])
}

interface RefreshButtonProps {
  hbl: string
  refreshing: boolean
  onRefresh: (hbl: string) => void
  variant: 'detail' | 'card'
}

/**
 * Botón de refresco de UN envío (Detalle y card). Deshabilitado mientras
 * actualiza, sin conexión, o si se superó el límite de 3/min para ese HBL
 * (compartido entre ambos sitios vía localStorage). Muestra cuenta atrás.
 */
export function RefreshButton({ hbl, refreshing, onRefresh, variant }: RefreshButtonProps) {
  const online = useOnline()
  const st = rl.check(rl.shipKey(hbl), rl.SHIP_MAX)
  const cooling = !st.ok
  useSecondTick(cooling)
  const secs = Math.ceil(st.retryMs / 1000)
  const disabled = refreshing || cooling || !online

  const title = !online
    ? 'Sin conexión'
    : cooling
      ? `Puedes actualizar de nuevo en ${secs}s (máx ${rl.SHIP_MAX}/min)`
      : 'Actualizar este envío'

  if (variant === 'card') {
    return (
      <button
        type="button"
        className={`ship-refresh ${refreshing ? 'spin' : ''}`}
        aria-label={title}
        title={title}
        disabled={disabled}
        onClick={() => onRefresh(hbl)}
      >
        {cooling && !refreshing ? <span className="rf-secs">{secs}</span> : <IconRefresh />}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`fbtn ${refreshing ? 'spin' : ''}`}
      title={title}
      disabled={disabled}
      onClick={() => onRefresh(hbl)}
    >
      <IconRefresh /> {refreshing ? 'Actualizando…' : cooling ? `Espera ${secs}s` : 'Actualizar'}
    </button>
  )
}

interface BulkRefreshButtonProps {
  count: number // nº de envíos en la lista
  max: number // máximo por lote
  refreshing: boolean
  onRefreshAll: () => void
}

/**
 * Botón "Actualizar todos" + icono de info con tooltip. Deshabilitado mientras
 * actualiza, sin conexión, lista vacía, o si se superó el límite de 1/min.
 */
export function BulkRefreshButton({ count, max, refreshing, onRefreshAll }: BulkRefreshButtonProps) {
  const online = useOnline()
  const [tipOpen, setTipOpen] = useState(false)
  const st = rl.check(rl.BULK_KEY, 1)
  const cooling = !st.ok
  useSecondTick(cooling)
  const secs = Math.ceil(st.retryMs / 1000)
  const disabled = refreshing || cooling || !online || count === 0

  const label = refreshing ? 'Actualizando…' : cooling ? `Espera ${secs}s` : 'Actualizar todos'
  const title = !online
    ? 'Sin conexión'
    : count === 0
      ? 'No hay envíos que actualizar'
      : cooling
        ? `Disponible de nuevo en ${secs}s (máx 1/min)`
        : `Actualiza los ${Math.min(count, max)} más recientes de una vez`

  return (
    <span className="bulk-wrap">
      <button
        type="button"
        className={`bulk-btn ${refreshing ? 'spin' : ''}`}
        title={title}
        disabled={disabled}
        onClick={onRefreshAll}
      >
        <IconRefresh /> {label}
      </button>
      <span className="info-wrap">
        <button
          type="button"
          className="info-btn"
          aria-label="Qué hace «Actualizar todos»"
          aria-expanded={tipOpen}
          onClick={() => setTipOpen((v) => !v)}
          onBlur={() => setTipOpen(false)}
        >
          <IconInfo />
        </button>
        <span className={`tip ${tipOpen ? 'open' : ''}`} role="tooltip">
          Actualiza de una vez los <b>{max} envíos más recientes</b> (por «Actualizado hace»).
          Máximo <b>1 vez por minuto</b>.
        </span>
      </span>
    </span>
  )
}

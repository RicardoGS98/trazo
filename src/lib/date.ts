const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Parsea "YYYY-MM-DD HH:mm:ss" (o ISO) a Date en hora local. */
export function parseDate(s: string): Date {
  const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (!m) return new Date(s)
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
}

export function fmtDate(d: Date): string {
  return `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Tiempo relativo en español ("hace 3 h", "ayer", ...). */
export function rel(d: Date): string {
  const diff = Date.now() - d.getTime()
  const min = 6e4, h = 36e5, day = 864e5
  if (diff < 0) return 'programado'
  if (diff < min) return 'ahora mismo'
  if (diff < h) return `hace ${Math.floor(diff / min)} min`
  if (diff < day) return `hace ${Math.floor(diff / h)} h`
  const days = Math.floor(diff / day)
  if (days === 1) return 'ayer'
  if (days < 30) return `hace ${days} días`
  const mo = Math.floor(days / 30)
  return `hace ${mo} ${mo === 1 ? 'mes' : 'meses'}`
}

/** Heurística para marcar un envío como entregado (solo afecta al color). */
export function isDelivered(status: string | null | undefined): boolean {
  return /entreg/i.test(status || '')
}

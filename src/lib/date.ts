import { locale } from './i18n'

const FULL = /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/
const DATE_ONLY = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/

/**
 * Fechas del API (asumidas en UTC):
 *  - con hora ("YYYY-MM-DD HH:mm:ss") → instante UTC (se mostrará en la zona
 *    horaria local del navegador).
 *  - solo fecha ("YYYY-MM-DD") → fecha de calendario (sin desplazamiento de día).
 */
export function parseDate(s: string): Date {
  const f = String(s).match(FULL)
  if (f) return new Date(Date.UTC(+f[1], +f[2] - 1, +f[3], +f[4], +f[5], +f[6]))
  const d = String(s).match(DATE_ONLY)
  if (d) return new Date(+d[1], +d[2] - 1, +d[3])
  return new Date(s)
}

/** ¿La cadena trae hora (no es solo fecha)? */
export function hasTime(s: string): boolean {
  return FULL.test(String(s))
}

// Formateadores según el locale del navegador (incluye región y, por defecto,
// la zona horaria local del navegador).
const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' })
const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })

export function fmtDate(d: Date): string {
  return dateFmt.format(d)
}

export function fmtTime(d: Date): string {
  return timeFmt.format(d)
}

/** Tiempo relativo localizado ("3h ago" / "hace 3 h", "yesterday" / "ayer", …). */
export function rel(d: Date): string {
  const sec = (d.getTime() - Date.now()) / 1000
  const abs = Math.abs(sec)
  if (abs < 60) return rtf.format(Math.round(sec), 'second')
  const min = sec / 60
  if (Math.abs(min) < 60) return rtf.format(Math.round(min), 'minute')
  const hr = min / 60
  if (Math.abs(hr) < 24) return rtf.format(Math.round(hr), 'hour')
  const day = hr / 24
  if (Math.abs(day) < 30) return rtf.format(Math.round(day), 'day')
  const mo = day / 30
  if (Math.abs(mo) < 12) return rtf.format(Math.round(mo), 'month')
  return rtf.format(Math.round(mo / 12), 'year')
}

/** Heurística para marcar un envío como entregado (solo afecta al color). */
export function isDelivered(status: string | null | undefined): boolean {
  return /entreg|deliver/i.test(status || '')
}

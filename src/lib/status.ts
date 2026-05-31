import { lang } from './i18n'

/**
 * Traducción por CÓDIGO (estable) del endpoint nuevo. En español usamos el
 * nombre que ya da el API; en inglés, nuestro mapa por código con fallback al
 * nombre del API si el código aún no está mapeado. Amplía los mapas según
 * aparezcan nuevos códigos.
 */
const STATUS_EN: Record<string, string> = {
  BRANCH_PROCESSING: 'Processing at Branch',
  CARRIER_RECEIVED: 'Received by Carrier',
  READY_FOR_DISPATCH: 'Ready for Dispatch',
  READY_FOR_INTERNATIONAL_DISPATCH: 'Ready for International Dispatch',
  IN_TRANSIT_TO_HUB: 'In Transit to Hub',
  AT_DISTRIBUTION_CENTER: 'At Distribution Center',
  DELIVERED: 'Delivered',
}

// Fases conocidas (por step): 1 Origen, 2 En Viaje, 4 Distribución, 5 Entregado.
// (El step 3 aún no lo hemos visto.)
const PHASE_EN: Record<string, string> = {
  ORIGIN: 'Origin',
  IN_TRANSIT: 'In Transit',
  DISTRIBUTION: 'Distribution',
  DELIVERED: 'Delivered',
}

/** Nombre del estado en el idioma activo. */
export function statusName(code: string, apiName: string): string {
  if (lang !== 'en') return apiName
  return STATUS_EN[code] || apiName
}

/** Nombre de la fase en el idioma activo. */
export function phaseName(code: string, apiName: string): string {
  if (lang !== 'en') return apiName
  return PHASE_EN[code] || apiName
}

/** Tinte suave (texto/fondo/borde) a partir del color hex de la fase. */
export function phaseChipStyle(color: string) {
  if (!color) return { color: 'var(--accent-strong)', background: 'var(--accent-soft)', borderColor: 'transparent' }
  return { color, background: `${color}14`, borderColor: `${color}33` }
}

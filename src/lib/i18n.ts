/**
 * i18n mínimo (sin dependencias). El idioma se fija una vez al cargar, según el
 * navegador: es → español, en → inglés, cualquier otro → inglés (por defecto).
 *  - `lang`   ('es' | 'en'): bucket de cadenas de UI.
 *  - `locale` (BCP-47): para Intl (fecha/hora/relativo). Regional si es/en
 *    (en-US, en-GB, es-ES…); para "otro" se usa 'en' (no el locale extranjero).
 */
type Lang = 'es' | 'en'

function detect(): { lang: Lang; locale: string } {
  const raw =
    (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || 'en'
  const primary = raw.toLowerCase().split('-')[0]
  if (primary === 'es') return { lang: 'es', locale: raw }
  if (primary === 'en') return { lang: 'en', locale: raw }
  return { lang: 'en', locale: 'en' }
}

const detected = detect()
export const lang: Lang = detected.lang
export const locale: string = detected.locale

if (typeof document !== 'undefined') document.documentElement.lang = lang

type Dict = Record<string, string>

const EN: Dict = {
  'brand.tag': 'Shipment tracking',
  'footer.privacy': 'Your shipments are saved only in this browser',

  'hero.title1': 'Track your shipments',
  'hero.title2': 'in real time.',
  'hero.sub': "Enter your HBL number and check your package's full journey, step by step.",
  'search.placeholder': 'HBL number — e.g. CM915528340AP',
  'search.button': 'Track',

  'list.title': 'Your shipments',
  'list.empty1': "You haven't tracked any shipments yet.",
  'list.empty2': 'Search for an HBL to start tracking it.',
  'card.openAria': 'Open {name}',
  'card.updated': 'Updated {rel}',

  'bulk.button': 'Refresh all',
  'bulk.refreshing': 'Refreshing…',
  'bulk.infoAria': 'What does «Refresh all» do',
  'bulk.tooltip': 'Refreshes the {max} most recent shipments at once (by «Updated»). At most once per minute.',
  'bulk.titleEmpty': 'No shipments to refresh',
  'bulk.titleCooling': 'Available again in {s}s (max 1/min)',
  'bulk.titleReady': 'Refresh the {n} most recent at once',

  'refresh.button': 'Refresh',
  'refresh.refreshing': 'Refreshing…',
  'refresh.titleReady': 'Refresh this shipment',
  'refresh.titleCooling': 'You can refresh again in {s}s (max {max}/min)',

  'common.offline': 'Offline',
  'common.wait': 'Wait {s}s',

  'flash.bulkResult': 'Updated {ok} of {total} shipments.',
  'flash.bulkError': "Couldn't refresh the shipments.",

  'detail.back': 'Back',
  'detail.eyebrow': 'Shipment',
  'detail.aliasPlaceholder': 'Package with EcoFlow :)',
  'detail.aliasAria': 'Shipment name (editable)',
  'detail.aliasEditAria': 'Edit shipment name',
  'detail.noInfo': 'No information',
  'detail.lastUpdate': 'Last updated {rel}',
  'detail.noEvents': 'No tracking events.',
  'detail.note': 'Note:',
  'detail.remove': 'Remove',
  'copy.title': 'Copy',

  'error.rateLimitSingle': 'Too many lookups in a row. Wait a few seconds and try again.',
  'error.lookupFailed': "Couldn't look up the shipment. Try again.",
  'error.notFound': "We couldn't find information for that HBL number. Check that it's spelled correctly.",
  'error.bulkRateLimit': 'You can only refresh all shipments once per minute. Wait a moment.',
  'error.bulkFailed': "Couldn't refresh the shipments. Try again.",
}

const ES: Dict = {
  'brand.tag': 'Seguimiento de envíos',
  'footer.privacy': 'Tus envíos se guardan solo en este navegador',

  'hero.title1': 'Sigue tus envíos',
  'hero.title2': 'en tiempo real.',
  'hero.sub': 'Introduce tu número HBL y consulta el recorrido completo de tu paquete, paso a paso.',
  'search.placeholder': 'Número HBL — ej. CM915528340AP',
  'search.button': 'Rastrear',

  'list.title': 'Tus envíos',
  'list.empty1': 'Aún no has rastreado ningún envío.',
  'list.empty2': 'Busca un HBL para empezar a seguirlo.',
  'card.openAria': 'Abrir {name}',
  'card.updated': 'Actualizado {rel}',

  'bulk.button': 'Actualizar todos',
  'bulk.refreshing': 'Actualizando…',
  'bulk.infoAria': 'Qué hace «Actualizar todos»',
  'bulk.tooltip': 'Actualiza de una vez los {max} envíos más recientes (por «Actualizado»). Como máximo 1 vez por minuto.',
  'bulk.titleEmpty': 'No hay envíos que actualizar',
  'bulk.titleCooling': 'Disponible de nuevo en {s}s (máx 1/min)',
  'bulk.titleReady': 'Actualiza los {n} más recientes de una vez',

  'refresh.button': 'Actualizar',
  'refresh.refreshing': 'Actualizando…',
  'refresh.titleReady': 'Actualizar este envío',
  'refresh.titleCooling': 'Puedes actualizar de nuevo en {s}s (máx {max}/min)',

  'common.offline': 'Sin conexión',
  'common.wait': 'Espera {s}s',

  'flash.bulkResult': 'Actualizados {ok} de {total} envíos.',
  'flash.bulkError': 'No se pudieron actualizar los envíos.',

  'detail.back': 'Volver',
  'detail.eyebrow': 'Envío',
  'detail.aliasPlaceholder': 'Paquete con EcoFlow :)',
  'detail.aliasAria': 'Nombre del envío (editable)',
  'detail.aliasEditAria': 'Editar nombre del envío',
  'detail.noInfo': 'Sin información',
  'detail.lastUpdate': 'Última actualización {rel}',
  'detail.noEvents': 'Sin eventos de seguimiento.',
  'detail.note': 'Nota:',
  'detail.remove': 'Quitar',
  'copy.title': 'Copiar',

  'error.rateLimitSingle': 'Demasiadas consultas seguidas. Espera unos segundos e inténtalo de nuevo.',
  'error.lookupFailed': 'No se pudo consultar el envío. Inténtalo de nuevo.',
  'error.notFound': 'No encontramos información para ese número HBL. Revisa que esté bien escrito.',
  'error.bulkRateLimit': 'Solo puedes actualizar todos los envíos una vez por minuto. Espera un poco.',
  'error.bulkFailed': 'No se pudieron actualizar los envíos. Inténtalo de nuevo.',
}

const DICT: Record<Lang, Dict> = { en: EN, es: ES }

/** Traduce `key` al idioma activo, interpolando {params}. */
export function t(key: string, params?: Record<string, string | number>): string {
  let s = DICT[lang][key] ?? EN[key] ?? key
  if (params) {
    for (const k in params) s = s.replace(`{${k}}`, String(params[k]))
  }
  return s
}

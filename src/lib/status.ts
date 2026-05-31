import { lang } from './i18n'

/**
 * Traducción del texto de estado del envío, que llega del API en español.
 * La clave del mapa es el texto "normalizado": minúsculas, sin tildes/acentos,
 * espacios colapsados y recortados; se conservan paréntesis y demás signos.
 * Así "Depósito de Distribución (Almacén La Habana)" →
 * "deposito de distribucion (almacen la habana)".
 */
export function normalizeStatus(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // quita tildes/acentos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

// es → en. Añade aquí nuevos estados según vayan apareciendo.
const STATUS_EN: Record<string, string> = {
  'en proceso de aduana': 'In Customs Processing',
  'deposito de distribucion (almacen la habana)': 'Distribution Warehouse (Havana Warehouse)',
}

/**
 * Traduce un estado al inglés solo si la UI está en inglés y está mapeado;
 * en cualquier otro caso devuelve el texto original tal cual.
 */
export function translateStatus(status: string | null | undefined): string {
  const s = status ?? ''
  if (lang !== 'en' || !s) return s
  return STATUS_EN[normalizeStatus(s)] ?? s
}

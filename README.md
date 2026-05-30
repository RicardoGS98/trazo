# Trazo · Seguimiento de envíos

SPA 100% client-side para rastrear envíos por número **HBL/código**. El historial de envíos
consultados se guarda **solo en tu navegador** con **IndexedDB** — no hay cuentas ni backend propio
de datos. La única llamada de red consulta el estado de un envío.

Diseño basado en el prototipo "Trazo" de Claude Design: estética minimalista, fondo papel cálido,
acento teal, tipografía Hanken Grotesk + JetBrains Mono y un timeline vertical de estados.

## Stack

- **React + Vite + TypeScript**
- **IndexedDB** vía [`idb`](https://github.com/jakearchibald/idb) para el historial
- **Función serverless** (Vercel) como proxy del API

## Arquitectura: la petición y CORS

El API público de tracking responde correctamente desde curl/Postman, pero **no envía cabeceras
CORS**, así que un navegador bloquea la llamada directa. Por eso el SPA llama siempre a
`POST /api/tracking` (mismo origen) y un proxy reenvía la petición al API real desde el servidor:

- **Desarrollo:** lo resuelve `server.proxy` de Vite (ver `vite.config.ts`).
- **Producción:** lo resuelve la función `api/tracking.ts` en Vercel.

Ambos reenvían a `POST https://emarket-services.com/api/orders/delivery_status_by_code/` con el cuerpo
`{ "code": "..." }`. Formato de respuesta:

```json
[ { "notes": null, "tracking_data": [ { "date": "2026-05-28 20:06:47", "status": "..." } ] } ]
```

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173  (el proxy de Vite evita CORS)
```

Prueba con el código de ejemplo `CM915528340AP`. El historial persiste en
DevTools → Application → IndexedDB → `trazo` → `shipments`.

```bash
npm run build    # comprobación de tipos + bundle de producción en dist/
npm run preview  # sirve el build de producción
```

## Despliegue (Vercel)

1. Sube el repo a GitHub (ya hecho: `RicardoGS98/trazo`).
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa `RicardoGS98/trazo`.
3. Framework **Vite** autodetectado; la función `api/tracking.ts` se despliega sola. Sin variables
   de entorno.
4. Cada push a `main` redepliega automáticamente.

> El proxy honra la idea de "una sola petición": el navegador hace una única llamada (a
> `/api/tracking`); el reenvío al API real ocurre del lado servidor para esquivar CORS.

## Estructura

```
api/tracking.ts          función proxy serverless (Vercel)
src/lib/api.ts           fetchTracking(code) → POST /api/tracking
src/lib/db.ts            wrapper de IndexedDB (idb)
src/lib/date.ts          formato de fechas y tiempo relativo
src/components/          Home, Detail, Timeline, Skeleton, Icons
src/App.tsx              máquina de estados (inicio / detalle)
```

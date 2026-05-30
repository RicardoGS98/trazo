import type { VercelRequest, VercelResponse } from '@vercel/node'

const UPSTREAM = 'https://emarket-services.com/api/orders/delivery_status_by_code/'

/**
 * Proxy serverless. El navegador llama same-origin a POST /api/tracking { code }
 * (sin CORS) y aquí reenviamos el POST al API real desde el servidor, donde CORS
 * no aplica. Devolvemos la respuesta tal cual:
 *   [ { "notes": null, "tracking_data": [ { "date", "status" } ] } ]
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const code = (req.body as { code?: string } | undefined)?.code
  if (!code) {
    res.status(400).json({ error: 'Falta el campo "code".' })
    return
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch {
    res.status(502).json({ error: 'No se pudo contactar con el servicio de envíos.' })
  }
}

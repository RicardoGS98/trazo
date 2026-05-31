import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Inyecta el CSS emitido como <style> dentro de index.html y borra el <link>
// render-blocking. El CSS de la app es pequeño (~4 KiB) → inlinearlo quita una
// petición del camino crítico (mejor FCP/LCP). Solo en build.
function inlineCss(): Plugin {
  return {
    name: 'inline-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find((a) => a.type === 'asset' && a.fileName === 'index.html')
      if (!html || html.type !== 'asset' || typeof html.source !== 'string') return
      let src = html.source
      for (const key of Object.keys(bundle)) {
        const a = bundle[key]
        if (a.type !== 'asset' || !a.fileName.endsWith('.css')) continue
        const css = typeof a.source === 'string' ? a.source : Buffer.from(a.source).toString('utf8')
        const escaped = a.fileName.replace(/[.+*?(){}[\]^$|]/g, '\\$&')
        const linkRe = new RegExp(`<link[^>]*href="[^"]*${escaped}"[^>]*>`, 'g')
        const before = src
        src = src.replace(linkRe, `<style>${css}</style>`)
        if (src !== before) delete bundle[key] // ya inlineado → no emitir el .css suelto
      }
      html.source = src
    },
  }
}

// Reescribe /api/tracking al API real (server-side → sin CORS). Mismo proxy en dev y preview.
const proxy = {
  '/api/tracking': {
    target: 'https://emarket-services.com',
    changeOrigin: true,
    rewrite: () => '/api/orders/delivery_status_by_code/',
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), inlineCss()],
  // Alias a Preact (preact/compat): mismo código React, bundle mucho más ligero.
  resolve: {
    alias: [
      { find: /^react$/, replacement: 'preact/compat' },
      { find: /^react-dom$/, replacement: 'preact/compat' },
      { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
      { find: /^react\/jsx-dev-runtime$/, replacement: 'preact/jsx-dev-runtime' },
      { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
    ],
  },
  server: { proxy },
  preview: { proxy },
})

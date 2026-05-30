import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  plugins: [react()],
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

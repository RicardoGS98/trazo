import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // En desarrollo, /api/tracking se reenvía al API real desde Node (sin CORS).
      // En producción lo resuelve la función serverless api/tracking.ts de Vercel.
      '/api/tracking': {
        target: 'https://emarket-services.com',
        changeOrigin: true,
        rewrite: () => '/api/orders/delivery_status_by_code/',
      },
    },
  },
})

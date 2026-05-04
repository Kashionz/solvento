import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@mantine/charts') || id.includes('recharts')) {
              return 'vendor-charts'
            }
            if (
              id.includes('@mantine/core') ||
              id.includes('@mantine/form') ||
              id.includes('@mantine/hooks') ||
              id.includes('@mantine/notifications')
            ) {
              return 'vendor-mantine'
            }
            if (
              id.includes('@tanstack/react-query') ||
              id.includes('dayjs') ||
              id.includes('zod')
            ) {
              return 'vendor-data'
            }
            if (
              id.includes('react-router-dom') ||
              id.includes('react-dom') ||
              id.includes('/react/')
            ) {
              return 'vendor-react'
            }
          }

          return undefined
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 3000,
  },
})

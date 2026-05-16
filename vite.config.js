import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendors into their own chunks so:
        //   - recharts (only used on /reports) doesn't bloat the initial load
        //   - react/react-router stays cached across deploys that only touch
        //     app code, since their hashes don't change when our source does
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-')) return 'recharts'
            if (id.includes('decimal.js')) return 'decimal'
            if (id.includes('react-router')) return 'react-router'
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('scheduler')) return 'react'
          }
          return undefined
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
  },
})

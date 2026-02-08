import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3005',
      '/health': 'http://localhost:3005',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large vendor libraries into their own chunks
          react: ['react', 'react-dom'],
          lucide: ['lucide-react'],
        },
      },
    },
    // Warn at 500 KB instead of the default 500 KB (just making it explicit)
    chunkSizeWarningLimit: 500,
  },
})

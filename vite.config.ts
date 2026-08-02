/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
interface BackendConfig { baseUrl: string, skinlibUrl: string }
const backendConfig: BackendConfig = JSON.parse(
  readFileSync(resolve(__dirname, 'config/backend-dev.json'), 'utf-8')
)
const backendTarget = backendConfig.baseUrl.replace(/\/$/, '')

// Paths that should be served by Vite (HMR, source files, public assets, etc.)
// and not proxied to the backend.
const isViteInternal = (path: string) => {
  // Strip query string for prefix matching.
  const p = path.split('?')[0]
  if (p === '/' || p === '') return false
  if (p.startsWith('/@')) return true // /@vite, /@id, /@react-refresh, ...
  if (p === '/node_modules' || p.startsWith('/node_modules/')) return true
  if (p === '/src' || p.startsWith('/src/')) return true
  if (p.startsWith('/__')) return true // /__vite, /__open-in-editor, ...
  // Known static public assets.
  if (p === '/favicon' || p === '/favicon.ico' || p.startsWith('/favicon.')) return true
  if (p === '/logo.svg') return true
  if (p === '/revolution.png') return true
  // Anything else with a file extension is treated as a static asset
  // and handled by Vite (e.g. /assets/index.js).
  if (/\.[a-zA-Z0-9]+$/.test(p)) return true
  return false
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mui-core': ['@mui/material', '@emotion/react', '@emotion/styled'],
          'mui-icons': ['@mui/icons-material'],
          'skinview3d-vendor': ['skinview3d']
        }
      }
    }
  },
  server: {
    proxy: {
      // Reverse proxy: forward all non-Vite requests to the backend
      // configured in config/backend-dev.json, so the frontend can use
      // same-origin (relative) URLs in dev and avoid CORS issues.
      '^/': {
        target: backendTarget,
        changeOrigin: true,
        secure: true,
        bypass: (req) => {
          const path = req.url || '/'
          // Let Vite's own middlewares handle internal asset / HMR requests.
          if (isViteInternal(path)) return path
          // Let Vite's SPA fallback handle HTML navigation requests.
          if (req.headers.accept?.includes('text/html')) return '/index.html'
          // Otherwise, proxy the request to the backend.
          return undefined
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true
  }
})
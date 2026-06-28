import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
      '/relay.php': {
        target: 'https://hrpauth.samuelcheston.com', // 你的目标后端
        changeOrigin: true,

        // 🔥 关键：把 /relay.php 去掉，后面的路径原样透传
        rewrite: (path) => path.replace(/^\/relay\.php/, '')
      }
    }
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [tailwindcss(), react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    // Allow cross-origin access to the Vite development server.
    cors: true,

    // Proxy API requests to the production API.
    proxy: {
      '/api': {
        target: 'https://veriflow.talhahun.io',
        changeOrigin: true,
        secure: true,
      },
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-mui': [
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            '@emotion/styled',
          ],
          'vendor-charts': ['echarts', 'echarts-for-react'],
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-utils': ['axios', 'zod', 'zustand', 'react-hook-form'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})

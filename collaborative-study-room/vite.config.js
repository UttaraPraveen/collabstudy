import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', 
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Collaborative Study Room',
        short_name: 'ClockedIn',
        description: 'AI-Powered Collaborative Study Workspace',
        theme_color: '#0d0618', 
        background_color: '#0d0618',
        display: 'standalone', 
        
        // 1. FIXED ICON NAMES HERE
        icons: [
          {
            src: 'web-app-manifest-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        
        // 2. ADDED SCREENSHOTS TO CLEAR WARNINGS
        screenshots: [
          {
            src: "screenshot-desktop.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide"
          },
          {
            src: "screenshot-mobile.png",
            sizes: "720x1280",
            type: "image/png"
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 8000000 
      }
    })
  ],
  // 👇 ADDED SERVER PROXY HERE 👇
  server: {
    proxy: {
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, '')
      }
    }
  },
  // 👆 END SERVER PROXY 👆
  build: {
    chunkSizeWarningLimit: 1500, 
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'firebase';
            if (id.includes('@zegocloud')) return 'zegocloud';
          }
        }
      }
    }
  }
})
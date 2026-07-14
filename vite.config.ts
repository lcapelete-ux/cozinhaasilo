import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/cozinhaasilo/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // O app abre mesmo sem internet: o service worker guarda o "app shell"
      // (HTML/JS/CSS/ícones) em cache. Os dados continuam vindo do cache offline
      // do Firestore (ver firebaseService.ts).
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,mp3}'],
        // Mantém os handlers de Web Push (alerta de estoque) dentro do SW do PWA.
        importScripts: ['push-sw.js'],
        // SPA: qualquer navegação offline cai no index.html cacheado.
        navigateFallback: '/cozinhaasilo/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Arraiá do Lar São Cristóvão',
        short_name: 'Arraiá',
        description: 'Sistema de gestão de pedidos — funciona offline',
        lang: 'pt-BR',
        start_url: '/cozinhaasilo/',
        scope: '/cozinhaasilo/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F5F5F0',
        theme_color: '#E67E22',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
  },
})

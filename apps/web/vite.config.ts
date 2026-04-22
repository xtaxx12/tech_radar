import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // prompt: pedimos confirmación al usuario antes de recargar con nueva versión
      // (en vez de autoUpdate que podría interrumpir en medio del form de /api).
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tech Radar LATAM',
        short_name: 'Tech Radar',
        description:
          'Agregador inteligente de eventos tech de Latinoamérica — recomendaciones con IA, chat conversacional y apps web + móvil.',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'es',
        categories: ['events', 'productivity', 'developer-tools'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: '/index.html',
        // No precache para archivos gigantes o chunks de vendor muy grandes.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // /events y /events/:id — network first para datos frescos,
            // fallback a cache si hay cold start de Render o sin señal.
            urlPattern: /^https:\/\/tech-radar-api\.onrender\.com\/events/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'trk-events',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 }, // 24h
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Opciones de perfil — estáticas en la práctica.
            urlPattern: /^https:\/\/tech-radar-api\.onrender\.com\/profile-options/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'trk-profile-options',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          {
            // Fuentes de Google Fonts (si agregamos en el futuro).
            urlPattern: /^https:\/\/fonts\.(gstatic|googleapis)\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'trk-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ],
        // Endpoints sensibles o no-idempotentes que JAMÁS cacheamos:
        // /auth/*, /chat, /me/*, /public/keys/* (POSTs), /sync* (admin).
        // Workbox solo intercepta GETs, así que los POST no se cachean de todas
        // formas. Para los GETs sensibles (/auth/me) los evitamos con este filtro:
        navigateFallbackDenylist: [/^\/auth\//, /^\/admin\//, /^\/me\//, /^\/chat/, /^\/sync/]
      },
      devOptions: {
        // Queremos probar el SW en desarrollo también (útil para debugear).
        enabled: false
      }
    })
  ],
  server: {
    port: 5173,
    open: false
  }
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Pendaftaran manual di src/lib/pembaruan.ts: versi baru dipasang saat aplikasi
      // ditinggalkan, bukan di tengah pengisian formulir.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon-64.png', 'apple-touch-icon.png', 'logo.png'],
      manifest: {
        name: 'SANDAR',
        short_name: 'SANDAR',
        description: 'Catat panen dan ruang muat kapal, tanpa sinyal.',
        lang: 'id',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#0E6E7E',
        icons: [
          { src: 'ikon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'ikon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'ikon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Hanya huruf Inter subset latin yang disimpan agar unduhan awal tetap kecil.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}', '**/inter-latin-wght-normal-*.woff2'],
        // Ikon pemasangan tidak dibutuhkan saat luring.
        globIgnores: ['**/ikon-*.png', '**/apple-touch-icon.png'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8765' },
  },
});

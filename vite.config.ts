import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Base path for GitHub Pages deployment (https://fjacquet.github.io/patlas/)
  base: '/patlas/',
  plugins: [
    react(),
    tailwindcss(),
    // ADR-0001 SW exception — injectManifest (our audited src/sw.ts, not a
    // generated black box), precache-only, prompt-style update. We register
    // manually in src/pwa/registerSW.ts so `injectRegister` is null. Scope and
    // start_url derive from `base` (/patlas/) and are pinned in the manifest.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: null,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,json}'],
      },
      manifest: {
        name: 'pAtlas',
        short_name: 'pAtlas',
        description:
          'Proxmox VE atlas (100% client-side) — drop a cv4pve-report export, get insights and exports',
        id: '/patlas/',
        scope: '/patlas/',
        start_url: '/patlas/',
        display: 'standalone',
        theme_color: '#11161f',
        background_color: '#11161f',
        icons: [
          { src: 'favicon.png', sizes: '32x32', type: 'image/png', purpose: 'any' },
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // No SW in `npm run dev` — the privacy/UAT story stays simple; the SW is
      // exercised via `npm run build && npm run preview`.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@engines': resolve(__dirname, './src/engines'),
      '@components': resolve(__dirname, './src/components'),
      '@store': resolve(__dirname, './src/store'),
      '@types': resolve(__dirname, './src/types'),
      '@utils': resolve(__dirname, './src/utils'),
      '@hooks': resolve(__dirname, './src/hooks'),
    },
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Function form keeps Rollup's discriminated union happy under
        // tsc -b (the static-object form makes TS pick the function overload
        // and reject the object literal). Path-based routing also avoids a
        // brittle list of exact package names.
        manualChunks(id) {
          // Split the bundled locale JSON (en/fr/de/it × every namespace)
          // out of the entry chunk. It is statically imported (so the active
          // locale stays synchronously available — no async i18n init), but
          // routing it to its own chunk keeps it out of the ECharts-bearing
          // `index` chunk that the ≤300 KiB gz gate measures. Locale strings
          // never carry the gate's marker, so this chunk isn't (and need not
          // be) gated.
          if (id.includes('/src/i18n/locales/')) return 'app-locales'
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/xlsx')) return 'vendor-xlsx'
          // Split the TanStack table/virtual primitives into their own
          // chunk so the LIVE bundle-size gate (03-RESEARCH A6, ≤ 60 KiB
          // gz) can actually MEASURE them — minification strips the literal
          // package name from the merged index chunk, defeating the
          // marker-scan otherwise.
          if (id.includes('node_modules/@tanstack')) return 'vendor-tanstack'
          if (id.includes('node_modules/zustand')) return 'vendor-state'
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) {
            return 'vendor-i18n'
          }
          return undefined
        },
      },
    },
  },
})

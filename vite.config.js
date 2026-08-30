import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  resolve: {
    alias: {
      // `@xmldom/xmldom` è il ripiego di epub.js per Node e per Internet
      // Explorer, e in un browser di oggi non viene chiamato mai — il
      // perché, misurato, sta scritto in `src/lib/xmldomFinto.js`. Senza
      // questo alias sarebbero 60 kB di codice morto spediti a ogni
      // lettore, per giunta con due avvisi ALTI di `npm audit` addosso.
      "@xmldom/xmldom": fileURLToPath(new URL("./src/lib/xmldomFinto.js", import.meta.url)),
    },
  },
  // il timbro di versione visibile in app: senza, e' impossibile sapere
  // quale build gira davvero sul tablet (il service worker in modalita'
  // prompt puo' restare indietro di parecchi rilasci)
  define: {
    __BC_VERSIONE__: JSON.stringify(
      new Date().toLocaleString("it-IT", {
        timeZone: "Europe/Rome",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    ),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      manifest: false,
      includeAssets: ["icon.svg", "manifest.json", "icons/*.png"],
      workbox: {
        globPatterns: ["**/*.{js,mjs,css,html,svg,png}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        skipWaiting: false,
        clientsClaim: false,
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});

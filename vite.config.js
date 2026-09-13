import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
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
  // prompt puo' restare indietro di parecchi rilasci). Da quando l'app ha
  // un guscio Android il timbro porta anche la VERSIONE di `package.json`:
  // e' quella che si dichiara allo store, e la data della build da sola
  // non dice a quale rilascio corrisponde.
  define: {
    __BC_VERSIONE__: JSON.stringify(
      `${JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version} · ${new Date().toLocaleString("it-IT", {
        timeZone: "Europe/Rome",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })}`
    ),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      manifest: false,
      includeAssets: ["icon.svg", "manifest.json", "icons/*.png"],
      workbox: {
        // IL DIZIONARIO OFFLINE NON STA QUI DENTRO, ed e' voluto: sono 3,3 MB
        // e il lettore li scarica quando li chiede lui (Impostazioni › Il
        // dizionario). Il `.gz`, il `.json` del cartellino e il `.txt` della
        // licenza restano fuori dai `globPatterns` proprio per questo —
        // precacharli vorrebbe dire spedirli a tutti al primo avvio, cioe'
        // togliere la scelta che il tasto promette.
        globPatterns: ["**/*.{js,mjs,css,html,svg,png}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        skipWaiting: false,
        clientsClaim: false,
        navigateFallback: "index.html",
        // ...ma restare fuori dal precache non basta: aprire la licenza in
        // una scheda nuova E' una navigazione, e il ripiego le servirebbe
        // `index.html` — cioe' l'app al posto del documento, senza un
        // errore che lo dica.
        // ...e lo stesso vale per la privacy, che e' una pagina a se' — lo
        // store la vuole a un indirizzo pubblico — e per `.well-known`,
        // dove Android viene a leggere `assetlinks.json` per fidarsi del
        // guscio: servirgli l'app al posto del file lascerebbe la barra
        // del browser in cima per sempre.
        navigateFallbackDenylist: [/^\/dizionario\//, /^\/privacy/, /^\/\.well-known\//],
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

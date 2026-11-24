// IL PEZZO MANCANTE SI RICONOSCE IN OGNI MOTORE, E SOLO LUI.
//
// Sbagliare da una parte vuol dire consigliare «riapri il tomo» a chi
// rifara' lo stesso errore all'infinito; dall'altra, far ricaricare l'app
// per un guasto vero che ricaricando torna identico, nascondendolo.
import { pezzoMancante } from "../src/lib/guasto.js";

export default async function (t) {
  const veri = {
    Chromium: "Failed to fetch dynamically imported module: https://x.app/assets/Reader-a1b2.js",
    Firefox: "error loading dynamically imported module: https://x.app/assets/Reader-a1b2.js",
    Safari: "Importing a module script failed.",
    Vite: "Unable to preload CSS for /assets/Reader-a1b2.css",
  };
  for (const [chi, msg] of Object.entries(veri)) {
    t.c(`${chi}: il pezzo mancante si riconosce`, pezzoMancante(new Error(msg)));
  }
  const conNome = new Error("Loading chunk 7 failed.");
  conNome.name = "ChunkLoadError";
  t.c("il ChunkLoadError si riconosce dal nome", pezzoMancante(conNome));
  t.c("anche una stringa nuda", pezzoMancante(veri.Firefox));

  // un fetch fallito qualunque NON e' un pezzo dell'app: e' la rete
  for (const msg of [
    "Failed to fetch",
    "NetworkError when attempting to fetch resource.",
    "Cannot read properties of undefined (reading 'cfi')",
    "No Section Found",
  ]) {
    t.c(`«${msg}» resta un guasto vero`, !pezzoMancante(new Error(msg)));
  }
  t.c("niente errore, niente pezzo mancante", !pezzoMancante(null) && !pezzoMancante(undefined));
}

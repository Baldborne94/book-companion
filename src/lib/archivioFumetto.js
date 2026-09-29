// I lettori degli archivi, per il BROWSER: e' l'unico posto che importa
// node-unrar-js, e lo fa pigramente — il wasm di unrar (200 KB) si
// scarica solo alla prima apertura di un CBR. `lib/fumetto.js` lo riceve
// da fuori e non lo conosce, cosi' resta provabile in Node (il CBZ lo legge
// da se', a fette: `lib/zipAFette.js`).
//
// IL WASM SI PASSA A MANO (`wasmBinary`): la colla di Emscripten lo
// cercherebbe accanto al proprio script, e dopo la build di Vite quel
// percorso non esiste piu'. Con `?url` Vite lo mette fra gli asset e il
// service worker lo precacha, cosi' un CBR si apre anche senza rete.
import wasmUrl from "node-unrar-js/esm/js/unrar.wasm?url";
import { apriArchivio, tipoImmagine } from "./fumetto.js";
import { misuraInchiostro, pagineDaMisurare } from "./pdfCrop.js";

let wasm = null;
const rar = async () => {
  const mod = await import("node-unrar-js");
  if (!wasm) wasm = await fetch(wasmUrl).then((r) => r.arrayBuffer());
  return { createExtractorFromData: (o) => mod.createExtractorFromData({ ...o, wasmBinary: wasm }) };
};

// Si passa il Blob, non i suoi byte: un CBZ si legge a fette e resta sul
// disco, e solo un CBR (sotto il suo tetto) si carica intero.
export const apriFumetto = (blob) => apriArchivio(blob, { rar });

// larga cosi' la tavola basta a trovare i bordi, e cinque pagine si
// decodificano in una frazione di secondo alla PRIMA apertura del libro
const LARGHEZZA = 180;

// La misura dei bordi vuole un canvas, quindi sta qui e non in
// `fumetto.js`: torna la misura di ogni pagina campionata (o `null` per
// quella che non si e' lasciata disegnare), e a decidere e' `bordiDaMisure`.
export async function misuraBordi(a) {
  const tela = document.createElement("canvas");
  const ctx = tela.getContext("2d", { willReadFrequently: true });
  // LE CINQUE PAGINE SI CHIEDONO INSIEME: da Google Drive ogni lettura e'
  // un viaggio in rete, e una dopo l'altra erano cinque attese in fila
  // prima di vedere la prima pagina. Il disegno resta in fila (la tela e'
  // una sola), ed e' la parte che non aspetta nessuno.
  const numeri = pagineDaMisurare(a.pagine.length);
  const letti = await Promise.all(numeri.map((n) => a.leggi(n - 1).catch(() => null)));
  const misure = [];
  for (let k = 0; k < numeri.length; k++) {
    const n = numeri[k];
    let url = null;
    try {
      if (!letti[k]) throw new Error("pagina non letta");
      url = URL.createObjectURL(new Blob([letti[k]], { type: tipoImmagine(a.pagine[n - 1]) || "image/jpeg" }));
      const img = new Image();
      img.src = url;
      await img.decode();
      const w = LARGHEZZA;
      const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
      tela.width = w;
      tela.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      misure.push(misuraInchiostro(ctx.getImageData(0, 0, w, h)));
    } catch {
      misure.push(null);
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }
  return misure;
}

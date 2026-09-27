// I lettori degli archivi, per il BROWSER: e' l'unico posto che importa
// JSZip e node-unrar-js, e lo fa pigramente — il wasm di unrar (200 KB) si
// scarica solo alla prima apertura di un CBR. `lib/fumetto.js` riceve
// questi due da fuori e non li conosce, cosi' resta provabile in Node.
//
// IL WASM SI PASSA A MANO (`wasmBinary`): la colla di Emscripten lo
// cercherebbe accanto al proprio script, e dopo la build di Vite quel
// percorso non esiste piu'. Con `?url` Vite lo mette fra gli asset e il
// service worker lo precacha, cosi' un CBR si apre anche senza rete.
import wasmUrl from "node-unrar-js/esm/js/unrar.wasm?url";
import { apriArchivio, tipoImmagine } from "./fumetto.js";
import { misuraInchiostro, pagineDaMisurare } from "./pdfCrop.js";

const zip = async () => (await import("jszip")).default;

let wasm = null;
const rar = async () => {
  const mod = await import("node-unrar-js");
  if (!wasm) wasm = await fetch(wasmUrl).then((r) => r.arrayBuffer());
  return { createExtractorFromData: (o) => mod.createExtractorFromData({ ...o, wasmBinary: wasm }) };
};

export const apriFumetto = (bytes) => apriArchivio(bytes, { zip, rar });

// larga cosi' la tavola basta a trovare i bordi, e cinque pagine si
// decodificano in una frazione di secondo alla PRIMA apertura del libro
const LARGHEZZA = 180;

// La misura dei bordi vuole un canvas, quindi sta qui e non in
// `fumetto.js`: torna la misura di ogni pagina campionata (o `null` per
// quella che non si e' lasciata disegnare), e a decidere e' `bordiDaMisure`.
export async function misuraBordi(a) {
  const tela = document.createElement("canvas");
  const ctx = tela.getContext("2d", { willReadFrequently: true });
  const misure = [];
  for (const n of pagineDaMisurare(a.pagine.length)) {
    let url = null;
    try {
      const bytes = await a.leggi(n - 1);
      url = URL.createObjectURL(new Blob([bytes], { type: tipoImmagine(a.pagine[n - 1]) || "image/jpeg" }));
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

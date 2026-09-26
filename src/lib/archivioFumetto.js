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
import { apriArchivio } from "./fumetto.js";

const zip = async () => (await import("jszip")).default;

let wasm = null;
const rar = async () => {
  const mod = await import("node-unrar-js");
  if (!wasm) wasm = await fetch(wasmUrl).then((r) => r.arrayBuffer());
  return { createExtractorFromData: (o) => mod.createExtractorFromData({ ...o, wasmBinary: wasm }) };
};

export const apriFumetto = (bytes) => apriArchivio(bytes, { zip, rar });

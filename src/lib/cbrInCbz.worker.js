// IL WORKER DELLA CONVERSIONE (vedi `rarInCbz.js`): e' qui perche' solo in
// un worker il browser concede le letture SINCRONE che la libreria RAR
// chiede (`FileReaderSync`), e perche' sciogliere un giga
// di RAR sulla pagina la terrebbe ferma per minuti.
import { Extractor } from "node-unrar-js";
import { getUnrar } from "node-unrar-js/esm/js/unrar.singleton.js";
import { rarInCbz, aFinestre } from "./rarInCbz.js";
import { pagineDa, eComicInfo } from "./fumetto.js";

const FINESTRA = 1024 * 1024;

function dalDisco(blob) {
  const r = new FileReaderSync();
  return (da, a) => new Uint8Array(r.readAsArrayBuffer(blob.slice(da, a)));
}

const tieni = (nome) => pagineDa([nome]).length > 0 || eComicInfo(nome);

self.onmessage = async ({ data }) => {
  try {
    const { blob, misura, wasm } = data;
    const unrar = await getUnrar({ wasmBinary: wasm });
    const leggi = aFinestre(dalDisco(blob), misura, FINESTRA);
    let detto = -1;
    const cbz = rarInCbz({
      unrar,
      Extractor,
      leggi,
      misura,
      tieni,
      onProgress: (p) => {
        // una volta per punto percentuale, non per pagina
        const cento = Math.floor((p.letti / p.misura) * 100);
        if (cento === detto) return;
        detto = cento;
        self.postMessage({ avanzamento: p });
      },
    });
    self.postMessage({ cbz });
  } catch (e) {
    self.postMessage({ errore: e?.message || String(e) });
  }
};

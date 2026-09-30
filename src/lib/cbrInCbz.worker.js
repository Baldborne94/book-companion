// IL WORKER DELLA CONVERSIONE (vedi `rarInCbz.js`): e' qui perche' solo in
// un worker il browser concede le letture SINCRONE che la libreria RAR
// chiede — `FileReaderSync` per un file del tablet, `XMLHttpRequest`
// sincrono con `Range` per un file di Drive — e perche' sciogliere un giga
// di RAR sulla pagina la terrebbe ferma per minuti.
import { Extractor } from "node-unrar-js";
import { getUnrar } from "node-unrar-js/esm/js/unrar.singleton.js";
import { rarInCbz, aFinestre } from "./rarInCbz.js";
import { pagineDa, eComicInfo } from "./fumetto.js";

// da Drive ogni finestra e' un viaggio: piu' larga che dal disco
const FINESTRA_QUI = 1024 * 1024;
const FINESTRA_DRIVE = 4 * 1024 * 1024;

function dalDisco(blob) {
  const r = new FileReaderSync();
  return (da, a) => new Uint8Array(r.readAsArrayBuffer(blob.slice(da, a)));
}

function daDrive({ id, chiave }) {
  return (da, a) => {
    const x = new XMLHttpRequest();
    x.open("GET", `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, false);
    x.responseType = "arraybuffer";
    x.setRequestHeader("Authorization", `Bearer ${chiave}`);
    x.setRequestHeader("Range", `bytes=${da}-${a - 1}`);
    x.send();
    if (x.status === 401) throw new Error("la chiave di Google Drive e' scaduta a meta' conversione");
    if (x.status !== 206 && x.status !== 200) throw new Error(`Google Drive ha risposto ${x.status}`);
    const b = new Uint8Array(x.response);
    // un server che ignora `Range` manda tutto: si prende il pezzo chiesto
    return x.status === 200 ? b.subarray(da, a) : b;
  };
}

const tieni = (nome) => pagineDa([nome]).length > 0 || eComicInfo(nome);

self.onmessage = async ({ data }) => {
  try {
    const { blob, drive, misura, wasm } = data;
    const unrar = await getUnrar({ wasmBinary: wasm });
    const prendi = blob ? dalDisco(blob) : daDrive(drive);
    const leggi = aFinestre(prendi, misura, blob ? FINESTRA_QUI : FINESTRA_DRIVE);
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

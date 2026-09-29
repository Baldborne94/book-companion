// UNA PAGINA, UNA LETTURA (`leggiVoce` in `lib/zipAFette.js`; segnalato dal
// lettore: «sono principalmente cbz ma ci mettono molto a caricare»). Da
// Google Drive ogni lettura e' un viaggio in rete: la testata letta a parte
// raddoppiava i viaggi di ogni pagina di un fumetto. Qui si conta, e si
// prova che la strada lunga resta quando la testata locale e' piu' grande
// di quel che la directory centrale fa pensare.
import { createRequire } from "module";
import { apriZip, MARGINE_TESTATA } from "../src/lib/zipAFette.js";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");
const uguali = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// un Blob che conta le letture: `slice` e' gratis, `arrayBuffer` e' un viaggio
function contato(blob) {
  const conto = { letture: 0 };
  const avvolgi = (b) => ({
    size: b.size,
    slice: (da, a) => avvolgi(b.slice(da, a)),
    arrayBuffer: () => {
      conto.letture += 1;
      return b.arrayBuffer();
    },
    stream: () => {
      conto.letture += 1;
      return b.stream();
    },
  });
  return { blob: avvolgi(blob), conto };
}

// uno zip scritto a mano con un campo extra LOCALE lunghissimo, che la
// directory centrale non ha: la stima si ferma prima dei dati
function zipExtraLungo(nome, dati, extra) {
  const n = new TextEncoder().encode(nome);
  const loc = new Uint8Array(30 + n.length + extra + dati.length);
  const dl = new DataView(loc.buffer);
  dl.setUint32(0, 0x04034b50, true);
  dl.setUint16(4, 20, true);
  dl.setUint32(18, dati.length, true);
  dl.setUint32(22, dati.length, true);
  dl.setUint16(26, n.length, true);
  dl.setUint16(28, extra, true);
  loc.set(n, 30);
  loc.set(dati, 30 + n.length + extra);
  const cen = new Uint8Array(46 + n.length);
  const dc = new DataView(cen.buffer);
  dc.setUint32(0, 0x02014b50, true);
  dc.setUint16(4, 20, true);
  dc.setUint16(6, 20, true);
  dc.setUint32(20, dati.length, true);
  dc.setUint32(24, dati.length, true);
  dc.setUint16(28, n.length, true);
  dc.setUint32(42, 0, true);
  cen.set(n, 46);
  const fine = new Uint8Array(22);
  const df = new DataView(fine.buffer);
  df.setUint32(0, 0x06054b50, true);
  df.setUint16(8, 1, true);
  df.setUint16(10, 1, true);
  df.setUint32(12, cen.length, true);
  df.setUint32(16, loc.length, true);
  return new Blob([loc, cen, fine]);
}

export default async function (t) {
  const pagina = new Uint8Array(300 * 1024).map((_, i) => (i * 7) % 251);
  const altra = new Uint8Array(5000).map((_, i) => (i * 13) % 199);
  for (const compressione of ["STORE", "DEFLATE"]) {
    const z = new JSZip();
    z.file("p001.jpg", pagina);
    z.file("p002.jpg", altra);
    const { blob, conto } = contato(new Blob([await z.generateAsync({ type: "uint8array", compression: compressione })]));
    const a = await apriZip(blob);
    const prima = conto.letture;
    const letta = await a.leggi("p001.jpg");
    t.eq(`${compressione}: una pagina, una lettura`, conto.letture - prima, 1);
    t.c(`${compressione}: e i byte sono quelli`, uguali(letta, pagina));
    t.c(`${compressione}: anche la pagina dopo`, uguali(await a.leggi("p002.jpg"), altra));
  }

  const dati = new Uint8Array(2000).map((_, i) => i % 256);
  const { blob, conto } = contato(zipExtraLungo("p.jpg", dati, MARGINE_TESTATA + 500));
  const a = await apriZip(blob);
  const prima = conto.letture;
  const letta = await a.leggi("p.jpg");
  t.c("una testata piu' lunga della stima: la pagina esce giusta lo stesso", uguali(letta, dati));
  t.c("…passando dalla strada in due tempi", conto.letture - prima > 1, String(conto.letture - prima));
}

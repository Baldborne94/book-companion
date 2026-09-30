// UN CBR CHE SCENDE DA DRIVE (chiesto dal lettore: i due Lobster Johnson,
// minuti di «Apro il tomo…» muti). Due patti di `scaricaDaDrive` e
// `fermaCbrCompresso`, le due tappe di `fileDaLeggere` (che sta in
// `sync.js`, e Node non lo importa):
//   - la discesa si RACCONTA (`fraseDiscesa`): quanti MB su quanti, un
//     avviso per MB e non uno per pezzo di rete;
//   - un CBR oltre `CBR_MAX` con le pagine COMPRESSE si ferma PRIMA di
//     scendere, dalla prima pagina (uno o due viaggi): dopo un giga di
//     discesa il lettore lo avrebbe rifiutato comunque.
import { rar4 } from "./rar-finto.mjs";

const memoria = {};
for (const [nome, fn] of Object.entries({
  getItem: (k) => (k in memoria ? memoria[k] : null),
  setItem: (k, v) => {
    memoria[k] = String(v);
  },
  removeItem: (k) => {
    delete memoria[k];
  },
})) {
  Object.defineProperty(memoria, nome, { value: fn, enumerable: false });
}

const MB = 1024 * 1024;
const pagina = (seme, lunga = 300) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from(Array.from({ length: lunga }, (_, i) => (i * 31 + seme) % 256))]);

// Drive finto: chi chiede un pezzo (`Range`) e chi il file intero
function driveFinto(file, { lunghezza = false } = {}) {
  const d = { pezzi: 0, interi: 0 };
  d.fetch = async (url, op = {}) => {
    const id = decodeURIComponent(new URL(url).pathname.split("/").pop());
    const bytes = file[id];
    const range = /bytes=(\d+)-(\d+)/.exec(op.headers?.Range || "");
    if (!bytes) return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({}) };
    if (range) {
      d.pezzi += 1;
      // la voce dice piu' byte di quelli scritti qui (un CBR da 300 MB non si
      // costruisce per una prova): oltre la fine, zeri, come un file vero
      const buf = Buffer.alloc(Number(range[2]) + 1 - Number(range[1]));
      bytes.copy(buf, 0, Number(range[1]));
      return { ok: true, status: 206, headers: { get: () => null }, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
    }
    d.interi += 1;
    let i = 0;
    const PEZZO = MB / 2;
    return {
      ok: true,
      status: 200,
      headers: { get: (k) => (lunghezza && k === "Content-Length" ? String(bytes.length) : null) },
      blob: async () => new Blob([bytes]),
      body: {
        getReader: () => ({
          read: async () => {
            if (i >= bytes.length) return { done: true };
            const value = bytes.subarray(i, i + PEZZO);
            i += PEZZO;
            return { done: false, value };
          },
        }),
      },
    };
  };
  return d;
}

export default async (t) => {
  const vecchi = { localStorage: globalThis.localStorage, fetch: globalThis.fetch };
  globalThis.localStorage = memoria;
  const { fraseDiscesa, fraseScarico, vaDetto } = await import("../src/lib/driveCore.js");
  const drive = await import("../src/lib/drive.js");
  const { CBR_MAX, PERCHE_CBR_GRANDE } = await import("../src/lib/fumetto.js");
  try {
    // ---- la frase ----------------------------------------------------------------
    t.eq("a che punto, su quanto", fraseDiscesa({ presi: 312.7 * MB, totale: 780 * MB }), "Scende da Google Drive: 312 di 780 MB");
    t.eq("all'inizio: zero", fraseDiscesa({ presi: 0, totale: 780 * MB }), "Scende da Google Drive: 0 di 780 MB");
    t.eq("un file piccolo non e' «di 0 MB»", fraseDiscesa({ presi: 0, totale: 200 * 1024 }), "Scende da Google Drive: 0 di 1 MB");
    t.eq("senza il totale si dice quel che e' sceso", fraseDiscesa({ presi: 40 * MB }), "Scende da Google Drive: 40 MB");
    t.eq("…anche quando e' poco", fraseDiscesa({ presi: 10 }), "Scende da Google Drive: meno di un MB");
    t.eq("sul tasto, prima che la risposta arrivi", fraseScarico(null), "Scarico…");
    t.eq("sul tasto, a che punto e'", fraseScarico({ presi: 120 * MB, totale: 480 * MB }), "Scarico… 120 di 480 MB");
    t.c("si dice a ogni MB passato", vaDetto(MB - 1, MB, 10 * MB));
    t.c("non a ogni pezzo di rete", !vaDetto(MB + 1, MB + 2, 10 * MB));
    t.c("e alla fine sempre", vaDetto(MB + 1, MB + 2, MB + 2));

    // ---- la discesa si racconta ----------------------------------------------------
    memoria.bc_drive_on = "1";
    memoria.bc_drive_token = JSON.stringify({ chiave: "k", scade: Date.now() + 3_600_000 });
    const lungo = Buffer.alloc(3.5 * MB, 7);
    const d0 = driveFinto({ lungo });
    globalThis.fetch = d0.fetch;
    const detti = [];
    const b = await drive.scaricaDaDrive("lungo", { onProgress: (p) => detti.push(p), totale: lungo.length });
    t.eq("il file sceso a pezzi e' intero", b.size, lungo.length);
    t.eq("un avviso all'inizio, uno per MB, uno alla fine", detti.map((p) => Math.floor(p.presi / MB)).join(), "0,1,2,3,3");
    t.eq("…col totale detto da Drive nell'elenco", detti[0].totale, lungo.length);
    globalThis.fetch = driveFinto({ lungo }, { lunghezza: true }).fetch;
    const conTesta = [];
    await drive.scaricaDaDrive("lungo", { onProgress: (p) => conTesta.push(p) });
    t.eq("senza l'elenco, il totale lo dice la risposta", conTesta[0].totale, lungo.length);
    globalThis.fetch = d0.fetch;
    t.eq("senza chi ascolta, il file si prende com'e'", (await drive.scaricaDaDrive("lungo")).size, lungo.length);

    // ---- il CBR troppo grande si dice prima ------------------------------------------
    const compresso = rar4([["p1.png", pagina(1), { metodo: 0x33 }], ["p2.png", pagina(2)]]);
    const memorizzato = rar4([["ComicInfo.xml", Buffer.from("<ComicInfo/>")], ["p1.png", pagina(1)], ["p2.png", pagina(2)]]);
    const GRANDE = CBR_MAX + 1;
    const d = driveFinto({ fc: compresso, fm: memorizzato, fp: compresso });
    globalThis.fetch = d.fetch;

    let errore = null;
    await drive.fermaCbrCompresso("cbr", { id: "fc", byte: GRANDE }).catch((e) => (errore = e));
    t.eq("grande e compresso: si dice perche'", errore?.message, PERCHE_CBR_GRANDE);
    t.eq("…senza scaricarlo", d.interi, 0);
    t.c("…a uno o due viaggi", d.pezzi >= 1 && d.pezzi <= 2, `${d.pezzi} viaggi`);

    d.pezzi = 0;
    t.eq("grande e memorizzato: si lascia scendere", await drive.fermaCbrCompresso("cbr", { id: "fm", byte: GRANDE }), undefined);
    t.c("…dopo aver guardato solo l'inizio", d.pezzi >= 1 && d.pezzi <= 2 && d.interi === 0, `${d.pezzi} viaggi, ${d.interi} interi`);

    d.pezzi = 0;
    await drive.fermaCbrCompresso("cbr", { id: "fp", byte: compresso.length });
    t.eq("piccolo e compresso: niente da guardare, ci pensa la libreria", d.pezzi, 0);
    await drive.fermaCbrCompresso("cbz", { id: "fc", byte: GRANDE });
    t.eq("un CBZ non si ferma qui: si legge a fette", d.pezzi, 0);
    await drive.fermaCbrCompresso("cbr", undefined);
    t.eq("un libro che su Drive non c'e': niente viaggi", d.pezzi + d.interi, 0);
  } finally {
    await drive.scollegaDrive?.().catch?.(() => {});
    for (const k of Object.keys(memoria)) delete memoria[k];
    for (const [k, v] of Object.entries(vecchi)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  }
};

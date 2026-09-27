// I FUMETTI: CBZ e CBR (chiesto dal lettore: «can you permit the
// application to open the cbr file for reading manga and graphic novels?»).
//
// Un fumetto e' un archivio di immagini, una per pagina: CBZ e' uno zip,
// CBR e' un RAR. Qui dentro stanno le decisioni che sbagliano in silenzio,
// fuori dal componente perche' un test in Node non importa un `.jsx`:
// - IL FORMATO SI LEGGE DAI BYTE, non dall'estensione. Moltissimi «.cbr»
//   in giro sono zip rinominati (e viceversa): fidarsi del nome vorrebbe
//   dire aprire con RAR un file zip, che non esplode — risponde «archivio
//   non leggibile» su un fumetto sano.
// - L'ORDINE DELLE PAGINE E' QUELLO NATURALE, non alfabetico: «p10» viene
//   dopo «p9», non fra «p1» e «p2». Alfabetico, il decimo capitolo si legge
//   per secondo, e nessun errore lo dice.
// - QUEL CHE NON E' UNA PAGINA SI SCARTA: `__MACOSX/`, `._p1.png`,
//   `Thumbs.db`, `ComicInfo.xml`. Contati, sarebbero pagine bianche o
//   un'immagine rotta in mezzo alla lettura.
//
// `apriArchivio` riceve il lettore RAR da fuori, come `leggiByte`
// altrove: cosi' il giro intero — formato, elenco, ordine, estrazione — si
// prova in Node con JSZip e con la build Node di node-unrar-js, che e' la
// stessa libreria (e lo stesso wasm) che gira nel browser.

import { TUTTA, unisci, rifinisci } from "./pdfCrop.js";
import { apriZip } from "./zipAFette.js";
import { apriRar } from "./rarAFette.js";

// UN CBR NON SI LEGGE A FETTE, e allora ha un tetto. La libreria RAR per il
// browser (unrar compilato in wasm) vuole l'archivio INTERO in memoria, e
// se ne fa una copia dentro il wasm: un volume da un giga sono due giga
// prima di vedere una pagina, e la scheda del tablet si arrende senza dire
// niente (segnalato: «il volume 3 di hellboy e' piu' di un gb e non riesco
// a caricarlo»). Il numero e' una scelta, non una misura sul tablet: sotto
// i 300 MB i CBR veri entrano (un volume normale ne pesa 50-150), sopra si
// rifiuta PRIMA di leggere un byte, con la strada scritta accanto. Il CBZ
// il tetto non ce l'ha: si legge a fette (`zipAFette.js`).
//
// MA IL TETTO VALE SOLO PER I CBR COMPRESSI DAVVERO. Quasi sempre le pagine
// stanno nel RAR «memorizzate», cioe' cosi' come sono, e allora si leggono a
// fette come in un CBZ (`rarAFette.js`), senza libreria e senza limite:
// `cbrTroppoGrande` si chiede solo quando quella strada non c'e'.
export const CBR_MAX = 300 * 1024 * 1024;
export const cbrTroppoGrande = (formato, byte) => formato === "cbr" && Number(byte) > CBR_MAX;
export const PERCHE_CBR_GRANDE =
  "questo CBR ha le pagine compresse ed è troppo grande per il browser (un RAR compresso va letto tutto in memoria): convertilo in CBZ — estrai le immagini e comprimile in uno zip rinominato .cbz — e il volume entra";

const ePagina = (nome) => pagineDa([nome]).length > 0;
const rarAFette = (blob) => apriRar(blob, { eImmagine: ePagina }).catch(() => null);

// Un CBR entra se si legge a fette, o se e' abbastanza piccolo da stare in
// memoria. Chiede solo le testate: non legge le pagine.
export async function cbrApribile(blob) {
  if (!cbrTroppoGrande("cbr", blob?.size)) return true;
  return !!(await rarAFette(blob));
}

export const FORMATI = ["cbz", "cbr"];
export const ESTENSIONI = [".cbz", ".cbr"];
export const eFumetto = (b) => b?.fileType === "cbz" || b?.fileType === "cbr";

// «Rar!\x1a\x07» apre ogni RAR (4 e 5); «PK\x03\x04» ogni zip
export function formatoDaByte(u8) {
  if (!u8 || u8.length < 4) return null;
  if (u8[0] === 0x52 && u8[1] === 0x61 && u8[2] === 0x72 && u8[3] === 0x21) return "cbr";
  if (u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 0x03 && u8[3] === 0x04) return "cbz";
  return null;
}

const TIPI = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
};

export function tipoImmagine(nome) {
  const est = String(nome || "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return (est && TIPI[est]) || null;
}

export const eImmagine = (nome) => !!tipoImmagine(nome);

// La roba che un archivio si porta dietro senza volerlo: le cartelle di
// servizio di macOS coi loro doppioni «._», le miniature di Windows.
const RUMORE = /(^|\/)(__MACOSX\/|\.[^/]*$|Thumbs\.db$|desktop\.ini$)/i;

export const eComicInfo = (nome) => /(^|\/)comicinfo\.xml$/i.test(String(nome || ""));

// «10» dopo «9»: ogni pezzo del nome si spezza in cifre e non-cifre, e le
// cifre si confrontano come numeri. Cartella per cartella, cosi' «cap2/p1»
// sta prima di «cap10/p1».
const pezzi = (s) => String(s).toLowerCase().split(/(\d+)/).filter((x) => x !== "");
function confrontaNaturale(a, b) {
  const pa = pezzi(a);
  const pb = pezzi(b);
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const na = /^\d+$/.test(pa[i]);
    const nb = /^\d+$/.test(pb[i]);
    if (na && nb) {
      const d = Number(pa[i]) - Number(pb[i]);
      if (d) return d;
    } else if (pa[i] !== pb[i]) {
      return pa[i] < pb[i] ? -1 : 1;
    }
  }
  return pa.length - pb.length;
}

export function pagineDa(nomi) {
  return (nomi || [])
    .filter((n) => typeof n === "string" && eImmagine(n) && !RUMORE.test(n))
    .sort((a, b) => {
      const sa = a.split("/");
      const sb = b.split("/");
      for (let i = 0; i < Math.min(sa.length, sb.length); i++) {
        // la cartella prima del file: un nome piu' profondo si confronta
        // segmento per segmento
        const ultimoA = i === sa.length - 1;
        const ultimoB = i === sb.length - 1;
        if (ultimoA !== ultimoB) return ultimoA ? -1 : 1;
        const d = confrontaNaturale(sa[i], sb[i]);
        if (d) return d;
      }
      return sa.length - sb.length;
    });
}

// ComicInfo.xml e' la scheda che i CBZ si portano dentro (Series, Number,
// Writer, Summary, e «Manga: YesAndRightToLeft» per il verso). Si legge a
// mano, senza DOM: un test in Node non ce l'ha, e sono sei campi.
const ENTITA = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodifica = (s) =>
  String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
      const k = e.toLowerCase();
      if (k[0] === "#") return String.fromCodePoint(k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
      return ENTITA[k] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();

function campo(xml, nome) {
  const m = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, "i"));
  return m ? decodifica(m[1]) : "";
}

export function leggiComicInfo(xml) {
  const s = String(xml || "");
  if (!/<ComicInfo[\s>]/i.test(s)) return null;
  const numero = parseFloat(campo(s, "Number").replace(",", "."));
  const manga = campo(s, "Manga");
  return {
    titolo: campo(s, "Title"),
    serie: campo(s, "Series"),
    numero: Number.isFinite(numero) && numero > 0 ? numero : null,
    autore: campo(s, "Writer"),
    sinossi: campo(s, "Summary"),
    // «YesAndRightToLeft» e' il verso dei manga; «Yes» da solo dice che e'
    // un manga ma non da che parte si legge, e li' non si inventa niente
    verso: /^YesAndRightToLeft$/i.test(manga) ? "rtl" : null,
    // «Yes» o «YesAndRightToLeft»: e' un manga, qualunque sia il verso
    manga: /^Yes/i.test(manga),
  };
}

// Da dove si riparte: il punto chiesto (un segnalibro), poi quello salvato,
// poi la prima pagina — e mai fuori dal fumetto.
export function paginaDaAprire(chiesta, salvata, totale) {
  const n = parseInt(chiesta, 10) || parseInt(salvata, 10) || 1;
  return Math.min(Math.max(1, totale || 1), Math.max(1, n));
}

// Le stesse fasce dei due reader, misurate sullo schermo — e IL VERSO LE
// SPECCHIA: in un manga la pagina dopo sta a sinistra, quindi il tocco a
// sinistra va avanti. `null` (col mouse) apre le barre e basta.
export const TAP_PREV = 0.28;
export const TAP_NEXT = 0.72;
export function tocco(rel, verso) {
  if (rel == null || !Number.isFinite(rel)) return "barre";
  if (rel < TAP_PREV) return verso === "rtl" ? "next" : "prev";
  if (rel > TAP_NEXT) return verso === "rtl" ? "prev" : "next";
  return "barre";
}

// Il verso di lettura sta sul dispositivo, per libro: e' una proprieta'
// del volume (un manga si legge da destra), non una preferenza del lettore.
// `ripiego` e' quel che ComicInfo ha detto all'import, se l'ha detto.
export function leggiVerso(id, ripiego) {
  let v = null;
  try {
    v = localStorage.getItem(`bc_verso_${id}`);
  } catch {
    /* senza storage resta il ripiego */
  }
  if (v === "ltr" || v === "rtl") return v;
  return ripiego === "rtl" ? "rtl" : "ltr";
}

export function scriviVerso(id, verso) {
  try {
    localStorage.setItem(`bc_verso_${id}`, verso === "rtl" ? "rtl" : "ltr");
  } catch {
    /* senza storage il verso dura quanto la lettura */
  }
}

// Come si adatta la pagina allo schermo — intera, o larga quanto lo
// schermo con lo scorrimento in verticale (i webtoon, le tavole fitte).
// E' del dispositivo, non del libro: dipende da quanto vetro c'e'.
export const ADATTA = ["intera", "larghezza"];
export function leggiAdatta() {
  try {
    const v = localStorage.getItem("bc_fumetto_adatta");
    return ADATTA.includes(v) ? v : "intera";
  } catch {
    return "intera";
  }
}
export function scriviAdatta(v) {
  try {
    localStorage.setItem("bc_fumetto_adatta", ADATTA.includes(v) ? v : "intera");
  } catch {
    /* senza storage dura quanto la lettura */
  }
}

// L'archivio aperto: le pagine in ordine, la scheda se c'e', e `leggi(i)`
// che torna i byte della pagina i (Uint8Array). Il RAR estrae un file per
// volta — non si tira fuori tutto il volume per guardare una pagina.
export async function apriArchivio(sorgente, { rar, aFette = true } = {}) {
  // Un Blob (il File scelto, o quel che torna da IndexedDB) si legge a
  // fette e NON si carica mai intero; dei byte gia' in mano si avvolgono in
  // un Blob, che non li copia. Il RAR invece i byte li vuole tutti.
  const blob = sorgente instanceof Blob ? sorgente : new Blob([sorgente || new ArrayBuffer(0)]);
  const formato = formatoDaByte(new Uint8Array(await blob.slice(0, 8).arrayBuffer()));
  if (formato === "cbz") {
    const z = await apriZip(blob);
    const pagine = pagineDa(z.nomi);
    const scheda = z.nomi.find(eComicInfo);
    const info = scheda ? leggiComicInfo(new TextDecoder().decode(await z.leggi(scheda))) : null;
    return { formato, pagine, info, leggi: (i) => z.leggi(pagine[i]), chiudi() {} };
  }
  if (formato === "cbr") {
    // prima la strada a fette: niente wasm da scaricare e niente tetto
    // (`aFette: false` serve ai test, per provare anche la strada della
    // libreria sullo stesso archivio)
    const f = aFette ? await rarAFette(blob) : null;
    if (f) {
      const pagine = pagineDa(f.nomi);
      const scheda = f.nomi.find(eComicInfo);
      const info = scheda ? leggiComicInfo(new TextDecoder().decode(await f.leggi(scheda))) : null;
      return { formato, pagine, info, leggi: (i) => f.leggi(pagine[i]), chiudi() {} };
    }
    if (!rar) throw new Error("manca il lettore rar");
    if (cbrTroppoGrande(formato, blob.size)) throw new Error(PERCHE_CBR_GRANDE);
    const buf = await blob.arrayBuffer();
    const r = await rar();
    // UN ESTRATTORE SERVE UNA PAGINA SOLA (misurato: la seconda `extract`
    // di un file diverso sullo stesso estrattore risponde «File read
    // error», perche' il cursore sull'archivio resta in fondo). Crearne
    // uno per pagina non costa niente: avvolge lo stesso ArrayBuffer senza
    // copiarlo, e il modulo wasm e' uno solo.
    const nuovo = () => r.createExtractorFromData({ data: buf });
    const nomi = [...(await nuovo()).getFileList().fileHeaders].filter((h) => !h.flags?.directory).map((h) => h.name);
    const pagine = pagineDa(nomi);
    const estrai = async (nome) => {
      for (const f of (await nuovo()).extract({ files: [nome] }).files) if (f.extraction) return f.extraction;
      throw new Error(`pagina non estraibile: ${nome}`);
    };
    const scheda = nomi.find(eComicInfo);
    const info = scheda ? leggiComicInfo(new TextDecoder().decode(await estrai(scheda))) : null;
    return { formato, pagine, info, leggi: (i) => estrai(pagine[i]), chiudi() {} };
  }
  throw new Error("archivio non leggibile");
}

// I BORDI DELLA SCANSIONE SI TOLGONO, E LA TAVOLA RIEMPIE LO SCHERMO
// (chiesto dal lettore col video in mano: «fare adattare la pagina in
// automatico allo schermo cosi' che la riempia al meglio»). La pagina
// disegnata con `object-fit: contain` riempiva gia' il vetro — ma il FILE
// no: le scansioni si portano dentro una cornice nera o bianca, e sul suo
// Hellboy quella cornice era il 5% per lato (misurato sui fotogrammi:
// tavola larga 973 pixel su 1080 di schermo). Riempire lo schermo con una
// cornice di carta morta non e' riempirlo.
//
// E' lo stesso mestiere del ritaglio dei margini nei PDF, con le stesse
// regole: si misura UNA VOLTA per libro su cinque pagine sparse, la
// misura e' l'UNIONE delle tavole (nessuna pagina campionata perde un
// pixel d'arte), c'e' un tetto per lato (una pagina quasi vuota nel
// campione non puo' mangiarsi il libro), e si salva sul dispositivo. La
// differenza sta nel respiro: nel PDF un filo di bianco attorno al testo
// aiuta a leggere, qui la tavola vuole arrivare al bordo. La misura si fa
// su una tavola ridotta a 180 pixel, e il pixel a cavallo fra bordo e
// arte conta come «disegnato» solo se l'arte ci sta per un quinto: quindi
// puo' mangiarsi al massimo quella frazione di un pixel ridotto — misurato
// sulla tavola finta: 36,7 contro 36 su 600, cioe' un pixel o due su una
// scansione da duemila, che a schermo non esistono.
export const BORDI = { respiro: 0, maxLato: 0.2 };

export const bordiDaMisure = (misure) => {
  let box = null;
  for (const m of misure || []) if (m) box = unisci(box, m);
  return rifinisci(box, BORDI);
};

const KEY_BORDI = (id) => `bc_fumetto_bordi_${id}`;
const bordiBuoni = (b) => !!b && [b.l, b.t, b.r, b.b].every((n) => Number.isFinite(n)) && b.r > b.l && b.b > b.t;

export function leggiBordi(id) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY_BORDI(id)));
    return bordiBuoni(v) ? v : null;
  } catch {
    return null;
  }
}

export function scriviBordi(id, b) {
  try {
    localStorage.setItem(KEY_BORDI(id), JSON.stringify(b));
  } catch {
    /* senza storage si rimisura alla prossima apertura */
  }
}

// COME SI DISEGNA LA PAGINA: il FOGLIO e' la parte della tavola che si
// vede (la scansione meno i bordi), l'IMMAGINE e' il file intero, spostato
// dentro il foglio cosi' che il bordo resti fuori dal ritaglio. «intera»
// fa stare il foglio nel riquadro, «larghezza» lo fa largo quanto il
// riquadro e lascia scorrere il resto. Tutto in pixel: e' quel che poi
// misurano lo zoom e la scorsa (`foglio` per `limita`/`zoomAttorno`).
export function disegnaPagina({ nat, riquadro, bordi, modo = "intera" } = {}) {
  if (!(nat?.w > 0 && nat?.h > 0 && riquadro?.w > 0 && riquadro?.h > 0)) return null;
  const c = bordiBuoni(bordi) ? bordi : TUTTA;
  const cw = nat.w * (c.r - c.l);
  const ch = nat.h * (c.b - c.t);
  const k = modo === "larghezza" ? riquadro.w / cw : Math.min(riquadro.w / cw, riquadro.h / ch);
  const tondo = (n) => Math.round(n * 100) / 100;
  return {
    foglio: { w: tondo(cw * k), h: tondo(ch * k) },
    immagine: { w: tondo(nat.w * k), h: tondo(nat.h * k), x: tondo(-c.l * nat.w * k), y: tondo(-c.t * nat.h * k) },
  };
}

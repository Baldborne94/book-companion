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
import { comeRete } from "./anticipo.js";

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
//
// NEL NASTRO UN TOCCO NON SCORRE (chiesto dal lettore: «con un tocco si
// muove come se andasse nella prossima pagina, e io vorrei uno scorrimento
// continuo in base al dito»): li' si va avanti col dito, e un tocco al bordo
// che salta di uno schermo porta via la vignetta che si stava leggendo.
// Resta alle barre; la rotella e le frecce scorrono ancora.
export function tocco(rel, verso, { nastro = false } = {}) {
  if (nastro || rel == null || !Number.isFinite(rel)) return "barre";
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

// Come si adatta la pagina allo schermo — intera, o il NASTRO: le pagine
// una sotto l'altra, larghe quanto lo schermo, e si scorre col dito da una
// all'altra senza voltare (chiesto dal lettore: «la modalita' scorrimento
// verticale dove l'immagine mi diventa un po' piu' grande e riesco a
// leggerla meglio»). Il nastro ha preso il posto di «larghezza», che era
// una pagina sola larga quanto lo schermo e poi da voltare: chi l'aveva
// scelta si ritrova il nastro, che e' la stessa cosa senza la voltata.
// E' del dispositivo, non del libro: dipende da quanto vetro c'e'.
export const ADATTA = ["intera", "nastro"];
export function leggiAdatta(storage = globalThis.localStorage) {
  try {
    const v = storage.getItem("bc_fumetto_adatta");
    if (v === "larghezza") return "nastro";
    return ADATTA.includes(v) ? v : "intera";
  } catch {
    return "intera";
  }
}
export function scriviAdatta(v, storage = globalThis.localStorage) {
  try {
    storage.setItem("bc_fumetto_adatta", ADATTA.includes(v) ? v : "intera");
  } catch {
    /* senza storage dura quanto la lettura */
  }
}

// LA GEOMETRIA DEL NASTRO. Ogni pagina e' alta quanto viene larga quanto
// lo schermo (la stessa aritmetica di `disegnaPagina` in «larghezza»); una
// pagina non ancora aperta non ha misura, e vale la proporzione MEDIANA di
// quelle gia' viste — in un volume le pagine sono quasi tutte uguali, e
// una stima giusta vuol dire un nastro che non salta quando la misura vera
// arriva. Senza nessuna misura, la proporzione di una pagina di fumetto.
export const PROPORZIONE_TIPICA = 1.5;
export function altezzeNastro({ totale, nats = {}, bordi = null, larghezza } = {}) {
  const n = Math.max(0, Math.floor(Number(totale) || 0));
  const riquadro = { w: larghezza, h: 1 };
  const note = [];
  const vere = [];
  for (let i = 1; i <= n; i++) {
    const d = disegnaPagina({ nat: nats[i], riquadro, bordi, modo: "larghezza" });
    vere.push(d ? d.foglio.h : null);
    if (d) note.push(d.foglio.h / larghezza);
  }
  note.sort((a, b) => a - b);
  const mediana = note.length ? note[Math.floor(note.length / 2)] : PROPORZIONE_TIPICA;
  const stima = Math.round(larghezza * mediana * 100) / 100;
  return vere.map((h) => (h == null ? stima : h));
}

// dove comincia ogni pagina nel nastro (e, in fondo, dove finisce l'ultima)
export function cimeNastro(altezze) {
  const cime = [0];
  for (const h of altezze || []) cime.push(cime[cime.length - 1] + h);
  return cime;
}

// la pagina sotto un punto del nastro (1 = la prima); fuori dal nastro, la
// prima o l'ultima
export function paginaAlPunto(cime, y) {
  const n = (cime?.length || 1) - 1;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cime[mid] <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

// L'archivio aperto: le pagine in ordine, la scheda se c'e', e `leggi(i)`
// che torna i byte della pagina i (Uint8Array). Il RAR estrae un file per
// volta — non si tira fuori tutto il volume per guardare una pagina.
export async function apriArchivio(sorgente, { rar, aFette = true } = {}) {
  // Un Blob (il File scelto, o quel che torna da IndexedDB) si legge a
  // fette e NON si carica mai intero; dei byte gia' in mano si avvolgono in
  // un Blob, che non li copia. Il RAR invece i byte li vuole tutti.
  // anche cio' che a un Blob somiglia soltanto — `size` e `slice` — come un
  // file di Drive letto a pezzi (`fileRemoto`): avvolto in un Blob vero
  // diventerebbe un archivio di zero byte
  const aFetta = (x) => x instanceof Blob || (!!x && typeof x.size === "number" && typeof x.slice === "function" && !ArrayBuffer.isView(x));
  const blob = aFetta(sorgente) ? sorgente : new Blob([sorgente || new ArrayBuffer(0)]);
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

// LA DOPPIA PAGINA (chiesto dal lettore: «avere due pagine una di fianco
// all'altra… o nel caso che proprio un panel occupi entrambe le pagine in
// un colpo solo»). Sul tablet sdraiato una pagina sola lascia vuoti due
// terzi del vetro.
//
// LE COPPIE SONO QUELLE DEL VOLUME STAMPATO: la copertina da sola, poi 2-3,
// 4-5… E UNA TAVOLA LARGA STA DA SOLA — e' la doppia pagina stampata,
// scansionata in un file unico — e dopo di lei le coppie RIPARTONO: nel
// volume stampato quella tavola occupava due facciate, quindi la pagina
// dopo torna a sinistra. Si calcolano DA CAPO ogni volta (sono poche
// centinaia di pagine), cosi' la coppia di una pagina e' sempre la stessa
// da qualunque parte ci si arrivi: avanti, indietro, cursore o segnalibro.
//
// LE PAGINE LARGHE SI SCOPRONO APRENDOLE (la misura sta nel file, non
// nell'archivio): chi salta lontano col cursore puo' trovare le coppie
// sfasate da una tavola larga che nessuno ha ancora aperto. Per quello c'e'
// `sposta`, che fa partire le coppie una pagina piu' in la'.
export const LARGA = 1;
export const eLarga = (nat) => nat?.w > 0 && nat?.h > 0 && nat.w / nat.h >= LARGA;

export function coppie(totale, { larghe = new Set(), sposta = 0 } = {}) {
  const n = Math.max(0, Math.floor(Number(totale) || 0));
  const out = [];
  if (!n) return out;
  out.push([1]);
  let i = 2;
  if (sposta && i <= n) out.push([i++]);
  while (i <= n) {
    if (larghe.has(i) || i === n || larghe.has(i + 1)) {
      out.push([i]);
      i += 1;
    } else {
      out.push([i, i + 1]);
      i += 2;
    }
  }
  return out;
}

export function coppiaDi(pagina, totale, opzioni) {
  const tutte = coppie(totale, opzioni);
  const p = Math.min(Math.max(1, parseInt(pagina, 10) || 1), Math.max(1, tutte.length ? tutte[tutte.length - 1].at(-1) : 1));
  return tutte.find((c) => c.includes(p)) || [p];
}

// una pagina della coppia dopo, o di quella prima (la coppia a schermo la
// decide `coppiaDi`, qualunque delle sue pagine si chieda); `null` in fondo
// e in cima, dove non si va da nessuna parte
export function coppiaVicina(pagina, totale, opzioni, dir) {
  const c = coppiaDi(pagina, totale, opzioni);
  if (dir > 0) return c.at(-1) < totale ? c.at(-1) + 1 : null;
  return c[0] > 1 ? c[0] - 1 : null;
}

// Doppia o singola e' del DISPOSITIVO (dipende da quanto vetro c'e'), come
// «Adatta», e di piu': dell'ORIENTAMENTO. Chi accende la doppia col tablet
// sdraiato e poi lo gira in piedi non vuole due francobolli — preso dal
// banco: la scelta unica seguiva il tablet in piedi. Senza una scelta,
// doppia quando il riquadro e' piu' largo che alto.
export const orientamento = (riquadro) => (riquadro?.w > riquadro?.h ? "largo" : "alto");
const KEY_DOPPIA = (o) => `bc_fumetto_doppia_${o === "largo" ? "largo" : "alto"}`;
export function leggiDoppia(o, storage = globalThis.localStorage) {
  try {
    const v = storage.getItem(KEY_DOPPIA(o));
    return v === "si" || v === "no" ? v : null;
  } catch {
    return null;
  }
}
export function scriviDoppia(o, v, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY_DOPPIA(o), v === "si" ? "si" : "no");
  } catch {
    /* senza storage dura quanto la lettura */
  }
}
export function doppiaAccesa(scelta, riquadro) {
  if (scelta === "si") return true;
  if (scelta === "no") return false;
  return riquadro?.w > 0 && riquadro?.h > 0 && riquadro.w > riquadro.h;
}

// Le pagine larghe e lo sfasamento sono del LIBRO: si ricordano per il
// prossimo giro, cosi' le coppie non si riassestano ogni volta che lo apri.
const KEY_LARGHE = (id) => `bc_fumetto_larghe_${id}`;
const KEY_SPOSTA = (id) => `bc_fumetto_sposta_${id}`;
export function leggiLarghe(id) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY_LARGHE(id)));
    return new Set(Array.isArray(v) ? v.filter((n) => Number.isInteger(n) && n > 0) : []);
  } catch {
    return new Set();
  }
}
export function scriviLarghe(id, larghe) {
  try {
    localStorage.setItem(KEY_LARGHE(id), JSON.stringify([...larghe].sort((a, b) => a - b)));
  } catch {
    /* si riscoprono aprendole */
  }
}
export function leggiSposta(id) {
  try {
    return localStorage.getItem(KEY_SPOSTA(id)) === "1" ? 1 : 0;
  } catch {
    return 0;
  }
}
export function scriviSposta(id, v) {
  try {
    localStorage.setItem(KEY_SPOSTA(id), v ? "1" : "0");
  } catch {
    /* dura quanto la lettura */
  }
}

// COME SI DISEGNA UNA COPPIA: le due tavole (meno i bordi) alla STESSA
// altezza, una accanto all'altra, e la coppia intera dentro il riquadro.
// Torna il foglio della coppia (quel che lo zoom misura) e, per ogni
// pagina nell'ordine dello SCHERMO, dove sta e come si disegna — in un
// manga la pagina dopo sta a sinistra.
// FRA LE DUE PAGINE C'E' UNA PIEGA (chiesto dal lettore con la fotografia
// di Kingdom: «puoi non mettermele appiccicate le due pagine?»). Attaccate,
// le vignette di una pagina finivano contro quelle dell'altra e sembravano
// una tavola sola; uno spazio scuro fra le due, come il dorso di un volume
// aperto, le separa senza rubare quasi niente al disegno. Lo spazio entra
// nel conto della misura: la coppia intera, piega compresa, sta nel
// riquadro. Una pagina sola (la copertina, una tavola larga) non ne ha.
export const PIEGA = 16;
export function disegnaCoppia({ nats, riquadro, bordi, verso = "ltr", piega = PIEGA } = {}) {
  if (!Array.isArray(nats) || !nats.length || !nats.every((n) => n?.w > 0 && n?.h > 0)) return null;
  if (!(riquadro?.w > 0 && riquadro?.h > 0)) return null;
  const c = bordiBuoni(bordi) ? bordi : TUTTA;
  const tagli = nats.map((n) => ({ n, cw: n.w * (c.r - c.l), ch: n.h * (c.b - c.t) }));
  const somma = tagli.reduce((s, t) => s + t.cw / t.ch, 0);
  const spazio = Math.max(0, piega) * (tagli.length - 1);
  const h = Math.min(riquadro.h, Math.max(1, riquadro.w - spazio) / somma);
  const tondo = (x) => Math.round(x * 100) / 100;
  const pagine = tagli.map((t, i) => {
    const k = h / t.ch;
    return {
      indice: i,
      foglio: { w: tondo(t.cw * k), h: tondo(h) },
      immagine: { w: tondo(t.n.w * k), h: tondo(t.n.h * k), x: tondo(-c.l * t.n.w * k), y: tondo(-c.t * t.n.h * k) },
    };
  });
  // nell'ordine dello SCHERMO: in un manga la pagina dopo sta a sinistra
  const aSchermo = verso === "rtl" ? [...pagine].reverse() : pagine;
  let x = 0;
  aSchermo.forEach((p, i) => {
    p.x = tondo(x);
    x += p.foglio.w + (i < aSchermo.length - 1 ? Math.max(0, piega) : 0);
  });
  return { foglio: { w: tondo(x), h: tondo(h) }, pagine: aSchermo };
}

// LE PAGINE AVANTI, PRONTE PRIMA CHE SI VOLTI (chiesto dal lettore:
// «le pagine ci mettono molto a caricare», sui manga letti da Drive). Il
// lettore teneva pronte solo le vicine — la pagina dopo, la coppia dopo —
// e un manga non si legge a passo costante: una tavola densa per qualche
// secondo, poi tre voltate svelte. La tavola densa lasciava la rete ferma,
// e le voltate svelte aspettavano un viaggio a Drive ciascuna (misurato col
// Drive finto a 800 ms e 1 MB/s: 11 voltate su 16 sopra il secondo).
//
// DA LONTANO SI PREPARANO PIU' PAGINE, una alla volta e dopo quella che si
// guarda: la banda e' una, e chiederle tutte insieme rallenterebbe proprio
// quella a schermo. Sulla rete a consumo (il browser lo dice: cellulare o
// «risparmio dati») poche, perche' quei byte si pagano; sul disco del
// tablet bastano le vicine, perche' leggere e' gia' istantaneo. Una rete
// che il browser non dice (il PC) vale libera: sono pagine del volume che
// stai leggendo, non un volume intero preso di nascosto.
export const AVANTI_DA_LONTANO = 10;
export const AVANTI_A_CONSUMO = 3;
export const AVANTI_QUI = 2;
export function pagineAvanti({ lontano = false, connessione = null } = {}) {
  if (!lontano) return AVANTI_QUI;
  return comeRete(connessione) === "a consumo" ? AVANTI_A_CONSUMO : AVANTI_DA_LONTANO;
}

// le pagine da preparare dopo `ultima` (l'ultima a schermo), in ordine, fino
// alla fine del volume, saltando quelle gia' pronte
export function daPreparare(ultima, totale, quante, pronte = new Set()) {
  const out = [];
  for (let n = ultima + 1; n <= Math.min(totale, ultima + quante); n++) if (!pronte.has(n)) out.push(n);
  return out;
}

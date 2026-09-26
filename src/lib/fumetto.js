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
// `apriArchivio` riceve i lettori (`zip`, `rar`) da fuori, come `leggiByte`
// altrove: cosi' il giro intero — formato, elenco, ordine, estrazione — si
// prova in Node con JSZip e con la build Node di node-unrar-js, che e' la
// stessa libreria (e lo stesso wasm) che gira nel browser.

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
export async function apriArchivio(bytes, { zip, rar } = {}) {
  const buf = bytes instanceof ArrayBuffer ? bytes : bytes?.buffer?.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const formato = formatoDaByte(new Uint8Array(buf || new ArrayBuffer(0), 0, Math.min(8, buf?.byteLength || 0)));
  if (formato === "cbz") {
    if (!zip) throw new Error("manca il lettore zip");
    const JSZip = await zip();
    const z = await JSZip.loadAsync(buf);
    const nomi = Object.keys(z.files).filter((n) => !z.files[n].dir);
    const pagine = pagineDa(nomi);
    const scheda = nomi.find(eComicInfo);
    const info = scheda ? leggiComicInfo(await z.file(scheda).async("string")) : null;
    return { formato, pagine, info, leggi: (i) => z.file(pagine[i]).async("uint8array"), chiudi() {} };
  }
  if (formato === "cbr") {
    if (!rar) throw new Error("manca il lettore rar");
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

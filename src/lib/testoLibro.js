import { getFile, getAux, putAux } from "./bookStore.js";
import { pageText } from "./pdfSearch.js";

// IL TESTO DI UN LIBRO SI ESTRAE UNA VOLTA SOLA (chiesto dal lettore fra le
// cose da rendere piu' veloci: «fai tutti e 4 i punti»).
//
// Tre domande aprivano i libri da capo ogni volta che venivano fatte: la
// ricerca in tutta la biblioteca, «Chi e' costui?» e «Dove eravamo rimasti» —
// ognuna scioglieva l'ePub, caricava ogni capitolo, ne costruiva l'albero e
// lo percorreva. Due domande di fila pagavano due volte lo stesso lavoro, e i
// volumi FINITI di una saga, che non cambiano mai piu', si rileggevano a ogni
// scheda. Adesso quel lavoro si fa una volta per file e se ne tiene su disco
// quel che le tre domande guardano, compresso:
//
// - per ogni capitolo: la base del suo CFI, se e' materiale di contorno
//   (`eContorno`, la stessa domanda di «Dove eravamo rimasti»), i BLOCCHI di
//   testo (paragrafi, voci, citazioni, titoli: il testo intero e dove
//   cominciano) e i NODI di testo, ognuno col blocco che lo contiene e il
//   punto in cui comincia;
// - per un PDF: il testo di ogni pagina.
//
// IL PUNTO E' LA PARTE CHE SBAGLIA IN SILENZIO. Un risultato della ricerca
// deve riaprire il libro dove sta la parola, e la passaggio di una scheda
// deve sapere se sta prima o dopo il tuo segno: prima si chiedeva a epub.js
// il CFI della parola trovata, col capitolo caricato. Adesso il capitolo non
// c'e' piu', quindi per ogni nodo si tiene il CFI del suo INIZIO spezzato in
// due — tutto quel che sta prima dello scostamento, e lo scostamento — e la
// parola al carattere `i` di quel nodo e' lo stesso CFI con lo scostamento
// spostato di `i`. E' l'aritmetica che epub.js fa per conto suo dentro un
// nodo di testo (un passo e uno scostamento), e la prova in browser lo
// confronta col CFI che epub.js calcola dal vivo.
//
// E' LEGATO AL FILE: si tiene con la misura dei byte da cui viene, e se i
// byte qui cambiano (una ricucitura, un file sostituito) si rifa'. Quando i
// byte qui non ci sono piu' — tornati su Drive — il testo tenuto vale lo
// stesso: e' l'unico modo di rispondere su un libro che non e' qui, ed e' un
// guadagno che prima non c'era.

export const VERSIONE_TESTO = 1;
export const chiaveTesto = (id) => `testo_${id}`;

// ---- il materiale di contorno (spostato qui da `trama.js`, che lo riesporta:
// l'estrazione lo segna una volta sola per capitolo) ----
const CONTORNO =
  /^\s*(dramatis\s+personae|cast\s+of\s+characters|personaggi|acknowledge?ments?|ringraziamenti|appendix|appendice|glossary|glossario|about\s+the\s+author|l['’]autore|nota\s+dell['’]autore|author['’]s\s+note|note\s+dell['’]editore|extract|estratto|anteprima|excerpt|also\s+by|dello\s+stesso\s+autore|copyright|indice|contents|table\s+of\s+contents|bibliograf)/i;

export function eContorno(doc) {
  const titolo = doc?.title || "";
  const testa = doc?.querySelector?.("h1, h2, h3, h4")?.textContent || "";
  return CONTORNO.test(titolo.trim()) || CONTORNO.test(testa.trim());
}

// ---- il punto dentro un nodo ----

// «epubcfi(/6/4!/4/2/1:0)» → ["epubcfi(/6/4!/4/2/1", 0, ""]; un CFI che non
// finisce con uno scostamento resta intero, e vale per il nodo
export function spezzaPunto(cfi) {
  const m = /^(.*):(\d+)((?:\[[^\]]*\])?)\)$/.exec(String(cfi || ""));
  return m ? [m[1], Number(m[2]), m[3]] : [String(cfi || ""), null, ""];
}

export function puntoNelNodo(nodo, i = 0) {
  const [pre, o, suf] = nodo.c || [];
  if (!pre) return null;
  if (o == null) return `${pre}`;
  return `${pre}:${o + i}${suf})`;
}

// ---- l'estrazione (vuole un browser: epub.js e il DOM dei capitoli) ----

const BLOCCHI = "p, li, blockquote, dd, td, h1, h2, h3";
const PROSA = "p, blockquote, dd";

export async function estraiEpub(eb) {
  const capitoli = [];
  for (const item of eb.spine.spineItems) {
    const cap = { base: item.cfiBase, contorno: false, blocchi: [], prosa: [], nodi: [] };
    capitoli.push(cap);
    try {
      await item.load(eb.load.bind(eb));
      const doc = item.document;
      cap.contorno = eContorno(doc);
      if (!doc?.body) continue;
      const indice = new Map();
      for (const el of doc.body.querySelectorAll(BLOCCHI)) {
        indice.set(el, cap.blocchi.length);
        if (el.matches(PROSA)) cap.prosa.push(cap.blocchi.length);
        cap.blocchi.push({ t: el.textContent || "", n: null });
      }
      const walker = doc.createTreeWalker(doc.body, 4 /* solo nodi di testo */);
      let node;
      while ((node = walker.nextNode())) {
        const t = node.textContent;
        if (!t) continue;
        const genitore = node.parentElement;
        const blocco = genitore?.closest?.(BLOCCHI) || genitore;
        let b = indice.get(blocco);
        if (b == null && blocco) {
          b = cap.blocchi.length;
          indice.set(blocco, b);
          cap.blocchi.push({ t: blocco.textContent || "", n: null });
        }
        let c = null;
        // il punto si paga solo dove c'e' qualcosa da trovare
        if (t.trim()) {
          try {
            const r = doc.createRange();
            r.setStart(node, 0);
            r.setEnd(node, 0);
            c = spezzaPunto(item.cfiFromRange(r));
          } catch {
            c = null;
          }
          // il punto di un blocco e' quello del suo primo nodo col punto, per
          // lui e per ogni blocco che lo contiene (una citazione coi suoi
          // paragrafi): serve a «Dove eravamo rimasti» per tagliare sul segno
          if (c) {
            for (let el = genitore; el && el !== doc.body; el = el.parentElement) {
              const k = indice.get(el);
              if (k != null && cap.blocchi[k].n == null) cap.blocchi[k].n = cap.nodi.length;
            }
          }
        }
        cap.nodi.push({ b: b ?? null, c, t });
      }
      // un blocco fatto di un nodo solo non ripete il suo testo: si rilegge
      // dal nodo (`testoBlocco`), e il testo tenuto pesa la meta'
      for (const bl of cap.blocchi) {
        const primo = bl.n != null ? cap.nodi[bl.n] : null;
        if (primo && primo.t === bl.t) bl.t = null;
      }
    } catch {
      /* capitolo illeggibile: resta vuoto, gli altri bastano */
    } finally {
      try { item.unload(); } catch { /* gia' scaricato */ }
    }
  }
  return { tipo: "epub", capitoli };
}

export async function estraiPdf(pdf) {
  const pagine = [];
  const cache = new Map();
  for (let n = 1; n <= pdf.numPages; n++) {
    try {
      pagine.push(await pageText(pdf, n, cache));
    } catch {
      pagine.push("");
    }
  }
  return { tipo: "pdf", pagine };
}

async function estraiDaByte(libro, blob) {
  if (libro.fileType === "pdf") {
    const mod = await import("./pdfThumb.js");
    const pdf = await mod.loadPdf(await blob.arrayBuffer());
    try {
      return await estraiPdf(pdf);
    } finally {
      mod.chiudiPdf(pdf);
    }
  }
  const { default: ePub } = await import("epubjs");
  const eb = ePub(await blob.arrayBuffer());
  try {
    await eb.ready;
    return await estraiEpub(eb);
  } finally {
    try { eb.destroy(); } catch { /* gia' chiuso */ }
  }
}

// ---- la compressione: un romanzo sono mezzo mega di testo, e compresso
// un terzo. Senza `CompressionStream` si tiene com'e'. ----

export async function comprimi(dati) {
  const json = JSON.stringify(dati);
  if (typeof CompressionStream === "undefined") return json;
  const flusso = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Blob([await new Response(flusso).arrayBuffer()], { type: "application/gzip" });
}

export async function decomprimi(salvato) {
  if (typeof salvato === "string") return JSON.parse(salvato);
  const flusso = salvato.stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(flusso).text());
}

// ---- la memoria ----

// Gli ultimi testi aperti restano anche in memoria: una scheda che attraversa
// tre volumi e la ricerca che la segue non devono scompattare tre volte.
const VIVI = new Map();
const MAX_VIVI = 4;
const IN_CORSO = new Map();
const SCRITTURE = new Map();

// per chi deve sapere che il testo e' arrivato su disco (i test, il banco)
export const scrittureFinite = () => Promise.all(SCRITTURE.values());

function tieni(id, voce) {
  VIVI.delete(id);
  VIVI.set(id, voce);
  while (VIVI.size > MAX_VIVI) VIVI.delete(VIVI.keys().next().value);
}

export function dimenticaTesti() {
  VIVI.clear();
  IN_CORSO.clear();
  SCRITTURE.clear();
}

// Torna il testo del libro, o `null` se non si puo' avere: niente byte qui e
// niente testo tenuto (il libro e' lontano), o un file che non si apre.
// `leggiByte`, `leggi`, `scrivi` ed `estrai` arrivano da fuori per la ragione
// di sempre: cosi' un test lo prova con una mappa invece di IndexedDB.
export async function testoDelLibro(
  libro,
  { leggiByte = getFile, leggi = getAux, scrivi = putAux, estrai = estraiDaByte } = {}
) {
  if (!libro?.id) return null;
  const id = libro.id;
  if (IN_CORSO.has(id)) return IN_CORSO.get(id);
  const giro = (async () => {
    let blob = null;
    try {
      blob = await leggiByte(id);
    } catch {
      blob = null;
    }
    const misura = blob ? blob.size : null;
    const vivo = VIVI.get(id);
    if (vivo && (misura == null || vivo.di === misura)) {
      tieni(id, vivo);
      return vivo.testo;
    }
    let salvato = null;
    try {
      salvato = await leggi(chiaveTesto(id));
    } catch {
      salvato = null;
    }
    const buono =
      salvato &&
      salvato.v === VERSIONE_TESTO &&
      salvato.dati != null &&
      (misura == null || salvato.di === misura);
    if (buono) {
      try {
        const testo = await decomprimi(salvato.dati);
        tieni(id, { di: salvato.di, testo });
        return testo;
      } catch {
        /* illeggibile: si rifa' se i byte ci sono */
      }
    }
    if (!blob) return null;
    const testo = await estrai(libro, blob);
    if (!testo) return null;
    tieni(id, { di: misura, testo });
    // si scrive DIETRO: comprimere un romanzo costa quanto estrarlo, e chi ha
    // chiesto il testo lo ha gia' in mano
    SCRITTURE.set(
      id,
      (async () => {
        try {
          await scrivi(chiaveTesto(id), { v: VERSIONE_TESTO, di: misura, dati: await comprimi(testo) });
        } catch {
          /* senza spazio si rifa' la prossima volta: costa e non rompe */
        }
      })()
    );
    return testo;
  })();
  IN_CORSO.set(id, giro);
  try {
    return await giro;
  } finally {
    IN_CORSO.delete(id);
  }
}

// il testo intero di un blocco, anche quando si rilegge dal suo nodo
export const testoBlocco = (cap, k) => {
  const bl = cap.blocchi[k];
  if (!bl) return undefined;
  return bl.t != null ? bl.t : cap.nodi[bl.n]?.t ?? "";
};

// il punto in cui comincia un blocco, o `null` se non contiene testo
export const puntoBlocco = (cap, k) => {
  const bl = cap.blocchi[k];
  return bl?.n != null ? puntoNelNodo(cap.nodi[bl.n], 0) : null;
};

// il testo di un capitolo com'e' `body.textContent`
export const testoCapitolo = (cap) => cap.nodi.map((n) => n.t).join("");

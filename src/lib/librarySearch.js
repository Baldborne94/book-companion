import { getFile } from "./bookStore.js";
import { searchBook } from "./epubSearch.js";
import { searchPdf } from "./pdfSearch.js";
import { queryRegex } from "./wordForms.js";

// CERCARE IN TUTTA LA BIBLIOTECA.
//
// Dentro un libro la ricerca era gia' possibile; qui la domanda e' un'altra
// — «dov'era quella frase?» — e la risposta puo' stare in qualunque tomo.
//
// Un tomo per volta, aperto e richiuso. La tentazione sarebbe aprirli tutti
// insieme e cercare in parallelo: su un tablet significa tenere in memoria
// venti libri sbobinati contemporaneamente, e il browser chiude la scheda
// molto prima di finire. Meglio piu' lento e vivo.
//
// Si cerca solo in quello che e' GIA' qui. Un libro che vive solo nel cloud
// si scaricherebbe intero per una domanda di tre parole: si salta e si dice
// quanti ne sono rimasti fuori.

// meno di tre lettere non e' una domanda, e' un setaccio che raccoglie tutto
export const abbastanzaLunga = (q) => (q || "").trim().length >= 3;

// Il passaggio arriva in una riga sola, ma nell'elenco l'occhio deve
// trovare subito la parola cercata. La si ritrova con la stessa espressione
// che l'ha trovata nel libro — quella con le forme flesse — cosi' si accende
// «pergamene» anche a chi ha chiesto «pergamena».
function spezza(testo, re) {
  if (!re) return { prima: testo, dentro: "", dopo: "" };
  re.lastIndex = 0;
  const m = re.exec(testo);
  if (!m) return { prima: testo, dentro: "", dopo: "" };
  return {
    prima: testo.slice(0, m.index),
    dentro: m[0],
    dopo: testo.slice(m.index + m[0].length),
  };
}

async function cercaEpub(blob, query, limite) {
  const { default: ePub } = await import("epubjs");
  const eb = ePub(await blob.arrayBuffer());
  try {
    await eb.ready;
    const trovati = await searchBook(eb, query, limite);
    const re = queryRegex(query);
    return trovati.map((r) => ({ punto: r.cfi, ...spezza(r.excerpt, re) }));
  } finally {
    try { eb.destroy(); } catch { /* gia' chiuso */ }
  }
}

async function cercaPdf(blob, query, limite, vivo) {
  const mod = await import("./pdfThumb.js");
  const pdf = await mod.loadPdf(await blob.arrayBuffer());
  try {
    const { results } = await searchPdf(pdf, query, { limit: limite, alive: vivo });
    // il PDF il passaggio lo consegna gia' spezzato nei tre pezzi
    return results.map((r) => ({
      punto: String(r.page),
      dove: `pag. ${r.page}`,
      prima: r.before,
      dentro: r.hit,
      dopo: r.after,
    }));
  } finally {
    try { pdf.destroy(); } catch { /* gia' chiuso */ }
  }
}

export async function cercaOvunque(libri, query, { onLibro, onTrovato, vivo, perLibro = 6 } = {}) {
  const attivo = vivo || (() => true);
  let lontani = 0;
  let esaminati = 0;
  for (const [i, libro] of libri.entries()) {
    if (!attivo()) break;
    onLibro?.({ i, totale: libri.length, titolo: libro.title });
    let blob = null;
    try {
      blob = await getFile(libro.id);
    } catch {
      /* archivio che non risponde: il libro si salta */
    }
    if (!blob) {
      lontani++;
      continue;
    }
    try {
      const trovati =
        libro.fileType === "pdf"
          ? await cercaPdf(blob, query, perLibro, attivo)
          : await cercaEpub(blob, query, perLibro);
      esaminati++;
      if (trovati.length && attivo()) onTrovato?.({ libro, trovati });
    } catch {
      /* tomo che non si lascia aprire: gli altri non c'entrano */
    }
  }
  return { lontani, esaminati };
}

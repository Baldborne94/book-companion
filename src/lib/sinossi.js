// IL RETRO DEL LIBRO, che era già dentro il file.
//
// Gli ePub portano `dc:description` nei metadati, ed è quasi sempre
// esattamente il testo di quarta di copertina: quello scritto dall'editore
// per farti venire voglia di aprirlo, e quindi **senza spoiler per
// mestiere**. epub.js lo legge già (`metadata.description`), e noi
// all'import prendevamo solo titolo, autore e copertina e lo buttavamo via.
//
// È la fonte migliore possibile: non costa niente, funziona senza rete, e
// non passa da nessun modello.

// Quanto può essere lunga. Certi editori ci infilano l'intera rassegna
// stampa, i premi vinti e la biografia dell'autore: oltre questa soglia
// non è più un retro di copertina, è un dépliant.
export const MAX = 1200;

// Le entità che si incontrano davvero in un `dc:description`, che è XML
// dentro XML e arriva scappato una volta o due.
const ENTITA = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  mdash: "—", ndash: "–", hellip: "…",
};

const entita = (s) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (tutto, cosa) => {
    if (cosa[0] === "#") {
      const n = cosa[1] === "x" || cosa[1] === "X"
        ? parseInt(cosa.slice(2), 16)
        : parseInt(cosa.slice(1), 10);
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : tutto;
    }
    const v = ENTITA[cosa.toLowerCase()];
    return v === undefined ? tutto : v;
  });

// LA DESCRIZIONE È QUASI SEMPRE HTML, e va ripulita a mano.
//
// Gli editori ci mettono `<p>`, `<b>`, `<br/>`, a volte tutto scappato
// (`&lt;p&gt;`) perché è HTML dentro un attributo XML. Mostrarla com'è
// vorrebbe dire stampare i tag sullo schermo — l'ho vista fare.
//
// Si scappa PRIMA di togliere i tag, e in quest'ordine: chi toglie i tag
// per primo si ritrova i `&lt;p&gt;` intatti, li scappa dopo, e a quel
// punto sono tag veri che nessuno toglie più. Un giro solo, e nell'ordine
// giusto — due giri di scappamento aprirebbero la porta a un `&amp;lt;`
// scritto apposta.
export function ripulisci(grezzo, max = MAX) {
  if (!grezzo) return "";
  let t = entita(String(grezzo));
  // i confini di paragrafo diventano righe vuote PRIMA che i tag spariscano
  t = t.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  t = t.replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n\n");
  t = t.replace(/<[^>]*>/g, "");
  t = t.replace(/[ \t ]+/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");
  t = t.split("\n").map((r) => r.trim()).join("\n").trim();
  if (t.length <= max) return t;
  // si taglia a fine FRASE, non a metà parola: un retro di copertina che
  // finisce con «…l'unico modo per» sembra un guasto, non una scelta
  const tagliato = t.slice(0, max);
  const punto = Math.max(tagliato.lastIndexOf(". "), tagliato.lastIndexOf(".\n"));
  return (punto > max * 0.5 ? tagliato.slice(0, punto + 1) : tagliato.trimEnd() + "…").trim();
}

// Quello che NON è un retro di copertina. Certi ePub mettono in
// `dc:description` il nome del convertitore, o «Unknown», o la stessa
// riga per tutti i libri del catalogo: mostrarlo sarebbe peggio che non
// mostrare niente, perché sembrerebbe che il libro parli di quello.
const SPAZZATURA = /^(unknown|n\/?a|none|null|undefined|description|calibre|converted by|epub|book|no description)\b/i;
// sotto questa lunghezza non è una quarta di copertina, è un residuo
export const MINIMO = 40;

export function buona(testo) {
  const t = (testo || "").trim();
  return t.length >= MINIMO && !SPAZZATURA.test(t);
}

// Il retro, pronto da mostrare: torna la stringa, o "" se quel che c'era
// non valeva la pena. La stringa vuota è un'informazione — vuol dire
// «guardato, non c'è» — e chi chiama la salva per non riguardare ogni
// volta (`undefined` = non abbiamo mai guardato).
export function dalMetadata(md) {
  const t = ripulisci(md?.description);
  return buona(t) ? t : "";
}

// IL RETRO DEI LIBRI CHE ERANO GIA' QUI.
//
// La descrizione si legge all'import, e i libri entrati prima non tornano
// indietro a farsi guardare — la stessa trappola dell'impronta e del ciclo.
// Ma qui non serve un tasto e una passata lunga su tutta la biblioteca:
// il retro serve quando APRI la scheda di QUEL libro, quindi si va a
// prendere allora, una volta sola, e si scrive sul libro.
//
// `""` e' una risposta, non un fallimento: vuol dire «guardato, non c'e'»,
// e serve a non riaprire un ePub da trenta megabyte ogni volta che tocchi
// la scheda. `undefined` vuol dire «non abbiamo mai guardato».
export async function recupera(book, leggiByte) {
  if (!book || typeof book.sinossi === "string") return null;
  if (book.fileType === "pdf") return "";
  let file = null;
  try {
    file = await Promise.resolve().then(() => leggiByte?.(book.id));
  } catch {
    file = null;
  }
  // un tomo rimasto nel cloud non si scarica per una quarta di copertina:
  // si riprova la prossima volta che i byte sono qui
  if (!file) return null;
  try {
    const { default: ePub } = await import("epubjs");
    const eb = ePub(await file.arrayBuffer());
    try {
      return dalMetadata(await eb.loaded.metadata);
    } finally {
      eb.destroy?.();
    }
  } catch {
    // un archivio illeggibile non e' «nessuna sinossi»: e' un guasto, e
    // scrivere `""` vorrebbe dire non riprovare mai piu'
    return null;
  }
}

// ---------------------------------------------------------------------
// IL RIPIEGO, per gli ePub che una descrizione non ce l'hanno.
//
// Qui NON si finge di avere la quarta di copertina: si legge l'inizio del
// romanzo e si dice cosa c'è nelle prime pagine. L'etichetta sullo schermo
// lo dichiara («Dalle prime pagine»), perché spacciarlo per il retro
// scritto dall'editore sarebbe una bugia piccola e inutile.
//
// E vale la regola di tutta l'app: al modello **non si manda il titolo**.
// Se lo riconoscesse risponderebbe a memoria — cioè con tutta la trama,
// finale compreso — ed è esattamente lo spoiler da cui questa funzione
// dovrebbe proteggere.

// quanti paragrafi bastano a dire di cosa parla: è la premessa, non la
// storia. Di più vorrebbe dire raccontare oltre l'inizio.
export const PARAGRAFI = 30;
// sotto questa lunghezza è una didascalia, un'intestazione, una firma
const PARAGRAFO_MINIMO = 60;

export async function raccogliApertura(book, leggiByte, { max = PARAGRAFI } = {}) {
  if (!book || book.fileType === "pdf") return [];
  let file = null;
  try {
    file = await Promise.resolve().then(() => leggiByte?.(book.id));
  } catch {
    return [];
  }
  if (!file) return [];
  const { default: ePub } = await import("epubjs");
  const { eContorno } = await import("./trama.js");
  const eb = ePub(await file.arrayBuffer());
  const fuori = [];
  try {
    await eb.loaded.spine;
    for (const item of eb.spine?.spineItems || eb.spine?.items || []) {
      if (fuori.length >= max) break;
      try {
        await item.load(eb.load.bind(eb));
        const doc = item.document;
        // indice, copyright, «dello stesso autore»: in testa si saltano e
        // si tira dritto — fermarsi lì vorrebbe dire non raccogliere niente
        if (eContorno(doc) || !doc?.body) continue;
        for (const el of doc.querySelectorAll("p, blockquote")) {
          const t = (el.textContent || "").replace(/\s+/g, " ").trim();
          if (t.length >= PARAGRAFO_MINIMO) fuori.push(t);
          if (fuori.length >= max) break;
        }
      } catch {
        /* capitolo illeggibile: gli altri bastano */
      } finally {
        try { item.unload(); } catch { /* già scaricato */ }
      }
    }
  } finally {
    try { eb.destroy(); } catch { /* già chiuso */ }
  }
  return fuori;
}

const SISTEMA_RETRO =
  "Sei il redattore che scrive il testo di quarta di copertina. Ti do le PRIME pagine di un " +
  "romanzo — solo quelle, nient'altro — e scrivi tre o quattro frasi che dicano al lettore cosa " +
  "sta per leggere: chi incontra, dove si trova, che tono ha il libro.\n\n" +
  "Regole, e sono la ragione per cui esisti:\n" +
  "— NON raccontare niente che non sia in questi passaggi. Non dedurre come va a finire, non " +
  "anticipare svolte: chi legge questo testo non ha ancora aperto il libro.\n" +
  "— NON provare a indovinare quale libro sia, e se credi di riconoscerlo NON usare quello che " +
  "ricordi: scrivi solo da quello che ti ho dato.\n" +
  "— Niente giudizi da recensione («un capolavoro», «avvincente»), niente domande retoriche.\n" +
  "— Scrivi in italiano, in prosa distesa, senza titoli e senza elenchi.";

export async function chiediRetro(passaggi, fetcher) {
  const { chiedi, getOracleKey, TETTO_BREVE } = await import("./oracle.js");
  if (!getOracleKey()) return { error: "chiave" };
  if (!passaggi?.length) return { error: "nessunPassaggio" };
  const righe = [
    "Le prime pagine di un romanzo, in ordine. Non ti dico il titolo né l'autore, apposta.",
    ...passaggi.map((t, i) => `${i + 1}. «${t}»`),
  ];
  return chiedi({ system: SISTEMA_RETRO, user: righe.join("\n"), tetto: TETTO_BREVE }, fetcher);
}

import DISCWORLD, { SAGA, CICLI_NOSTRI } from "../data/discworldBooks.js";

// Riconoscere il romanzo dal titolo: i metadati degli EPUB sono spesso vuoti,
// storti o pieni di roba dell'editore («Guards! Guards! (Discworld Novels
// Book 8)»), e senza saga il glossario non si accende e il «prossimo della
// saga» non sa dove andare. Il titolo invece nel nome del file c'e' quasi
// sempre, in una forma o nell'altra.

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// i titoli lunghi per primi: «The Light Fantastic» non deve perdere contro
// «Light», e «Mort» non deve rubare la partita a «Monstrous Regiment»
const INDICE = DISCWORLD.map((b) => ({ ...b, k: norm(b.t) })).sort((a, b) => b.k.length - a.k.length);

// dentro una stringa piu' lunga, ma solo a confine di parola: «Mort» sta in
// «Mortal Engines» come sequenza di lettere, non come titolo
function contiene(testo, chiave) {
  const i = testo.indexOf(chiave);
  if (i < 0) return false;
  const prima = i === 0 ? " " : testo[i - 1];
  const dopo = i + chiave.length >= testo.length ? " " : testo[i + chiave.length];
  return !/[a-z0-9']/.test(prima) && !/[a-z0-9']/.test(dopo);
}

// Pratchett ha scritto parecchio fuori dal Disco: senza questa lista, il
// ripiego sull'autore darebbe il glossario del Mondo Disco anche a Good
// Omens o alla Lunga Terra, dove non c'entra niente.
const FUORI_SAGA = [
  "good omens", "nation", "dodger", "the long earth", "the long war",
  "the long mars", "the long utopia", "the long cosmos", "truckers", "diggers",
  "wings", "the carpet people", "strata", "the dark side of the sun",
  "only you can save mankind", "johnny and the dead", "johnny and the bomb",
];

export function riconosci({ title, author, fileName } = {}) {
  const campi = [title, fileName].filter(Boolean).map(norm);
  for (const campo of campi) {
    for (const b of INDICE) {
      if (contiene(campo, b.k)) return { saga: SAGA, sagaOrder: b.n, ciclo: b.c, titolo: b.t };
    }
  }
  // il titolo non si riconosce ma l'autore si': saga senza numero, che e'
  // comunque meglio di niente — il glossario si accende lo stesso
  const fuori = campi.some((campo) => FUORI_SAGA.some((t) => contiene(campo, t)));
  if (!fuori && norm(author).includes("pratchett")) {
    return { saga: SAGA, sagaOrder: null, ciclo: null, titolo: null };
  }
  return null;
}

// L'autore lo conosciamo, ma QUESTO titolo sta fuori dalla sua saga. Serve
// alla deduzione dalla biblioteca: senza, a Good Omens finirebbe «Discworld»
// solo perche' tutti gli altri Pratchett ce l'hanno scritto.
export function fuoriSaga({ title, author, fileName } = {}) {
  if (!norm(author).includes("pratchett")) return false;
  return [title, fileName]
    .filter(Boolean)
    .map(norm)
    .some((campo) => FUORI_SAGA.some((t) => contiene(campo, t)));
}

// «Abercrombie, Joe» e «Joe Abercrombie» sono la stessa persona, e negli
// ePub capitano tutt'e due: si confrontano le parole del nome, ordinate.
const chiaveAutore = (a) => norm(a).split(" ").filter(Boolean).sort().join(" ");

// LA SAGA SI IMPARA DALLA TUA BIBLIOTECA, non da una tabella.
//
// La tabella conosce un autore solo (Pratchett) e non potra' mai conoscerli
// tutti. Ma la saga di un libro spesso e' gia' scritta — da te — su un
// altro libro dello stesso autore: se hai messo «Circle of the World» su
// The Heroes, il cofanetto di First Law la vuole uguale.
//
// La regola e' volutamente timida, perche' un'attribuzione sbagliata
// mescola due storie: si propone solo se TUTTI i libri di quell'autore che
// una saga ce l'hanno dichiarano LA STESSA. Due saghe diverse dello stesso
// autore, e non si tocca niente.
export function sagaDaBiblioteca(libro = {}, libri = []) {
  const mio = chiaveAutore(libro.author);
  if (mio.length < 3) return null;
  let scelta = null;
  for (const b of libri) {
    if (b.id && libro.id && b.id === libro.id) continue;
    if (chiaveAutore(b.author) !== mio) continue;
    const s = String(b.saga || "").trim();
    if (!s) continue;
    if (!scelta) scelta = s;
    else if (s.toLowerCase() !== scelta.toLowerCase()) return null;
  }
  return scelta;
}

// Il ripasso dei libri gia' in biblioteca. Riempire i campi vuoti non
// basta: chi ha importato i libri quando i cicli si chiamavano «Streghe»,
// o «The Witches Cycle», quel nome ce l'ha ancora scritto, e un campo
// pieno non e' vuoto — il tasto rispondeva «erano gia' tutti a posto» e i
// nomi vecchi restavano li' per sempre.
//
// Quindi i nomi che abbiamo scritto NOI si aggiornano, e tutto il resto
// no: quello che il lettore ha scritto a mano non si tocca mai, nemmeno
// quando il riconoscimento la pensa diversamente, perche' su questi campi
// l'ultima parola e' sua.
export function ripassa(libro = {}, libri = []) {
  const trovato = riconosci({ title: libro.title, author: libro.author });
  const saga = String(libro.saga || "").trim();
  const serie = String(libro.series || "").trim();
  const tocchi = {};
  let dedotta = false;

  if (trovato) {
    if (!saga) tocchi.saga = trovato.saga;
    if (libro.sagaOrder == null && trovato.sagaOrder != null) tocchi.sagaOrder = trovato.sagaOrder;
  } else if (!saga && !fuoriSaga(libro)) {
    // la tabella non lo conosce: glielo puo' dire la tua biblioteca
    const dalla = sagaDaBiblioteca(libro, libri);
    if (dalla) {
      tocchi.saga = dalla;
      dedotta = true;
    }
  }

  if (!serie) {
    if (trovato?.ciclo) tocchi.series = trovato.ciclo;
  } else if (
    Object.prototype.hasOwnProperty.call(CICLI_NOSTRI, serie) &&
    (trovato?.saga === SAGA || saga === SAGA)
  ) {
    // se il titolo si riconosce ancora, il ciclo giusto lo dice la tabella,
    // che e' piu' informata della mappa dei nomi vecchi: sa promuovere un
    // «Autoconclusivo» ad «Ancient Civilizations». Se invece si riconosce
    // solo l'autore — titolo tradotto, metadati riscritti — la tabella non
    // sa di che libro parliamo e direbbe «nessun ciclo», cancellando un
    // ciclo buono: li' vale la mappa dei nomi.
    const giusto = trovato?.titolo ? trovato.ciclo : CICLI_NOSTRI[serie];
    if ((giusto || "") !== serie) tocchi.series = giusto || "";
  }

  // `campi` sono i valori da scrivere; `dedotta` dice che la saga non
  // l'abbiamo riconosciuta ma DEDOTTA dagli altri libri dello stesso
  // autore — e' un'informazione del lettore, e il resoconto la dice a parte
  return Object.keys(tocchi).length ? { campi: tocchi, dedotta } : null;
}

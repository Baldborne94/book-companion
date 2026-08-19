import DISCWORLD, { SAGA, CICLI_NOSTRI } from "../data/discworldBooks.js";
import HORUS, { SAGA as SAGA_HH } from "../data/horusHeresy.js";

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

// LE TAVOLE. Una per saga, e da qui in poi il codice non sa piu' quale sta
// guardando: aggiungerne una terza e' scrivere un file in `data/` e una
// riga qui.
//
// Le due che ci sono adesso pero' NON si riconoscono allo stesso modo, e la
// differenza sta nell'autore. Pratchett ha scritto quasi solo Mondo Disco,
// quindi il ripiego «l'autore lo conosco, la saga gliela do lo stesso» ci
// azzecca quasi sempre (e i suoi fuori-saga stanno in un elenco). L'Eresia
// di Horus la scrivono venti autori che scrivono anche moltissimo altro:
// col ripiego sull'autore, i Gaunt's Ghosts di Abnett diventerebbero
// Eresia. Per questo `autore` li' e' `null`.
const TAVOLE = [
  { saga: SAGA, libri: DISCWORLD, ordine: (b) => b.n, autore: "pratchett", fuori: FUORI_SAGA, stretta: false },
  // `o` e non `n`: l'ordine e' quello del percorso CD8D, non la numerazione
  // della collana. Vedi il commento in testa a `horusHeresy.js`.
  { saga: SAGA_HH, libri: HORUS, ordine: (b) => b.o, autore: null, fuori: [], stretta: true },
];

// I titoli lunghi per primi, e da TUTTE le tavole insieme: «Garro» non
// deve prendersi «Garro: Knight of the Grey». Oggi quella coppia la
// fermerebbe anche la regola della copertura — l'antologia non porta
// l'autore, e «garro» copre un quinto di quel campo — ma l'ordine e' la
// difesa che vale anche per le tavole LARGHE, dove la copertura non si
// applica: nel Mondo Disco una coppia cosi' non c'e', e il giorno che
// arriva non deve dipendere dall'ordine con cui e' scritto un file.
const INDICE = TAVOLE.flatMap((tav) =>
  tav.libri.map((b) => ({ ...b, k: norm(b.t), tav }))
).sort((a, b) => b.k.length - a.k.length);

// QUANDO IL CONTENIMENTO NON BASTA.
//
// Il Mondo Disco se la cava col solo contenimento: i titoli sono
// distintivi e c'e' il ripiego sull'autore a raccogliere quel che scappa.
// L'Eresia no. Sedici delle sue voci sono parole comuni — «Scars»,
// «Mortis», «Betrayer», «Fulgrim» — e venti autori diversi la scrivono
// mentre scrivono anche moltissimo altro: presa per contenimento, «Scars»
// si mangerebbe «Scars of the Past» di chiunque.
//
// Le tavole `strette` chiedono un secondo segnale, e ne basta uno dei due:
// o l'AUTORE conferma, o il titolo e' il GROSSO di quello che c'e' scritto.
// L'autore si cerca anche nel campo, perche' nei nomi dei file ci sta quasi
// sempre e nei metadati quasi mai.
const cognome = (a) => norm(a).split(" ").filter(Boolean).pop() || "";

// Il rumore dell'editore e del file — «(The Horus Heresy Book 24)»,
// «.epub», il numero della collana — non e' titolo, e non deve contare
// quando si misura quanto del campo il titolo copre. Senza questa
// ripulita, «Betrayer (Horus Heresy 24).epub» non si riconoscerebbe: il
// titolo sarebbe un terzo di quel che c'e' scritto.
// «The Horus Heresy» nel nome del file si scrive in tutt'e due i modi, e
// spesso senza l'articolo: cercando la forma intera, «Betrayer (Horus
// Heresy 24).epub» restava con mezza saga attaccata al titolo e non si
// riconosceva piu'.
const senzaArticolo = (s) => norm(s).replace(/^(the|il|lo|la|i|gli|le)\s+/, "");

const senzaRumore = (campo, saga) =>
  campo
    .replace(senzaArticolo(saga), " ")
    .replace(/\b(book|vol|volume|no|n)\s*\d+\b/g, " ")
    .replace(/\b(epub|mobi|azw3|pdf|retail|ebook)\b/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// meta' e' la soglia: sotto, quel titolo e' una citazione dentro una frase
// piu' lunga, non il titolo del libro che hai in mano
const COPERTURA = 0.5;

function combacia(campo, voce, autoreNorm) {
  if (!contiene(campo, voce.k)) return false;
  if (!voce.tav.stretta) return true;
  const cogn = voce.a ? cognome(voce.a) : "";
  const suo = cogn && (autoreNorm.includes(cogn) || campo.includes(cogn));
  if (suo) return true;
  // UN AUTORE SBAGLIATO E' UNA PROVA; UN AUTORE MANCANTE NON E' NIENTE.
  // Se sappiamo di chi e' il libro e chi ce lo porta dice un altro nome,
  // non e' quello: «Betrayer» di chiunque altro non e' il Betrayer
  // dell'Eresia. Ma meta' degli ePub l'autore non ce l'ha, e li' il
  // silenzio non deve valere come smentita.
  if (cogn && autoreNorm) return false;
  const nudo = senzaRumore(campo, voce.tav.saga);
  return voce.k.length >= nudo.length * COPERTURA;
}

export function riconosci({ title, author, fileName } = {}) {
  const campi = [title, fileName].filter(Boolean).map(norm);
  const chiAutore = norm(author);
  for (const campo of campi) {
    for (const b of INDICE) {
      if (combacia(campo, b, chiAutore)) {
        return { saga: b.tav.saga, sagaOrder: b.tav.ordine(b) ?? null, ciclo: b.c, titolo: b.t };
      }
    }
  }
  // il titolo non si riconosce ma l'autore si': saga senza numero, che e'
  // comunque meglio di niente — il glossario si accende lo stesso. Vale solo
  // per le tavole che un autore proprio ce l'hanno.
  for (const tav of TAVOLE) {
    if (!tav.autore || !chiAutore.includes(tav.autore)) continue;
    if (campi.some((campo) => tav.fuori.some((t) => contiene(campo, t)))) continue;
    return { saga: tav.saga, sagaOrder: null, ciclo: null, titolo: null };
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

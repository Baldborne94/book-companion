import DISCWORLD, { SAGA } from "../data/discworldBooks.js";

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

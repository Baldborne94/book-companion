// THE BOUND AND THE BROKEN, di Ryan Cahill: i quattro romanzi, in ordine.
//
// Chiesto dal lettore, con la ricerca di Google accanto all'app che non
// trovava niente: «perché non mi trovi nulla?». Su Wikidata non ci sono né
// la serie né i libri. La fonte e' Open Library, misurato il 10 novembre 2026:
// le edizioni scrivono la serie («The Bound And the Broken») e l'anno su
// ciascuno: Of Blood and Fire 2021, Of Darkness and Light 2021 (dicembre),
// Of War and Ruin 2023, Of Empires and Dust 2025. I numeri sono l'ordine
// d'uscita, che per una serie di romanzi in fila e' quello della serie.
//
// SOLO I ROMANZI: The Fall (95 pagine, 2021) e The Exile (2022), che le
// edizioni mettono nella stessa serie, sono le novelle prima della storia
// (0.5 e 0.6 su Goodreads) e restano fuori.
export const SAGA = "The Bound and the Broken";

const A = "Ryan Cahill";

export default [
  { o: 1, t: "Of Blood and Fire", c: SAGA, a: A },
  { o: 2, t: "Of Darkness and Light", c: SAGA, a: A },
  { o: 3, t: "Of War and Ruin", c: SAGA, a: A },
  { o: 4, t: "Of Empires and Dust", c: SAGA, a: A },
];

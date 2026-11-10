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
// I ROMANZI SONO LA GUIDA; le STORIE DI MEZZO (`NOVELLE`, chiesto dal
// lettore con la pagina della serie su Goodreads: «non mi consideri anche le
// storie di intramezzo delle serie?») stanno a parte, col loro numero, e le
// usa solo l'elenco di «📥 Senza file». Fonte: Hardcover, misurato il 10
// novembre 2026 (posizione e data d'uscita), lo stesso elenco di Goodreads.
export const NOVELLE = [
  { o: 0.5, t: "The Fall", c: "The Bound and the Broken", a: "Ryan Cahill", anno: 2020 },
  { o: 0.6, t: "The Blood that Burns the Winter Snow", c: "The Bound and the Broken", a: "Ryan Cahill", anno: 2024 },
  { o: 2.5, t: "The Exile", c: "The Bound and the Broken", a: "Ryan Cahill", anno: 2022 },
  { o: 3.5, t: "The Ice", c: "The Bound and the Broken", a: "Ryan Cahill", anno: 2023 },
  { o: 4.5, t: "The Truth", c: "The Bound and the Broken", a: "Ryan Cahill", anno: 2026 },
];
export const SAGA = "The Bound and the Broken";

const A = "Ryan Cahill";

export default [
  { o: 1, t: "Of Blood and Fire", c: SAGA, a: A },
  { o: 2, t: "Of Darkness and Light", c: SAGA, a: A },
  { o: 3, t: "Of War and Ruin", c: SAGA, a: A },
  { o: 4, t: "Of Empires and Dust", c: SAGA, a: A },
];

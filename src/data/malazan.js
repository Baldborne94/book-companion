// IL LIBRO DEI CADUTI DI MALAZAN, di Steven Erikson: i dieci romanzi, in
// ordine.
//
// Chiesto dal lettore: «fai anche le guide di Malazan e Stormlight». La
// fonte e' Wikidata, misurato il 9 novembre 2026 con «📥 Senza file»: la
// serie «Malazan Book of the Fallen» coi dieci romanzi numerati da 1 a 10
// (Gardens of the Moon 1999 … The Crippled God 2011). L'ordine di
// pubblicazione e' quello di lettura.
//
// Solo la serie di Erikson: i romanzi di Esslemont dello stesso mondo (le
// «Novels of the Malazan Empire») e le altre serie di Erikson (Kharkanas,
// Witness, le novelle di Bauchelain e Korbal Broach) sono altre serie. Per
// questo l'autore sta su ogni volume e non sulla tavola: «e' un Erikson»
// non vuol dire «e' del Libro dei Caduti».
//
// Gli ALIAS sono i titoli che senza articolo restano di una parola sola
// («Bonehunters», che il confronto per parole piene non vede) e
// l'apostrofo caduto («Reapers Gale»).
export const SAGA = "Malazan Book of the Fallen";

const A = "Steven Erikson";

export default [
  { o: 1, t: "Gardens of the Moon", c: SAGA, a: A },
  { o: 2, t: "Deadhouse Gates", c: SAGA, a: A },
  { o: 3, t: "Memories of Ice", c: SAGA, a: A },
  { o: 4, t: "House of Chains", c: SAGA, a: A },
  { o: 5, t: "Midnight Tides", c: SAGA, a: A },
  { o: 6, t: "The Bonehunters", c: SAGA, a: A, alias: ["Bonehunters"] },
  { o: 7, t: "Reaper's Gale", c: SAGA, a: A, alias: ["Reapers Gale"] },
  { o: 8, t: "Toll the Hounds", c: SAGA, a: A },
  { o: 9, t: "Dust of Dreams", c: SAGA, a: A },
  { o: 10, t: "The Crippled God", c: SAGA, a: A },
];

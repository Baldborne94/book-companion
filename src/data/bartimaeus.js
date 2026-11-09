// BARTIMAEUS, di Jonathan Stroud: la trilogia e il prequel, in ordine.
//
// Chiesto dal lettore: «fai anche le guide di Bartimaeus e Kingkiller». La
// fonte e' Wikidata, misurato il 9 novembre 2026 con la ricerca per nome:
// la «Bartimaeus Sequence» coi quattro romanzi numerati (The Amulet of
// Samarkand 2003, The Golem's Eye 2004, Ptolemy's Gate 2005, The Ring of
// Solomon 2010). Il quarto e' un prequel, e sta al suo numero: e' l'ordine
// di pubblicazione, quello in cui l'autore li ha pensati.
//
// Gli ALIAS sono i titoli dell'edizione italiana (il lettore e' italiano)
// e l'apostrofo caduto. Stroud scrive anche Lockwood: l'autore sta su ogni
// volume e non sulla tavola.
export const SAGA = "Bartimaeus";

const A = "Jonathan Stroud";

export default [
  { o: 1, t: "The Amulet of Samarkand", c: SAGA, a: A, alias: ["L'amuleto di Samarcanda"] },
  { o: 2, t: "The Golem's Eye", c: SAGA, a: A, alias: ["The Golems Eye", "L'occhio del Golem"] },
  { o: 3, t: "Ptolemy's Gate", c: SAGA, a: A, alias: ["Ptolemys Gate", "La porta di Tolomeo"] },
  { o: 4, t: "The Ring of Solomon", c: SAGA, a: A, alias: ["L'anello di Salomone"], nota: "prequel" },
];

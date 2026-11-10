// LE CRONACHE DELL'ASSASSINO DEL RE (The Kingkiller Chronicle), di Patrick
// Rothfuss: i due romanzi usciti, in ordine.
//
// Chiesto dal lettore insieme a Bartimaeus. La fonte e' Wikidata, misurato
// il 9 novembre 2026: la serie coi due romanzi numerati (The Name of the
// Wind 2007, The Wise Man's Fear 2011). «The Slow Regard of Silent Things»
// e' una novella e resta fuori, come le novelle di Sanderson; il terzo
// romanzo non e' uscito, e una guida non promette un libro che non c'e'.
//
// Gli ALIAS sono i titoli italiani e l'apostrofo caduto.
export const SAGA = "The Kingkiller Chronicle";

const A = "Patrick Rothfuss";

export default [
  { o: 1, t: "The Name of the Wind", c: SAGA, a: A, alias: ["Il nome del vento"] },
  { o: 2, t: "The Wise Man's Fear", c: SAGA, a: A, alias: ["The Wise Mans Fear", "La paura del saggio"] },
];

// LE STORIE DI MEZZO (chiesto dal lettore: «non mi consideri anche le storie
// di intramezzo delle serie?»): a parte dai romanzi, fuori dal cammino e dal
// riconoscimento, col loro numero; le usa solo l'elenco di «📥 Senza file»,
// che le propone senza spunta. Fonte: Hardcover, misurato il 10 novembre
// 2026 (la posizione nella serie e l'anno); solo quelle gia' uscite.
export const NOVELLE = [
  { o: 0.6, t: "The Narrow Road Between Desires", c: SAGA, a: "Patrick Rothfuss", anno: 2023 },
  { o: 2.5, t: "The Slow Regard of Silent Things", c: SAGA, a: "Patrick Rothfuss", anno: 2014 },
];

// LOCKWOOD & CO., di Jonathan Stroud: i cinque romanzi, in ordine.
//
// Chiesto dal lettore insieme a Mistborn. La fonte e' Wikidata, misurato il
// 9 novembre 2026: la serie coi cinque romanzi numerati da 1 a 5 (The
// Screaming Staircase 2013 … The Empty Grave). Stroud scrive anche
// Bartimaeus: l'autore sta su ogni volume e non sulla tavola.
export const SAGA = "Lockwood & Co.";

const A = "Jonathan Stroud";

export default [
  { o: 1, t: "The Screaming Staircase", c: SAGA, a: A },
  { o: 2, t: "The Whispering Skull", c: SAGA, a: A },
  { o: 3, t: "The Hollow Boy", c: SAGA, a: A },
  { o: 4, t: "The Creeping Shadow", c: SAGA, a: A },
  { o: 5, t: "The Empty Grave", c: SAGA, a: A },
];

// LE STORIE DI MEZZO (chiesto dal lettore: «non mi consideri anche le storie
// di intramezzo delle serie?»): a parte dai romanzi, fuori dal cammino e dal
// riconoscimento, col loro numero; le usa solo l'elenco di «📥 Senza file»,
// che le propone senza spunta. Fonte: Hardcover, misurato il 10 novembre
// 2026 (la posizione nella serie e l'anno); solo quelle gia' uscite.
export const NOVELLE = [
  { o: 4.5, t: "A Portland Row Christmas", c: SAGA, a: "Jonathan Stroud", anno: 2023 },
];

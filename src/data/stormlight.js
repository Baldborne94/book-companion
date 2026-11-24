// LE CRONACHE DELLA FOLGORLUCE (The Stormlight Archive), di Brandon
// Sanderson: i cinque romanzi del primo arco, in ordine.
//
// Chiesto dal lettore insieme a Malazan. La fonte e' Wikidata, misurato il
// 9 novembre 2026: la serie coi cinque romanzi numerati da 1 a 5 (The Way
// of Kings 2010, Words of Radiance 2014, Oathbringer 2017, Rhythm of War
// 2020, Wind and Truth 2024).
//
// SOLO I ROMANZI: le novelle fra un romanzo e l'altro (Edgedancer,
// Dawnshard) il lettore non le vuole («non mi mettere le storie brevi…
// soltanto i romanzi principali e le saghe principali»), e «The Stormlight
// Archive (Part One)» e' la prima meta' di The Way of Kings stampata a parte.
// L'autore sta su ogni volume: Sanderson scrive anche Mistborn, Skyward e
// il resto del Cosmere.
export const SAGA = "The Stormlight Archive";

const A = "Brandon Sanderson";

export default [
  { o: 1, t: "The Way of Kings", c: SAGA, a: A },
  { o: 2, t: "Words of Radiance", c: SAGA, a: A },
  { o: 3, t: "Oathbringer", c: SAGA, a: A },
  { o: 4, t: "Rhythm of War", c: SAGA, a: A },
  { o: 5, t: "Wind and Truth", c: SAGA, a: A },
];

// LE STORIE DI MEZZO (chiesto dal lettore: «non mi consideri anche le storie
// di intramezzo delle serie?»): a parte dai romanzi, fuori dal cammino e dal
// riconoscimento, col loro numero; le usa solo l'elenco di «📥 Senza file»,
// che le propone senza spunta. Fonte: Hardcover, misurato il 10 novembre
// 2026 (la posizione nella serie e l'anno); solo quelle gia' uscite.
export const NOVELLE = [
  { o: 2.1, t: "Elsecaller and King Lopen the First of Alethkar", c: SAGA, a: "Brandon Sanderson", anno: 2025 },
  { o: 2.5, t: "Edgedancer", c: SAGA, a: "Brandon Sanderson", anno: 2016 },
  { o: 3.5, t: "Dawnshard", c: SAGA, a: "Brandon Sanderson", anno: 2020 },
];

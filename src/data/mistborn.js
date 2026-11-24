// MISTBORN, di Brandon Sanderson: i sette romanzi delle due ere, in ordine.
//
// Chiesto dal lettore: «fai anche le guide di Mistborn e Lockwood». La
// fonte e' Wikidata, misurato il 9 novembre 2026 con «📥 Senza file»: la
// serie coi sette romanzi numerati da 1 a 7 (The Final Empire 2006 … The
// Lost Metal 2022). I primi tre sono la prima era, gli altri quattro la
// seconda (Wax e Wayne): i due cicli (`c`), come i cicli della Seconda
// Apocalisse.
//
// SOLO I ROMANZI: «Secret History» e' una novella. E l'autore sta su ogni
// volume: Sanderson scrive anche Stormlight e il resto del Cosmere.
//
// Il titolo e' quello corto («The Final Empire»): il nome del file porta
// spesso la serie davanti («Mistborn: The Final Empire») e il titolo ci sta
// dentro. Un file che si chiama soltanto «Mistborn» non si riconosce:
// come alias del primo prenderebbe anche «Mistborn: Secret History».
export const SAGA = "Mistborn";

export const ERA1 = "Era One";
export const ERA2 = "Era Two · Wax and Wayne";

const A = "Brandon Sanderson";

export default [
  { o: 1, t: "The Final Empire", c: ERA1, a: A },
  { o: 2, t: "The Well of Ascension", c: ERA1, a: A },
  { o: 3, t: "The Hero of Ages", c: ERA1, a: A },
  { o: 4, t: "The Alloy of Law", c: ERA2, a: A },
  { o: 5, t: "Shadows of Self", c: ERA2, a: A },
  { o: 6, t: "The Bands of Mourning", c: ERA2, a: A },
  { o: 7, t: "The Lost Metal", c: ERA2, a: A },
];

// LE STORIE DI MEZZO (chiesto dal lettore: «non mi consideri anche le storie
// di intramezzo delle serie?»): a parte dai romanzi, fuori dal cammino e dal
// riconoscimento, col loro numero; le usa solo l'elenco di «📥 Senza file»,
// che le propone senza spunta. Fonte: Hardcover, misurato il 10 novembre
// 2026 (la posizione nella serie e l'anno); solo quelle gia' uscite.
export const NOVELLE = [
  { o: 1.5, t: "The Eleventh Metal", c: ERA1, a: "Brandon Sanderson", anno: 2012 },
  { o: 3.5, t: "Mistborn: Secret History", c: ERA1, a: "Brandon Sanderson", anno: 2016 },
];

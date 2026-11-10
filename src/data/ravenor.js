// RAVENOR, di Dan Abnett: i tre romanzi dell'inquisitore Gideon Ravenor,
// allievo di Eisenhorn, e la raccolta che li contiene.
//
// Chiesto dal lettore insieme a Eisenhorn. La fonte e' il Warhammer 40k
// Wiki di Fandom: la pagina della serie di Eisenhorn (dopo Hereticus,
// «Abnett wrote the Ravenor series… published 2005-7») e quella di
// «Ravenor: The Omnibus» (2019), che elenca i tre romanzi con l'anno:
// Ravenor 2004, Ravenor Returned 2005, Ravenor Rogue 2007.
//
// Come Eisenhorn: una serie, la raccolta e' una riga sua (`tipo:
// "omnibus"`) e i romanzi stanno dentro (`in`). «Ravenor» e' insieme il
// nome della serie e il titolo del primo: un file «Ravenor 02 - Ravenor
// Returned» non e' il primo, e lo decide l'ordine di `INDICE` (il titolo
// piu' lungo prima, il nome di una saga per ultimo).
//
// Il seguito delle due serie, «Bequin» (Pariah, 2012: «Ravenor vs
// Eisenhorn»), e' una terza serie e non sta qui.
export const SAGA = "Ravenor";
export const OMNIBUS = "Ravenor: The Omnibus";

const A = "Dan Abnett";

export default [
  { o: 1, t: "Ravenor", c: SAGA, a: A, in: OMNIBUS },
  { o: 2, t: "Ravenor Returned", c: SAGA, a: A, in: OMNIBUS },
  { o: 3, t: "Ravenor Rogue", c: SAGA, a: A, in: OMNIBUS },
  {
    o: null,
    tipo: "omnibus",
    t: OMNIBUS,
    c: SAGA,
    a: A,
    nota: "raccolta: Ravenor, Ravenor Returned e Ravenor Rogue",
  },
];

// LE STORIE DI MEZZO (chiesto dal lettore: «non mi consideri anche le storie
// di intramezzo delle serie?»): a parte dai romanzi, fuori dal cammino e dal
// riconoscimento, col loro numero; le usa solo l'elenco di «📥 Senza file»,
// che le propone senza spunta. Fonte: Hardcover, misurato il 10 novembre
// 2026 (la posizione nella serie e l'anno); solo quelle gia' uscite.
export const NOVELLE = [
  { o: 1.5, t: "Thorn Wishes Talon", c: SAGA, a: "Dan Abnett", anno: 2011 },
];

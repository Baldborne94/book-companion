// IL MONDO DI THE FIRST LAW, di Joe Abercrombie: tre guide dello stesso
// `universo` (la trilogia, i tre romanzi a se', The Age of Madness), come il
// 40K: ognuna tiene i suoi numeri e tutte finiscono nella raccolta dove il
// lettore tiene Abercrombie (sul suo scaffale ci sono «First Law» e «First
// Law Trilogy», in `test/saghe-fumetti.test.mjs`).
//
// La fonte e' Wikidata, misurato il 9 novembre 2026, romanzo per romanzo:
// The Blade Itself 2006, Before They Are Hanged 2007, Last Argument of Kings
// 2008; Best Served Cold 2009, The Heroes 2011, Red Country 2012; A Little
// Hatred 2019, The Trouble with Peace 2020, The Wisdom of Crowds 2021.
// Gli ALIAS sono i titoli italiani che Wikidata registra.
// SOLO I ROMANZI: Sharp Ends (racconti) no.
export const TRILOGIA = "The First Law Trilogy";
export const A_SE = "The First Law Standalones";
export const FOLLIA = "The Age of Madness";
export const UNIVERSO = "The First Law";

const A = "Joe Abercrombie";

export const LA_TRILOGIA = [
  { o: 1, t: "The Blade Itself", c: TRILOGIA, a: A, alias: ["Il richiamo delle spade"] },
  { o: 2, t: "Before They Are Hanged", c: TRILOGIA, a: A, alias: ["Non prima che siano impiccati"] },
  { o: 3, t: "Last Argument of Kings", c: TRILOGIA, a: A, alias: ["L'ultima ragione dei re"] },
];

export const I_SOLI = [
  { o: 1, t: "Best Served Cold", c: A_SE, a: A, alias: ["Il sapore della vendetta"] },
  { o: 2, t: "The Heroes", c: A_SE, a: A },
  { o: 3, t: "Red Country", c: A_SE, a: A },
];

export const LA_FOLLIA = [
  { o: 1, t: "A Little Hatred", c: FOLLIA, a: A },
  { o: 2, t: "The Trouble with Peace", c: FOLLIA, a: A },
  { o: 3, t: "The Wisdom of Crowds", c: FOLLIA, a: A },
];

// LE STORIE DI MEZZO (chiesto dal lettore: «non mi consideri anche le storie
// di intramezzo delle serie?»): a parte dai romanzi, fuori dal cammino e dal
// riconoscimento, col loro numero; le usa solo l'elenco di «📥 Senza file»,
// che le propone senza spunta. Fonte: Hardcover, misurato il 10 novembre
// 2026 (la posizione nella serie e l'anno); solo quelle gia' uscite.
export const NOVELLE_FOLLIA = [
  { o: 0, t: "The Great Change", c: FOLLIA, a: "Joe Abercrombie", anno: 2023 },
];

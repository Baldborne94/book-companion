// IL MONDO DI MALAZAN OLTRE IL LIBRO DEI CADUTI: i romanzi di Ian Cameron
// Esslemont e le altre serie di Steven Erikson, guide dello stesso
// `universo` del Libro dei Caduti (`data/malazan.js`).
//
// Chiesto dal lettore: «fai le guide di Cosmoverso e Malazan». Come il 40K,
// ogni serie tiene i suoi numeri («Malazan 08 - Toll the Hounds» resta
// l'ottavo) e tutte finiscono nella raccolta dove il lettore tiene Malazan.
//
// La fonte e' Wikidata, misurato il 9 novembre 2026, serie per serie, coi
// numeri e gli anni che dice lui:
// - Novels of the Malazan Empire (Esslemont): Night of Knives 2004, Return
//   of the Crimson Guard 2008, Stonewielder 2010, Orb, Sceptre, Throne 2012,
//   Blood and Bone 2012, Assail 2014 (senza numeri: per anno);
// - Path to Ascendancy (Esslemont): Dancer's Lament 2016, Deadhouse Landing
//   2017, Kellanved's Reach 2019, Forge of the High Mage 2023;
// - The Kharkanas Trilogy (Erikson): Forge of Darkness 2012, Fall of Light
//   2016. Il terzo, Walk in Shadow, su Wikidata non ha data: non e' uscito;
// - Witness (Erikson): The God Is Not Willing 2021, No Life Forsaken 2025,
//   Legacies of Betrayal 2026.
// SOLO I ROMANZI: le novelle di Bauchelain e Korbal Broach no.
export const MALAZAN_EMPIRE = "Novels of the Malazan Empire";
export const PATH = "Path to Ascendancy";
export const KHARKANAS = "The Kharkanas Trilogy";
export const WITNESS = "Witness";

const E = "Ian C. Esslemont";
const S = "Steven Erikson";

export const EMPIRE = [
  { o: 1, t: "Night of Knives", c: MALAZAN_EMPIRE, a: E },
  { o: 2, t: "Return of the Crimson Guard", c: MALAZAN_EMPIRE, a: E },
  { o: 3, t: "Stonewielder", c: MALAZAN_EMPIRE, a: E },
  { o: 4, t: "Orb Sceptre Throne", c: MALAZAN_EMPIRE, a: E, alias: ["Orb, Sceptre, Throne"] },
  { o: 5, t: "Blood and Bone", c: MALAZAN_EMPIRE, a: E },
  { o: 6, t: "Assail", c: MALAZAN_EMPIRE, a: E },
];

export const ASCESA = [
  { o: 1, t: "Dancer's Lament", c: PATH, a: E, alias: ["Dancers Lament"] },
  { o: 2, t: "Deadhouse Landing", c: PATH, a: E },
  { o: 3, t: "Kellanved's Reach", c: PATH, a: E, alias: ["Kellanveds Reach"] },
  { o: 4, t: "Forge of the High Mage", c: PATH, a: E },
];

export const KHARKANAS_LIBRI = [
  { o: 1, t: "Forge of Darkness", c: KHARKANAS, a: S },
  { o: 2, t: "Fall of Light", c: KHARKANAS, a: S },
];

export const WITNESS_LIBRI = [
  { o: 1, t: "The God Is Not Willing", c: WITNESS, a: S },
  { o: 2, t: "No Life Forsaken", c: WITNESS, a: S },
  { o: 3, t: "Legacies of Betrayal", c: WITNESS, a: S },
];

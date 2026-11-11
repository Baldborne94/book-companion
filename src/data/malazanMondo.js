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
//   Blood and Bone 2012, Assail 2014 (senza numeri: per anno; su Hardcover
//   Assail esce il 7 novembre 2013, e conta per l'ordine del mondo, sotto);
// - Path to Ascendancy (Esslemont): Dancer's Lament 2016, Deadhouse Landing
//   2017, Kellanved's Reach 2019, Forge of the High Mage 2023;
// - The Kharkanas Trilogy (Erikson): Forge of Darkness 2012, Fall of Light
//   2016. Il terzo, Walk in Shadow, su Wikidata non ha data: non e' uscito;
// - Witness (Erikson): The God Is Not Willing 2021, No Life Forsaken 2025,
//   Legacies of Betrayal 2026.
// SOLO I ROMANZI: le novelle di Bauchelain e Korbal Broach no.
import { SAGA as LIBRO_DEI_CADUTI } from "./malazan.js";

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

// L'ORDINE DI LETTURA DEL MONDO INTERO (`MONDI` in `sagaBooks.js`), chiesto
// dal lettore: «mi metti l'ordine di lettura di tutti i libri del malazan
// universe e non solo delle singole serie?». E' L'ORDINE DI USCITA, quello
// che Erikson ed Esslemont consigliano: le due serie dell'Impero si
// scambiano rimandi e ognuna e' scritta sapendo quel che l'altra ha gia'
// detto. Ogni riga e' [guida, titolo, data della prima edizione]: la data
// la dice Wikidata (P577) dove ce l'ha al giorno, se no la prima edizione
// su Hardcover (un «1° gennaio» li' e' solo l'anno), misurato l'11
// novembre 2026 — e il test guarda che la fila sia proprio in ordine di
// data, cosi' una riga spostata a mano si vede. I pari merito dell'anno:
// Return of the Crimson Guard esce prima nell'edizione limitata di PS
// Publishing (maggio 2008), Toll the Hounds il 30 giugno; Orb, Sceptre,
// Throne il 19 gennaio 2012, prima di Forge of Darkness; Dancer's Lament
// il 25 febbraio 2016, prima di Fall of Light (21 aprile). Forge of the
// High Mage e' del 2023 (il «2020» di Hardcover e' una data annunciata e
// poi spostata).
// Il cammino non rinumera niente: ogni volume tiene il numero della sua
// serie.
export const ORDINE = [
  [LIBRO_DEI_CADUTI, "Gardens of the Moon", "1999-04-01"],
  [LIBRO_DEI_CADUTI, "Deadhouse Gates", "2000-09-01"],
  [LIBRO_DEI_CADUTI, "Memories of Ice", "2001-12-06"],
  [LIBRO_DEI_CADUTI, "House of Chains", "2002-12-02"],
  [LIBRO_DEI_CADUTI, "Midnight Tides", "2004-03-01"],
  [MALAZAN_EMPIRE, "Night of Knives", "2004-09-01"],
  [LIBRO_DEI_CADUTI, "The Bonehunters", "2006-03-01"],
  [LIBRO_DEI_CADUTI, "Reaper's Gale", "2007"],
  [MALAZAN_EMPIRE, "Return of the Crimson Guard", "2008-05"],
  [LIBRO_DEI_CADUTI, "Toll the Hounds", "2008-06-30"],
  [LIBRO_DEI_CADUTI, "Dust of Dreams", "2009"],
  [MALAZAN_EMPIRE, "Stonewielder", "2010-11-25"],
  [LIBRO_DEI_CADUTI, "The Crippled God", "2011"],
  [MALAZAN_EMPIRE, "Orb Sceptre Throne", "2012-01-19"],
  [KHARKANAS, "Forge of Darkness", "2012-07-31"],
  [MALAZAN_EMPIRE, "Blood and Bone", "2012-11-22"],
  [MALAZAN_EMPIRE, "Assail", "2013-11-07"],
  [PATH, "Dancer's Lament", "2016-02-25"],
  [KHARKANAS, "Fall of Light", "2016-04-21"],
  [PATH, "Deadhouse Landing", "2017-11-14"],
  [PATH, "Kellanved's Reach", "2019-02-19"],
  [WITNESS, "The God Is Not Willing", "2021-11-16"],
  [PATH, "Forge of the High Mage", "2023"],
  [WITNESS, "No Life Forsaken", "2025-10-23"],
  [WITNESS, "Legacies of Betrayal", "2026-10-01"],
];

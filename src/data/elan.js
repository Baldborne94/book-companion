// IL MONDO DI ELAN, di Michael J. Sullivan: quattro serie nello stesso
// mondo, quattro guide dello stesso `universo`, come il Cosmere. Chiesto dal
// lettore: «The World of Elan che comprende diverse saghe scritta da Michael
// J. Sullivan come mai non le riconosce ma le vede solo come saghe singole a
// parte?». Hardcover ha le quattro serie ma non il mondo (cercato per nome:
// niente), quindi il mondo lo dice questa tavola.
//
// LA FONTE E' HARDCOVER, misurato l'11 novembre 2026: le serie (The Riyria
// Revelations, The Riyria Chronicles, The Legends of the First Empire, The
// Rise and Fall) con la posizione di ogni libro. Le DATE, che su Hardcover
// sono spesso il solo anno («-01-01»), sono la prima edizione datata al
// giorno su Hardcover o su Open Library, guardate libro per libro; dove le
// due fonti non sono d'accordo (Sullivan esce prima per i sostenitori, poi
// in libreria) vale la prima, e l'ordine fra le serie non cambia. Wikidata
// rispondeva 429. Il pareggio del 2017 l'hanno deciso le edizioni di
// Hardcover: Age of Swords il 25 luglio, The Disappearance of Winter's
// Daughter il 5 dicembre. Blythin Castle (Chronicles #6) e' annunciato per
// il 2027: non e' uscito e non entra.
//
// LE RIVELAZIONI SONO SEI ROMANZI e tre raccolte di Orbit (Theft of Swords,
// Rise of Empire, Heir of Novron), due romanzi ciascuna: una raccolta e' una
// riga sua (`tipo: "omnibus"`), e chi ce l'ha ha i due romanzi dentro (`in`),
// come l'omnibus di Eisenhorn. Hardcover le mette alle posizioni 1, 3 e 5.
// Sullo scaffale del lettore il primo si chiama «The Crown Conspiricy»
// (com'e' scritto su Hardcover): e' un alias.
export const UNIVERSO = "The World of Elan";
export const REVELATIONS = "The Riyria Revelations";
export const CHRONICLES = "The Riyria Chronicles";
export const LEGENDS = "The Legends of the First Empire";
export const RISE = "The Rise and Fall";

const A = "Michael J. Sullivan";
const THEFT = "Theft of Swords";
const EMPIRE = "Rise of Empire";
const HEIR = "Heir of Novron";

export const LE_RIVELAZIONI = [
  { o: 1, t: "The Crown Conspiracy", c: REVELATIONS, a: A, alias: ["The Crown Conspiricy"], in: THEFT },
  { o: 2, t: "Avempartha", c: REVELATIONS, a: A, in: THEFT },
  { o: 3, t: "Nyphron Rising", c: REVELATIONS, a: A, in: EMPIRE },
  { o: 4, t: "The Emerald Storm", c: REVELATIONS, a: A, in: EMPIRE },
  { o: 5, t: "Wintertide", c: REVELATIONS, a: A, in: HEIR },
  { o: 6, t: "Percepliquis", c: REVELATIONS, a: A, in: HEIR },
  { o: null, tipo: "omnibus", t: THEFT, c: REVELATIONS, a: A, nota: "raccolta: The Crown Conspiracy e Avempartha" },
  { o: null, tipo: "omnibus", t: EMPIRE, c: REVELATIONS, a: A, nota: "raccolta: Nyphron Rising e The Emerald Storm" },
  { o: null, tipo: "omnibus", t: HEIR, c: REVELATIONS, a: A, nota: "raccolta: Wintertide e Percepliquis" },
];

export const LE_CRONACHE = [
  { o: 1, t: "The Crown Tower", c: CHRONICLES, a: A },
  { o: 2, t: "The Rose and the Thorn", c: CHRONICLES, a: A },
  { o: 3, t: "The Death of Dulgath", c: CHRONICLES, a: A },
  { o: 4, t: "The Disappearance of Winter's Daughter", c: CHRONICLES, a: A },
  { o: 5, t: "Drumindor", c: CHRONICLES, a: A },
];

export const LE_LEGGENDE = [
  { o: 1, t: "Age of Myth", c: LEGENDS, a: A },
  { o: 2, t: "Age of Swords", c: LEGENDS, a: A },
  { o: 3, t: "Age of War", c: LEGENDS, a: A },
  { o: 4, t: "Age of Legend", c: LEGENDS, a: A },
  { o: 5, t: "Age of Death", c: LEGENDS, a: A },
  { o: 6, t: "Age of Empyre", c: LEGENDS, a: A },
];

export const ASCESA_E_CADUTA = [
  { o: 1, t: "Nolyn", c: RISE, a: A },
  { o: 2, t: "Farilane", c: RISE, a: A },
  { o: 3, t: "Esrahaddon", c: RISE, a: A },
];

// LE STORIE DI MEZZO, a parte dai romanzi come nelle altre guide: le usa
// solo l'elenco di «📥 Senza file», che le propone senza spunta. Fonte:
// Hardcover (la posizione nella serie e l'anno della prima edizione).
export const NOVELLE_RIVELAZIONI = [{ o: 0.5, t: "The Thieves", c: REVELATIONS, a: A, anno: 2013 }];
export const NOVELLE_CRONACHE = [
  { o: 1.5, t: "The Viscount and the Witch", c: CHRONICLES, a: A, anno: 2011 },
  { o: 2.5, t: "The Jester", c: CHRONICLES, a: A, anno: 2014 },
  { o: 2.6, t: "Professional Integrity", c: CHRONICLES, a: A, anno: 2015 },
];
export const NOVELLE_LEGGENDE = [
  { o: 0.5, t: "Pile of Bones", c: LEGENDS, a: A, anno: 2019 },
  { o: 0.6, t: "Little Wren and the Big Forest", c: LEGENDS, a: A, anno: 2016 },
];

// L'ORDINE DI LETTURA DEL MONDO (`MONDI` in `sagaBooks.js`): l'ordine di
// uscita, come per Malazan e il Cosmere. [guida, titolo, prima edizione],
// e le storie di mezzo (quarta colonna) al posto della loro uscita, con la
// data della prima edizione su Hardcover (The Viscount and the Witch ha
// solo l'anno).
export const ORDINE = [
  [REVELATIONS, "The Crown Conspiracy", "2007-09-01"],
  [REVELATIONS, "Avempartha", "2009-04-01"],
  [REVELATIONS, "Nyphron Rising", "2009-10-17"],
  [REVELATIONS, "The Emerald Storm", "2010"],
  [REVELATIONS, "Wintertide", "2010-09-22"],
  [CHRONICLES, "The Viscount and the Witch", "2011", true],
  [REVELATIONS, "Percepliquis", "2012"],
  [REVELATIONS, "The Thieves", "2013-03-17", true],
  [CHRONICLES, "The Crown Tower", "2013-08-06"],
  [CHRONICLES, "The Rose and the Thorn", "2013-09-17"],
  [CHRONICLES, "The Jester", "2014-01-17", true],
  [CHRONICLES, "Professional Integrity", "2015-06-03", true],
  [CHRONICLES, "The Death of Dulgath", "2015-10-15"],
  [LEGENDS, "Age of Myth", "2016-06-15"],
  [LEGENDS, "Little Wren and the Big Forest", "2016-11-21", true],
  [LEGENDS, "Age of Swords", "2017-07-25"],
  [CHRONICLES, "The Disappearance of Winter's Daughter", "2017-12-05"],
  [LEGENDS, "Age of War", "2018-07-03"],
  [LEGENDS, "Age of Legend", "2019-07-09"],
  [LEGENDS, "Pile of Bones", "2019-08-01", true],
  [LEGENDS, "Age of Death", "2020"],
  [LEGENDS, "Age of Empyre", "2020"],
  [RISE, "Nolyn", "2021-05-05"],
  [RISE, "Farilane", "2022-06-07"],
  [RISE, "Esrahaddon", "2023-07-11"],
  [CHRONICLES, "Drumindor", "2024-10-21"],
];

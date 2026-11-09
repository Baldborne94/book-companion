// THE REALM OF THE ELDERLINGS, di Robin Hobb: i sedici romanzi delle cinque
// serie dello stesso mondo, in ordine.
//
// Chiesto dal lettore, con la foto delle saghe di Robin Hobb: «perché non
// mi raccoglie tutto sotto the realm of the elderlings come avviene per il
// cosmoverso o malazan universe dove raccoglie tutte le saghe?». Wikidata
// le cinque serie le ha (Farseer, Liveship Traders, Tawny Man, Rain Wild
// Chronicles, Fitz and the Fool) ma il mondo che le tiene insieme no: nessuna
// voce, e nessuna serie dice di farne parte. Quindi una guida, come le altre.
//
// La fonte e' Wikidata, misurato il 9 novembre 2026: ogni romanzo col suo
// numero nella sua serie e il suo anno (1995 … 2017), tranne Golden Fool,
// la cui voce non ha ne' serie ne' anno: e' il secondo dei Tawny Man, fra
// Fool's Errand (2001, n° 1) e Fool's Fate (2003, n° 3). L'ordine e' quello di uscita, che
// per Hobb e' anche quello di lettura (ogni serie viene dopo la precedente
// nella storia del mondo). Le serie sono i CICLI (`c`): sullo scaffale,
// sotto-ripiani della raccolta, coi nomi che il lettore usa gia' sulla sua
// raccolta «The Realm of the Elderlings» («The Tawny Man», «The Rain Wilds
// Chronicles»: si vedono nelle sue schede in `test/saghe-fumetti.test.mjs`).
//
// SOLO I ROMANZI: le novelle («The Wilful Princess and the Piebald
// Prince») e le raccolte («The Inheritance») no. Gli ALIAS sono i titoli
// italiani che Wikidata registra (l'edizione italiana dei Liveship
// spezza ogni romanzo in due: le due meta' sono alias dello stesso) e gli
// apostrofi caduti.
export const SAGA = "The Realm of the Elderlings";

export const FARSEER = "The Farseer Trilogy";
export const LIVESHIP = "Liveship Traders";
export const TAWNY = "The Tawny Man";
export const RAIN_WILD = "The Rain Wilds Chronicles";
export const FITZ_FOOL = "Fitz and the Fool";

const A = "Robin Hobb";

export default [
  { o: 1, t: "Assassin's Apprentice", c: FARSEER, a: A, alias: ["Assassins Apprentice", "L'apprendista assassino"] },
  { o: 2, t: "Royal Assassin", c: FARSEER, a: A, alias: ["L'assassino di corte"] },
  { o: 3, t: "Assassin's Quest", c: FARSEER, a: A, alias: ["Assassins Quest", "Il viaggio dell'assassino"] },
  { o: 4, t: "Ship of Magic", c: LIVESHIP, a: A, alias: ["La nave della magia", "La nave in fuga"] },
  { o: 5, t: "The Mad Ship", c: LIVESHIP, a: A, alias: ["La nave dei pirati", "La nave della pazzia"] },
  { o: 6, t: "Ship of Destiny", c: LIVESHIP, a: A, alias: ["La nave del destino"] },
  { o: 7, t: "Fool's Errand", c: TAWNY, a: A, alias: ["Fools Errand", "Il risveglio dell'assassino"] },
  { o: 8, t: "Golden Fool", c: TAWNY, a: A, alias: ["The Golden Fool"] },
  { o: 9, t: "Fool's Fate", c: TAWNY, a: A, alias: ["Fools Fate"] },
  { o: 10, t: "Dragon Keeper", c: RAIN_WILD, a: A, alias: ["Il custode del drago"] },
  { o: 11, t: "Dragon Haven", c: RAIN_WILD, a: A },
  { o: 12, t: "City of Dragons", c: RAIN_WILD, a: A },
  { o: 13, t: "Blood of Dragons", c: RAIN_WILD, a: A },
  { o: 14, t: "Fool's Assassin", c: FITZ_FOOL, a: A, alias: ["Fools Assassin"] },
  { o: 15, t: "Fool's Quest", c: FITZ_FOOL, a: A, alias: ["Fools Quest"] },
  { o: 16, t: "Assassin's Fate", c: FITZ_FOOL, a: A, alias: ["Assassins Fate"] },
];

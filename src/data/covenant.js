// THOMAS COVENANT, di Stephen R. Donaldson: tre serie di Cronache, una
// guida sola con le serie come CICLI (come gli Elderlings), numerata col
// mondo: 1-10 nell'ordine di uscita, che e' anche quello di lettura.
//
// Chiesto dal lettore, con la sua raccolta «Thomas Covenant» gia' aperta
// (The Runes of the Earth al 7, Gilden-Fire al 2.1) e gli altri volumi
// sparsi in tre raccolte («The Complete Chronicles…», «The Last
// Chronicles…» con dentro Lord Foul's Bane, «The 2nd Chronicles…»): «ho
// dei problemi con Covenant». La raccolta e' la sua (`RACCOLTA`):
// «📚 Saghe da sistemare» ci porta i volumi, con la serie e il numero.
//
// LA FONTE E' HARDCOVER per le serie e le posizioni (misurato il 12
// novembre 2026), e OPEN LIBRARY per gli anni: la prima edizione datata
// di ogni romanzo. Lord Foul's Bane su Open Library ha solo ristampe dal
// 1987; Hardcover lo da' al 1977, come i due che lo seguono.
// Gilden-Fire (1981, un capitolo tolto da The Illearth War) e' una storia
// di mezzo: 2.1 come su Hardcover, il posto che il lettore gli ha gia'
// dato.
export const SAGA = "Thomas Covenant";
export const RACCOLTA = "Thomas Covenant";

export const PRIME = "The Chronicles of Thomas Covenant the Unbeliever";
export const SECONDE = "The Second Chronicles of Thomas Covenant";
export const ULTIME = "The Last Chronicles of Thomas Covenant";

const A = "Stephen R. Donaldson";

// [titolo, serie, anno della prima edizione]
export default [
  { o: 1, t: "Lord Foul's Bane", c: PRIME, a: A, anno: 1977 },
  { o: 2, t: "The Illearth War", c: PRIME, a: A, anno: 1977 },
  { o: 3, t: "The Power That Preserves", c: PRIME, a: A, anno: 1977 },
  { o: 4, t: "The Wounded Land", c: SECONDE, a: A, anno: 1980 },
  { o: 5, t: "The One Tree", c: SECONDE, a: A, anno: 1982 },
  { o: 6, t: "White Gold Wielder", c: SECONDE, a: A, anno: 1983 },
  { o: 7, t: "The Runes of the Earth", c: ULTIME, a: A, anno: 2004 },
  { o: 8, t: "Fatal Revenant", c: ULTIME, a: A, anno: 2007 },
  { o: 9, t: "Against All Things Ending", c: ULTIME, a: A, anno: 2010 },
  { o: 10, t: "The Last Dark", c: ULTIME, a: A, anno: 2013 },
];

export const NOVELLE = [{ o: 2.1, t: "Gilden-Fire", c: PRIME, a: A, anno: 1981 }];

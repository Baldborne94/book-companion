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

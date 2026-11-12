// L'ENDERVERSE, di Orson Scott Card: quattro serie, una guida sola con le
// serie come CICLI (come gli Elderlings), numerata col mondo nell'ordine di
// uscita.
//
// Chiesto dal lettore: «enderverse che ha ender saga a parte». La sua
// raccolta «Enderverse» seguiva gia' l'ordine di uscita di Hardcover
// («Enderverse: Publication Order», misurato il 12 novembre 2026:
// Ender's Shadow 5 … The Hive 17), e i primi quattro romanzi ed Ender in
// Exile stavano in una raccolta a parte, «Ender Saga», numerati 1-5. La
// raccolta e' la sua (`RACCOLTA`): «📚 Saghe da sistemare» ci porta i
// volumi, con la serie e il numero.
//
// FIRST MEETINGS (racconti) E A WAR OF GIFTS (romanzo breve) SONO VOLUMI,
// all'8 e al 10 come su Hardcover: scelto dal lettore, perche' i numeri che
// aveva gia' restassero quelli. Il 12 su Hardcover e' solo l'edizione
// polacca, «Ucieczka Cienia», che e' Shadows in Flight (ed e' il titolo di
// una scheda del lettore: un alias). The Last Shadow (2021) Hardcover non
// lo mette in quella lista: viene dopo The Hive (2019), al 18.
//
// Gli ANNI sono la prima edizione datata su Open Library: Shadow of the
// Giant ha un'edizione datata 2000, prima di Shadow Puppets (2002) che lo
// precede nella storia, e tutte le altre 2005: vale il 2005. A War of Gifts
// ha una sola edizione del 2006 contro il 2007 di tutte le altre e di
// Hardcover. Earth Unaware, Earth Afire, Earth Awakens e The Hive sono
// scritti con Aaron Johnston (gli «Author» su Hardcover): `co`.
export const SAGA = "Enderverse";
export const RACCOLTA = "Enderverse";

export const QUINTETTO = "The Ender Quintet";
export const OMBRE = "The Shadow Series";
export const PRIMA_GUERRA = "The First Formic War";
export const SECONDA_GUERRA = "The Second Formic War";

const A = "Orson Scott Card";
const JOHNSTON = ["Aaron Johnston"];

export default [
  { o: 1, t: "Ender's Game", c: QUINTETTO, a: A, anno: 1985 },
  { o: 2, t: "Speaker for the Dead", c: QUINTETTO, a: A, anno: 1986 },
  { o: 3, t: "Xenocide", c: QUINTETTO, a: A, anno: 1991 },
  { o: 4, t: "Children of the Mind", c: QUINTETTO, a: A, anno: 1996 },
  { o: 5, t: "Ender's Shadow", c: OMBRE, a: A, anno: 1999 },
  { o: 6, t: "Shadow of the Hegemon", c: OMBRE, a: A, anno: 2001 },
  { o: 7, t: "Shadow Puppets", c: OMBRE, a: A, anno: 2002 },
  { o: 8, t: "First Meetings in Ender's Universe", c: QUINTETTO, a: A, anno: 2002, alias: ["First Meetings"] },
  { o: 9, t: "Shadow of the Giant", c: OMBRE, a: A, anno: 2005 },
  { o: 10, t: "A War of Gifts: An Ender Battle School Story", c: QUINTETTO, a: A, anno: 2007, alias: ["A War of Gifts"] },
  { o: 11, t: "Ender in Exile", c: QUINTETTO, a: A, anno: 2008 },
  { o: 12, t: "Shadows in Flight", c: OMBRE, a: A, anno: 2012, alias: ["Ucieczka Cienia"] },
  { o: 13, t: "Earth Unaware", c: PRIMA_GUERRA, a: A, co: JOHNSTON, anno: 2012 },
  { o: 14, t: "Earth Afire", c: PRIMA_GUERRA, a: A, co: JOHNSTON, anno: 2013 },
  { o: 15, t: "Earth Awakens", c: PRIMA_GUERRA, a: A, co: JOHNSTON, anno: 2014 },
  { o: 16, t: "The Swarm", c: SECONDA_GUERRA, a: A, anno: 2016 },
  { o: 17, t: "The Hive", c: SECONDA_GUERRA, a: A, co: JOHNSTON, anno: 2019 },
  { o: 18, t: "The Last Shadow", c: OMBRE, a: A, anno: 2021 },
];

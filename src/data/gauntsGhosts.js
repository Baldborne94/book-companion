// GAUNT'S GHOSTS, di Dan Abnett: i quindici romanzi, in ordine.
//
// Chiesto dal lettore dopo che la sezione «I libri dei tuoi autori» e'
// stata tolta (Wikidata gli dava «Gaunt's Ghosts · 2 libri»): una guida
// scritta a mano, come quelle del Mondo Disco e dell'Eresia, che dica
// quanti sono, quali hai e quali ti mancano.
//
// La fonte e' l'elenco della serie sul Warhammer 40k Wiki di Fandom
// («Gaunt's Ghosts (Series)»: quindici romanzi, dal 1999 al 2019, col
// numero di serie) e le quattro raccolte di Black Library, che dicono i
// cicli: The Founding (1-3), The Saint (4-7), The Lost (8-11), e dopo The
// Lost viene The Victory (12-15).
//
// L'ORDINE DI PUBBLICAZIONE E' ANCHE QUELLO DI LETTURA: e' una storia
// sola, la crociata dei Mondi di Sabbat vista dal reggimento di Gaunt, e
// va avanti dritta. Per questo la tavola e' a CAPITOLI (`parti: true`) e
// non a cicli: sotto «Warhammer 40K», dove il lettore tiene l'universo,
// la Serie scritta sul libro dev'essere «Gaunt's Ghosts» — l'altra storia
// accanto all'Eresia — e i quattro cicli sono il terzo livello.
//
// I NOMI DEI CICLI PORTANO I NUMERI. Non per bellezza: i capitoli di tutte
// le guide finiscono in un indice solo (`PARTI_DI_GUIDA`), e una Serie del
// lettore che si chiama «The Lost» — un titolo che qualunque autore puo'
// usare — diventerebbe un capitolo di questa guida. «The Lost (8-11)» non
// lo scrive nessuno per caso.
//
// L'autore e' su ogni volume e non sulla tavola: Abnett scrive anche
// Eisenhorn, Ravenor e l'Eresia, quindi «e' un Abnett» non vuol dire «e'
// un Gaunt's Ghosts». E «Necropolis» o «Ghostmaker» di un altro autore non
// sono questi: l'autore sbagliato scritto accanto li rifiuta.
//
// Gli ALIAS sono le grafie che un file vero porta: l'inglese americano
// delle edizioni USA («Honor Guard», «The Armor of Contempt») e i titoli
// senza articolo che restano di una parola sola («Anarch», «Warmaster»),
// che il confronto per parole piene non vede (vedi `PAROLE_PIENE`), e
// l'apostrofo caduto («Salvations Reach»).
export const SAGA = "Gaunt's Ghosts";

export const FOUNDING = "The Founding (1-3)";
export const SAINT = "The Saint (4-7)";
export const LOST = "The Lost (8-11)";
export const VICTORY = "The Victory (12-15)";

const A = "Dan Abnett";

export default [
  { o: 1, t: "First and Only", c: FOUNDING, a: A },
  { o: 2, t: "Ghostmaker", c: FOUNDING, a: A },
  { o: 3, t: "Necropolis", c: FOUNDING, a: A },
  { o: 4, t: "Honour Guard", c: SAINT, a: A, alias: ["Honor Guard"] },
  { o: 5, t: "The Guns of Tanith", c: SAINT, a: A },
  { o: 6, t: "Straight Silver", c: SAINT, a: A },
  { o: 7, t: "Sabbat Martyr", c: SAINT, a: A },
  { o: 8, t: "Traitor General", c: LOST, a: A },
  { o: 9, t: "His Last Command", c: LOST, a: A },
  { o: 10, t: "The Armour of Contempt", c: LOST, a: A, alias: ["The Armor of Contempt"] },
  { o: 11, t: "Only in Death", c: LOST, a: A },
  { o: 12, t: "Blood Pact", c: VICTORY, a: A },
  { o: 13, t: "Salvation's Reach", c: VICTORY, a: A, alias: ["Salvations Reach"] },
  { o: 14, t: "The Warmaster", c: VICTORY, a: A, alias: ["Warmaster"] },
  { o: 15, t: "The Anarch", c: VICTORY, a: A, alias: ["Anarch"] },
];

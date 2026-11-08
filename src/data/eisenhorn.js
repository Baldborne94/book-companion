// EISENHORN, di Dan Abnett: i quattro romanzi dell'inquisitore Gregor
// Eisenhorn, in ordine, e la raccolta che contiene i primi tre.
//
// Chiesto dal lettore dopo Gaunt's Ghosts: «fai Eisenhorn e Ravenor». La
// fonte e' la pagina della serie sul Warhammer 40k Wiki di Fandom
// («Eisenhorn (Series)»: Xenos 2001, Malleus 2001, Hereticus 2002, e
// l'omnibus del 2004 che li raccoglie) e, per il quarto, Wikidata (The
// Magos, opera di Abnett, 2018: il romanzo e i racconti di Eisenhorn).
//
// UNA SERIE E BASTA, NON UNA STORIA A CAPITOLI: la Serie scritta su un
// libro sciolto e' «Eisenhorn» (`c`), come la Seconda Apocalisse scrive i
// suoi cicli. Sotto «Warhammer 40K», accanto all'Eresia, e' l'altra storia.
//
// TRE DI QUESTI TITOLI STANNO ANCHE NELL'ERESIA, nel prologo («percorso
// Inquisition»: Eisenhorn, Malleus, Hereticus). La' sono contorno — la
// guida li nomina per preparare — e qui sono la storia: un titolo che una
// guida nomina come contorno e un'altra come sua tappa e' della seconda
// (vedi l'ordine di `INDICE`). Il cammino dell'Eresia li trova lo stesso,
// per titolo.
//
// LA RACCOLTA E' UNA RIGA SUA (`tipo: "omnibus"`): un file vero, che chi
// ce l'ha possiede i tre romanzi dentro (`in`). Non e' un volume in piu'
// della guida e non e' un passo: e' un modo di averli. Il lettore ha
// proprio l'«Eisenhorn Omnibus».
export const SAGA = "Eisenhorn";
export const OMNIBUS = "Eisenhorn";

const A = "Dan Abnett";

export default [
  { o: 1, t: "Xenos", c: SAGA, a: A, in: OMNIBUS },
  { o: 2, t: "Malleus", c: SAGA, a: A, in: OMNIBUS },
  { o: 3, t: "Hereticus", c: SAGA, a: A, in: OMNIBUS },
  { o: 4, t: "The Magos", c: SAGA, a: A, nota: "romanzo e racconti" },
  {
    o: null,
    tipo: "omnibus",
    t: OMNIBUS,
    c: SAGA,
    a: A,
    nota: "raccolta: Xenos, Malleus e Hereticus",
  },
];

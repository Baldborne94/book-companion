// LA SECONDA APOCALISSE, di R. Scott Bakker.
//
// Chiesto dal lettore due volte («perche' non riconosci la saga di scott
// baker»), e la ragione per cui non bastava la strada di sempre e' che ne
// ha UN SOLO volume in biblioteca: `sagaDaBiblioteca` copia la saga da un
// altro libro dello stesso autore su cui l'hai scritta tu, e con un libro
// solo non c'e' da dove copiarla — il tasto «Riconosci saghe e cicli»
// rispondeva «erano gia' tutti a posto», ed era letteralmente vero.
//
// Sette romanzi in due cicli, ed e' l'ordine di pubblicazione perche' qui
// coincide con quello di lettura: la storia e' una sola e va avanti dritta.
//
// LA TAVOLA E' `stretta`, come l'Eresia e diversamente dal Mondo Disco.
// «The Great Ordeal», «The Judging Eye», «The Warrior Prophet» non sono
// parole comuni come «Scars», ma nemmeno insegne inconfondibili come
// «Ankh-Morpork»: preso per solo contenimento, «The Great Ordeal» si
// mangerebbe un romanzo di chiunque altro che si chiami cosi'. Con
// `stretta` serve un secondo segnale — l'autore, che qui e' sempre lo
// stesso — e un titolo omonimo di un ALTRO autore viene rifiutato.
//
// L'ARTICOLO IN TESTA E' UN ALIAS, e non e' un vezzo: il libro del lettore
// si chiama «Darkness That Comes Before», senza «The», perche' cosi'
// gliel'ha scritto chi ha impacchettato il file. Il riconoscimento cerca il
// titolo DENTRO il campo, quindi la forma lunga non ci sta e non
// combacerebbe mai. Gli alias si dichiarano a mano, uno per uno, invece di
// togliere l'articolo a tutti: «The Truth» del Mondo Disco diventerebbe
// «truth», che sta dentro qualunque titolo.
export const SAGA = "The Second Apocalypse";

export const PRINCE = "The Prince of Nothing";
export const ASPECT = "The Aspect-Emperor";

// Bakker fuori dalla saga: senza questa lista il ripiego sull'autore
// darebbe «The Second Apocalypse» anche ai suoi thriller.
export const FUORI = ["neuropath", "disciple of the dog", "light time and gravity"];

export default [
  { n: 1, t: "The Darkness That Comes Before", c: PRINCE, a: "R. Scott Bakker", alias: ["Darkness That Comes Before"] },
  { n: 2, t: "The Warrior Prophet", c: PRINCE, a: "R. Scott Bakker", alias: ["Warrior Prophet"] },
  { n: 3, t: "The Thousandfold Thought", c: PRINCE, a: "R. Scott Bakker", alias: ["Thousandfold Thought"] },
  { n: 4, t: "The Judging Eye", c: ASPECT, a: "R. Scott Bakker", alias: ["Judging Eye"] },
  { n: 5, t: "The White-Luck Warrior", c: ASPECT, a: "R. Scott Bakker", alias: ["White-Luck Warrior"] },
  { n: 6, t: "The Great Ordeal", c: ASPECT, a: "R. Scott Bakker", alias: ["Great Ordeal"] },
  { n: 7, t: "The Unholy Consult", c: ASPECT, a: "R. Scott Bakker", alias: ["Unholy Consult"] },
];

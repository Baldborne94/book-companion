// I 41 romanzi del Mondo Disco in ordine di pubblicazione, che e' anche
// l'ordine in cui Pratchett li ha pensati: i richiami interni guardano
// sempre indietro, mai avanti. Serve a riconoscere il libro dal titolo
// quando i metadati dell'EPUB sono vuoti o sbagliati — capita spesso — e a
// far funzionare il «prossimo della saga» senza scrivere niente a mano.
// `c` e' il ciclo, col nome INGLESE come i titoli: e' il campo Serie
// del libro, e se qui scrivessimo «Streghe» mentre il lettore ha
// segnato «The Witches Cycle» i due gruppi non si parlerebbero, e la
// scheda «Prima di cominciare» vedrebbe due serie diverse.
// `null` = autoconclusivo, cioe' NESSUN ciclo: raccoglierli sotto
// un'etichetta comune farebbe credere che «Small Gods» continui
// «Pyramids», e il riassunto dei volumi precedenti racconterebbe
// libri che non c'entrano niente.

export const SAGA = "Discworld";

export default [
  { n: 1, t: "The Colour of Magic", c: "The Rincewind Cycle" },
  { n: 2, t: "The Light Fantastic", c: "The Rincewind Cycle" },
  { n: 3, t: "Equal Rites", c: "The Witches Cycle" },
  { n: 4, t: "Mort", c: "The Death Cycle" },
  { n: 5, t: "Sourcery", c: "The Rincewind Cycle" },
  { n: 6, t: "Wyrd Sisters", c: "The Witches Cycle" },
  { n: 7, t: "Pyramids", c: null },
  { n: 8, t: "Guards! Guards!", c: "The City Watch Cycle" },
  { n: 9, t: "Eric", c: "The Rincewind Cycle" },
  { n: 10, t: "Moving Pictures", c: null },
  { n: 11, t: "Reaper Man", c: "The Death Cycle" },
  { n: 12, t: "Witches Abroad", c: "The Witches Cycle" },
  { n: 13, t: "Small Gods", c: null },
  { n: 14, t: "Lords and Ladies", c: "The Witches Cycle" },
  { n: 15, t: "Men at Arms", c: "The City Watch Cycle" },
  { n: 16, t: "Soul Music", c: "The Death Cycle" },
  { n: 17, t: "Interesting Times", c: "The Rincewind Cycle" },
  { n: 18, t: "Maskerade", c: "The Witches Cycle" },
  { n: 19, t: "Feet of Clay", c: "The City Watch Cycle" },
  { n: 20, t: "Hogfather", c: "The Death Cycle" },
  { n: 21, t: "Jingo", c: "The City Watch Cycle" },
  { n: 22, t: "The Last Continent", c: "The Rincewind Cycle" },
  { n: 23, t: "Carpe Jugulum", c: "The Witches Cycle" },
  { n: 24, t: "The Fifth Elephant", c: "The City Watch Cycle" },
  { n: 25, t: "The Truth", c: null },
  { n: 26, t: "Thief of Time", c: "The Death Cycle" },
  { n: 27, t: "The Last Hero", c: "The Rincewind Cycle" },
  { n: 28, t: "The Amazing Maurice and His Educated Rodents", c: null },
  { n: 29, t: "Night Watch", c: "The City Watch Cycle" },
  { n: 30, t: "The Wee Free Men", c: "The Tiffany Aching Cycle" },
  { n: 31, t: "Monstrous Regiment", c: null },
  { n: 32, t: "A Hat Full of Sky", c: "The Tiffany Aching Cycle" },
  { n: 33, t: "Going Postal", c: "The Moist von Lipwig Cycle" },
  { n: 34, t: "Thud!", c: "The City Watch Cycle" },
  { n: 35, t: "Wintersmith", c: "The Tiffany Aching Cycle" },
  { n: 36, t: "Making Money", c: "The Moist von Lipwig Cycle" },
  { n: 37, t: "Unseen Academicals", c: "The Wizards Cycle" },
  { n: 38, t: "I Shall Wear Midnight", c: "The Tiffany Aching Cycle" },
  { n: 39, t: "Snuff", c: "The City Watch Cycle" },
  { n: 40, t: "Raising Steam", c: "The Moist von Lipwig Cycle" },
  { n: 41, t: "The Shepherd's Crown", c: "The Tiffany Aching Cycle" },
];

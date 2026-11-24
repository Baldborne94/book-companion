// I 41 romanzi del Mondo Disco in ordine di pubblicazione, che e' anche
// l'ordine in cui Pratchett li ha pensati: i richiami interni guardano
// sempre indietro, mai avanti. Serve a riconoscere il libro dal titolo
// quando i metadati dell'EPUB sono vuoti o sbagliati — capita spesso — e a
// far funzionare il «prossimo della saga» senza scrivere niente a mano.
//
// `c` e' il ciclo, cioe' il campo Serie del libro, e i nomi sono quelli
// CORRENTI fra i lettori del Disco (Rincewind, City Watch, The Witches,
// Death, Ancient Civilizations, Industrial Revolution, Tiffany Aching,
// The Wizards, Moist von Lipwig): il lettore li riconosce a colpo d'occhio,
// e se qui scrivessimo un nome nostro — «Streghe», «The Witches Cycle» —
// i due gruppi non si parlerebbero e «Prima di cominciare» vedrebbe due
// serie dove ce n'e' una sola.
//
// Diversi romanzi stanno in due gruppi insieme (Snuff e' Vimes ed e' la
// Guardia, Raising Steam e' Lipwig ed e' la rivoluzione industriale): il
// campo Serie ne tiene uno solo, e si sceglie **l'arco della storia**,
// perche' e' quello che «Prima di cominciare» deve poter riassumere. Snuff
// sta con la Guardia, i tre di Lipwig stanno insieme, gli Accademici
// Perduti stanno coi Maghi.
//
// `null` = autoconclusivo, cioe' NESSUN ciclo — un solo libro, The Amazing
// Maurice: raccogliere gli autoconclusivi sotto un'etichetta comune
// («One-off») li farebbe credere una serie, e il riassunto dei volumi
// precedenti racconterebbe libri che non c'entrano niente.

export const SAGA = "Discworld";

export default [
  { n: 1, t: "The Colour of Magic", c: "Rincewind" },
  { n: 2, t: "The Light Fantastic", c: "Rincewind" },
  { n: 3, t: "Equal Rites", c: "The Witches" },
  { n: 4, t: "Mort", c: "Death" },
  { n: 5, t: "Sourcery", c: "Rincewind" },
  { n: 6, t: "Wyrd Sisters", c: "The Witches" },
  { n: 7, t: "Pyramids", c: "Ancient Civilizations" },
  { n: 8, t: "Guards! Guards!", c: "City Watch" },
  { n: 9, t: "Eric", c: "Rincewind" },
  { n: 10, t: "Moving Pictures", c: "Industrial Revolution" },
  { n: 11, t: "Reaper Man", c: "Death" },
  { n: 12, t: "Witches Abroad", c: "The Witches" },
  { n: 13, t: "Small Gods", c: "Ancient Civilizations" },
  { n: 14, t: "Lords and Ladies", c: "The Witches" },
  { n: 15, t: "Men at Arms", c: "City Watch" },
  { n: 16, t: "Soul Music", c: "Death" },
  { n: 17, t: "Interesting Times", c: "Rincewind" },
  { n: 18, t: "Maskerade", c: "The Witches" },
  { n: 19, t: "Feet of Clay", c: "City Watch" },
  { n: 20, t: "Hogfather", c: "Death" },
  { n: 21, t: "Jingo", c: "City Watch" },
  { n: 22, t: "The Last Continent", c: "Rincewind" },
  { n: 23, t: "Carpe Jugulum", c: "The Witches" },
  { n: 24, t: "The Fifth Elephant", c: "City Watch" },
  { n: 25, t: "The Truth", c: "Industrial Revolution" },
  { n: 26, t: "Thief of Time", c: "Death" },
  { n: 27, t: "The Last Hero", c: "Rincewind" },
  { n: 28, t: "The Amazing Maurice and His Educated Rodents", c: null },
  { n: 29, t: "Night Watch", c: "City Watch" },
  { n: 30, t: "The Wee Free Men", c: "Tiffany Aching" },
  { n: 31, t: "Monstrous Regiment", c: "Industrial Revolution" },
  { n: 32, t: "A Hat Full of Sky", c: "Tiffany Aching" },
  { n: 33, t: "Going Postal", c: "Moist von Lipwig" },
  { n: 34, t: "Thud!", c: "City Watch" },
  { n: 35, t: "Wintersmith", c: "Tiffany Aching" },
  { n: 36, t: "Making Money", c: "Moist von Lipwig" },
  { n: 37, t: "Unseen Academicals", c: "The Wizards" },
  { n: 38, t: "I Shall Wear Midnight", c: "Tiffany Aching" },
  { n: 39, t: "Snuff", c: "City Watch" },
  { n: 40, t: "Raising Steam", c: "Moist von Lipwig" },
  { n: 41, t: "The Shepherd's Crown", c: "Tiffany Aching" },
];

// I nomi che abbiamo scritto NOI nelle versioni precedenti — prima in
// italiano, poi «The … Cycle» — e che quindi possiamo ancora rinominare
// senza pestare i piedi al lettore. Serve solo ai libri che oggi non si
// riconoscono piu' dal titolo: per tutti gli altri il ciclo giusto lo dice
// la tabella qui sopra, che sa anche promuovere un vecchio «Autoconclusivo»
// ad «Ancient Civilizations». `null` = era una nostra etichetta di comodo e
// il ciclo va tolto, non rinominato.
export const CICLI_NOSTRI = {
  Streghe: "The Witches",
  Guardie: "City Watch",
  Morte: "Death",
  Maghi: "The Wizards",
  Moist: "Moist von Lipwig",
  Tiffany: "Tiffany Aching",
  Rincewind: "Rincewind",
  Autoconclusivo: null,
  "The Witches Cycle": "The Witches",
  "The City Watch Cycle": "City Watch",
  "The Death Cycle": "Death",
  "The Wizards Cycle": "The Wizards",
  "The Moist von Lipwig Cycle": "Moist von Lipwig",
  "The Tiffany Aching Cycle": "Tiffany Aching",
  "The Rincewind Cycle": "Rincewind",
};

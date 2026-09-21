// IL PERCORSO DI LETTURA DELL ERESIA DI HORUS, nella versione CD8D —
// quella raccolta e messa in ordine da un lettore su Reddit, ripresa da
// Polygon, e gia trascritta a mano nel nostro wh-companion
// (`src/data/hhGuide.js`, variante `HH_FULL`). Qui e la stessa guida
// girata verso una domanda diversa: non «cosa leggo adesso», ma «questo
// FILE che ho in libreria, dove sta nel percorso».
//
// La differenza non e da poco. La guida ha 155 voci, ma 62 sono racconti e
// audiodrammi che stanno DENTRO le antologie: quelli non sono file. Qui
// l antologia compare UNA volta, al posto del suo primo racconto — e
// `Eye of Terra` da sola ne porta undici.
//
// `o` E IL NUMERO DI LETTURA, E CONTA I ROMANZI DELL ERESIA. Non e `n`,
// che e il numero della collana Black Library e serve solo a ritrovare il
// volume: il percorso CD8D li rimescola apposta, quindi `The First
// Heretic` e il 14 in copertina e il 6 nel cammino.
//
// E NON conta tutto il resto, che un numero non ce l ha (`o: null`):
//
//   - IL PROLOGO sono QUATTRO PERCORSI ALTERNATIVI: ne scegli uno, non
//     leggi tutti e tredici i libri. Numerarli di fila faceva uscire
//     «Horus Rising» quindicesimo del suo stesso inizio, e contava libri
//     che nessuno leggera mai.
//   - LE ANTOLOGIE stanno nel percorso per UN racconto alla volta:
//     metterle davanti a un romanzo per via di una novella vuol dire
//     rubargli il posto. Il momento in cui aprirle lo dice il ciclo.
//   - I SETTE TITOLI 40K non sono romanzi dell Eresia.
//
// Restano comunque nella saga e nel loro ciclo, quindi sullo scaffale
// stanno col gruppo giusto: semplicemente non fingono di essere un passo
// del cammino.
//
// E `tipo` DICE QUAL E DELLE TRE, invece di farlo indovinare alla nota.
// Serve a `prossimoPasso`, che deve trattarle in tre modi diversi: il
// prologo e una scelta fra quattro percorsi (e non una fila), i titoli
// «fuori» la guida stessa li dichiara fuori dalla storia, e l antologia e
// una tappa come le altre. La `nota` resta il testo per lo schermo: era
// gia il posto dove l informazione stava, ma leggerla con
// un espressione vuol dire che riscrivendo una parola si cambia il
// comportamento del cammino senza che nessun errore lo dica. I 39 romanzi
// non hanno tipo: sono il caso normale.
export const SAGA = "The Horus Heresy";

export default [
  { o: null, tipo: "prologo", t: "Eisenhorn", c: "Prologo · 40K Foundation", nota: "Percorso Inquisition" },
  { o: null, tipo: "prologo", t: "Malleus", c: "Prologo · 40K Foundation", nota: "Percorso Inquisition" },
  { o: null, tipo: "prologo", t: "Hereticus", c: "Prologo · 40K Foundation", nota: "Percorso Inquisition" },
  { o: null, tipo: "prologo", t: "Soul Hunter", c: "Prologo · 40K Foundation", nota: "Percorso Night Lords" },
  { o: null, tipo: "prologo", t: "Blood Reaver", c: "Prologo · 40K Foundation", nota: "Percorso Night Lords" },
  { o: null, tipo: "prologo", t: "Void Stalker", c: "Prologo · 40K Foundation", nota: "Percorso Night Lords" },
  { o: null, tipo: "prologo", t: "Angels of Darkness", c: "Prologo · 40K Foundation", nota: "Percorso Dark Angels" },
  { o: null, tipo: "prologo", t: "Ravenwing", c: "Prologo · 40K Foundation", nota: "Percorso Dark Angels" },
  { o: null, tipo: "prologo", t: "Master of Sanctity", c: "Prologo · 40K Foundation", nota: "Percorso Dark Angels" },
  { o: null, tipo: "prologo", t: "The Unforgiven", c: "Prologo · 40K Foundation", nota: "Percorso Dark Angels" },
  { o: null, tipo: "prologo", t: "Nightbringer", c: "Prologo · 40K Foundation", nota: "Percorso Ultramarines" },
  { o: null, tipo: "prologo", t: "Storm of Iron", c: "Prologo · 40K Foundation", nota: "Percorso Ultramarines" },
  { o: null, tipo: "prologo", t: "Warriors of Ultramar", c: "Prologo · 40K Foundation", nota: "Percorso Ultramarines" },
  { o: null, tipo: "antologia", t: "Eye of Terra", n: 35, c: "Part 1 · The Fall of Horus", nota: "antologia" },
  { o: 1, t: "Horus Rising", a: "Dan Abnett", n: 1, c: "Part 1 · The Fall of Horus" },
  { o: 2, t: "False Gods", a: "Graham McNeill", n: 2, c: "Part 1 · The Fall of Horus" },
  { o: 3, t: "Galaxy in Flames", a: "Ben Counter", n: 3, c: "Part 1 · The Fall of Horus" },
  { o: 4, t: "The Flight of the Eisenstein", a: "James Swallow", n: 4, c: "Part 1 · The Fall of Horus" },
  { o: 5, t: "Fulgrim", a: "Graham McNeill", n: 5, c: "Part 1 · The Fall of Horus" },
  { o: null, tipo: "antologia", t: "Tales of Heresy", n: 10, c: "Part 2 · The First Heretic", nota: "antologia" },
  { o: 6, t: "The First Heretic", a: "Aaron Dembski-Bowden", n: 14, c: "Part 2 · The First Heretic" },
  { o: 7, t: "Know No Fear", a: "Dan Abnett", n: 19, c: "Part 2 · The First Heretic" },
  { o: null, tipo: "antologia", t: "War Without End", n: 33, c: "Part 3 · Betrayer", nota: "antologia" },
  { o: null, tipo: "antologia", t: "Legacies of Betrayal", n: 31, c: "Part 3 · Betrayer", nota: "antologia" },
  { o: 8, t: "Betrayer", a: "Aaron Dembski-Bowden", n: 24, c: "Part 3 · Betrayer" },
  { o: null, tipo: "antologia", t: "Shadows of Treachery", n: 22, c: "Part 4 · The Lion and the Prince", nota: "antologia" },
  { o: 9, t: "Fallen Angels", a: "Mike Lee", n: 11, c: "Part 4 · The Lion and the Prince" },
  { o: null, tipo: "antologia", t: "Age of Darkness", n: 16, c: "Part 4 · The Lion and the Prince", nota: "antologia" },
  { o: null, tipo: "antologia", t: "The Primarchs", n: 20, c: "Part 4 · The Lion and the Prince", nota: "antologia" },
  { o: null, tipo: "fuori", t: "Lord of the Night", a: "Simon Spurrier", c: "Part 4 · The Lion and the Prince", nota: "40k, fuori dall'Eresia" },
  { o: null, tipo: "fuori", t: "Night Lords Omnibus", a: "Aaron Dembski-Bowden", c: "Part 4 · The Lion and the Prince", nota: "40k, fuori dall'Eresia" },
  { o: 10, t: "The Unremembered Empire", a: "Dan Abnett", n: 27, c: "Part 5 · Imperium Secondus" },
  { o: null, tipo: "antologia", t: "Burden of Loyalty", n: 48, c: "Part 5 · Imperium Secondus", nota: "antologia" },
  { o: 11, t: "Pharos", a: "Guy Haley", n: 34, c: "Part 5 · Imperium Secondus" },
  { o: 12, t: "Angels of Caliban", a: "Gav Thorpe", n: 38, c: "Part 5 · Imperium Secondus" },
  { o: 13, t: "Ruinstorm", a: "David Annandale", n: 46, c: "Part 5 · Imperium Secondus" },
  { o: null, tipo: "fuori", t: "Scythes of the Emperor Anthology", a: "L.J. Goulding", c: "Part 5 · Imperium Secondus", nota: "40k, fuori dall'Eresia" },
  { o: null, tipo: "antologia", t: "Garro", n: 42, c: "Part 6 · Legion of One — Garro", nota: "antologia" },
  { o: null, tipo: "antologia", t: "The Silent War", n: 37, c: "Part 6 · Legion of One — Garro", nota: "antologia" },
  { o: 14, t: "Vengeful Spirit", a: "Graham McNeill", n: 29, c: "Part 6 · Legion of One — Garro" },
  { o: 15, t: "Mechanicum", a: "Graham McNeill", n: 9, c: "Part 7 · Mars & Magnus" },
  { o: 16, t: "A Thousand Sons", a: "Graham McNeill", n: 12, c: "Part 7 · Mars & Magnus" },
  { o: 17, t: "The Master of Mankind", a: "Aaron Dembski-Bowden", n: 41, c: "Part 7 · Mars & Magnus" },
  { o: 18, t: "The Crimson King", a: "Graham McNeill", n: 44, c: "Part 7 · Mars & Magnus" },
  { o: null, tipo: "fuori", t: "Ahriman Omnibus", a: "John French", c: "Part 7 · Mars & Magnus", nota: "40k, fuori dall'Eresia" },
  { o: null, tipo: "fuori", t: "Forges of Mars Omnibus", a: "Graham McNeill", c: "Part 7 · Mars & Magnus", nota: "40k, fuori dall'Eresia" },
  { o: 19, t: "Prospero Burns", a: "Dan Abnett", n: 15, c: "Part 8 · Wolves" },
  { o: 20, t: "Wolfsbane", a: "Guy Haley", n: 49, c: "Part 8 · Wolves" },
  { o: null, tipo: "fuori", t: "The Hunt for Magnus", a: "Chris Wraight", c: "Part 8 · Wolves", nota: "40k, fuori dall'Eresia" },
  { o: null, tipo: "fuori", t: "Battle of the Fang", a: "Chris Wraight", c: "Part 8 · Wolves", nota: "40k, fuori dall'Eresia" },
  { o: 21, t: "Scars", a: "Chris Wraight", n: 28, c: "Part 9 · Scars" },
  { o: 22, t: "Path of Heaven", a: "Chris Wraight", n: 36, c: "Part 9 · Scars" },
  { o: null, tipo: "antologia", t: "Heralds of the Siege", n: 52, c: "Part 9 · Scars", nota: "antologia" },
  { o: null, tipo: "antologia", t: "Scions of the Emperor", c: "Part 10 · Iron Warriors", nota: "antologia" },
  { o: 23, t: "Perturabo: The Hammer of Olympia", a: "Guy Haley", c: "Part 10 · Iron Warriors" },
  { o: 24, t: "Angel Exterminatus", a: "Graham McNeill", n: 23, c: "Part 10 · Iron Warriors" },
  { o: 25, t: "Slaves to Darkness", a: "John French", n: 51, c: "Part 10 · Iron Warriors" },
  { o: 26, t: "Praetorian of Dorn", a: "John French", n: 39, c: "Part 11 · Imperial Fists" },
  { o: 27, t: "The Solar War", a: "John French", c: "Part 12 · The Siege of Terra" },
  { o: 28, t: "The Lost and the Damned", a: "Guy Haley", c: "Part 12 · The Siege of Terra" },
  { o: 29, t: "The First Wall", a: "Gav Thorpe", c: "Part 12 · The Siege of Terra" },
  { o: 30, t: "Sons of the Selenar", a: "Graham McNeill", c: "Part 12 · The Siege of Terra" },
  { o: 31, t: "Saturnine", a: "Dan Abnett", c: "Part 12 · The Siege of Terra" },
  { o: 32, t: "Fury of Magnus", a: "Graham McNeill", c: "Part 12 · The Siege of Terra" },
  { o: 33, t: "Mortis", a: "John French", c: "Part 12 · The Siege of Terra" },
  { o: 34, t: "Warhawk", a: "Chris Wraight", c: "Part 12 · The Siege of Terra" },
  { o: 35, t: "Echoes of Eternity", a: "Aaron Dembski-Bowden", c: "Part 12 · The Siege of Terra" },
  { o: 36, t: "Garro: Knight of the Grey", a: "James Swallow", c: "Part 12 · The Siege of Terra" },
  { o: 37, t: "The End and the Death: Volume I", a: "Dan Abnett", c: "Part 12 · The Siege of Terra" },
  { o: 38, t: "The End and the Death: Volume II", a: "Dan Abnett", c: "Part 12 · The Siege of Terra" },
  { o: 39, t: "The End and the Death: Volume III", a: "Dan Abnett", c: "Part 12 · The Siege of Terra" },
];

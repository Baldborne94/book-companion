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
// `Eye of Terra` da sola ne porta undici. Chi cerca la finezza dei
// singoli racconti la trova in wh-companion, non qui.
//
// `o` E IL NUMERO CHE DIVENTA IL TUO ORDINE DI LETTURA, non `n`.
// `n` e il numero ufficiale della collana Black Library, che serve solo a
// ritrovare il volume in libreria: il percorso CD8D li rimescola apposta
// — si comincia dal 14 dopo il 5, e il 46 arriva prima del 28. Se sullo
// scaffale vedi «3» accanto a un libro che in copertina dice «19», e
// giusto cosi: quello e il terzo passo del TUO cammino.
//
// I libri del prologo e i `40k, fuori dall Eresia` non sono romanzi
// dell Eresia, ma sono tappe del percorso: stanno qui perche «Prima di
// cominciare» possa raccontarteli quando apri quello dopo.
export const SAGA = "The Horus Heresy";

export default [
  { o: 1, t: "Eisenhorn", c: "Prologo · 40K Foundation", nota: "Percorso Inquisition" },
  { o: 2, t: "Malleus", c: "Prologo · 40K Foundation", nota: "Percorso Inquisition" },
  { o: 3, t: "Hereticus", c: "Prologo · 40K Foundation", nota: "Percorso Inquisition" },
  { o: 4, t: "Soul Hunter", c: "Prologo · 40K Foundation", nota: "Percorso Night Lords" },
  { o: 5, t: "Blood Reaver", c: "Prologo · 40K Foundation", nota: "Percorso Night Lords" },
  { o: 6, t: "Void Stalker", c: "Prologo · 40K Foundation", nota: "Percorso Night Lords" },
  { o: 7, t: "Angels of Darkness", c: "Prologo · 40K Foundation", nota: "Percorso Dark Angels" },
  { o: 8, t: "Ravenwing", c: "Prologo · 40K Foundation", nota: "Percorso Dark Angels" },
  { o: 9, t: "Master of Sanctity", c: "Prologo · 40K Foundation", nota: "Percorso Dark Angels" },
  { o: 10, t: "The Unforgiven", c: "Prologo · 40K Foundation", nota: "Percorso Dark Angels" },
  { o: 11, t: "Nightbringer", c: "Prologo · 40K Foundation", nota: "Percorso Ultramarines" },
  { o: 12, t: "Storm of Iron", c: "Prologo · 40K Foundation", nota: "Percorso Ultramarines" },
  { o: 13, t: "Warriors of Ultramar", c: "Prologo · 40K Foundation", nota: "Percorso Ultramarines" },
  { o: 14, t: "Eye of Terra", n: 35, c: "Part 1 · The Fall of Horus", nota: "antologia" },
  { o: 15, t: "Horus Rising", a: "Dan Abnett", n: 1, c: "Part 1 · The Fall of Horus" },
  { o: 16, t: "False Gods", a: "Graham McNeill", n: 2, c: "Part 1 · The Fall of Horus" },
  { o: 17, t: "Galaxy in Flames", a: "Ben Counter", n: 3, c: "Part 1 · The Fall of Horus" },
  { o: 18, t: "The Flight of the Eisenstein", a: "James Swallow", n: 4, c: "Part 1 · The Fall of Horus" },
  { o: 19, t: "Fulgrim", a: "Graham McNeill", n: 5, c: "Part 1 · The Fall of Horus" },
  { o: 20, t: "Tales of Heresy", n: 10, c: "Part 2 · The First Heretic", nota: "antologia" },
  { o: 21, t: "The First Heretic", a: "Aaron Dembski-Bowden", n: 14, c: "Part 2 · The First Heretic" },
  { o: 22, t: "Know No Fear", a: "Dan Abnett", n: 19, c: "Part 2 · The First Heretic" },
  { o: 23, t: "War Without End", n: 33, c: "Part 3 · Betrayer", nota: "antologia" },
  { o: 24, t: "Legacies of Betrayal", n: 31, c: "Part 3 · Betrayer", nota: "antologia" },
  { o: 25, t: "Betrayer", a: "Aaron Dembski-Bowden", n: 24, c: "Part 3 · Betrayer" },
  { o: 26, t: "Shadows of Treachery", n: 22, c: "Part 4 · The Lion and the Prince", nota: "antologia" },
  { o: 27, t: "Fallen Angels", a: "Mike Lee", n: 11, c: "Part 4 · The Lion and the Prince" },
  { o: 28, t: "Age of Darkness", n: 16, c: "Part 4 · The Lion and the Prince", nota: "antologia" },
  { o: 29, t: "The Primarchs", n: 20, c: "Part 4 · The Lion and the Prince", nota: "antologia" },
  { o: 30, t: "Lord of the Night", a: "Simon Spurrier", c: "Part 4 · The Lion and the Prince", nota: "40k, fuori dall'Eresia" },
  { o: 31, t: "Night Lords Omnibus", a: "Aaron Dembski-Bowden", c: "Part 4 · The Lion and the Prince", nota: "40k, fuori dall'Eresia" },
  { o: 32, t: "The Unremembered Empire", a: "Dan Abnett", n: 27, c: "Part 5 · Imperium Secondus" },
  { o: 33, t: "Burden of Loyalty", n: 48, c: "Part 5 · Imperium Secondus", nota: "antologia" },
  { o: 34, t: "Pharos", a: "Guy Haley", n: 34, c: "Part 5 · Imperium Secondus" },
  { o: 35, t: "Angels of Caliban", a: "Gav Thorpe", n: 38, c: "Part 5 · Imperium Secondus" },
  { o: 36, t: "Ruinstorm", a: "David Annandale", n: 46, c: "Part 5 · Imperium Secondus" },
  { o: 37, t: "Scythes of the Emperor Anthology", a: "L.J. Goulding", c: "Part 5 · Imperium Secondus", nota: "40k, fuori dall'Eresia" },
  { o: 38, t: "Garro", n: 42, c: "Part 6 · Legion of One — Garro", nota: "antologia" },
  { o: 39, t: "The Silent War", n: 37, c: "Part 6 · Legion of One — Garro", nota: "antologia" },
  { o: 40, t: "Vengeful Spirit", a: "Graham McNeill", n: 29, c: "Part 6 · Legion of One — Garro" },
  { o: 41, t: "Mechanicum", a: "Graham McNeill", n: 9, c: "Part 7 · Mars & Magnus" },
  { o: 42, t: "A Thousand Sons", a: "Graham McNeill", n: 12, c: "Part 7 · Mars & Magnus" },
  { o: 43, t: "The Master of Mankind", a: "Aaron Dembski-Bowden", n: 41, c: "Part 7 · Mars & Magnus" },
  { o: 44, t: "The Crimson King", a: "Graham McNeill", n: 44, c: "Part 7 · Mars & Magnus" },
  { o: 45, t: "Ahriman Omnibus", a: "John French", c: "Part 7 · Mars & Magnus", nota: "40k, fuori dall'Eresia" },
  { o: 46, t: "Forges of Mars Omnibus", a: "Graham McNeill", c: "Part 7 · Mars & Magnus", nota: "40k, fuori dall'Eresia" },
  { o: 47, t: "Prospero Burns", a: "Dan Abnett", n: 15, c: "Part 8 · Wolves" },
  { o: 48, t: "Wolfsbane", a: "Guy Haley", n: 49, c: "Part 8 · Wolves" },
  { o: 49, t: "The Hunt for Magnus", a: "Chris Wraight", c: "Part 8 · Wolves", nota: "40k, fuori dall'Eresia" },
  { o: 50, t: "Battle of the Fang", a: "Chris Wraight", c: "Part 8 · Wolves", nota: "40k, fuori dall'Eresia" },
  { o: 51, t: "Scars", a: "Chris Wraight", n: 28, c: "Part 9 · Scars" },
  { o: 52, t: "Path of Heaven", a: "Chris Wraight", n: 36, c: "Part 9 · Scars" },
  { o: 53, t: "Heralds of the Siege", n: 52, c: "Part 9 · Scars", nota: "antologia" },
  { o: 54, t: "Scions of the Emperor", c: "Part 10 · Iron Warriors", nota: "antologia" },
  { o: 55, t: "Perturabo: The Hammer of Olympia", a: "Guy Haley", c: "Part 10 · Iron Warriors" },
  { o: 56, t: "Angel Exterminatus", a: "Graham McNeill", n: 23, c: "Part 10 · Iron Warriors" },
  { o: 57, t: "Slaves to Darkness", a: "John French", n: 51, c: "Part 10 · Iron Warriors" },
  { o: 58, t: "Praetorian of Dorn", a: "John French", n: 39, c: "Part 11 · Imperial Fists" },
  { o: 59, t: "The Solar War", a: "John French", c: "Part 12 · The Siege of Terra" },
  { o: 60, t: "The Lost and the Damned", a: "Guy Haley", c: "Part 12 · The Siege of Terra" },
  { o: 61, t: "The First Wall", a: "Gav Thorpe", c: "Part 12 · The Siege of Terra" },
  { o: 62, t: "Sons of the Selenar", a: "Graham McNeill", c: "Part 12 · The Siege of Terra" },
  { o: 63, t: "Saturnine", a: "Dan Abnett", c: "Part 12 · The Siege of Terra" },
  { o: 64, t: "Fury of Magnus", a: "Graham McNeill", c: "Part 12 · The Siege of Terra" },
  { o: 65, t: "Mortis", a: "John French", c: "Part 12 · The Siege of Terra" },
  { o: 66, t: "Warhawk", a: "Chris Wraight", c: "Part 12 · The Siege of Terra" },
  { o: 67, t: "Echoes of Eternity", a: "Aaron Dembski-Bowden", c: "Part 12 · The Siege of Terra" },
  { o: 68, t: "Garro: Knight of the Grey", a: "James Swallow", c: "Part 12 · The Siege of Terra" },
  { o: 69, t: "The End and the Death: Volume I", a: "Dan Abnett", c: "Part 12 · The Siege of Terra" },
  { o: 70, t: "The End and the Death: Volume II", a: "Dan Abnett", c: "Part 12 · The Siege of Terra" },
  { o: 71, t: "The End and the Death: Volume III", a: "Dan Abnett", c: "Part 12 · The Siege of Terra" },
];

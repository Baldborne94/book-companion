// IL PERCORSO DI LETTURA DELL ERESIA DI HORUS, nella versione CD8D —
// quella raccolta e messa in ordine da un lettore su Reddit, ripresa da
// Polygon, e gia trascritta a mano nel nostro wh-companion
// (`src/data/hhGuide.js`, variante `HH_FULL`). Qui e la stessa guida
// girata verso una domanda diversa: non «cosa leggo adesso», ma «questo
// FILE che ho in libreria, dove sta nel percorso».
//
// La differenza non e da poco. La guida ha 98 voci: 39 romanzi e novelle
// dell Eresia, 13 libri di prologo, 7 titoli 40K e 39 fra racconti e
// audiodrammi che stanno DENTRO le antologie — e quelli non sono file.
// L antologia compare quindi come FILE una volta sola (`Eye of Terra` da
// sola porta undici racconti), e i suoi racconti hanno una riga per uno,
// ognuna al posto suo.
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
//     rubargli il posto. Il momento in cui aprirle lo dicono adesso i
//     racconti, che hanno una riga per uno.
//   - I RACCONTI non sono romanzi dell Eresia e non sono file: si spuntano,
//     non si aprono.
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
//
// E I RACCONTI DELLE ANTOLOGIE STANNO NELLA GUIDA, AL LORO POSTO.
// Sono 39 fra racconti e audiodrammi, e non sono file: vivono DENTRO
// un'antologia, che in libreria e' un volume solo. Fin qui la tavola
// teneva la sola antologia, al posto del suo primo racconto — e cosi' la
// guida diceva «leggi Eye of Terra» senza dire QUALE degli undici
// racconti, ne' che gli altri dieci si leggono molto piu' avanti.
// Adesso ogni racconto ha la sua riga nel punto in cui la guida lo
// chiede, e `in` dice da quale antologia si pesca.
//
// LE RIGHE-FILE RESTANO NELL ORDINE DI PRIMA, ed e' un patto e non un
// caso: il numero di lettura che il lettore si e' scritto addosso e' il
// posto del volume fra i FILE della guida, quindi infilare i racconti in
// mezzo non deve spostare un numero gia' scritto. `numerazioneGuida`
// conta le sole righe-file, e un test tiene il patto.

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
  { o: null, tipo: "racconto", t: "The Wolf of Ash and Fire", a: "Graham McNeill", in: "Eye of Terra", c: "Part 1 · The Fall of Horus", nota: "racconto" },
  { o: 1, t: "Horus Rising", a: "Dan Abnett", n: 1, c: "Part 1 · The Fall of Horus" },
  { o: 2, t: "False Gods", a: "Graham McNeill", n: 2, c: "Part 1 · The Fall of Horus" },
  { o: 3, t: "Galaxy in Flames", a: "Ben Counter", n: 3, c: "Part 1 · The Fall of Horus" },
  { o: 4, t: "The Flight of the Eisenstein", a: "James Swallow", n: 4, c: "Part 1 · The Fall of Horus" },
  { o: 5, t: "Fulgrim", a: "Graham McNeill", n: 5, c: "Part 1 · The Fall of Horus" },
  { o: null, tipo: "antologia", t: "Tales of Heresy", n: 10, c: "Part 2 · The First Heretic", nota: "antologia" },
  { o: null, tipo: "racconto", t: "The Last Church", a: "Graham McNeill", in: "Tales of Heresy", c: "Part 2 · The First Heretic", nota: "audiodramma" },
  { o: 6, t: "The First Heretic", a: "Aaron Dembski-Bowden", n: 14, c: "Part 2 · The First Heretic" },
  { o: null, tipo: "racconto", t: "The Aurelian", a: "Aaron Dembski-Bowden", in: "Eye of Terra", c: "Part 2 · The First Heretic", nota: "racconto" },
  { o: 7, t: "Know No Fear", a: "Dan Abnett", n: 19, c: "Part 2 · The First Heretic" },
  { o: null, tipo: "racconto", t: "After Deshea", a: "Matt Farrer", in: "Tales of Heresy", c: "Part 3 · Betrayer", nota: "racconto" },
  { o: null, tipo: "antologia", t: "War Without End", n: 33, c: "Part 3 · Betrayer", nota: "antologia" },
  { o: null, tipo: "racconto", t: "Lord of the Red Sands", a: "Aaron Dembski-Bowden", in: "War Without End", c: "Part 3 · Betrayer", nota: "racconto" },
  { o: null, tipo: "antologia", t: "Legacies of Betrayal", n: 31, c: "Part 3 · Betrayer", nota: "antologia" },
  { o: null, tipo: "racconto", t: "Butcher's Nails", a: "Aaron Dembski-Bowden", in: "Legacies of Betrayal", c: "Part 3 · Betrayer", nota: "audiodramma" },
  { o: 8, t: "Betrayer", a: "Aaron Dembski-Bowden", n: 24, c: "Part 3 · Betrayer" },
  { o: null, tipo: "antologia", t: "Shadows of Treachery", n: 22, c: "Part 4 · The Lion and the Prince", nota: "antologia" },
  { o: null, tipo: "racconto", t: "The Dark King", a: "Graham McNeill", in: "Shadows of Treachery", c: "Part 4 · The Lion and the Prince", nota: "audiodramma" },
  { o: null, tipo: "racconto", t: "Massacre", a: "Aaron Dembski-Bowden", in: "Eye of Terra", c: "Part 4 · The Lion and the Prince", nota: "racconto" },
  { o: 9, t: "Fallen Angels", a: "Mike Lee", n: 11, c: "Part 4 · The Lion and the Prince" },
  { o: null, tipo: "antologia", t: "Age of Darkness", n: 16, c: "Part 4 · The Lion and the Prince", nota: "antologia" },
  { o: null, tipo: "racconto", t: "Savage Weapons", a: "Aaron Dembski-Bowden", in: "Age of Darkness", c: "Part 4 · The Lion and the Prince", nota: "racconto" },
  { o: null, tipo: "antologia", t: "The Primarchs", n: 20, c: "Part 4 · The Lion and the Prince", nota: "antologia" },
  { o: null, tipo: "racconto", t: "The Lion", a: "Gav Thorpe", in: "The Primarchs", c: "Part 4 · The Lion and the Prince", nota: "racconto" },
  { o: null, tipo: "racconto", t: "Prince of Crows", a: "Aaron Dembski-Bowden", in: "Shadows of Treachery", c: "Part 4 · The Lion and the Prince", nota: "racconto" },
  { o: null, tipo: "racconto", t: "Master of the First", a: "Gav Thorpe", in: "Eye of Terra", c: "Part 4 · The Lion and the Prince", nota: "racconto" },
  { o: null, tipo: "racconto", t: "The Long Night", a: "Aaron Dembski-Bowden", in: "Eye of Terra", c: "Part 4 · The Lion and the Prince", nota: "racconto" },
  { o: null, tipo: "fuori", t: "Lord of the Night", a: "Simon Spurrier", c: "Part 4 · The Lion and the Prince", nota: "40k, fuori dall'Eresia" },
  { o: null, tipo: "fuori", t: "Night Lords Omnibus", a: "Aaron Dembski-Bowden", c: "Part 4 · The Lion and the Prince", nota: "40k, fuori dall'Eresia" },
  { o: 10, t: "The Unremembered Empire", a: "Dan Abnett", n: 27, c: "Part 5 · Imperium Secondus" },
  { o: null, tipo: "racconto", t: "A Safe and Shadowed Place", a: "Guy Haley", in: "War Without End", c: "Part 5 · Imperium Secondus", nota: "racconto" },
  { o: null, tipo: "antologia", t: "Burden of Loyalty", n: 48, c: "Part 5 · Imperium Secondus", nota: "antologia" },
  { o: null, tipo: "racconto", t: "Heart of Pharos", a: "L.J. Goulding", in: "Burden of Loyalty", c: "Part 5 · Imperium Secondus", nota: "audiodramma" },
  { o: 11, t: "Pharos", a: "Guy Haley", n: 34, c: "Part 5 · Imperium Secondus" },
  { o: 12, t: "Angels of Caliban", a: "Gav Thorpe", n: 38, c: "Part 5 · Imperium Secondus" },
  { o: 13, t: "Ruinstorm", a: "David Annandale", n: 46, c: "Part 5 · Imperium Secondus" },
  { o: null, tipo: "fuori", t: "Scythes of the Emperor Anthology", alias: ["Scythes of the Emperor"], a: "L.J. Goulding", c: "Part 5 · Imperium Secondus", nota: "40k, fuori dall'Eresia" },
  { o: null, tipo: "racconto", t: "The Last Remembrancer", a: "John French", in: "Age of Darkness", c: "Part 6 · Legion of One — Garro", nota: "racconto" },
  { o: null, tipo: "antologia", t: "Garro", n: 42, c: "Part 6 · Legion of One — Garro", nota: "antologia" },
  { o: null, tipo: "racconto", t: "Oath of Moment", a: "James Swallow", in: "Garro", c: "Part 6 · Legion of One — Garro", nota: "audiodramma" },
  { o: null, tipo: "racconto", t: "Sword of Truth", a: "James Swallow", in: "Garro", c: "Part 6 · Legion of One — Garro", nota: "audiodramma" },
  { o: null, tipo: "racconto", t: "Legion of One", a: "James Swallow", in: "Garro", c: "Part 6 · Legion of One — Garro", nota: "audiodramma" },
  { o: null, tipo: "antologia", t: "The Silent War", alias: ["Silent War"], n: 37, c: "Part 6 · Legion of One — Garro", nota: "antologia" },
  { o: null, tipo: "racconto", t: "Grey Angel", a: "James Swallow", in: "The Silent War", c: "Part 6 · Legion of One — Garro", nota: "racconto" },
  { o: null, tipo: "racconto", t: "Luna Mendax", a: "Graham McNeill", in: "The Silent War", c: "Part 6 · Legion of One — Garro", nota: "racconto" },
  { o: null, tipo: "racconto", t: "The Devine Adoratrice", a: "Graham McNeill", in: "War Without End", c: "Part 6 · Legion of One — Garro", nota: "racconto" },
  { o: 14, t: "Vengeful Spirit", a: "Graham McNeill", n: 29, c: "Part 6 · Legion of One — Garro" },
  { o: null, tipo: "racconto", t: "The Kaban Project", a: "Graham McNeill", in: "Shadows of Treachery", c: "Part 7 · Mars & Magnus", nota: "racconto" },
  { o: 15, t: "Mechanicum", a: "Graham McNeill", n: 9, c: "Part 7 · Mars & Magnus" },
  { o: null, tipo: "racconto", t: "Into Exile", a: "Aaron Dembski-Bowden", in: "Burden of Loyalty", c: "Part 7 · Mars & Magnus", nota: "racconto" },
  { o: 16, t: "A Thousand Sons", a: "Graham McNeill", n: 12, c: "Part 7 · Mars & Magnus" },
  { o: null, tipo: "racconto", t: "Thief of Revelations", a: "Graham McNeill", in: "Legacies of Betrayal", c: "Part 7 · Mars & Magnus", nota: "audiodramma" },
  { o: 17, t: "The Master of Mankind", a: "Aaron Dembski-Bowden", n: 41, c: "Part 7 · Mars & Magnus" },
  { o: 18, t: "The Crimson King", a: "Graham McNeill", n: 44, c: "Part 7 · Mars & Magnus" },
  { o: null, tipo: "fuori", t: "Ahriman Omnibus", a: "John French", c: "Part 7 · Mars & Magnus", nota: "40k, fuori dall'Eresia" },
  { o: null, tipo: "fuori", t: "Forges of Mars Omnibus", a: "Graham McNeill", c: "Part 7 · Mars & Magnus", nota: "40k, fuori dall'Eresia" },
  { o: 19, t: "Prospero Burns", a: "Dan Abnett", n: 15, c: "Part 8 · Wolves" },
  { o: null, tipo: "racconto", t: "Wolf's Claw", a: "Chris Wraight", in: "Legacies of Betrayal", c: "Part 8 · Wolves", nota: "audiodramma" },
  { o: null, tipo: "racconto", t: "Wolf King", a: "Chris Wraight", in: "Burden of Loyalty", c: "Part 8 · Wolves", nota: "audiodramma" },
  { o: 20, t: "Wolfsbane", a: "Guy Haley", n: 49, c: "Part 8 · Wolves" },
  { o: null, tipo: "racconto", t: "Two Metaphysical Blades", a: "Chris Wraight", c: "Part 8 · Wolves", nota: "racconto" },
  { o: null, tipo: "fuori", t: "The Hunt for Magnus", a: "Chris Wraight", c: "Part 8 · Wolves", nota: "40k, fuori dall'Eresia" },
  { o: null, tipo: "fuori", t: "Battle of the Fang", a: "Chris Wraight", c: "Part 8 · Wolves", nota: "40k, fuori dall'Eresia" },
  { o: 21, t: "Scars", a: "Chris Wraight", n: 28, c: "Part 9 · Scars" },
  { o: null, tipo: "racconto", t: "Brotherhood of the Moon", a: "Chris Wraight", in: "Eye of Terra", c: "Part 9 · Scars", nota: "racconto" },
  { o: null, tipo: "racconto", t: "Allegiance", a: "Chris Wraight", in: "War Without End", c: "Part 9 · Scars", nota: "racconto" },
  { o: 22, t: "Path of Heaven", a: "Chris Wraight", n: 36, c: "Part 9 · Scars" },
  { o: null, tipo: "antologia", t: "Heralds of the Siege", n: 52, c: "Part 9 · Scars", nota: "antologia" },
  { o: null, tipo: "racconto", t: "The Last Son of Prospero", a: "Chris Wraight", in: "Heralds of the Siege", c: "Part 9 · Scars", nota: "racconto" },
  { o: null, tipo: "antologia", t: "Scions of the Emperor", c: "Part 10 · Iron Warriors", nota: "antologia" },
  { o: null, tipo: "racconto", t: "The Emperor's Architect", a: "Guy Haley", in: "Scions of the Emperor", c: "Part 10 · Iron Warriors", nota: "racconto" },
  { o: 23, t: "Perturabo: The Hammer of Olympia", a: "Guy Haley", c: "Part 10 · Iron Warriors" },
  { o: null, tipo: "racconto", t: "The Iron Within", a: "Rob Sanders", in: "Age of Darkness", c: "Part 10 · Iron Warriors", nota: "racconto" },
  { o: null, tipo: "racconto", t: "Ironfire", a: "Rob Sanders", in: "Eye of Terra", c: "Part 10 · Iron Warriors", nota: "racconto" },
  { o: 24, t: "Angel Exterminatus", a: "Graham McNeill", n: 23, c: "Part 10 · Iron Warriors" },
  { o: 25, t: "Slaves to Darkness", a: "John French", n: 51, c: "Part 10 · Iron Warriors" },
  { o: null, tipo: "racconto", t: "The Lightning Tower", a: "Dan Abnett", in: "Shadows of Treachery", c: "Part 11 · Imperial Fists", nota: "audiodramma" },
  { o: null, tipo: "racconto", t: "The Crimson Fist", a: "John French", in: "Shadows of Treachery", c: "Part 11 · Imperial Fists", nota: "racconto" },
  { o: null, tipo: "racconto", t: "Templar", a: "John French", in: "The Silent War", c: "Part 11 · Imperial Fists", nota: "audiodramma" },
  { o: 26, t: "Praetorian of Dorn", a: "John French", n: 39, c: "Part 11 · Imperial Fists" },
  { o: null, tipo: "racconto", t: "The Chamber at the End of Memory", a: "James Swallow", in: "Scions of the Emperor", c: "Part 11 · Imperial Fists", nota: "racconto" },
  { o: null, tipo: "racconto", t: "Now Peals Midnight", a: "John French", in: "Heralds of the Siege", c: "Part 11 · Imperial Fists", nota: "racconto" },
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
  { o: 37, t: "The End and the Death: Volume I", alias: ["The End and the Death Volume 1"], a: "Dan Abnett", c: "Part 12 · The Siege of Terra" },
  { o: 38, t: "The End and the Death: Volume II", a: "Dan Abnett", c: "Part 12 · The Siege of Terra" },
  { o: 39, t: "The End and the Death: Volume III", a: "Dan Abnett", c: "Part 12 · The Siege of Terra" },];

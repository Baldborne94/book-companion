// L'UNIVERSO DI HELLBOY, nell'ordine di lettura della Comics Beat
// («Hellboy Universe Reading Order 2025», di Mark Tweedale: non ufficiale,
// ricopiato dalle schermate che il lettore ha mandato — la pagina dal banco
// non si apre). Chiesto dal lettore: «sistemami tutti i libri di Hellboy
// mettendoli dentro la saga di Hellboy con l'ordine consigliato da questo
// sito».
//
// LA GUIDA HA DUE COLONNE e qui ne sta UNA: a sinistra i volumi e le Library
// Edition, a destra gli Omnibus, in mezzo quel che leggono tutti e due. Il
// lettore ha gli Omnibus, quindi le tappe sono la colonna di destra e il
// mezzo. Un volume singolo o una Library Edition non e' una tappa sua: si
// riconosce come la raccolta che lo contiene (`forme`), e prende il suo
// posto. Cosi' «ti manca» non dice mai «Hollow Earth» a chi ha l'Omnibus 1.
//
// `o` E' IL NUMERO DI LETTURA, una tappa per riga della guida, nel suo
// ordine. Lo stesso libro a volte torna piu' giu' — la guida spezza
// «The Secret Histories» e l'Omnibus di Koshchei in tre punti («I've split
// up these stories for this reading order») — e il file e' uno: sta alla
// sua prima comparsa, e le storie dei punti dopo sono righe `racconto` con
// `in` (la regola delle antologie dell'Eresia: si spuntano, non si aprono).
// Anche «Icthyo Sapien», che la guida fa leggere dopo «Messiah» pescandolo
// da «Lost Lives».
//
// I DRAMMI AUDIO stanno nella guida e non sono fumetti: senza numero, cosi'
// non sono il «prossimo volume» e non finiscono fra quelli da prendere.
//
// `forme` SONO ESPRESSIONI, non titoli da cercare dentro il nome come nelle
// altre tavole. Qui quel che distingue un volume dall'altro e' un NUMERO
// («B.P.R.D. Omnibus v03»), e i nomi dei file lo scrivono in sei modi
// («v03», «vol 3», «Volume 3», «Omnibus03», «v3-522»); i titoli dei volumi
// singoli poi sono parole di tutti («The Dead», «Russia», «End of Days»).
// Si leggono sul nome ridotto da `formaDi` (in `sagaBooks.js`): «b p r d»
// diventa «bprd», ogni numero di volume «vN». Una forma che comincia con
// «~» vale solo se nel titolo, nell'autore o nella saga c'e' l'universo
// (Hellboy, Mignola, B.P.R.D., Abe Sapien…): «The Wild Hunt» di chiunque
// altro non e' l'Omnibus 3. Le forme si provano tappa per tappa, in ordine,
// e la prima che combacia vince: per questo i volumi di «Hell on Earth»
// (numerati da 1 a 15) si leggono dal sottotitolo PRIMA che il numero di una
// vecchia raccolta («Hell on Earth Volume 4») li porti altrove.
export const SAGA = "Hellboy";

const PdF = (n) => `B.P.R.D.: Plague of Frogs Volume ${n}`;
const HoE = (n) => `B.P.R.D.: Hell on Earth Volume ${n}`;

export default [
  { o: 1, t: "Hellboy Omnibus Volume 1: Seed of Destruction", nota: "Seed of Destruction, Wake the Devil", forme: ["hellboy omnibus v1\\b", "seed of destruction", "~wake the devil", "hellboy library edition v1\\b"] },
  { o: 2, t: "Hellboy: The Complete Short Stories Volume 1", nota: "The Chained Coffin and Others, The Right Hand of Doom", forme: ["complete short stories v1\\b", "chained coffin", "right hand of doom", "hellboy library edition v2\\b"] },
  { o: 3, t: "Hellboy: The Complete Short Stories Volume 2", nota: "Into the Silent Sea, The Troll Witch and Others, The Crooked Man and Others", forme: ["complete short stories v2\\b", "into the silent sea", "troll witch", "~crooked man", "hellboy library edition v4\\b"] },
  { o: 4, t: "Hellboy Omnibus Volume 2: Strange Places", nota: "Conqueror Worm, Strange Places", forme: ["hellboy omnibus v2\\b", "~strange places", "~conqueror worm", "hellboy library edition v3\\b"] },
  { o: 5, t: "B.P.R.D. Omnibus Volume 1", nota: `Hollow Earth, The Soul of Venice, Plague of Frogs · era ${PdF(1)}`, forme: ["bprd omnibus v1\\b", "plague of frogs v1\\b", "~hollow earth", "soul of venice", "~plague of frogs(?! v[2-4]\\b)"] },
  { o: 6, t: "B.P.R.D. Omnibus Volume 2", nota: `The Dead, The Black Flame, War on Frogs · era ${PdF(2)}`, forme: ["bprd omnibus v2\\b", "plague of frogs v2\\b", "\\bbprd\\b.*\\bthe dead\\b", "\\bbprd\\b.*(?<!(?:rise|reign) of )\\bthe black flame\\b", "war on frogs"] },
  { o: 7, t: "B.P.R.D. Omnibus Volume 3", nota: `The Universal Machine, Garden of Souls, Killing Ground · era ${PdF(3)}`, forme: ["bprd omnibus v3\\b", "plague of frogs v3\\b", "~universal machine", "~garden of souls", "~killing ground"] },
  { o: 8, t: "B.P.R.D. Omnibus Volume 4", nota: `The Warning, The Black Goddess, King of Fear · era ${PdF(4)}`, forme: ["bprd omnibus v4\\b", "plague of frogs v4\\b", "\\bbprd\\b.*\\bthe warning\\b", "~black goddess", "~king of fear"] },
  { o: 9, t: "Hellboy Omnibus Volume 3: The Wild Hunt", nota: "Darkness Calls, The Wild Hunt, The Storm and the Fury, The Bride of Hell and Others", forme: ["hellboy omnibus v3\\b", "~darkness calls", "~wild hunt", "storm and the fury", "bride of hell", "hellboy library edition v[56]\\b"] },
  { o: 10, t: "Hellboy: Weird Tales", nota: "Weird Tales 1 e 2, How Koshchei Became Deathless, Baba Yaga's Feast", forme: ["~weird tales"] },
  { o: 11, t: "Sir Edward Grey, Witchfinder Omnibus Volume 1", nota: "In the Service of Angels, Lost and Gone Forever, The Mysteries of Unland", forme: ["witchfinder omnibus(?! v2\\b)", "service of angels", "lost and gone forever", "mysteries of unland"] },
  { o: 12, t: "Lobster Johnson Omnibus Volume 1", nota: "The Burning Hand, Satan Smells a Rat, Get the Lobster!", forme: ["lobster johnson omnibus(?! v2\\b)", "~burning hand", "satan smells a rat", "get the lobster"] },
  { o: 13, t: "Lobster Johnson Omnibus Volume 2", nota: "A Chain Forged in Life, The Pirate's Ghost and Metal Monsters of Midtown, The Iron Prometheus", forme: ["lobster johnson omnibus v2\\b", "chain forged in life", "pirates ghost", "iron prometheus"] },
  { o: 14, t: "Hellboy Universe: The Secret Histories", nota: "qui Sledgehammer 44; il resto piu' avanti", forme: ["secret histories", "sledgehammer 44"] },
  { o: 15, t: "B.P.R.D.: 1946-1948", nota: "1946, 1947, 1948", forme: ["~\\b1946 1948\\b", "\\bbprd 194[678]\\b"] },
  { o: 16, t: "B.P.R.D.: Vampire", forme: ["\\bbprd\\b.*\\bvampire\\b"] },
  { o: 17, t: "Young Hellboy: The Hidden Land", forme: ["~hidden land"] },
  { o: 18, t: "Young Hellboy: Assault on Castle Death", forme: ["castle death"] },
  { o: 19, t: "Hellboy: The Midnight Circus", forme: ["~midnight circus"] },
  { o: 20, t: "Hellboy in Mexico", forme: ["hellboy in mexico"] },
  { o: 21, t: "Frankenstein Underground", forme: ["frankenstein underground"] },
  { o: 22, t: "Abe Sapien: The Drowning and Other Stories", nota: "The Drowning, The Devil Does Not Jest, Lost Lives (tranne Icthyo Sapien)", forme: ["~\\bthe drowning\\b", "devil does not jest", "~lost lives"] },
  { o: 23, t: "B.P.R.D.: Being Human", forme: ["\\bbprd\\b.*\\bbeing human\\b"] },
  { o: 24, t: "Hellboy: The Bones of Giants", forme: ["bones of giants"] },
  { o: 25, t: "The Amazing Screw-On Head and Other Curious Objects", nota: "fuori continuita', ma la storia lo richiama", forme: ["screw on head"] },
  { o: 26, t: "B.P.R.D. Omnibus Volume 5", nota: `Hell on Earth: New World, Gods and Monsters, Russia · era ${HoE(1)}`, forme: ["bprd omnibus v5\\b", "(?:bprd|hell on earth).*\\bnew world\\b", "(?:bprd|hell on earth).*gods and monsters", "(?:bprd|hell on earth).*\\brussia\\b", "hell on earth v1\\b"] },
  { o: 27, t: "B.P.R.D. Omnibus Volume 6", nota: `The Devil's Engine & The Long Death, The Pickens County Horror, The Return of the Master · era ${HoE(2)}`, forme: ["bprd omnibus v6\\b", "~devils engine", "~long death", "pickens county", "~return of the master", "hell on earth v2\\b"] },
  { o: 28, t: "Hellboy Omnibus Volume 4: Hellboy in Hell", nota: "The Descent, The Death Card", forme: ["hellboy omnibus v4\\b", "hellboy in hell", "~death card"] },
  { o: 29, t: "B.P.R.D. Omnibus Volume 7", nota: `A Cold Day in Hell, Lake of Fire, The Reign of the Black Flame · era ${HoE(3)}`, forme: ["bprd omnibus v7\\b", "~cold day in hell", "~lake of fire", "reign of the black flame", "hell on earth v3\\b"] },
  { o: 30, t: "Abe Sapien: Dark and Terrible Volume 1", nota: "Dark and Terrible and The New Race of Man, The Shape of Things to Come, Sacred Places", forme: ["dark and terrible v1\\b", "new race of man", "abe sapien.*shape of things to come", "abe sapien.*sacred places"] },
  { o: 31, t: "B.P.R.D. Omnibus Volume 8", nota: `The Devil's Wings, Flesh and Stone, The Exorcist · era ${HoE(4)}`, forme: ["bprd omnibus v8\\b", "~devils wings", "(?:bprd|hell on earth).*flesh and stone", "(?:bprd|hell on earth).*\\bexorcist\\b", "hell on earth v4\\b"] },
  { o: 32, t: "Abe Sapien: Dark and Terrible Volume 2", nota: "A Darkness So Great, The Secret Fire, The Desolate Shore", forme: ["dark and terrible v2\\b", "~darkness so great", "abe sapien.*secret fire", "~desolate shore"] },
  { o: 33, t: "B.P.R.D. Omnibus Volume 9", nota: `Metamorphosis, End of Days, Cometh the Hour · era ${HoE(5)}`, forme: ["bprd omnibus v9\\b", "(?:bprd|hell on earth).*metamorphosis", "(?:bprd|hell on earth).*end of days", "~cometh the hour", "hell on earth v5\\b"] },
  { o: 34, t: "Koshchei the Deathless", nota: "qui Koshchei the Deathless; il resto dell'omnibus piu' avanti", forme: ["koshchei the deathless"] },
  { o: 35, t: "B.P.R.D. Omnibus Volume 10", nota: "Messiah, Pandemonium, Ragna Rok · era B.P.R.D.: The Devil You Know", forme: ["bprd omnibus v10\\b", "~devil you know", "(?:bprd|devil you know).*\\bmessiah\\b", "(?:bprd|devil you know).*pandemonium", "~ragna ?rok"] },
  { o: null, tipo: "racconto", t: "Icthyo Sapien", in: "Abe Sapien: The Drowning and Other Stories", forme: ["icthyo sapien"] },
  { o: 36, t: "Sir Edward Grey, Witchfinder Omnibus Volume 2", nota: "City of the Dead, The Gates of Heaven, The Reign of Darkness", forme: ["witchfinder omnibus v2\\b", "witchfinder.*city of the dead", "witchfinder.*gates of heaven", "witchfinder.*reign of darkness"] },
  { o: 37, t: "Rise of the Black Flame", forme: ["rise of the black flame"] },
  { o: 38, t: "The House of Lost Horizons: A Sarah Jewell Mystery", forme: ["house of lost horizons"] },
  { o: 39, t: "Crimson Lotus", forme: ["~crimson lotus"] },
  { o: null, tipo: "racconto", t: "Rasputin: The Voice of the Dragon", in: "Hellboy Universe: The Secret Histories", forme: ["voice of the dragon"] },
  { o: 40, t: "Hellboy and the B.P.R.D.: 1952-1954", nota: "1952, 1953, 1954", forme: ["~\\b1952 1954\\b", "hellboy and the bprd 195[234]\\b"] },
  { o: 41, t: "Hellboy: The Silver Lantern Club", forme: ["silver lantern club"] },
  { o: null, tipo: "racconto", t: "The Visitor: How and Why He Stayed", in: "Hellboy Universe: The Secret Histories", forme: ["how and why he stayed"] },
  { o: 42, t: "Hellboy and the B.P.R.D.: 1955-1957", nota: "1955, 1956, 1957", forme: ["~\\b1955 1957\\b", "hellboy and the bprd 195[567]\\b"] },
  { o: 43, t: "Shadow of the Golden Crane", forme: ["golden crane"] },
  { o: 44, t: "Hellboy and the B.P.R.D.: The Beast of Vargu and Others", forme: ["beast of vargu"] },
  { o: 45, t: "Hellboy and the B.P.R.D.: The Return of Effie Kolb and Others", forme: ["effie kolb"] },
  { o: 46, t: "Hellboy and the B.P.R.D.: The Secret of Chesbro House & Others", forme: ["chesbro house"] },
  { o: 47, t: "Castle Full of Blackbirds", forme: ["castle full of blackbirds"] },
  { o: null, tipo: "racconto", t: "Koshchei in Hell", in: "Koshchei the Deathless", forme: ["koshchei in hell"] },
  { o: null, tipo: "racconto", t: "The Serpent in the Garden: Ed Grey and the Last Battle for England", in: "Koshchei the Deathless", forme: ["serpent in the garden", "last battle for england"] },
  { o: 48, t: "Hellboy in Love", forme: ["hellboy in love"] },
  { o: null, t: "Hellboy: A Plague of Wasps", nota: "dramma audio", forme: ["plague of wasps"] },
  { o: null, t: "Lobster Johnson: The Proteus Club", nota: "dramma audio", forme: ["proteus club"] },
  { o: null, t: "Hellboy and the B.P.R.D.: The Goddess of Manhattan", nota: "dramma audio", forme: ["goddess of manhattan"] },
  { o: 49, t: "Panya: The Mummy's Curse", forme: ["\\bpanya\\b"] },
  { o: 50, t: "Miss Truesdale and the Fall of Hyperborea", forme: ["miss truesdale"] },
  { o: 51, t: "The British Paranormal Society: Time Out of Mind", forme: ["british paranormal society"] },
  { o: 52, t: "The Sword of Hyperborea", forme: ["sword of hyperborea"] },
  { o: 53, t: "Frankenstein: New World", forme: ["frankenstein new world(?! the sea of forever)"] },
  { o: 54, t: "Frankenstein: New World – The Sea of Forever", forme: ["sea of forever"] },
];

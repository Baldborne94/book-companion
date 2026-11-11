// LE SAGHE DEL 40K OLTRE L'ERESIA, Gaunt's Ghosts, Eisenhorn e Ravenor, e i
// romanzi a se' piu' belli. Chiesto dal lettore: «vorrei tutte le saghe e i
// libri singoli piu' belli dell'universo 40K da leggere», e poi, vista la
// proposta: «per ora lasciamo solo le piu' belle e le piu' famose».
//
// LA FONTE E' HARDCOVER, misurato l'11 novembre 2026: i 1381 libri della
// serie «Warhammer 40,000», col voto e i lettori di ognuno. Una saga entra
// con un voto di almeno 3,7 e una cinquantina di lettori sommati sui
// volumi; le collane (Space Marine Battles, Warhammer Crime, Warhammer
// Horror…) non sono saghe, e i loro libri migliori stanno fra i romanzi a
// se'. Un romanzo a se' entra con un voto di almeno 3,8. L'ordine di ogni
// saga e' quello della serie su Hardcover (`volumiDaHardcover`: di ogni
// numero un romanzo, l'inglese), e dove Hardcover sbaglia si e' guardato
// libro per libro:
// - Ciaphas Cain: il 7 (The Emperor's Finest, 2010) mancava dall'elenco
//   della serie, sta nella scheda del libro; Old Soldiers Never Die non ha
//   data, non e' uscito;
// - Space Wolf: il 2 era l'edizione italiana (L'Artiglio di Ragnar): e'
//   Ragnar's Claw, 2000; Wolf's Honour e' scritto con Lee Lightner;
// - Dark Imperium: il 1 era l'edizione polacca; Wikidata lo dice del 2018;
// - Ahriman: il 1 (Exile, 2012) mancava; Exodus ha 138 pagine, e' una
//   novella;
// - Grey Knights: il 1 (Grey Knights, 2004) mancava;
// - The Dark Coil: Hardcover non numera i romanzi; sono i tre usciti, per
//   anno (Cult of the Spiral Dawn non ha data);
// - Path of the Dark Eldar: The Masque of Vyle ha 100 pagine, e' una novella;
// - Yarrick: dopo i due romanzi la serie e' fatta di racconti da 25-130
//   pagine.
// SOLO I ROMANZI: le storie brevi restano fuori, per ora (il lettore: «poi
// vediamo se aggiungere per la lore»).
export const UNIVERSO = "Warhammer 40K";
export const SOLI = "Warhammer 40K · Romanzi a sé";

const serie = (saga, a, titoli) =>
  titoli.map((x, i) => {
    const [t, alias, co] = Array.isArray(x) ? x : [x];
    return { o: i + 1, t, c: saga, a, ...(alias ? { alias } : {}), ...(co ? { co } : {}) };
  });

export const GUIDE = [
  {
    saga: "Ciaphas Cain",
    libri: serie("Ciaphas Cain", "Sandy Mitchell", [
      "For the Emperor",
      "Caves of Ice",
      "The Traitor's Hand",
      "Death or Glory",
      "Duty Calls",
      "Cain's Last Stand",
      "The Emperor's Finest",
      "The Last Ditch",
      "The Greater Good",
      "Choose Your Enemies",
      "Vainglorious",
    ]),
  },
  { saga: "Bequin", libri: serie("Bequin", "Dan Abnett", ["Pariah", "Penitent"]) },
  { saga: "Trazyn and Orikan", libri: serie("Trazyn and Orikan", "Robert Rath", ["The Infinite and the Divine", "The Wicked and the Warped"]) },
  { saga: "The Dark Coil", libri: serie("The Dark Coil", "Peter Fehervari", ["Fire Caste", "Requiem Infernal", "The Reverie"]) },
  {
    saga: "Space Wolf",
    libri: serie("Space Wolf", "William King", ["Space Wolf", "Ragnar's Claw", "Grey Hunter", "Wolfblade", "Sons of Fenris", ["Wolf's Honour", ["Wolf's Honor"], ["Lee Lightner"]]]),
  },
  { saga: "Night Lords", libri: serie("Night Lords", "Aaron Dembski-Bowden", ["Soul Hunter", "Blood Reaver", "Void Stalker"]) },
  { saga: "Vaults of Terra", libri: serie("Vaults of Terra", "Chris Wraight", ["The Carrion Throne", "The Hollow Mountain", "The Dark City"]) },
  { saga: "Dark Imperium", libri: serie("Dark Imperium", "Guy Haley", ["Dark Imperium", "Plague War", "Godblight"]) },
  {
    saga: "Belisarius Cawl",
    libri: serie("Belisarius Cawl", "Guy Haley", [["Belisarius Cawl: The Great Work", ["The Great Work"]], "Genefather", "Archmagos"]),
  },
  {
    saga: "Fabius Bile",
    libri: serie("Fabius Bile", "Joshua Reynolds", [["Fabius Bile: Primogenitor", ["Primogenitor"]], ["Fabius Bile: Clonelord", ["Clonelord"]], ["Fabius Bile: Manflayer", ["Manflayer"]]]),
  },
  { saga: "Watchers of the Throne", libri: serie("Watchers of the Throne", "Chris Wraight", ["The Emperor's Legion", "The Regent's Shadow"]) },
  { saga: "Cadia", libri: serie("Cadia", "Justin D. Hill", ["Cadia Stands", "Cadian Honour", "Traitor Rock", "Shadow of the Eighth", "Hell's Last"]) },
  {
    saga: "Ahriman",
    libri: serie("Ahriman", "John French", ["Ahriman: Exile", "Ahriman: Sorcerer", "Ahriman: Unchanged", "Ahriman: Eternal", "Ahriman: Undying"]),
  },
  { saga: "Grey Knights", libri: serie("Grey Knights", "Ben Counter", ["Grey Knights", "Dark Adeptus", "Hammer of Daemons"]) },
  { saga: "Path of the Dark Eldar", libri: serie("Path of the Dark Eldar", "Andy Chambers", ["Path of the Renegade", "Path of the Incubus", "Path of the Archon"]) },
  {
    saga: "Yarrick",
    libri: serie("Yarrick", "David Annandale", [["Yarrick: Imperial Creed", ["Imperial Creed"]], ["Yarrick: The Pyres of Armageddon", ["The Pyres of Armageddon"]]]),
  },
  // i romanzi a se', per anno di uscita (Hardcover)
  {
    saga: SOLI,
    libri: [
      { t: "Storm of Iron", a: "Graham McNeill" },
      { t: "Fifteen Hours", a: "Mitchel Scanlon" },
      { t: "Helsreach", a: "Aaron Dembski-Bowden" },
      { t: "The Devastation of Baal", a: "Guy Haley" },
      { t: "Spear of the Emperor", a: "Aaron Dembski-Bowden" },
      { t: "The Lords of Silence", a: "Chris Wraight" },
      { t: "The Wicked and the Damned", a: "Joshua Reynolds", co: ["David Annandale", "Phil Kelly"] },
      { t: "Brutal Kunnin'", a: "Mike Brooks", alias: ["Brutal Kunnin"] },
      { t: "Flesh and Steel", a: "Guy Haley" },
      { t: "Ghazghkull Thraka: Prophet of the Waaagh!", a: "Nate Crowley", alias: ["Ghazghkull Thraka"] },
      { t: "The Lion: Son of the Forest", a: "Mike Brooks" },
      { t: "The Fall of Cadia", a: "Robert Rath" },
    ].map((v, i) => ({ o: i + 1, ...v })),
  },
];

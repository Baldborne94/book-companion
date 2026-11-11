// LE SAGHE DEL 40K E I ROMANZI A SE' (`data/warhammer40k.js`), chieste dal
// lettore: «vorrei tutte le saghe e i libri singoli piu' belli
// dell'universo 40K». Quel che sbaglia in silenzio e' il riconoscimento: il
// nome di una saga che e' anche il titolo del primo volume («Space Wolf»,
// «Dark Imperium», «Grey Knights»), i titoli che sono parole comuni
// («Pariah», «The Reverie») scritti da altri, e i romanzi che l'Eresia ha
// gia' nel suo prologo (i Night Lords, Storm of Iron).
import { riconosci, TAVOLE } from "../src/lib/sagaBooks.js";
import { GUIDE, SOLI, UNIVERSO } from "../src/data/warhammer40k.js";
import { guidaDalNome } from "../src/lib/sagaDaNome.js";

const chi = (title, author) => {
  const r = riconosci({ title, author });
  return r ? `${r.saga} · ${r.titolo} · ${r.sagaOrder}` : null;
};

export default async (t) => {
  t.eq("sedici saghe e i romanzi a se'", GUIDE.length, 17);
  t.eq("tutte nel mondo del 40K, nelle tavole", GUIDE.filter((g) => TAVOLE.some((x) => x.saga === g.saga && x.universo === UNIVERSO)).length, 17);
  // ogni volume si riconosce col suo autore, nella sua guida, al suo numero
  const sbagliati = [];
  for (const g of GUIDE) for (const v of g.libri) {
    const atteso = `${g.saga} · ${v.t} · ${v.o}`;
    if (chi(v.t, v.a) !== atteso) sbagliati.push(`${v.t}: ${chi(v.t, v.a)}`);
  }
  t.eq("ogni volume nella sua guida, al suo numero", sbagliati.join(" | "), "");
  // i romanzi verificati sull'11 novembre 2026 (vedi il commento della
  // tavola): un volume tolto o aggiunto per sbaglio si vede qui
  t.eq(
    "quanti romanzi per guida",
    GUIDE.map((g) => `${g.saga} ${g.libri.length}`).join(", "),
    `Ciaphas Cain 11, Bequin 2, Trazyn and Orikan 2, The Dark Coil 3, Space Wolf 6, Night Lords 3, Vaults of Terra 3, Dark Imperium 3, Belisarius Cawl 3, Fabius Bile 3, Watchers of the Throne 2, Cadia 5, Ahriman 5, Grey Knights 3, Path of the Dark Eldar 3, Yarrick 2, ${SOLI} 12`
  );
  t.eq("e il primo di ognuna", GUIDE.map((g) => g.libri[0].t).join(", "), "For the Emperor, Pariah, The Infinite and the Divine, Fire Caste, Space Wolf, Soul Hunter, The Carrion Throne, Dark Imperium, Belisarius Cawl: The Great Work, Fabius Bile: Primogenitor, The Emperor's Legion, Cadia Stands, Ahriman: Exile, Grey Knights, Path of the Renegade, Yarrick: Imperial Creed, Storm of Iron");
  t.eq("i numeri di ogni guida vanno da 1 senza buchi", GUIDE.filter((g) => g.libri.some((v, i) => v.o !== i + 1)).map((g) => g.saga).join(), "");
  // il nome della saga e il titolo del primo
  t.eq("«Space Wolf» e' il primo di Space Wolf", chi("Space Wolf", ""), "Space Wolf · Space Wolf · 1");
  t.eq("«Space Wolf 03 - Grey Hunter» e' Grey Hunter", chi("Space Wolf 03 - Grey Hunter", ""), "Space Wolf · Grey Hunter · 3");
  t.eq("«Dark Imperium 02 - Plague War»", chi("Dark Imperium 02 - Plague War", ""), "Dark Imperium · Plague War · 2");
  t.eq("«Primogenitor» senza il nome davanti", chi("Primogenitor", "Joshua Reynolds"), "Fabius Bile · Fabius Bile: Primogenitor · 1");
  t.eq("«The Fall of Cadia» e' un romanzo a se', non di Cadia", chi("The Fall of Cadia", "Robert Rath"), `${SOLI} · The Fall of Cadia · 12`);
  // i titoli comuni scritti da altri non sono del 40K
  t.eq("«Pariah» di un altro autore no", chi("Pariah", "Bob Fingerman"), null);
  t.eq("«The Reverie» di un altro autore no", chi("The Reverie", "Jane Smith"), null);
  t.eq("«Fire Caste» di un altro autore no", chi("Fire Caste", "Jane Smith"), null);
  // quel che l'Eresia ha nel prologo va alla sua guida (la tappa batte il
  // contorno), come Malleus a Eisenhorn
  t.eq("«Soul Hunter» e' dei Night Lords", chi("Soul Hunter", "Aaron Dembski-Bowden"), "Night Lords · Soul Hunter · 1");
  t.eq("«Storm of Iron» e' un romanzo a se'", chi("Storm of Iron", "Graham McNeill"), `${SOLI} · Storm of Iron · 1`);
  // e si trovano per nome
  t.eq("«Ciaphas Cain» per nome", guidaDalNome("Ciaphas Cain")?.saga, "Ciaphas Cain");
  t.eq("«Night Lords» per nome", guidaDalNome("night lords")?.saga, "Night Lords");
};

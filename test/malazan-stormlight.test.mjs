// MALAZAN E STORMLIGHT (`data/malazan.js`, `data/stormlight.js`): chieste
// dal lettore dopo le guide del 40K. Quel che sbaglia in silenzio e' il
// riconoscimento: Erikson e Sanderson scrivono altre serie nello stesso
// mondo, e le novelle di Stormlight il lettore non le vuole.
import { riconosci } from "../src/lib/sagaBooks.js";
import { guidaDalNome, sagaDalNome } from "../src/lib/sagaDaNome.js";
import MALAZAN from "../src/data/malazan.js";
import STORMLIGHT from "../src/data/stormlight.js";

const chi = (title, author) => {
  const r = riconosci({ title, author });
  return r ? `${r.saga} · ${r.sagaOrder}` : null;
};

export default async (t) => {
  t.eq("Malazan: dieci romanzi, 1-10", MALAZAN.map((v) => v.o).join(","), "1,2,3,4,5,6,7,8,9,10");
  t.eq("Stormlight: cinque romanzi, 1-5", STORMLIGHT.map((v) => `${v.o} ${v.t}`).join(", "), "1 The Way of Kings, 2 Words of Radiance, 3 Oathbringer, 4 Rhythm of War, 5 Wind and Truth");
  for (const v of [...MALAZAN, ...STORMLIGHT]) t.eq(`«${v.t}» si riconosce`, riconosci({ title: v.t, author: v.a })?.titolo, v.t);
  t.eq("«Bonehunters» senza articolo", chi("Bonehunters", "Steven Erikson"), "Malazan Book of the Fallen · 6");
  t.eq("«Reapers Gale» senza apostrofo", chi("Reapers Gale", ""), "Malazan Book of the Fallen · 7");
  t.eq("«Malazan 08 - Toll the Hounds» dal nome del file", chi("Malazan 08 - Toll the Hounds", ""), "Malazan Book of the Fallen · 8");
  t.eq("«Way of Kings» senza articolo", chi("Way of Kings", "Brandon Sanderson"), "The Stormlight Archive · 1");
  // e quel che non e' della guida resta fuori
  t.eq("la novella Edgedancer no", chi("Edgedancer", "Brandon Sanderson"), null);
  t.eq("la prima meta' di The Way of Kings stampata a parte no", chi("The Stormlight Archive (Part One)", "Brandon Sanderson"), null);
  t.eq("Mistborn non e' Stormlight: e' la sua guida", chi("Mistborn: The Final Empire", "Brandon Sanderson"), "Mistborn · 1");
  t.eq("un altro Erikson (Kharkanas) non e' il Libro dei Caduti: e' la sua guida", chi("Forge of Darkness", "Steven Erikson"), "The Kharkanas Trilogy · 1");
  t.eq("«Memories of Ice» di un altro autore no", chi("Memories of Ice", "Joe Bloggs"), null);
  // e si trovano per nome, anche in italiano
  t.eq("«Il libro dei caduti di Malazan»", guidaDalNome("Il libro dei Caduti di Malazan")?.saga, "Malazan Book of the Fallen");
  t.eq("«Le cronache della Folgorluce»", guidaDalNome("Le Cronache della Folgorluce")?.saga, "The Stormlight Archive");
  const sl = await sagaDalNome("Stormlight", { libri: [{ title: "The Way of Kings", author: "Brandon Sanderson", saga: "Cosmoverse" }] });
  t.eq("dal nome, la guida: cinque volumi in ordine", `${sl.fonte} ${sl.volumi.filter((v) => !v.novella).map((v) => v.numero).join(",")}`, "guida 1,2,3,4,5");
  t.eq("…e fra loro le storie di mezzo, senza «The Way of Kings Prime» (una prima stesura)", sl.volumi.filter((v) => v.novella).map((v) => v.titolo).join(", "), "Elsecaller and King Lopen the First of Alethkar, Edgedancer, Dawnshard");
  t.eq("…quello che hai e' segnato", sl.volumi.filter((v) => v.gia).map((v) => v.titolo).join(), "The Way of Kings");
  t.eq("…e la raccolta e' quella dove tieni la saga («Cosmoverse»)", sl.saga, "Cosmoverse");
};

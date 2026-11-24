// BARTIMAEUS E KINGKILLER (`data/bartimaeus.js`, `data/kingkiller.js`):
// chieste dal lettore. Il lettore e' italiano, quindi i titoli delle
// edizioni italiane sono grafie dei file come le altre; e le novelle (The
// Slow Regard of Silent Things) restano fuori come per Sanderson.
import { riconosci } from "../src/lib/sagaBooks.js";
import { guidaDalNome } from "../src/lib/sagaDaNome.js";
import BARTIMAEUS from "../src/data/bartimaeus.js";
import KINGKILLER from "../src/data/kingkiller.js";

const chi = (title, author = "") => {
  const r = riconosci({ title, author });
  return r ? `${r.saga} · ${r.sagaOrder}` : null;
};

export default async (t) => {
  t.eq("Bartimaeus: la trilogia e il prequel, 1-4", BARTIMAEUS.map((v) => `${v.o} ${v.t}`).join(", "), "1 The Amulet of Samarkand, 2 The Golem's Eye, 3 Ptolemy's Gate, 4 The Ring of Solomon");
  t.eq("Kingkiller: i due romanzi usciti", KINGKILLER.map((v) => `${v.o} ${v.t}`).join(", "), "1 The Name of the Wind, 2 The Wise Man's Fear");
  for (const v of [...BARTIMAEUS, ...KINGKILLER]) t.eq(`«${v.t}» si riconosce`, riconosci({ title: v.t, author: v.a })?.titolo, v.t);
  // i titoli italiani
  t.eq("«L'amuleto di Samarcanda»", chi("L'amuleto di Samarcanda", "Jonathan Stroud"), "Bartimaeus · 1");
  t.eq("«L'occhio del Golem»", chi("L'occhio del Golem"), "Bartimaeus · 2");
  t.eq("«La porta di Tolomeo»", chi("La porta di Tolomeo"), "Bartimaeus · 3");
  t.eq("«L'anello di Salomone»", chi("L'anello di Salomone", "Jonathan Stroud"), "Bartimaeus · 4");
  t.eq("«Il nome del vento»", chi("Il nome del vento"), "The Kingkiller Chronicle · 1");
  t.eq("«La paura del saggio»", chi("La paura del saggio", "Patrick Rothfuss"), "The Kingkiller Chronicle · 2");
  // l'apostrofo caduto
  t.eq("«The Golems Eye»", chi("The Golems Eye"), "Bartimaeus · 2");
  t.eq("«Ptolemys Gate»", chi("Ptolemys Gate"), "Bartimaeus · 3");
  t.eq("«The Wise Mans Fear»", chi("The Wise Mans Fear"), "The Kingkiller Chronicle · 2");
  // e quel che non e' della guida resta fuori
  t.eq("la novella di Rothfuss no", chi("The Slow Regard of Silent Things", "Patrick Rothfuss"), null);
  t.eq("Lockwood resta Lockwood", chi("The Screaming Staircase", "Jonathan Stroud"), "Lockwood & Co. · 1");
  t.eq("«Il nome della rosa» non e' «Il nome del vento»", chi("Il nome della rosa", "Umberto Eco"), null);
  t.eq("«The Name of the Wind» di un altro autore no", chi("The Name of the Wind", "Joe Bloggs"), null);
  // i nomi, anche in italiano e con le parole generiche
  t.eq("«Le Cronache dell'Assassino del Re»", guidaDalNome("Le Cronache dell'Assassino del Re")?.saga, "The Kingkiller Chronicle");
  t.eq("«Trilogia di Bartimeus»", guidaDalNome("Trilogia di Bartimeus")?.saga, "Bartimaeus");
  t.eq("«Bartimaeus Sequence»", guidaDalNome("Bartimaeus Sequence")?.saga, "Bartimaeus");
  t.eq("«kingkiller series»", guidaDalNome("kingkiller series")?.saga, "The Kingkiller Chronicle");
};

// IL MONDO DI ELAN (`data/elan.js`), chiesto dal lettore: «The World of Elan
// che comprende diverse saghe scritta da Michael J. Sullivan come mai non le
// riconosce ma le vede solo come saghe singole a parte?». Quattro serie,
// quattro guide dello stesso universo, e un ordine di lettura del mondo.
import { riconosci, TAVOLE, MONDI, saghePropose, raccoltaDellaGuida } from "../src/lib/sagaBooks.js";
import { guidaDalNome, sagaDalNome, guideDellAutore } from "../src/lib/sagaDaNome.js";
import { camminoDellaGuida, camminoDelMondo } from "../src/lib/cammino.js";

const S = "Michael J. Sullivan";
const chi = (title, author = S) => {
  const r = riconosci({ title, author });
  return r ? `${r.saga} · ${r.sagaOrder}` : null;
};

export default async (t) => {
  const guide = TAVOLE.filter((x) => x.universo === "The World of Elan");
  t.eq("quattro guide nel mondo di Elan", guide.map((g) => `${g.saga} ${g.libri.filter((v) => v.tipo !== "omnibus").length}`).join(" | "), "The Riyria Revelations 6 | The Riyria Chronicles 5 | Legends of the First Empire 6 | The Rise and Fall 3");
  t.eq("il primo di ogni guida", guide.map((g) => g.libri[0].t).join(" | "), "The Crown Conspiracy | The Crown Tower | Age of Myth | Nolyn");
  // come sta sul tuo scaffale (il titolo di Hardcover)
  t.eq("«The Crown Conspiricy» e' il primo delle Rivelazioni", chi("The Crown Conspiricy"), "The Riyria Revelations · 1");
  t.eq("Age of Swords e' il secondo delle Leggende", chi("Age of Swords"), "Legends of the First Empire · 2");
  t.eq("Drumindor e' il quinto delle Cronache", chi("Drumindor"), "The Riyria Chronicles · 5");
  t.eq("Blythin Castle, non ancora uscito, no", chi("Blythin Castle"), null);
  t.eq("lo stesso titolo di un altro autore no", chi("Age of Myth", "Joe Bloggs"), null);

  // il mondo per nome, come l'ha scritto il lettore
  t.eq("«The World of Elan» e' il mondo intero", guidaDalNome("The World of Elan")?.universo, "The World of Elan");
  t.eq("«Riyria Chronicles» la sua serie", guidaDalNome("Riyria Chronicles")?.saga, "The Riyria Chronicles");
  const mondo = await sagaDalNome("The World of Elan", { libri: [{ title: "The Crown Conspiricy", author: S, saga: "The Riyria Revelations" }] });
  t.eq("chiesto per nome, tutti i romanzi del mondo", mondo?.volumi.filter((v) => !v.novella).length, 20);
  // la raccolta l'ha scelta il lettore: «The World of Elan», e le serie coi
  // nomi della guida dell'autore
  t.eq("…nella raccolta «The World of Elan», anche se i libri stavano altrove", mondo?.saga, "The World of Elan");
  t.eq("…ognuno nella serie col nome della guida", [...new Set(mondo?.volumi.map((v) => v.serie))].join(" | "), "The Riyria Revelations | The Riyria Chronicles | Legends of the First Empire | The Rise and Fall");
  t.c("…e il mondo per primo fra le saghe di Sullivan", /World of Elan/.test(guideDellAutore(S)[0]?.universo || guideDellAutore(S)[0]?.saga || ""));

  // le raccolte di Orbit: chi ha Theft of Swords ha i primi due
  const rivelazioni = TAVOLE.find((x) => x.saga === "The Riyria Revelations");
  const c = camminoDellaGuida(rivelazioni, [{ id: "ts", title: "Theft of Swords", author: S, saga: "The Riyria Revelations", fileType: "epub" }]);
  t.eq("Theft of Swords contiene i primi due romanzi", c.tappe.filter((x) => x.libro?.id === "ts" && x.dentro).map((x) => x.voce.t).join(" | "), "The Crown Conspiracy | Avempartha");
  t.c("…e non e' un passo", !c.tappe.some((x) => x.voce.t === "Theft of Swords" && x.posto != null));

  // l'ordine di lettura del mondo: quello che consiglia l'autore
  const elan = MONDI.find((m) => m.universo === "The World of Elan");
  const fila = camminoDelMondo(elan, []).tappe.filter((x) => x.voce.tipo !== "storia").map((x) => x.voce.t);
  t.eq(
    "il mondo nell'ordine dell'autore",
    fila.join(" | "),
    "The Crown Conspiracy | Avempartha | Nyphron Rising | The Emerald Storm | Wintertide | Percepliquis | The Crown Tower | The Rose and the Thorn | Age of Myth | Age of Swords | Age of War | The Death of Dulgath | The Disappearance of Winter's Daughter | Age of Legend | Age of Death | Age of Empyre | Nolyn | Farilane | Esrahaddon | Drumindor"
  );

  // LA RACCOLTA DELLE GUIDE: i libri nuovi vanno in «The World of Elan»,
  // e «📚 Saghe da sistemare» ci porta quelli gia' sullo scaffale
  const scaffale = [
    { id: "a", title: "Age of Myth", author: S, saga: "The Legends of the First Empire", sagaOrder: 1 },
    { id: "n", title: "Nolyn", author: S, saga: "The Legends of the First Empire", series: "The Rise and Fall", sagaOrder: 1 },
    { id: "c", title: "The Crown Conspiricy", author: S, saga: "The Riyria Revelations", sagaOrder: 1 },
    { id: "t", title: "Theft of Swords", author: S, saga: "The Riyria Revelations", sagaOrder: 1 },
    { id: "f", title: "Farilane", author: S, saga: "The World of Elan", series: "The Rise and Fall", sagaOrder: 2 },
    { id: "x", title: "Mistborn", author: "Brandon Sanderson", saga: "Cosmoverse", sagaOrder: 2 },
    { id: "r", title: "The Crown Tower", author: S, saga: "Riyria", series: "Riyria Chronicles", sagaOrder: 1 },
  ];
  t.eq("un libro nuovo delle Leggende va in «The World of Elan»", raccoltaDellaGuida("Legends of the First Empire", scaffale), "The World of Elan");
  const proposte = new Map(saghePropose(scaffale).map((p) => [p.id, `${p.dopo.saga} / ${p.dopo.series} / ${p.dopo.sagaOrder}`]));
  t.eq("Age of Myth si propone nella raccolta e nella serie della guida", proposte.get("a"), "The World of Elan / Legends of the First Empire / 1");
  t.eq("Nolyn lascia la raccolta delle Leggende", proposte.get("n"), "The World of Elan / The Rise and Fall / 1");
  t.eq("il primo delle Rivelazioni, col titolo del tuo scaffale", proposte.get("c"), "The World of Elan / The Riyria Revelations / 1");
  t.eq("la raccolta di Orbit tiene il suo numero", proposte.get("t"), "The World of Elan / The Riyria Revelations / 1");
  t.eq("una serie scritta a mano prende il nome della guida", proposte.get("r"), "The World of Elan / The Riyria Chronicles / 1");
  t.c("chi e' gia' a posto non si propone", !proposte.has("f"));
  t.c("e un libro di un altro mondo nemmeno", !proposte.has("x"));
};

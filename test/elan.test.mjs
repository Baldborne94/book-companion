// IL MONDO DI ELAN (`data/elan.js`), chiesto dal lettore: «The World of Elan
// che comprende diverse saghe scritta da Michael J. Sullivan come mai non le
// riconosce ma le vede solo come saghe singole a parte?». Quattro serie,
// quattro guide dello stesso universo, e un ordine di lettura del mondo.
import { riconosci, TAVOLE, MONDI } from "../src/lib/sagaBooks.js";
import { guidaDalNome, sagaDalNome, guideDellAutore } from "../src/lib/sagaDaNome.js";
import { camminoDellaGuida, camminoDelMondo } from "../src/lib/cammino.js";

const S = "Michael J. Sullivan";
const chi = (title, author = S) => {
  const r = riconosci({ title, author });
  return r ? `${r.saga} · ${r.sagaOrder}` : null;
};

export default async (t) => {
  const guide = TAVOLE.filter((x) => x.universo === "The World of Elan");
  t.eq("quattro guide nel mondo di Elan", guide.map((g) => `${g.saga} ${g.libri.filter((v) => v.tipo !== "omnibus").length}`).join(" | "), "The Riyria Revelations 6 | The Riyria Chronicles 5 | The Legends of the First Empire 6 | The Rise and Fall 3");
  t.eq("il primo di ogni guida", guide.map((g) => g.libri[0].t).join(" | "), "The Crown Conspiracy | The Crown Tower | Age of Myth | Nolyn");
  // come sta sul tuo scaffale (il titolo di Hardcover)
  t.eq("«The Crown Conspiricy» e' il primo delle Rivelazioni", chi("The Crown Conspiricy"), "The Riyria Revelations · 1");
  t.eq("Age of Swords e' il secondo delle Leggende", chi("Age of Swords"), "The Legends of the First Empire · 2");
  t.eq("Drumindor e' il quinto delle Cronache", chi("Drumindor"), "The Riyria Chronicles · 5");
  t.eq("Blythin Castle, non ancora uscito, no", chi("Blythin Castle"), null);
  t.eq("lo stesso titolo di un altro autore no", chi("Age of Myth", "Joe Bloggs"), null);

  // il mondo per nome, come l'ha scritto il lettore
  t.eq("«The World of Elan» e' il mondo intero", guidaDalNome("The World of Elan")?.universo, "The World of Elan");
  t.eq("«Riyria Chronicles» la sua serie", guidaDalNome("Riyria Chronicles")?.saga, "The Riyria Chronicles");
  const mondo = await sagaDalNome("The World of Elan", { libri: [{ title: "The Crown Conspiricy", author: S, saga: "The Riyria Revelations" }] });
  t.eq("chiesto per nome, tutti i romanzi del mondo", mondo?.volumi.filter((v) => !v.novella).length, 20);
  t.eq("…nella raccolta dove il lettore lo tiene", mondo?.saga, "The Riyria Revelations");
  t.c("…e il mondo per primo fra le saghe di Sullivan", /World of Elan/.test(guideDellAutore(S)[0]?.universo || guideDellAutore(S)[0]?.saga || ""));

  // le raccolte di Orbit: chi ha Theft of Swords ha i primi due
  const rivelazioni = TAVOLE.find((x) => x.saga === "The Riyria Revelations");
  const c = camminoDellaGuida(rivelazioni, [{ id: "ts", title: "Theft of Swords", author: S, saga: "The Riyria Revelations", fileType: "epub" }]);
  t.eq("Theft of Swords contiene i primi due romanzi", c.tappe.filter((x) => x.libro?.id === "ts" && x.dentro).map((x) => x.voce.t).join(" | "), "The Crown Conspiracy | Avempartha");
  t.c("…e non e' un passo", !c.tappe.some((x) => x.voce.t === "Theft of Swords" && x.posto != null));

  // l'ordine di lettura del mondo: le serie si alternano come sono uscite
  const elan = MONDI.find((m) => m.universo === "The World of Elan");
  const fila = camminoDelMondo(elan, []).tappe.filter((x) => x.voce.tipo !== "storia").map((x) => x.voce.t);
  t.eq("il mondo comincia dalle Rivelazioni", fila.slice(0, 6).join(" | "), "The Crown Conspiracy | Avempartha | Nyphron Rising | The Emerald Storm | Wintertide | Percepliquis");
  t.c("Age of Swords prima di The Disappearance of Winter's Daughter", fila.indexOf("Age of Swords") < fila.indexOf("The Disappearance of Winter's Daughter"));
  t.eq("e finisce con Drumindor", fila.at(-1), "Drumindor");
};

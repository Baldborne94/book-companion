// EISENHORN E RAVENOR (`data/eisenhorn.js`, `data/ravenor.js`): le guide
// scritte a mano chieste dopo Gaunt's Ghosts. Due cose sbagliano in
// silenzio: il RICONOSCIMENTO (tre titoli stanno anche nel prologo
// dell'Eresia, «Ravenor» e' insieme la serie e il primo romanzo) e la
// RACCOLTA (il lettore ha l'«Eisenhorn Omnibus», cioe' i primi tre romanzi
// in un file solo).
import { riconosci, TAVOLE } from "../src/lib/sagaBooks.js";
import { camminiDi, camminoDellaGuida, prossimoPasso, lettiDelCammino } from "../src/lib/cammino.js";
import { numerazioneGuida, serieDaScrivere, sagaComune } from "../src/lib/numeraCammino.js";
import { proposte } from "../src/lib/daPrendere.js";
import EISENHORN from "../src/data/eisenhorn.js";
import RAVENOR from "../src/data/ravenor.js";

const r = (title, author = "Dan Abnett") => riconosci({ title, author });
const chi = (title, author) => {
  const x = r(title, author);
  return x ? `${x.saga} · ${x.titolo}` : null;
};
const guida = (saga) => TAVOLE.find((t) => t.saga === saga);
const L = (id, title, saga = "Warhammer 40K") => ({ id, title, author: "Dan Abnett", saga });

export default async (t) => {
  t.eq("Eisenhorn: quattro romanzi, 1-4", EISENHORN.filter((v) => v.o != null).map((v) => `${v.o} ${v.t}`).join(", "), "1 Xenos, 2 Malleus, 3 Hereticus, 4 The Magos");
  t.eq("Ravenor: tre romanzi, 1-3", RAVENOR.filter((v) => v.o != null).map((v) => `${v.o} ${v.t}`).join(", "), "1 Ravenor, 2 Ravenor Returned, 3 Ravenor Rogue");
  // ogni romanzo dentro la raccolta lo dice, e la raccolta esiste
  for (const g of [EISENHORN, RAVENOR]) {
    const omnibus = g.find((v) => v.tipo === "omnibus");
    t.c(`la raccolta c'e' («${omnibus?.t}»)`, !!omnibus);
    t.c(`…e i romanzi che contiene la nominano («${omnibus?.t}»)`, g.filter((v) => v.in).every((v) => v.in === omnibus.t));
  }

  // ── IL RICONOSCIMENTO ─────────────────────────────────────────────────
  for (const v of [...EISENHORN, ...RAVENOR]) t.eq(`«${v.t}» si riconosce nella sua guida`, r(v.t)?.titolo, v.t);
  // il prologo dell'Eresia li nomina come contorno: qui sono la storia
  t.eq("«Malleus» e' di Eisenhorn, non del prologo dell'Eresia", chi("Malleus"), "Eisenhorn · Malleus");
  t.eq("«Eisenhorn» (l'omnibus del 2004) e' la raccolta", chi("Eisenhorn"), "Eisenhorn · Eisenhorn");
  t.eq("«Eisenhorn Omnibus», anche senza autore", chi("Eisenhorn Omnibus", ""), "Eisenhorn · Eisenhorn");
  // il nome della saga nel file e' un'etichetta, il titolo e' l'altro
  t.eq("«Eisenhorn 01 - Xenos» e' Xenos", chi("Eisenhorn 01 - Xenos", ""), "Eisenhorn · Xenos");
  t.eq("«Malleus (Eisenhorn 2)» e' Malleus", chi("Malleus (Eisenhorn 2)"), "Eisenhorn · Malleus");
  t.eq("«Ravenor 02 - Ravenor Returned» non e' il primo", chi("Ravenor 02 - Ravenor Returned", ""), "Ravenor · Ravenor Returned");
  t.eq("«Ravenor» da solo e' il primo", chi("Ravenor"), "Ravenor · Ravenor");
  t.eq("«The Ravenor Omnibus» e' la raccolta, non il primo", chi("The Ravenor Omnibus", ""), "Ravenor · Ravenor: The Omnibus");
  t.eq("«Ravenor Omnibus» con l'autore, idem", chi("Ravenor Omnibus"), "Ravenor · Ravenor: The Omnibus");
  t.eq("«The Eisenhorn Omnibus» senza autore e' la raccolta", chi("The Eisenhorn Omnibus", ""), "Eisenhorn · Eisenhorn");
  // e il resto non si sposta
  t.eq("il resto del prologo resta dell'Eresia", chi("Angels of Darkness", "Gav Thorpe"), "The Horus Heresy · Angels of Darkness");
  // e i Night Lords, da quando hanno la loro guida (`data/warhammer40k.js`),
  // sono suoi come Malleus e' di Eisenhorn
  t.eq("«Soul Hunter» e' dei Night Lords", chi("Soul Hunter", "Aaron Dembski-Bowden"), "Night Lords · Soul Hunter");
  t.eq("«Horus Rising» resta dell'Eresia", chi("Horus Rising"), "The Horus Heresy · Horus Rising");
  t.eq("la Serie di un romanzo sciolto e' la serie", r("Hereticus").ciclo, "Eisenhorn");
  t.eq("…e il numero quello della serie", r("Hereticus").sagaOrder, 3);
  t.eq("la raccolta non ha numero", r("Eisenhorn Omnibus").sagaOrder, null);

  // ── LA RACCOLTA NEL CAMMINO: il caso del lettore ──────────────────────
  const omnibus = { ...L("e", "Eisenhorn Omnibus"), id: "e" };
  const stato = (letti) => ({ statoDi: (id) => (letti.includes(id) ? "read" : "unread"), progressoDi: () => 0, spuntati: new Set() });
  const c = camminoDellaGuida(guida("Eisenhorn"), [omnibus]);
  t.eq("con l'omnibus hai tre dei quattro romanzi", `${c.tue} di ${c.volumi}`, "3 di 4");
  t.eq("…e Xenos sta nella raccolta", c.tappe.find((x) => x.voce.t === "Xenos").libro?.id, "e");
  t.eq("la raccolta non ha un posto suo", c.tappe.find((x) => x.voce.tipo === "omnibus").posto, null);
  t.eq("nessuno propone di numerare l'omnibus (tre volte)", numerazioneGuida(c).length, 0);
  t.eq("…e la Serie si propone una volta sola", serieDaScrivere(c).filter((p) => p.id === "e").length, 1);
  t.eq("da leggere: il primo romanzo, che apri dall'omnibus", prossimoPasso(c, stato([])).tappa.voce.t, "Xenos");
  t.eq("letto l'omnibus, il passo e' The Magos (che non hai)", prossimoPasso(c, stato(["e"])).tappa.voce.t, "The Magos");
  t.eq("…e i letti sono tre di quattro", JSON.stringify(lettiDelCammino(c, stato(["e"]))), JSON.stringify({ letti: 3, quante: 4 }));
  // chi ha i quattro romanzi uno per uno e non l'omnibus ha finito: la
  // raccolta non e' un passo, ne' un volume che manca
  const sciolti = ["Xenos", "Malleus", "Hereticus", "The Magos"].map((x, i) => ({ ...L(`s${i}`, x) }));
  const tutti = camminoDellaGuida(guida("Eisenhorn"), sciolti);
  t.eq("letti i quattro romanzi, nessun passo (l'omnibus non lo e')", prossimoPasso(tutti, stato(sciolti.map((b) => b.id))), null);
  t.eq("…e li hai tutti", `${tutti.tue} di ${tutti.volumi}`, "4 di 4");
  const prop = proposte([omnibus], [], { statusOf: (id) => (id === "e" ? "read" : "unread") });
  t.eq("Da prendere propone The Magos dopo l'omnibus letto", prop.flatMap((g) => g.voci.map((v) => v.titolo)).join(", "), "The Magos");

  // ── IL RIPIANO DEL 40K: Eresia, Eisenhorn, Ravenor ────────────────────
  const libri = [L("h1", "Horus Rising"), L("h2", "Know No Fear"), omnibus, L("r1", "Ravenor Returned")];
  const tre = camminiDi(libri, { scaffale: libri });
  t.eq("tre cammini sul ripiano del 40K", tre.map((x) => x.saga).join(" + "), "The Horus Heresy + Eisenhorn + Ravenor");
  const eresia = tre[0];
  const malleus = eresia.tappe.find((x) => x.voce.t === "Malleus");
  t.eq("nel prologo dell'Eresia l'omnibus e' tuo, per titolo", eresia.tappe.find((x) => x.voce.t === "Eisenhorn").libro?.id, "e");
  // era la scena del lettore: «Malleus, non ce l'hai» con l'omnibus in mano
  t.eq("…e anche Malleus, che sta dentro l'omnibus", malleus.libro?.id, "e");
  t.eq("e l'Eresia non numera un libro di un'altra guida", numerazioneGuida(eresia).some((p) => p.id === "e"), false);
  // ne' gli tocca la Serie o la saga: lo fa la sua guida, e due guide che
  // propongono due cose diverse sullo stesso libro sarebbero un tira e molla
  const conSerie = [L("h1", "Horus Rising"), L("h2", "Know No Fear"), { ...omnibus, series: "The Horus Heresy", saga: "Eisenhorn" }];
  const eresia2 = camminiDi(conSerie, { scaffale: conSerie })[0];
  t.eq("l'Eresia non propone di togliere la Serie all'omnibus", serieDaScrivere(eresia2).some((p) => p.id === "e"), false);
  t.eq("…ne' di cambiargli la saga", (sagaComune(eresia2)?.quali || []).includes("e"), false);
};

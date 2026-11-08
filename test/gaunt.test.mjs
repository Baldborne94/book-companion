// GAUNT'S GHOSTS (`data/gauntsGhosts.js`): la guida scritta a mano che ha
// preso il posto di «I libri dei tuoi autori» (Wikidata diceva «2 libri»).
// Quel che sbaglia in silenzio e' il RICONOSCIMENTO: un volume suo dato
// per mancante si ricompra, un libro di un altro dato per suo si salta.
import { riconosci, TAVOLE } from "../src/lib/sagaBooks.js";
import { camminoDellaGuida, camminiDi, prossimoPasso } from "../src/lib/cammino.js";
import GAUNT, { SAGA } from "../src/data/gauntsGhosts.js";

const saga = (title, author = "Dan Abnett") => riconosci({ title, author })?.saga ?? null;
const titolo = (title, author = "Dan Abnett") => riconosci({ title, author })?.titolo ?? null;

export default async (t) => {
  t.eq("quindici romanzi, numerati da 1 a 15 senza buchi", GAUNT.map((v) => v.o).join(","), Array.from({ length: 15 }, (_, i) => i + 1).join(","));
  t.eq("quattro cicli, nell'ordine della storia", [...new Set(GAUNT.map((v) => v.c))].join(" › "), "The Founding (1-3) › The Saint (4-7) › The Lost (8-11) › The Victory (12-15)");
  // i numeri nel nome del ciclo sono una promessa: devono dire chi c'e' dentro
  for (const ciclo of new Set(GAUNT.map((v) => v.c))) {
    const [da, a] = ciclo.match(/\((\d+)-(\d+)\)/).slice(1).map(Number);
    t.eq(`«${ciclo}» contiene proprio i volumi che dice`, GAUNT.filter((v) => v.c === ciclo).map((v) => v.o).join(","), Array.from({ length: a - da + 1 }, (_, i) => da + i).join(","));
  }
  t.c("la guida sta fra le tavole", TAVOLE.some((tav) => tav.saga === SAGA));

  // ogni titolo, come lo scrive la guida, si riconosce col suo autore
  for (const v of GAUNT) t.eq(`«${v.t}» si riconosce`, titolo(v.t), v.t);
  // e le grafie dei file veri
  t.eq("«Honor Guard» americano", titolo("Honor Guard"), "Honour Guard");
  t.eq("«The Armor of Contempt» americano", titolo("The Armor of Contempt"), "The Armour of Contempt");
  t.eq("«Anarch» senza articolo", titolo("Anarch"), "The Anarch");
  t.eq("«Warmaster» senza articolo", titolo("Warmaster"), "The Warmaster");
  t.eq("«Salvations Reach» senza apostrofo", titolo("Salvations Reach"), "Salvation's Reach");
  t.eq("«Guns of Tanith» senza articolo", titolo("Guns of Tanith"), "The Guns of Tanith");
  t.eq("il nome del file senza autore", titolo("Gaunt's Ghosts 07 - Sabbat Martyr - Dan Abnett", ""), "Sabbat Martyr");

  // UN AUTORE SBAGLIATO E' UNA PROVA: «Necropolis» di un altro non e' questo
  t.eq("«Necropolis» di un altro autore resta fuori", saga("Necropolis", "Joe Bloggs"), null);
  t.eq("«Ghostmaker» di un altro autore resta fuori", saga("Ghostmaker", "Joe Bloggs"), null);
  // e Abnett non e' Gaunt's Ghosts: l'Eresia resta Eresia, Eisenhorn resta
  // il prologo dell'Eresia, e un Abnett che nessuna guida conosce resta fuori
  t.eq("«Horus Rising» resta dell'Eresia", saga("Horus Rising"), "The Horus Heresy");
  t.eq("«Prospero Burns» resta dell'Eresia", saga("Prospero Burns"), "The Horus Heresy");
  t.eq("«Xenos» (Eisenhorn) non e' Gaunt's Ghosts", saga("Xenos"), null);

  // A CAPITOLI: la Serie scritta sul libro e' la storia, il ciclo e' il capitolo
  const r = riconosci({ title: "Traitor General", author: "Dan Abnett" });
  t.eq("la Serie e' «Gaunt's Ghosts», non il ciclo", r.ciclo, SAGA);
  t.eq("il ciclo e' il capitolo", r.parte, "The Lost (8-11)");
  t.eq("il numero e' quello della serie", r.sagaOrder, 8);

  // IL CAMMINO, anche con zero volumi, e sul ripiano «Warhammer 40K» accanto all'Eresia
  const vuoto = camminoDellaGuida(TAVOLE.find((tav) => tav.saga === SAGA), []);
  t.eq("senza volumi: 15 tappe, nessuna tua", `${vuoto.volumi} ${vuoto.tue}`, "15 0");
  // una guida senza prologo non parla del prologo
  const passo = prossimoPasso(vuoto, { statoDi: () => "unread", progressoDi: () => 0, spuntati: new Set() });
  t.eq("da zero il passo e' il primo romanzo", passo.tappa.voce.t, "First and Only");
  t.eq("…e senza la riga dei percorsi del prologo, che qui non c'e'", passo.prologo, null);
  const libri = [
    { id: "h1", title: "Horus Rising", author: "Dan Abnett", saga: "Warhammer 40K" },
    { id: "h2", title: "Legion", author: "Dan Abnett", saga: "Warhammer 40K" },
    { id: "h3", title: "Know No Fear", author: "Dan Abnett", saga: "Warhammer 40K" },
    { id: "g1", title: "First and Only", author: "Dan Abnett", saga: "Warhammer 40K" },
  ];
  const due = camminiDi(libri, { scaffale: libri });
  t.eq("sul ripiano del 40K due cammini: l'Eresia e Gaunt's Ghosts", due.map((c) => c.saga).join(" + "), "The Horus Heresy + Gaunt's Ghosts");
  t.eq("…e Gaunt's Ghosts ha il suo volume", due[1].tue, 1);
};

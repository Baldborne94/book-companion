// THOMAS COVENANT E L'ENDERVERSE (`data/covenant.js`, `data/enderverse.js`),
// chiesto dal lettore: «ho dei problemi con Covenant, Enderverse che ha Ender
// Saga a parte». Una guida sola per mondo, le serie come cicli, numerata col
// mondo e nella raccolta del lettore. Le schede qui sotto sono le sue (la
// copia della biblioteca del 12 novembre).
import { riconosci, saghePropose, raccoltaDellaGuida } from "../src/lib/sagaBooks.js";
import { guidaDalNome } from "../src/lib/sagaDaNome.js";

const D = "Stephen R. Donaldson";
const C = "Orson Scott Card";
const chi = (title, author) => {
  const r = riconosci({ title, author });
  return r ? `${r.saga} · ${r.sagaOrder} · ${r.ciclo}` : null;
};

export default async (t) => {
  t.eq("The Wounded Land e' il quarto di Covenant, nelle Seconde Cronache", chi("The Wounded Land", D), "Thomas Covenant · 4 · The Second Chronicles of Thomas Covenant");
  t.eq("…col sottotitolo del file", chi("The Runes of the Earth: The Last Chronicles of Thomas Covenant - Book One", D), "Thomas Covenant · 7 · The Last Chronicles of Thomas Covenant");
  t.eq("Ender in Exile e' l'undicesimo dell'Enderverse", chi("Ender in Exile", C), "Enderverse · 11 · The Ender Quintet");
  t.eq("«Ucieczka Cienia» e' Shadows in Flight", chi("Ucieczka Cienia", C), "Enderverse · 12 · The Shadow Series");
  t.eq("…Earth Unaware anche col coautore scritto", chi("Earth Unaware", "Aaron Johnston"), "Enderverse · 13 · The First Formic War");
  t.eq("un altro «The Swarm» no", chi("The Swarm", "Frank Schätzing"), null);
  t.eq("«Ender Saga» per nome e' l'Enderverse", guidaDalNome("Ender Saga")?.saga, "Enderverse");
  t.eq("la raccolta e' quella del lettore", [raccoltaDellaGuida("Thomas Covenant"), raccoltaDellaGuida("Enderverse")].join(" | "), "Thomas Covenant | Enderverse");

  // le sue schede, sparse
  const scaffale = [
    { id: "lfb", title: "Lord Foul's Bane", author: D, saga: "The Last Chronicles of Thomas Covenant", sagaOrder: 1 },
    { id: "ot", title: "The One Tree", author: D, saga: "The Complete Chronicles of Thomas Covenant", sagaOrder: 5 },
    { id: "ld", title: "The Last Dark", author: D, saga: "The Complete Chronicles of Thomas Covenant", sagaOrder: 4 },
    { id: "rot", title: "The Runes of the Earth", author: D, saga: "Thomas Covenant", sagaOrder: 7 },
    { id: "gf", title: "Gilden-Fire", author: D, saga: "Thomas Covenant", sagaOrder: 2.1 },
    { id: "eg", title: "Ender's Game", author: C, saga: "Ender Saga", series: "The Ender Quintet", sagaOrder: 1 },
    { id: "eie", title: "Ender in Exile", author: C, saga: "Ender Saga", series: "The Ender Quintet", sagaOrder: 5 },
    { id: "es", title: "Ender's Shadow", author: C, saga: "Enderverse", sagaOrder: 5 },
    { id: "fm", title: "First Meetings in Ender's Universe", author: C, saga: "Enderverse", sagaOrder: 8 },
  ];
  const p = Object.fromEntries(saghePropose(scaffale).map((x) => [x.id, `${x.dopo.saga} · ${x.dopo.series} · ${x.dopo.sagaOrder}`]));
  t.eq("Lord Foul's Bane torna il primo, nelle prime Cronache", p.lfb, "Thomas Covenant · The Chronicles of Thomas Covenant the Unbeliever · 1");
  t.eq("The One Tree resta il quinto, nelle Seconde", p.ot, "Thomas Covenant · The Second Chronicles of Thomas Covenant · 5");
  t.eq("The Last Dark e' il decimo, non il quarto", p.ld, "Thomas Covenant · The Last Chronicles of Thomas Covenant · 10");
  t.eq("The Runes of the Earth prende la sua serie", p.rot, "Thomas Covenant · The Last Chronicles of Thomas Covenant · 7");
  t.eq("Gilden-Fire, storia di mezzo, resta com'e'", p.gf, undefined);
  t.eq("Ender's Game entra nell'Enderverse al primo posto", p.eg, "Enderverse · The Ender Quintet · 1");
  t.eq("Ender in Exile all'undicesimo, dopo A War of Gifts", p.eie, "Enderverse · The Ender Quintet · 11");
  t.eq("Ender's Shadow resta il quinto e prende la sua serie", p.es, "Enderverse · The Shadow Series · 5");
  t.eq("First Meetings resta l'ottavo (un volume, scelto dal lettore)", p.fm, "Enderverse · The Ender Quintet · 8");
};

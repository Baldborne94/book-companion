// MISTBORN E LOCKWOOD (`data/mistborn.js`, `data/lockwood.js`): chieste dal
// lettore dopo Malazan e Stormlight. Il riconoscimento sbaglia in silenzio:
// Sanderson scrive anche Stormlight e una novella col nome «Mistborn»
// davanti, Stroud anche Bartimaeus.
import { riconosci } from "../src/lib/sagaBooks.js";
import { guidaDalNome, sagaDalNome } from "../src/lib/sagaDaNome.js";
import MISTBORN from "../src/data/mistborn.js";
import LOCKWOOD from "../src/data/lockwood.js";

const chi = (title, author) => {
  const r = riconosci({ title, author });
  return r ? `${r.saga} · ${r.sagaOrder} · ${r.ciclo}` : null;
};

export default async (t) => {
  t.eq("Mistborn: sette romanzi, 1-7", MISTBORN.map((v) => v.o).join(","), "1,2,3,4,5,6,7");
  t.eq("…in due ere, tre e quattro", MISTBORN.map((v) => (v.c.startsWith("Era One") ? 1 : 2)).join(""), "1112222");
  t.eq("Lockwood: cinque romanzi, 1-5", LOCKWOOD.map((v) => `${v.o} ${v.t}`).join(", "), "1 The Screaming Staircase, 2 The Whispering Skull, 3 The Hollow Boy, 4 The Creeping Shadow, 5 The Empty Grave");
  for (const v of [...MISTBORN, ...LOCKWOOD]) t.eq(`«${v.t}» si riconosce`, riconosci({ title: v.t, author: v.a })?.titolo, v.t);
  t.eq("«Mistborn: The Final Empire», col nome della serie davanti", chi("Mistborn: The Final Empire", "Brandon Sanderson"), "Mistborn · 1 · Era One");
  t.eq("«Mistborn 2 - The Well of Ascension», dal nome del file", chi("Mistborn 2 - The Well of Ascension", ""), "Mistborn · 2 · Era One");
  t.eq("la seconda era e' il suo ciclo", chi("The Alloy of Law", "Brandon Sanderson"), "Mistborn · 4 · Era Two · Wax and Wayne");
  t.eq("«Lockwood & Co. 2 - The Whispering Skull»", chi("Lockwood & Co. 2 - The Whispering Skull", ""), "Lockwood & Co. · 2 · Lockwood & Co.");
  // e quel che non e' della guida resta fuori
  t.eq("la novella «Mistborn: Secret History» no", chi("Mistborn: Secret History", "Brandon Sanderson"), null);
  t.eq("Stormlight resta Stormlight", chi("The Way of Kings", "Brandon Sanderson")?.split(" · ")[0], "The Stormlight Archive");
  t.eq("Bartimaeus non e' Lockwood", chi("The Amulet of Samarkand", "Jonathan Stroud"), null);
  t.eq("«The Empty Grave» di un altro autore no", chi("The Empty Grave", "Joe Bloggs"), null);
  // per nome
  t.eq("«Wax and Wayne» e' Mistborn", guidaDalNome("Wax and Wayne")?.saga, "Mistborn");
  t.eq("«Lockwood & Co.» col segno", guidaDalNome("Lockwood & Co.")?.saga, "Lockwood & Co.");
  t.eq("«Lockwood and Co» a parole", guidaDalNome("Lockwood and Co")?.saga, "Lockwood & Co.");
  const lw = await sagaDalNome("Lockwood", { libri: [] });
  t.eq("dal nome, la guida: cinque volumi in ordine", `${lw.fonte} ${lw.volumi.map((v) => v.numero).join(",")}`, "guida 1,2,3,4,5");
};

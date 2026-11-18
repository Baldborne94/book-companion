// QUEL CHE NON SERVE AL PRIMO DISEGNO ASPETTA (`lib/riposo.js`): il video
// dell'avvio, la pagina vuota per un secondo e piu' mentre l'Ingresso
// contava i «da prendere» di duemila libri.
import { readFileSync } from "node:fs";
import { aRiposo } from "../src/lib/riposo.js";

export default async function (t) {
  const chiesti = [];
  const annullati = [];
  const finestra = { requestIdleCallback: (f, o) => (chiesti.push([f, o]), 7), cancelIdleCallback: (id) => annullati.push(id) };
  let fatto = 0;
  const annulla = aRiposo(() => fatto++, { finestra });
  t.eq("si chiede al browser quando e' libero", chiesti.length, 1);
  t.eq("…senza farlo subito", fatto, 0);
  t.eq("…ma con un tetto, che un browser sempre occupato non lo rimandi per sempre", chiesti[0][1].timeout, 4000);
  chiesti[0][0]();
  t.eq("e quando e' libero si fa", fatto, 1);
  annulla();
  t.eq("chi si smonta prima annulla la sua richiesta", annullati.join(), "7");

  // senza requestIdleCallback (Safari) un'attesa breve, annullabile anche lei
  let tardi = 0;
  const via = aRiposo(() => tardi++, { finestra: {} });
  via();
  await new Promise((r) => setTimeout(r, 350));
  t.eq("senza il browser che lo dice, un'attesa breve che si annulla", tardi, 0);
  await new Promise((r) => aRiposo(r, { finestra: {} }));
  t.c("…e non annullata arriva", true);

  // l'Ingresso disegna prima e conta dopo: il conto dei «da prendere» non
  // sta nel disegno, ma in quel che aspetta il riposo
  const home = readFileSync("src/components/Home.jsx", "utf8");
  const chiamate = [...home.matchAll(/proposte\(books/g)].map((m) => home.slice(Math.max(0, m.index - 60), m.index));
  t.c("l'Ingresso conta i «da prendere»", chiamate.length > 0);
  t.c("…solo a riposo, dopo il primo disegno", chiamate.every((prima) => /aRiposo\(\(\) => set\w+\($/.test(prima)), chiamate.join(" | "));
}

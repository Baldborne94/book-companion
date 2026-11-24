// QUEL CHE NON SERVE AL PRIMO DISEGNO ASPETTA (`lib/riposo.js`): il video
// dell'avvio, la pagina vuota per un secondo e piu' mentre l'Ingresso
// contava i «da prendere» di duemila libri.
import { readFileSync } from "node:fs";
import { aRiposo, aFette } from "../src/lib/riposo.js";
import { scrittoDel40k, del40k } from "../src/lib/lexicanum.js";

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

  // senza requestIdleCallback la funzione riceve lo stesso una scadenza
  const scadenza = await new Promise((r) => aRiposo(r, { finestra: {} }));
  t.c("…con una scadenza finta, breve, come quella vera", scadenza.timeRemaining() > 0 && scadenza.timeRemaining() <= 10);

  // ---- a fette: le copertine dell'Ingresso aspettavano dietro un conto di 600 ms ----
  // un browser finto: ogni riposo concede `quanti` elementi di tempo
  const browser = (quanti) => {
    const coda = [];
    let tolti = 0;
    return {
      coda,
      finestra: { requestIdleCallback: (f) => (coda.push(f), coda.length), cancelIdleCallback: () => tolti++ },
      riposa: () => {
        let resto = quanti;
        const f = coda.shift();
        f?.({ timeRemaining: () => (resto-- > 0 ? 50 : 0) });
        return !!f;
      },
      tolti: () => tolti,
    };
  };
  const visti = [];
  let fine = null;
  const b1 = browser(3);
  aFette([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], (x) => void visti.push(x), { finestra: b1.finestra, poi: (fermo) => (fine = fermo) });
  t.eq("non comincia prima del riposo", visti.length, 0);
  b1.riposa();
  t.eq("in un riposo fa quel che ci sta, e lascia passare il resto", visti.join(), "1,2,3,4");
  t.eq("…e chiede un altro riposo per continuare", b1.coda.length, 1);
  for (let giri = 0; giri < 50 && b1.riposa(); giri++);
  t.eq("riposo dopo riposo, li fa tutti e una volta sola", visti.join(), "1,2,3,4,5,6,7,8,9,10");
  t.eq("…e alla fine lo dice, senza essersi fermato", fine, false);

  // un browser mai libero (scadenza sempre a zero): un elemento a fetta, ma avanza
  const b2 = browser(0);
  const uno = [];
  aFette(["a", "b", "c"], (x) => void uno.push(x), { finestra: b2.finestra });
  b2.riposa();
  t.eq("anche senza tempo libero si fa almeno un elemento a fetta", uno.join(), "a");
  for (let giri = 0; giri < 50 && b2.riposa(); giri++);
  t.eq("…e si arriva in fondo", uno.join(), "a,b,c");

  // come `some`: chi trova si ferma
  const b3 = browser(99);
  const guardati = [];
  let trovato = null;
  aFette([1, 2, 3, 4], (x) => (guardati.push(x), x === 2), { finestra: b3.finestra, poi: (f) => (trovato = f) });
  for (let giri = 0; giri < 50 && b3.riposa(); giri++);
  t.eq("trovato quel che si cercava, il giro si ferma", guardati.join(), "1,2");
  t.eq("…e lo dice", trovato, true);

  // chi si smonta prima ferma tutto
  const b4 = browser(1);
  const fatti = [];
  let detto = false;
  const ferma = aFette([1, 2, 3, 4, 5], (x) => void fatti.push(x), { finestra: b4.finestra, poi: () => (detto = true) });
  b4.riposa();
  ferma();
  for (let giri = 0; giri < 50 && b4.riposa(); giri++);
  t.c("smontato, non fa piu' niente e non risponde", fatti.length < 5 && !detto, fatti.join());
  t.eq("…e annulla il riposo chiesto", b4.tolti(), 1);

  // una lista vuota risponde lo stesso, a riposo
  const b5 = browser(5);
  let vuota = null;
  aFette([], () => {}, { finestra: b5.finestra, poi: (f) => (vuota = f) });
  t.eq("una lista vuota non risponde subito", vuota, null);
  b5.riposa();
  t.eq("…ma al riposo dice che ha finito", vuota, false);

  // chi legge il 40K si vede dai nomi, senza riconoscere niente
  t.c("il 40K scritto nella saga si vede a colpo d'occhio", scrittoDel40k({ saga: "Warhammer 40K", title: "x" }));
  t.c("…anche nella serie", scrittoDel40k({ series: "Gaunt's Ghosts", title: "First and Only" }));
  t.c("…e nel titolo", scrittoDel40k({ title: "Warhammer 40,000: Xenos" }));
  t.c("un libro che il nome non dice non si vede a colpo d'occhio", !scrittoDel40k({ title: "Galaxy in Flames", author: "Ben Counter" }));
  t.c("…e lo trova la strada lunga", del40k({ title: "Galaxy in Flames", author: "Ben Counter" }));
  t.c("niente libro, niente 40K", !scrittoDel40k(null) && !scrittoDel40k({}));
  t.c("e un libro qualunque non e' del 40K", !scrittoDel40k({ saga: "Discworld", title: "Mort" }));

  // ---- chi fa i conti sull'Ingresso li fa dopo il primo disegno, a fette ----
  const home = readFileSync("src/components/Home.jsx", "utf8");
  const chiamate = [...home.matchAll(/proposte\(books/g)].map((m) => home.slice(Math.max(0, m.index - 120), m.index));
  t.c("l'Ingresso conta i «da prendere»", chiamate.length > 0);
  t.c("…solo alla fine delle fette, dopo il primo disegno", chiamate.every((prima) => /aFette\(books, [^\n]*poi: \(\) => set\w+\($/.test(prima)), chiamate.join(" | "));
  t.c("le copertine dell'Ingresso partono senza aspettare l'osservatore", [...home.matchAll(/<BookCover [^>]*>/g)].every((m) => / subito /.test(m[0])) && /<BookCover /.test(home));
  const cop = readFileSync("src/components/BookCover.jsx", "utf8");
  t.c("…e la copertina «subito» non aspetta l'osservatore", /useState\(subito \|\| intera/.test(cop));
  const uscite = readFileSync("src/components/Uscite40k.jsx", "utf8");
  t.c("le uscite del 40K guardano prima i nomi", /useState\(\(\) => books\.some\(scrittoDel40k\)\)/.test(uscite));
  t.c("…e riconoscono i libri solo a fette", /aFette\(books, del40k/.test(uscite) && !/books\.some\(\(?b?\)? ?=?>? ?del40k/.test(uscite) && !/some\(del40k\)/.test(uscite));
  const app = readFileSync("src/App.jsx", "utf8");
  const doppi = app.slice(app.lastIndexOf("useEffect(", app.indexOf("doppioniInBiblioteca(books")), app.indexOf("doppioniInBiblioteca(books"));
  t.c("i doppioni si contano a riposo, non davanti alle copertine", /aRiposo\(\(\) =>\s*listCoverIds\(\)/.test(doppi), doppi.slice(0, 200));
}

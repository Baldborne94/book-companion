// LA PAGINA DOPO SI DECODIFICA PRIMA (`daDecodificare`): sbaglia in silenzio
// preparando il foglio sbagliato (la voltata aspetta lo stesso) o troppi
// fogli (decine di MB l'uno, tolti alle pagine che arrivano). E le tre liste
// del foglio (`fogliInScena`): una pagina in due liste e' una chiave doppia,
// e React butta l'elemento che si voleva tenere.
import { daDecodificare, coppiaDi, fogliInScena } from "../src/lib/fumetto.js";

export default async (t) => {
  const av = (o) => daDecodificare(o).avanti.join();
  const ind = (o) => daDecodificare(o).indietro.join();
  t.eq("a pagina singola, la pagina dopo", av({ ultima: 4, pages: 20 }), "5");
  t.eq("in doppia pagina, la coppia dopo", av({ ultima: 3, pages: 20, doppia: true }), coppiaDi(4, 20, {}).join());
  t.eq("…che dopo la copertina e' 2-3", av({ ultima: 1, pages: 20, doppia: true }), "2,3");
  t.eq("all'ultima pagina non c'e' niente dopo", av({ ultima: 20, pages: 20 }), "");
  t.eq("un volume non ancora aperto, niente", av({ ultima: 0, pages: 0 }) + ind({ ultima: 0, pages: 0 }), "");
  t.eq("senza una pagina a schermo, niente da preparare", av({ pages: 20 }) + ind({ pages: 20 }), "");
  t.eq("le coppie seguono le tavole larghe del libro", av({ ultima: 3, pages: 20, doppia: true, opzioni: { larghe: new Set([4]) } }), "4");
  // E IL FOGLIO PRIMA (tornare indietro costava 70-156 ms)
  t.eq("a pagina singola, la pagina prima", ind({ ultima: 4, prima: 4, pages: 20 }), "3");
  t.eq("senza `prima` vale l'ultima (pagina singola)", ind({ ultima: 4, pages: 20 }), "3");
  t.eq("in doppia, la coppia prima della prima pagina a schermo", ind({ prima: 4, ultima: 5, pages: 20, doppia: true }), coppiaDi(3, 20, {}).join());
  t.eq("…che prima di 2-3 e' la copertina sola", ind({ prima: 2, ultima: 3, pages: 20, doppia: true }), "1");
  t.eq("alla copertina non c'e' niente prima", ind({ prima: 1, ultima: 1, pages: 20 }), "");
  t.eq("anche all'indietro le tavole larghe stanno sole", ind({ prima: 5, ultima: 6, pages: 20, doppia: true, opzioni: { larghe: new Set([4]) } }), "4");
  t.eq("una pagina oltre la fine non ha un prima che esista", ind({ prima: 25, ultima: 25, pages: 20 }), "");
  const p = (...ns) => ns.map((n) => ({ n }));
  const vede = (r) => `${r.uscenti.map((x) => x.n).join()}|${r.dopo.map((x) => `${x.n}@${x.indice}`).join()}`;
  t.eq("le tre liste separate restano come sono", vede(fogliInScena({ aSchermo: p(4, 5), uscenti: p(2, 3), dopo: p(6, 7) })), "2,3|6@0,7@1");
  t.eq("una pagina che torna a schermo non svanisce", vede(fogliInScena({ aSchermo: p(4), uscenti: p(4, 5) })), "5|");
  t.eq("tornando indietro la pagina che svanisce non e' anche quella dopo", vede(fogliInScena({ aSchermo: p(3), uscenti: p(4), dopo: p(4) })), "4|");
  t.eq("la pagina dopo gia' a schermo non si prepara, e l'altra tiene il suo posto nel foglio", vede(fogliInScena({ aSchermo: p(5), dopo: p(5, 6) })), "|6@1");
  t.eq("senza voltata in corso, solo il foglio dopo", vede(fogliInScena({ aSchermo: p(1), uscenti: undefined, dopo: p(2) })), "|2@0");
  t.eq("chi porta il suo posto nel foglio lo tiene (due fogli: dopo e prima)", vede(fogliInScena({ aSchermo: p(5), dopo: [{ n: 6, indice: 0 }, { n: 7, indice: 1 }, { n: 3, indice: 1 }] })), "|6@0,7@1,3@1");
};

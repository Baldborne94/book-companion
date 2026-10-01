// LA PAGINA DOPO SI DECODIFICA PRIMA (`daDecodificare`): sbaglia in silenzio
// preparando il foglio sbagliato (la voltata aspetta lo stesso) o troppi
// fogli (decine di MB l'uno, tolti alle pagine che arrivano). E le tre liste
// del foglio (`fogliInScena`): una pagina in due liste e' una chiave doppia,
// e React butta l'elemento che si voleva tenere.
import { daDecodificare, coppiaDi, fogliInScena } from "../src/lib/fumetto.js";

export default async (t) => {
  t.eq("a pagina singola, la pagina dopo", daDecodificare({ ultima: 4, pages: 20 }).join(), "5");
  t.eq("in doppia pagina, la coppia dopo", daDecodificare({ ultima: 3, pages: 20, doppia: true }).join(), coppiaDi(4, 20, {}).join());
  t.eq("…che dopo la copertina e' 2-3", daDecodificare({ ultima: 1, pages: 20, doppia: true }).join(), "2,3");
  t.eq("all'ultima pagina non c'e' niente dopo", daDecodificare({ ultima: 20, pages: 20 }).length, 0);
  t.eq("un volume non ancora aperto, niente", daDecodificare({ ultima: 0, pages: 0 }).length, 0);
  t.eq("senza una pagina a schermo, niente da preparare", daDecodificare({ pages: 20 }).length, 0);
  t.eq("le coppie seguono le tavole larghe del libro", daDecodificare({ ultima: 3, pages: 20, doppia: true, opzioni: { larghe: new Set([4]) } }).join(), "4");

  const p = (...ns) => ns.map((n) => ({ n }));
  const vede = (r) => `${r.uscenti.map((x) => x.n).join()}|${r.dopo.map((x) => `${x.n}@${x.indice}`).join()}`;
  t.eq("le tre liste separate restano come sono", vede(fogliInScena({ aSchermo: p(4, 5), uscenti: p(2, 3), dopo: p(6, 7) })), "2,3|6@0,7@1");
  t.eq("una pagina che torna a schermo non svanisce", vede(fogliInScena({ aSchermo: p(4), uscenti: p(4, 5) })), "5|");
  t.eq("tornando indietro la pagina che svanisce non e' anche quella dopo", vede(fogliInScena({ aSchermo: p(3), uscenti: p(4), dopo: p(4) })), "4|");
  t.eq("la pagina dopo gia' a schermo non si prepara, e l'altra tiene il suo posto nel foglio", vede(fogliInScena({ aSchermo: p(5), dopo: p(5, 6) })), "|6@1");
  t.eq("senza voltata in corso, solo il foglio dopo", vede(fogliInScena({ aSchermo: p(1), uscenti: undefined, dopo: p(2) })), "|2@0");
};

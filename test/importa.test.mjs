// Il resoconto dell'import: una riga sola, e deve dire tutto quello che
// l'app ha fatto in silenzio. Il pezzo che conta e' il titolo preso dal
// nome del file — e' il guasto che si scopre settimane dopo, da una saga
// che non si accende.
import { resoconto } from "../src/lib/importBook.js";

const libri = (n) => Array.from({ length: n }, (_, i) => ({ id: String(i) }));

export default async function (t) {
  // ---- il caso di tutti i giorni ---------------------------------------
  t.eq("un libro e basta", resoconto({ added: libri(1) }), "Un nuovo tomo sullo scaffale ✨");
  t.eq("piu' libri", resoconto({ added: libri(3) }), "3 nuovi tomi sullo scaffale ✨");
  t.eq("niente di niente", resoconto({}), "Nessun file importato");
  t.eq("niente, ma con un errore", resoconto({ errors: [{ name: "x.txt", reason: "formato non supportato" }] }),
    "«x.txt»: formato non supportato");

  // ---- quello che l'app faceva in silenzio ------------------------------
  t.eq("la ricucitura si dice",
    resoconto({ added: libri(1), cuciti: 12 }),
    "Un nuovo tomo sullo scaffale ✨ · 12 pezzi ricuciti 🪡");
  t.eq("la saga riconosciuta si dice",
    resoconto({ added: libri(1), riconosciuti: 1 }),
    "Un nuovo tomo sullo scaffale ✨ · una saga riconosciuta 🔖");
  t.c("il titolo dal nome del file si dice, e dice cosa fare",
    /nome del file/.test(resoconto({ added: libri(1), senzaMetadati: 1 })) &&
      /scheda/.test(resoconto({ added: libri(1), senzaMetadati: 1 })));

  // ---- singolare e plurale, che e' dove si sbaglia in silenzio ----------
  t.c("un pezzo, non «1 pezzi»", /un pezzo ricucito/.test(resoconto({ cuciti: 1 })));
  t.c("una saga, non «1 saghe»", /una saga riconosciuta/.test(resoconto({ riconosciuti: 1 })));
  t.c("un titolo, non «1 titoli»", /un titolo preso/.test(resoconto({ senzaMetadati: 1 })));
  t.c("due pezzi", /2 pezzi ricuciti/.test(resoconto({ cuciti: 2 })));
  t.c("due saghe", /2 saghe riconosciute/.test(resoconto({ riconosciuti: 2 })));
  t.c("due titoli", /2 titoli presi/.test(resoconto({ senzaMetadati: 2 })));

  // ---- lo zero non si dice ----------------------------------------------
  // «0 pezzi ricuciti» sarebbe rumore a ogni import: quello che non e'
  // successo non va raccontato
  const pulito = resoconto({ added: libri(2), cuciti: 0, riconosciuti: 0, senzaMetadati: 0 });
  t.eq("niente zeri in giro", pulito, "2 nuovi tomi sullo scaffale ✨");

  // ---- l'ordine: prima cosa e' entrato, poi cosa c'e' da fare ----------
  const tutto = resoconto({
    added: libri(14),
    cuciti: 12,
    riconosciuti: 14,
    senzaMetadati: 2,
    errors: [{ name: "rotto.epub", reason: "salvataggio fallito" }],
  });
  const pos = (s) => tutto.indexOf(s);
  t.c("i tomi per primi", pos("14 nuovi tomi") === 0);
  t.c("poi la ricucitura", pos("ricuciti") > pos("nuovi tomi"));
  t.c("poi le saghe", pos("saghe riconosciute") > pos("ricuciti"));
  t.c("poi quello che non si e' letto", pos("nome del file") > pos("saghe riconosciute"));
  t.c("gli errori in fondo", pos("rotto.epub") > pos("nome del file"));
  t.c("e tutto sta in una riga", !tutto.includes("\n"));
}

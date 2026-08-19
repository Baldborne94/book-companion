// Il resoconto dell'import: una riga sola, e deve dire tutto quello che
// l'app ha fatto in silenzio. Il pezzo che conta e' il titolo preso dal
// nome del file — e' il guasto che si scopre settimane dopo, da una saga
// che non si accende.
import { resoconto, impronta, giaInLibreria, sembraGiaLetto } from "../src/lib/importBook.js";

const libri = (n) => Array.from({ length: n }, (_, i) => ({ id: String(i) }));
const byte = (s) => new TextEncoder().encode(s).buffer;

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

  // ---- L'IMPRONTA DEI BYTE ----------------------------------------------
  // l'id di un libro e' un randomUUID: senza impronta lo stesso file
  // importato due volte faceva due libri distinti, e nessuno lo diceva
  const a = await impronta(byte("le stesse identiche pagine"));
  const b = await impronta(byte("le stesse identiche pagine"));
  const c = await impronta(byte("le stesse identiche pagine."));
  t.eq("lo stesso file da la stessa impronta", a, b);
  t.c("un file diverso no", a !== c, `${a} vs ${c}`);
  t.c("ed e' esadecimale", /^[0-9a-f]{64}$/.test(a), String(a));
  // senza impronta il libro entra lo stesso: un doppione e' un fastidio,
  // un libro non importato e' un danno
  t.eq("un file vuoto non ha impronta", await impronta(byte("")), null);
  t.eq("e nemmeno il nulla", await impronta(null), null);

  const scaffale = [{ id: "x", title: "Guards! Guards!", author: "Terry Pratchett", impronta: a }];
  t.c("il doppione si riconosce", giaInLibreria(a, scaffale)?.id === "x");
  t.eq("un file nuovo no", giaInLibreria(c, scaffale), null);
  // i libri entrati prima di questa cura l'impronta non ce l'hanno: non
  // devono diventare tutti doppioni l'uno dell'altro
  t.eq("nessuna impronta non e' un doppione", giaInLibreria(null, scaffale), null);
  t.eq("e nemmeno contro un libro senza impronta", giaInLibreria(a, [{ id: "y" }]), null);
  // LA TRAPPOLA: senza il guardiano su `imp`, un'impronta `undefined` si
  // troverebbe uguale a TUTTI i libri vecchi, che l'impronta non ce l'hanno
  // — e il primo libro della biblioteca diventerebbe il doppione di ogni
  // file che importi
  t.eq(
    "un'impronta mancante non pareggia con chi non ce l'ha",
    giaInLibreria(undefined, [{ id: "vecchio" }, { id: "altro" }]),
    null
  );

  // ---- L'ALTRA EDIZIONE --------------------------------------------------
  // byte diversi, stesso romanzo: questo NON si salta — magari e' proprio
  // la copia migliore che cercavi — ma non entra di nascosto
  t.c(
    "stesso titolo e stesso autore",
    sembraGiaLetto({ title: "Guards! Guards!", author: "Terry Pratchett" }, scaffale)?.id === "x"
  );
  t.c(
    "l'autore si confronta a parole ordinate",
    sembraGiaLetto({ title: "guards guards", author: "Pratchett, Terry" }, scaffale)?.id === "x"
  );
  t.c(
    "l'articolo non distingue due edizioni",
    sembraGiaLetto({ title: "The Colour of Magic" }, [{ title: "Colour of Magic" }]) !== null
  );
  // un ePub senza metadati e' proprio il caso in cui il doppione e' piu'
  // probabile: il titolo da solo deve bastare
  t.c(
    "senza autore basta il titolo",
    sembraGiaLetto({ title: "Guards! Guards!" }, scaffale)?.id === "x"
  );
  t.eq(
    "ma due autori diversi sono due libri",
    sembraGiaLetto({ title: "Guards! Guards!", author: "Joe Abercrombie" }, scaffale),
    null
  );
  t.eq("un altro romanzo no", sembraGiaLetto({ title: "Mort", author: "Terry Pratchett" }, scaffale), null);
  // un titolo di due lettere non identifica niente
  t.eq("un titolo troppo corto non decide", sembraGiaLetto({ title: "It" }, [{ title: "It" }]), null);
  t.eq("niente titolo, niente gemello", sembraGiaLetto({}, scaffale), null);

  // ---- e il resoconto li dice, ognuno a modo suo ------------------------
  t.c(
    "il saltato dice quale libro era",
    /«Guards! Guards!» era già in libreria/.test(
      resoconto({ saltati: [{ name: "gg.epub", title: "Guards! Guards!" }] })
    )
  );
  t.c(
    "senza titolo ripiega sul nome del file",
    /«gg\.epub»/.test(resoconto({ saltati: [{ name: "gg.epub" }] }))
  );
  t.c("piu' di uno si conta", /3 erano già in libreria/.test(resoconto({ saltati: libri(3) })));
  t.c(
    "il sospetto invece dice che decidi tu",
    /sembra già in libreria in un'altra copia — decidi tu/.test(
      resoconto({ added: libri(1), sospetti: [{ title: "Mort" }] })
    )
  );
  // il doppione saltato spiega perche' i tomi entrati sono meno dei file
  // passati: va detto SUBITO dopo il conto, non in fondo
  const misto = resoconto({ added: libri(2), saltati: libri(1), cuciti: 4, senzaMetadati: 1 });
  t.c("il saltato viene subito dopo i tomi", misto.indexOf("già in libreria") < misto.indexOf("ricuciti"));
  // e da solo si spiega da se': «Nessun file importato» sarebbe una bugia
  // per omissione, perche' il file c'era
  t.c(
    "un doppione solo non diventa «nessun file importato»",
    !/Nessun file importato/.test(resoconto({ saltati: libri(1) }))
  );
  t.eq("mentre il vuoto vero resta vuoto", resoconto({}), "Nessun file importato");
}

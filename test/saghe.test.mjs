// Le saghe: la tabella del Mondo Disco, il ripasso dei libri gia' in
// biblioteca, e la saga imparata dalla tua biblioteca.
import DISCWORLD, { SAGA, CICLI_NOSTRI } from "../src/data/discworldBooks.js";
import { riconosci, ripassa, sagaDaBiblioteca, fuoriSaga } from "../src/lib/sagaBooks.js";

export default async function (t) {
  const cicloDi = (t) => DISCWORLD.find((b) => b.t === t)?.c;

  // ---- 1. i nomi sono quelli della lista del lettore ----------------------
  const ATTESI = new Set([
    "Rincewind", "The Witches", "Death", "City Watch", "Ancient Civilizations",
    "Industrial Revolution", "Tiffany Aching", "The Wizards", "Moist von Lipwig",
  ]);
  const usati = [...new Set(DISCWORLD.map((b) => b.c).filter(Boolean))];
  t.c("solo i nomi canonici", usati.every((n) => ATTESI.has(n)), usati.filter((n) => !ATTESI.has(n)).join(", "));
  t.c("nessun «Cycle» rimasto", !usati.some((n) => /cycle/i.test(n)), usati.join(", "));
  t.c("nessun nome italiano", !usati.some((n) => /Streghe|Guardie|Morte|Maghi|Autoconclusiv/i.test(n)));
  t.c("tutti e nove i gruppi usati", ATTESI.size === usati.length, `usati ${usati.length}`);

  // ---- 2. libro per libro, contro la lista del lettore --------------------
  const LISTA = {
    "The Colour of Magic": "Rincewind", "The Light Fantastic": "Rincewind",
    "Equal Rites": "The Witches", Mort: "Death", Sourcery: "Rincewind",
    "Wyrd Sisters": "The Witches", Pyramids: "Ancient Civilizations",
    "Guards! Guards!": "City Watch", Eric: "Rincewind",
    "Moving Pictures": "Industrial Revolution", "Reaper Man": "Death",
    "Witches Abroad": "The Witches", "Small Gods": "Ancient Civilizations",
    "Lords and Ladies": "The Witches", "Men at Arms": "City Watch",
    "Soul Music": "Death", "Interesting Times": "Rincewind",
    Maskerade: "The Witches", "Feet of Clay": "City Watch", Hogfather: "Death",
    Jingo: "City Watch", "The Last Continent": "Rincewind",
    "Carpe Jugulum": "The Witches", "The Fifth Elephant": "City Watch",
    "The Truth": "Industrial Revolution", "Thief of Time": "Death",
    "The Last Hero": "Rincewind",
    "The Amazing Maurice and His Educated Rodents": null,
    "Night Watch": "City Watch", "The Wee Free Men": "Tiffany Aching",
    "Monstrous Regiment": "Industrial Revolution", "A Hat Full of Sky": "Tiffany Aching",
    "Going Postal": "Moist von Lipwig", "Thud!": "City Watch",
    Wintersmith: "Tiffany Aching", "Making Money": "Moist von Lipwig",
    "Unseen Academicals": "The Wizards", "I Shall Wear Midnight": "Tiffany Aching",
    Snuff: "City Watch", "Raising Steam": "Moist von Lipwig",
    "The Shepherd's Crown": "Tiffany Aching",
  };
  t.eq("quarantuno romanzi", DISCWORLD.length, 41);
  // NB: la variabile del ciclo non si chiama `t`, che qui e' il banco
  for (const [tit, atteso] of Object.entries(LISTA)) t.eq(`ciclo di «${tit}»`, cicloDi(tit), atteso);
  t.c("numeri 1..41 senza buchi", DISCWORLD.every((b, i) => b.n === i + 1));

  // ---- 3. le scelte chieste al lettore -----------------------------------
  t.eq("Snuff sta con la Guardia", cicloDi("Snuff"), "City Watch");
  t.eq("Raising Steam sta con Lipwig", cicloDi("Raising Steam"), "Moist von Lipwig");
  t.eq("Unseen Academicals sta coi Maghi", cicloDi("Unseen Academicals"), "The Wizards");
  t.eq("Tiffany ha un ciclo suo", cicloDi("The Wee Free Men"), "Tiffany Aching");
  t.c("Tiffany non finisce nelle Streghe",
    DISCWORLD.filter((b) => b.c === "Tiffany Aching").length === 5);
  t.c("le Streghe restano sei", DISCWORLD.filter((b) => b.c === "The Witches").length === 6);
  t.eq("un solo autoconclusivo", DISCWORLD.filter((b) => b.c === null).length, 1);
  t.eq("ed e' Maurice", DISCWORLD.find((b) => b.c === null).t, "The Amazing Maurice and His Educated Rodents");

  // ---- 4. il riconoscimento all'import ------------------------------------
  const r1 = riconosci({ title: "Men at Arms (Discworld Novels Book 15)", author: "Terry Pratchett" });
  t.eq("Men at Arms → City Watch", r1.ciclo, "City Watch");
  t.eq("Men at Arms → n. 15", r1.sagaOrder, 15);
  t.eq("Men at Arms → saga", r1.saga, SAGA);
  t.eq("Small Gods → Ancient Civilizations", riconosci({ fileName: "small gods.epub" }).ciclo, "Ancient Civilizations");
  t.eq("Maurice resta senza ciclo", riconosci({ title: "The Amazing Maurice and His Educated Rodents" }).ciclo, null);
  t.c("Good Omens resta fuori", riconosci({ title: "Good Omens", author: "Terry Pratchett" }) === null);

  // ---- 5. il ripasso: rinomina i nostri, lascia stare i tuoi --------------
  const libro = (x) => ({ title: "", author: "", saga: "", series: "", sagaOrder: null, ...x });

  // il caso del lettore: nome vecchio, titolo riconoscibile
  t.eq("«The Witches Cycle» → «The Witches»",
    ripassa(libro({ title: "Wyrd Sisters", saga: SAGA, series: "The Witches Cycle", sagaOrder: 6 }))?.campi.series,
    "The Witches");
  t.eq("«Streghe» → «The Witches»",
    ripassa(libro({ title: "Maskerade", saga: SAGA, series: "Streghe", sagaOrder: 18 }))?.campi.series,
    "The Witches");
  t.eq("«Guardie» → «City Watch»",
    ripassa(libro({ title: "Jingo", saga: SAGA, series: "Guardie", sagaOrder: 21 }))?.campi.series,
    "City Watch");
  t.eq("«Autoconclusivo» su Small Gods → «Ancient Civilizations»",
    ripassa(libro({ title: "Small Gods", saga: SAGA, series: "Autoconclusivo", sagaOrder: 13 }))?.campi.series,
    "Ancient Civilizations");
  t.eq("«Autoconclusivo» su Maurice → si svuota",
    ripassa(libro({ title: "The Amazing Maurice and His Educated Rodents", saga: SAGA, series: "Autoconclusivo", sagaOrder: 28 }))?.campi.series,
    "");
  t.eq("«Moist» → «Moist von Lipwig»",
    ripassa(libro({ title: "Going Postal", saga: SAGA, series: "Moist", sagaOrder: 33 }))?.campi.series,
    "Moist von Lipwig");

  // quello che ha scritto il lettore non si tocca
  t.c("un nome tuo resta tuo",
    !("series" in (ripassa(libro({ title: "Jingo", saga: SAGA, series: "Le Guardie di Ankh-Morpork", sagaOrder: 21 }))?.campi || {})));
  // maiuscole diverse = non l'abbiamo scritto noi
  t.c("un nome tuo resta tuo anche se e' quasi il nostro",
    !("series" in (ripassa(libro({ title: "Jingo", saga: SAGA, series: "city watch", sagaOrder: 21 }))?.campi || {})));

  // un ciclo gia' giusto non e' un tocco
  t.c("un ciclo gia' giusto non muove niente",
    ripassa(libro({ title: "Jingo", saga: SAGA, series: "City Watch", sagaOrder: 21 })) === null);
  t.c("«Rincewind» era gia' il nome buono",
    ripassa(libro({ title: "Sourcery", saga: SAGA, series: "Rincewind", sagaOrder: 5 })) === null);

  // campi vuoti: il comportamento di prima, intatto
  const vuoto = ripassa(libro({ title: "Thud!", author: "Terry Pratchett" }))?.campi;
  t.eq("campo vuoto: saga", vuoto.saga, SAGA);
  t.eq("campo vuoto: numero", vuoto.sagaOrder, 34);
  t.eq("campo vuoto: serie", vuoto.series, "City Watch");

  // il titolo non si riconosce (tradotto), ma il ciclo vecchio e' nostro:
  // vale la mappa dei nomi, non la tabella — o cancelleremmo un ciclo buono
  const tradotto = ripassa(libro({ title: "A me le guardie!", author: "Terry Pratchett", saga: SAGA, series: "Guardie", sagaOrder: 8 }));
  t.eq("titolo tradotto: il ciclo si rinomina lo stesso", tradotto?.campi.series, "City Watch");

  // e un libro che non c'entra niente col Disco non si tocca mai
  t.c("un libro estraneo non si tocca",
    ripassa(libro({ title: "Dune", author: "Frank Herbert", saga: "Dune", series: "Streghe" })) === null);

  // ---- 5b. LA SAGA SI IMPARA DALLA TUA BIBLIOTECA -------------------------
  // il caso segnalato: il cofanetto di First Law con la Saga vuota, e in
  // biblioteca un altro Abercrombie che dichiara «Circle of the World»
  const ABER = [
    { id: "h", title: "The Heroes", author: "Joe Abercrombie", saga: "Circle of the World", series: "" },
    { id: "b", title: "Best Served Cold", author: "Joe Abercrombie", saga: "Circle of the World", series: "" },
  ];
  const cofanetto = libro({ id: "x", title: "The First Law Trilogy Boxed Set", author: "Joe Abercrombie", series: "The First Law Trilogy", sagaOrder: 1 });
  const dedotto = ripassa(cofanetto, [...ABER, cofanetto]);
  t.eq("il cofanetto prende la saga dagli altri Abercrombie", dedotto?.campi.saga, "Circle of the World");
  t.c("e si dichiara DEDOTTA, non riconosciuta", dedotto?.dedotta === true);
  t.c("la serie che avevi scritto tu non si tocca", !("series" in (dedotto?.campi || {})));
  t.c("e nemmeno il numero di lettura", !("sagaOrder" in (dedotto?.campi || {})));

  // «Abercrombie, Joe» e «Joe Abercrombie» sono la stessa persona
  t.eq("il nome girato conta lo stesso",
    sagaDaBiblioteca({ author: "Abercrombie, Joe" }, ABER), "Circle of the World");

  // DUE SAGHE DELLO STESSO AUTORE: non si tocca niente
  const DUE = [...ABER, { id: "s", title: "Half a King", author: "Joe Abercrombie", saga: "Shattered Sea" }];
  t.c("con due saghe dello stesso autore non si deduce",
    sagaDaBiblioteca({ id: "x", author: "Joe Abercrombie" }, DUE) === null);

  // e nessun altro libro di quell'autore: niente da cui imparare
  t.c("da solo non si deduce niente",
    sagaDaBiblioteca({ id: "x", author: "Robin Hobb" }, ABER) === null);

  // UN LIBRO CHE HA GIA' LA SAGA non si tocca
  t.c("una saga gia' scritta resta",
    ripassa(libro({ id: "x", title: "Sharp Ends", author: "Joe Abercrombie", saga: "La mia" }), ABER) === null);

  // LA TRAPPOLA: Good Omens non deve diventare Discworld solo perche' tutti
  // gli altri Pratchett lo sono
  const PRATCHETT = [
    { id: "p1", title: "Mort", author: "Terry Pratchett", saga: "Discworld" },
    { id: "p2", title: "Jingo", author: "Terry Pratchett", saga: "Discworld" },
  ];
  t.c("«fuoriSaga» riconosce Good Omens", fuoriSaga({ title: "Good Omens", author: "Terry Pratchett" }));
  t.c("e Good Omens NON prende Discworld dalla biblioteca",
    ripassa(libro({ id: "g", title: "Good Omens", author: "Terry Pratchett" }), PRATCHETT) === null);
  t.c("mentre un Pratchett qualsiasi la prende dalla tabella",
    ripassa(libro({ id: "n", title: "Nemmeno un titolo noto", author: "Terry Pratchett" }), PRATCHETT)?.campi.saga === SAGA);
  t.c("«fuoriSaga» non si applica agli altri autori",
    fuoriSaga({ title: "Nation", author: "Joe Abercrombie" }) === false);

  // un autore vuoto non deve pescare a caso
  t.c("senza autore non si deduce",
    sagaDaBiblioteca({ id: "x", author: "" }, ABER) === null);
  t.c("e nemmeno con un autore di due lettere",
    sagaDaBiblioteca({ id: "x", author: "Jo" }, [{ id: "z", author: "Jo", saga: "Qualcosa" }]) === null);

  // ---- 6. la mappa dei nomi vecchi e' completa ----------------------------
  for (const vecchio of ["Streghe", "Guardie", "Morte", "Maghi", "Moist", "Tiffany", "Rincewind", "Autoconclusivo"])
    t.c(`mappa: «${vecchio}»`, Object.prototype.hasOwnProperty.call(CICLI_NOSTRI, vecchio));
  for (const vecchio of ["The Witches Cycle", "The City Watch Cycle", "The Death Cycle", "The Wizards Cycle", "The Moist von Lipwig Cycle", "The Tiffany Aching Cycle", "The Rincewind Cycle"])
    t.c(`mappa: «${vecchio}»`, Object.prototype.hasOwnProperty.call(CICLI_NOSTRI, vecchio));
  t.c("la mappa punta solo a nomi veri (o al vuoto)",
    Object.values(CICLI_NOSTRI).every((n) => n === null || ATTESI.has(n)));

}

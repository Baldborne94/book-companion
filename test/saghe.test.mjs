// Le saghe: la tabella del Mondo Disco, il ripasso dei libri gia' in
// biblioteca, e la saga imparata dalla tua biblioteca.
import DISCWORLD, { SAGA, CICLI_NOSTRI } from "../src/data/discworldBooks.js";
import {
  riconosci, ripassa, sagaDaBiblioteca, fuoriSaga,
  chiaveSaga, nomeInBiblioteca, unificaSaghe, deduciSaghe,
} from "../src/lib/sagaBooks.js";
import APOCALISSE, { SAGA as SAGA_SA } from "../src/data/secondApocalypse.js";

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

  // ---- 5c. LA STESSA SAGA SCRITTA IN DUE MODI E' UNA SAGA SOLA ------------
  // Il caso del lettore: tre ripiani di Robert Jordan — «The Wheel of
  // Time», «Wheel of Time», e due volumi soli sotto l'autore, perché la
  // deduzione vedeva «due saghe dello stesso autore» e si fermava.
  const JORDAN = [
    { id: "j1", title: "The Eye of the World", author: "Robert Jordan", saga: "Wheel of Time", sagaOrder: 1 },
    { id: "j2", title: "The Great Hunt", author: "Robert Jordan", saga: "", sagaOrder: null },
    { id: "j0", title: "New Spring", author: "Robert Jordan", saga: "The Wheel of Time", sagaOrder: 0 },
    { id: "j4", title: "The Shadow Rising", author: "Robert Jordan", saga: "The Wheel of Time", sagaOrder: 4 },
    { id: "j5", title: "The Fires of Heaven", author: "Robert Jordan", saga: "", sagaOrder: null },
  ];
  t.eq("l'articolo non fa due saghe", chiaveSaga("The Wheel of Time"), chiaveSaga("Wheel of Time"));
  t.eq("e nemmeno le maiuscole", chiaveSaga("WHEEL OF TIME"), chiaveSaga("wheel of time"));
  t.c("ma due saghe diverse restano diverse", chiaveSaga("First Law") !== chiaveSaga("Shattered Sea"));
  // LIMITE DICHIARATO: «First Law» e «First Law Trilogy» restano due, perché
  // da qui non si può sapere se sono la stessa, e mescolare due storie è
  // peggio di un ripiano in più
  t.c("un suffisso è una differenza vera", chiaveSaga("First Law") !== chiaveSaga("First Law Trilogy"));

  {
    const u = unificaSaghe(JORDAN);
    t.eq("una saga da riunire", u.unificate, 1);
    // vince la grafia PIÙ USATA (due contro uno)
    t.eq("vince la più usata", JSON.stringify(u.nomi), '["The Wheel of Time"]');
    t.eq("e si riscrive solo chi era scritto diversamente", JSON.stringify(Object.keys(u.campi)), '["j1"]');
    t.eq("con la grafia scelta", u.campi.j1.saga, "The Wheel of Time");
    // i libri senza saga non c'entrano: unificare non è dedurre
    t.c("i vuoti restano vuoti", !("j2" in u.campi) && !("j5" in u.campi));
  }
  {
    // A PARITÀ vince la più lunga, cioè quella con l'articolo — e il
    // criterio non dipende dall'ordine dei libri, o cambierebbe a ogni import
    const pari = [
      { id: "a", saga: "Wheel of Time" },
      { id: "b", saga: "The Wheel of Time" },
    ];
    t.eq("a parità la forma piena", unificaSaghe(pari).nomi[0], "The Wheel of Time");
    t.eq("in qualunque ordine", unificaSaghe([...pari].reverse()).nomi[0], "The Wheel of Time");
    t.eq("e si riscrive l'altra", unificaSaghe(pari).campi.a?.saga, "The Wheel of Time");
  }
  t.eq("una biblioteca già in ordine non muove niente", unificaSaghe(ABER).unificate, 0);
  t.eq("e nemmeno una vuota", unificaSaghe([]).unificate, 0);

  // LA DEDUZIONE ORA VEDE UNA SAGA SOLA: con le due grafie si fermava
  t.eq("prima della cura la deduzione si fermava... e adesso no",
    sagaDaBiblioteca({ id: "j2", author: "Robert Jordan" }, JORDAN), "Wheel of Time");
  {
    // la passata automatica: si riuniscono le grafie, poi si deduce
    const u = unificaSaghe(JORDAN);
    const uniti = JORDAN.map((b) => (u.campi[b.id] ? { ...b, ...u.campi[b.id] } : b));
    const d = deduciSaghe(uniti);
    t.eq("i due volumi soli prendono la saga", d.dedotte, 2);
    t.eq("quella dei fratelli", d.campi.j2?.saga, "The Wheel of Time");
    t.eq("tutt'e due", d.campi.j5?.saga, "The Wheel of Time");
    // e chi ce l'aveva non si tocca
    t.c("chi ce l'aveva non è nei campi", !("j0" in d.campi) && !("j4" in d.campi));
  }
  // la deduzione automatica tiene le stesse guardie del tasto
  t.eq("Good Omens non prende Discworld nemmeno da sola",
    deduciSaghe([...PRATCHETT, { id: "g", title: "Good Omens", author: "Terry Pratchett", saga: "" }]).dedotte, 0);
  t.eq("con due saghe dello stesso autore non si deduce",
    deduciSaghe([...DUE, { id: "x", author: "Joe Abercrombie", saga: "" }]).dedotte, 0);

  // LA GRAFIA DI CASA ALL'INGRESSO: il file dice «Wheel of Time», la
  // biblioteca ha già «The Wheel of Time» — si scrive come in casa
  t.eq("il file si adegua alla casa", nomeInBiblioteca("Wheel of Time", [JORDAN[2]]), "The Wheel of Time");
  t.eq("una saga nuova entra com'è", nomeInBiblioteca("Malazan", JORDAN), "Malazan");
  t.eq("e il vuoto resta vuoto", nomeInBiblioteca("", JORDAN), "");

  // ---- 6. la mappa dei nomi vecchi e' completa ----------------------------
  for (const vecchio of ["Streghe", "Guardie", "Morte", "Maghi", "Moist", "Tiffany", "Rincewind", "Autoconclusivo"])
    t.c(`mappa: «${vecchio}»`, Object.prototype.hasOwnProperty.call(CICLI_NOSTRI, vecchio));
  for (const vecchio of ["The Witches Cycle", "The City Watch Cycle", "The Death Cycle", "The Wizards Cycle", "The Moist von Lipwig Cycle", "The Tiffany Aching Cycle", "The Rincewind Cycle"])
    t.c(`mappa: «${vecchio}»`, Object.prototype.hasOwnProperty.call(CICLI_NOSTRI, vecchio));
  t.c("la mappa punta solo a nomi veri (o al vuoto)",
    Object.values(CICLI_NOSTRI).every((n) => n === null || ATTESI.has(n)));

  // ---- LA SECONDA APOCALISSE, e perché ha una tavola sua ---------------
  //
  // Chiesto due volte dal lettore. La strada di sempre — la saga copiata da
  // un altro libro dello stesso autore — non poteva funzionare: di Bakker
  // ne ha UN volume solo, quindi non c'era da dove copiarla, e il tasto
  // rispondeva «erano già tutti a posto» dicendo il vero.
  const bakker = (t2, a = "R. Scott Bakker") => riconosci({ title: t2, author: a });

  t.eq("il titolo intero si riconosce", bakker("The Darkness That Comes Before")?.sagaOrder, 1);
  t.eq("con la sua saga", bakker("The Darkness That Comes Before")?.saga, SAGA_SA);
  t.eq("e il suo ciclo", bakker("The Darkness That Comes Before")?.ciclo, "The Prince of Nothing");
  // IL CASO DEL LETTORE: il suo file si chiama senza «The», e il titolo si
  // cerca DENTRO il campo — la forma lunga non ci starebbe mai.
  t.eq("e anche il titolo senza l'articolo", bakker("Darkness That Comes Before")?.sagaOrder, 1);
  t.eq(
    "il rumore dell'editore non lo nasconde",
    bakker("The Unholy Consult (The Aspect-Emperor Book 4).epub", "Bakker, R. Scott")?.sagaOrder,
    7
  );
  t.eq("il secondo ciclo si chiama col suo nome", bakker("The Judging Eye")?.ciclo, "The Aspect-Emperor");

  // LA TAVOLA È `stretta`, ed è questa la ragione: «The Great Ordeal» non è
  // un'insegna inconfondibile, e di un ALTRO autore non è il suo.
  t.eq("un omonimo di un altro autore non passa", bakker("The Great Ordeal", "Qualcun Altro"), null);
  t.eq("ma il suo sì", bakker("The Great Ordeal")?.sagaOrder, 6);

  // I THRILLER DI BAKKER NON SONO LA SAGA: senza `fuori`, il ripiego
  // sull'autore darebbe «The Second Apocalypse» anche a quelli.
  t.eq("«Neuropath» non è la saga", bakker("Neuropath"), null);
  t.eq("nemmeno «Disciple of the Dog»", bakker("Disciple of the Dog"), null);
  // ...mentre un titolo che non conosciamo prende la saga senza numero:
  // meglio della saga mancante, e il numero non si inventa
  const ignoto = bakker("Un romanzo che la tavola non conosce");
  t.eq("un titolo ignoto del suo autore prende la saga", ignoto?.saga, SAGA_SA);
  t.eq("ma senza numero, che non si inventa", ignoto?.sagaOrder, null);

  // la tavola in sé: numeri di fila, nessun doppione, ogni voce col ciclo
  t.eq("sette romanzi", APOCALISSE.length, 7);
  t.c("numerati di fila da 1", APOCALISSE.every((b, i) => b.n === i + 1));
  t.eq("nessun titolo doppio", new Set(APOCALISSE.map((b) => b.t)).size, APOCALISSE.length);
  t.c("ogni volume dichiara il suo ciclo", APOCALISSE.every((b) => !!b.c));
  t.c("e il suo autore, che è quel che rende la tavola stretta", APOCALISSE.every((b) => !!b.a));

  // GLI ALIAS NON DEVONO ALLARGARE LE ALTRE TAVOLE: togliere l'articolo a
  // tutti farebbe di «The Truth» un «truth» che sta dentro qualunque cosa.
  t.eq("«The Truth» resta il Mondo Disco", riconosci({ title: "The Truth", author: "Terry Pratchett" })?.saga, SAGA);
  // ...e la chiave del Disco resta «the truth», con l'articolo: è questo che
  // l'alias non deve toccare.
  t.eq(
    "«Truth» da solo non prende il Mondo Disco",
    riconosci({ title: "Truth", author: "Qualcun Altro" }),
    null
  );
  // LIMITE DICHIARATO, e non è mio: il Mondo Disco è una tavola LARGA, e
  // «The Truth About Cats» di chiunque si prende «The Truth» per solo
  // contenimento. Misurato prima e dopo questa modifica: identico. Curarlo
  // vorrebbe dire rendere `stretta` anche quella tavola, che è un'altra
  // faccenda e tocca quarantun romanzi già in libreria.
}

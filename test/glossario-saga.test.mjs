// IL GLOSSARIO DI SAGA: cosa si riconosce in una selezione, e cosa NON si
// deve riconoscere.
//
// È un modulo che sbaglia in silenzio da tutt'e due i lati. Se non riconosce
// un termine, la scheda esce vuota e sembra solo che non ci fosse niente da
// dire; se lo riconosce dove non c'è — «the death of the king» che diventa
// il personaggio Morte — la scheda risponde con sicurezza a una domanda che
// nessuno ha fatto. Nessuno dei due casi alza un errore.
//
// Le regole provate qui stavano tutte scritte nei commenti del modulo e
// pinnate da niente.
const memoria = {};
for (const [nome, fn] of Object.entries({
  getItem: (k) => (k in memoria ? memoria[k] : null),
  setItem: (k, v) => {
    memoria[k] = String(v);
  },
  removeItem: (k) => {
    delete memoria[k];
  },
})) {
  Object.defineProperty(memoria, nome, { value: fn, enumerable: false });
}
globalThis.localStorage = memoria;

const {
  normalize,
  capitalized,
  buildIndex,
  scan,
  espressione,
  glossaryOf,
  haGlossario,
  wikiUrl,
  explain,
  termIndex,
} = await import("../src/lib/glossary.js");
const { salvaVoci, chiaveGlossario } = await import("../src/lib/glossarioMio.js");

const DISCO = { id: "l1", title: "Guards! Guards!", author: "Terry Pratchett", saga: "Discworld" };
const ALTRA = { id: "l2", title: "Gardens of the Moon", author: "Steven Erikson", saga: "Malazan" };

export default async function (t) {
  // =======================================================================
  // COME SI APPIATTISCE UNA PAROLA
  // =======================================================================
  {
    t.eq("maiuscole giù", normalize("Ankh-Morpork"), "ankh-morpork");
    t.eq("gli apostrofi ricci diventano dritti", normalize("sod’s law"), "sod's law");
    t.eq("la punteggiatura è uno spazio", normalize("Death, said."), "death said");
    t.eq("gli spazi si stringono", normalize("  the   Shades  "), "the shades");
    t.eq("il trattino resta", normalize("Ankh-Morpork").includes("-"), true);
    t.eq("niente non è niente", normalize(null), "");
  }

  // =======================================================================
  // LA MAIUSCOLA SI CERCA NEL TESTO COM'È SCRITTO
  // =======================================================================
  //
  // È la regola che tiene «Death» il personaggio separato da «the death of
  // the king». Due trappole, tutt'e due già cascate secondo il modulo.
  {
    t.c("«Death said» è il personaggio", capitalized("Death said hello", "death"));
    t.c("«the death of the king» no", !capitalized("the death of the king", "death"));
    // BASTA UNA OCCORRENZA: nella stessa selezione possono starci tutt'e due,
    // e allora il personaggio c'è
    t.c(
      "una sola maiuscola basta",
      capitalized("the death of the king. Death said nothing.", "death")
    );
    // «Ankh-Morpork» ha DUE maiuscole, e la chiave normalizzata è tutta
    // minuscola: confrontando la chiave col testo ricostruito non si
    // trovava mai
    t.c("un nome con due maiuscole si trova lo stesso", capitalized("in Ankh-Morpork", "ankh-morpork"));
    // il termine dev'essere una parola intera: «Deathly» non è «Death»
    t.c("dentro un'altra parola non conta", !capitalized("deathly quiet", "death"));
    // e i caratteri speciali di una regex non devono far esplodere niente
    t.c("un termine con la punteggiatura non rompe la regex", !capitalized("nulla", "a.b*c"));
  }

  // =======================================================================
  // L'INDICE: alias e varianti col trattino
  // =======================================================================
  {
    const ix = buildIndex([
      { t: "Ankh-Morpork", d: "la città", a: ["Morpork"] },
      { t: "Granny Weatherwax", d: "la strega", a: ["Weatherwax"] },
    ]);
    t.c("il termine c'è", ix.map.has("ankh-morpork"));
    t.c("e anche senza trattino, che è come lo scrivono in tanti", ix.map.has("ankh morpork"));
    t.c("gli alias entrano", ix.map.has("morpork") && ix.map.has("weatherwax"));
    // `max` dice quante parole guardare avanti nella scansione: se restasse
    // a 1, «Granny Weatherwax» non verrebbe mai cercato intero
    t.eq("la finestra più lunga è di due parole", ix.max, 2);
    // IL PRIMO CHE ARRIVA VINCE: due voci che dichiarano la stessa chiave non
    // devono scambiarsi il posto a seconda dell'ordine di lettura
    const doppio = buildIndex([{ t: "X", d: "primo" }, { t: "X", d: "secondo" }]);
    t.eq("una chiave doppia tiene la prima voce", doppio.map.get("x").d, "primo");
  }

  // =======================================================================
  // LA SCANSIONE: il pezzo più lungo vince e si riparte da dopo
  // =======================================================================
  const gloss = buildIndex([
    { t: "Granny Weatherwax", d: "la strega", a: ["Weatherwax"] },
    { t: "Death", d: "il personaggio" },
    { t: "Ankh-Morpork", d: "la città" },
  ]);
  const modi = buildIndex([
    { t: "egg on", d: "istigare", a: ["egged on"] },
    { t: "row", d: "litigata", c: 1 },
  ]);
  const trova = (testo) => scan([["gloss", gloss], ["slang", modi]], testo);
  {
    const r = trova("Granny Weatherwax walked");
    t.eq("il nome intero vince sul pezzo", r.length, 1);
    t.eq("ed è quello lungo", r[0].t, "Granny Weatherwax");
  }
  {
    // e si riparte DA DOPO: il pezzo già preso non si rilegge
    const r = trova("Granny Weatherwax went to Ankh-Morpork");
    t.eq("due voci in ordine di lettura", r.map((e) => e.t).join(" → "), "Granny Weatherwax → Ankh-Morpork");
  }
  {
    // I DOPPIONI SI SCARTANO: un nome ripetuto in un paragrafo è una voce
    // sola, o la scheda diventerebbe un elenco della stessa cosa
    const r = trova("Ankh-Morpork, oh Ankh-Morpork");
    t.eq("lo stesso termine due volte è una voce", r.length, 1);
  }

  // =======================================================================
  // LE DUE TRAPPOLE DELLA PAROLA SINGOLA
  // =======================================================================
  //
  // Dentro una frase, una parola sola che è anche una parola comune farebbe
  // scattare la scheda ovunque. Ma se quella parola è TUTTA la selezione,
  // allora l'hai scelta tu, e la risposta la vuoi.
  {
    // (1) LE VOCI SEGNATE `c` hanno un senso comunissimo
    t.eq("«row» dentro una frase non scatta", trova("they had a row about it").length, 0);
    t.c("«row» da sola invece sì", trova("row").length === 1);
  }
  {
    // (2) I NOMI PROPRI vogliono la maiuscola nel testo
    const conMaiuscola = trova("and then Death spoke");
    t.eq("«Death» maiuscolo è il personaggio", conMaiuscola.length, 1);
    t.eq("la morte minuscola non è nessuno", trova("the death of the king").length, 0);
    // ma da sola, anche minuscola, la parola l'hai scelta tu
    t.eq("«death» da sola risponde comunque", trova("death").length, 1);
  }

  // =======================================================================
  // I VERBI SEPARABILI: il complemento sta in mezzo
  // =======================================================================
  //
  // «egg them on» è «egg on» con «them» incastrato. Elencare un alias per
  // ogni pronome e per ogni forma del verbo non scala: la regola sta nel
  // codice una volta sola.
  {
    t.eq("«egg on» attaccato", trova("egg on")[0]?.t, "egg on");
    t.eq("«egg them on» separato", trova("they egg them on")[0]?.t, "egg on");
    // e la regola vale anche sulle forme del verbo, che sono alias:
    // «egged him on» → «egged on»
    t.eq("e su una forma coniugata", trova("she egged him on")[0]?.t, "egg on");
    // UNA PAROLA QUALUNQUE IN MEZZO NON APRE IL VERBO: «egg the on» non è
    // «egg on», e senza l'elenco dei pronomi qualunque terzina passerebbe
    t.eq("una parola qualunque in mezzo non conta", trova("egg the on").length, 0);
    // LA FINESTRA DEVE ARRIVARE A TRE ANCHE SENZA VOCI LUNGHE TRE, ed è il
    // difetto che questo test ha trovato: la regola scatta a `n === 3`, ma
    // il ciclo ci arriva solo se qualche voce è lunga tre parole. Funzionava
    // per caso, perché nello slang c'è «take the mickey» — potata quella,
    // «egg them on» sarebbe sparito in silenzio. Qui l'indice ha un solo
    // termine di DUE parole, e la regola deve funzionare lo stesso.
    const solo = buildIndex([{ t: "egg on", d: "istigare" }]);
    t.eq(
      "e regge su un indice dove nessuna voce è lunga tre",
      scan([["slang", solo]], "they egg them on")[0]?.t,
      "egg on"
    );
  }

  // =======================================================================
  // L'ESPRESSIONE CHE SEGNA I TERMINI SULLA PAGINA
  // =======================================================================
  {
    const re = espressione(gloss.map);
    t.eq("il nome intero si segna intero", "Granny Weatherwax".match(re)?.[0], "Granny Weatherwax");
    // LE CHIAVI LUNGHE PER PRIME, e il caso che lo dimostra è quello in cui
    // una chiave corta è PREFISSO di una lunga: nel glossario vero «Ankh» è
    // un alias del fiume e «Ankh-Morpork» è la città. Ordinate corte prima,
    // l'alternanza si ferma su «Ankh» — il trattino non è una lettera, quindi
    // il confine regge — e sulla pagina si accenderebbe il fiume dove c'è
    // scritta la città. Senza due chiavi in questo rapporto, invertire
    // l'ordine non fa cascare niente: provato, e la mutazione sopravviveva.
    const fiumeECitta = espressione(
      buildIndex([{ t: "Ankh", d: "il fiume" }, { t: "Ankh-Morpork", d: "la città" }]).map
    );
    t.eq("la città vince sul fiume", "in Ankh-Morpork".match(fiumeECitta)?.[0], "Ankh-Morpork");
    // LE CHIAVI CORTE RESTANO FUORI: nel corpo del testo farebbero rumore
    const corte = espressione(buildIndex([{ t: "UU", d: "l'università" }]).map);
    t.eq("una chiave di due lettere non si segna", corte, null);
    // e una parola dentro un'altra non è quella parola
    t.eq("dentro un'altra parola non si segna", "Deathly".match(espressione(gloss.map)), null);
    t.eq("una mappa vuota non dà nessuna espressione", espressione(new Map()), null);
  }

  // =======================================================================
  // QUALE LIBRO HA IL GLOSSARIO
  // =======================================================================
  {
    t.eq("dalla saga scritta a mano", glossaryOf({ saga: "Discworld" }), "discworld");
    t.eq("anche in italiano", glossaryOf({ saga: "Mondo Disco" }), "discworld");
    t.eq("e scritta staccata", glossaryOf({ saga: "Disc World" }), "discworld");
    // I LIBRI ENTRATI PRIMA CHE L'APP RICONOSCESSE LE SAGHE hanno il campo
    // vuoto, e non è un buon motivo per restare senza glossario
    t.eq("dal titolo, con la saga vuota", glossaryOf({ title: "Guards! Guards!", author: "Terry Pratchett" }), "discworld");
    t.eq("un'altra saga non ha il nostro glossario", glossaryOf(ALTRA), null);
    t.eq("né un libro senza niente", glossaryOf({}), null);
    t.eq("né un libro che non c'è", glossaryOf(null), null);
  }

  // =======================================================================
  // LE VOCI TUE
  // =======================================================================
  {
    for (const k of Object.keys(memoria)) delete memoria[k];
    // LA LEVETTA «segna i termini» GUARDA TUTT'E DUE I GLOSSARI: prima
    // guardava solo la saga riconosciuta, e su Malazan restava spenta anche
    // con venti voci scritte a mano
    t.c("senza voci e senza saga nostra, niente glossario", !haGlossario(ALTRA));
    salvaVoci(chiaveGlossario(ALTRA), [{ t: "Warren", d: "un piano di magia" }]);
    t.c("con una voce tua il glossario c'è", haGlossario(ALTRA));
    t.c("e su un libro nostro c'è comunque", haGlossario(DISCO));
  }
  {
    // LE VOCI TUE VINCONO SULLE NOSTRE: sulla tua saga sai più tu di noi
    for (const k of Object.keys(memoria)) delete memoria[k];
    salvaVoci(chiaveGlossario(DISCO), [{ t: "Death", d: "la mia spiegazione" }]);
    const r = await explain("Death spoke", DISCO);
    t.eq("comanda quello che hai scritto tu", r.gloss.d, "la mia spiegazione");
    // IL RIMANDO AL WIKI RESTA SOLO SULLE NOSTRE: una voce tua non deve
    // portare a una pagina che parla d'altro
    t.c("e la voce tua non manda al wiki", !r.gloss.wiki, JSON.stringify(r.gloss.wiki));
  }
  {
    for (const k of Object.keys(memoria)) delete memoria[k];
    const r = await explain("Death spoke", DISCO);
    t.eq("la nostra voce risponde", r.gloss?.t, "Death");
    t.c("e porta il rimando al wiki", /discworld\.fandom/.test(r.gloss.wiki || ""), r.gloss.wiki);
  }
  {
    // una voce tua su un'ALTRA saga non deve mai prendersi il wiki del Disco
    for (const k of Object.keys(memoria)) delete memoria[k];
    salvaVoci(chiaveGlossario(ALTRA), [{ t: "Warren", d: "un piano di magia" }]);
    const r = await explain("Warren", ALTRA);
    t.eq("la voce tua risponde", r.gloss?.d, "un piano di magia");
    t.c("senza rimandarti al wiki sbagliato", !r.gloss.wiki);
    t.eq("e nessuna ricerca sul wiki", r.wikiSearch, null);
  }

  // =======================================================================
  // IL RIPIEGO SUL WIKI, che è un ripiego
  // =======================================================================
  {
    for (const k of Object.keys(memoria)) delete memoria[k];
    // se una risposta ce l'abbiamo, non si manda nessuno altrove
    const conRisposta = await explain("Death spoke", DISCO);
    t.eq("con una risposta in casa, niente wiki", conRisposta.wikiSearch, null);
    // se non ce l'abbiamo e la selezione è corta, la strada si offre
    const senza = await explain("Rincewind", DISCO);
    if (!senza.gloss && !senza.slang) {
      t.c("senza risposta si offre il wiki", !!senza.wikiSearch, JSON.stringify(senza.wikiSearch));
    }
    // ma non su un brano: cercare mezza pagina sul wiki non ha senso
    const lungo = await explain("this is a very long stretch of prose with no terms", DISCO);
    t.eq("su un brano lungo il wiki non si offre", lungo.wikiSearch, null);
    // e mai su un libro che il nostro wiki non copre
    const altrove = await explain("Warren", ALTRA);
    t.eq("né su una saga che non è la nostra", altrove.wikiSearch, null);
  }
  {
    t.c("l'indirizzo del wiki è una ricerca, non una pagina", /Special:Search/.test(wikiUrl("Death")));
    t.c("e il termine ci va dentro codificato", wikiUrl("The Shades").includes("The%20Shades"));
  }

  // =======================================================================
  // SELEZIONI DI CONTORNO
  // =======================================================================
  {
    for (const k of Object.keys(memoria)) delete memoria[k];
    const vuoto = await explain("", DISCO);
    t.eq("una selezione vuota non trova niente", vuoto.found.length, 0);
    t.eq("e non ha una voce", vuoto.gloss, null);
    const spazi = await explain("   ", DISCO);
    t.eq("nemmeno degli spazi", spazi.found.length, 0);
  }
  {
    // I TERMINI DA SEGNARE SULLA PAGINA: senza glossario non c'è espressione,
    // o il reader si metterebbe a cercare il nulla su ogni nodo
    for (const k of Object.keys(memoria)) delete memoria[k];
    t.eq("un libro senza glossario non ha termini da segnare", await termIndex(ALTRA), null);
    const ix = await termIndex(DISCO);
    t.c("un libro nostro sì", !!ix?.re);
    t.c("e l'espressione trova un termine vero", ix.re.test("in Ankh-Morpork"));
  }
  {
    // LE VOCI TUE SI FONDONO CON LE NOSTRE sulla pagina: sono la stessa cosa
    // per chi legge, una parola di questo mondo spiegata
    for (const k of Object.keys(memoria)) delete memoria[k];
    salvaVoci(chiaveGlossario(DISCO), [{ t: "Klatchian", d: "roba mia" }]);
    const ix = await termIndex(DISCO);
    ix.re.lastIndex = 0;
    t.c("il termine tuo si segna", ix.re.test("some Klatchian coffee"));
    ix.re.lastIndex = 0;
    t.c("e il nostro continua a segnarsi", ix.re.test("in Ankh-Morpork"));
  }
  for (const k of Object.keys(memoria)) delete memoria[k];
}

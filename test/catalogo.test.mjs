// IL RETRO CERCATO IN RETE.
//
// La scala delle fonti è: il file (l'editore), il catalogo in rete, e solo
// in ultimo l'Oracolo. Qui si prova il catalogo, e soprattutto LA SCELTA
// DEL VOLUME, che è la parte dove si sbaglia: il catalogo risponde con
// cinque edizioni e adattamenti, e la quarta di copertina di un ALTRO
// libro è peggio di nessuna.
import {
  cercaRetro,
  scegliVolume,
  daGoogle,
  daOpenLibrary,
  varianti,
  autorePerIlCatalogo,
  MAX_VARIANTI,
} from "../src/lib/retroInRete.js";

const DESCRIZIONE =
  "Eric is the Discworld's only demonology hacker, and he wants his three wishes: to be immortal, " +
  "to rule the world, and to have the most beautiful woman fall madly in love with him. Instead he " +
  "gets Rincewind, the Discworld's most incompetent wizard, and a talking luggage with hundreds of legs.";

export default async function (t) {
  // ---- LA SCELTA DEL VOLUME --------------------------------------------
  const voci = [
    { titolo: "The Unofficial Guide to Eric", autori: ["Qualcun Altro"], testo: "Una guida al romanzo." + "x".repeat(60) },
    { titolo: "Eric: The Graphic Novel", autori: ["Terry Pratchett"], testo: "L'adattamento a fumetti." + "x".repeat(60) },
    { titolo: "Eric", autori: ["Terry Pratchett"], testo: DESCRIZIONE },
  ];
  t.eq(
    "si sceglie il titolo giusto, non il primo con una descrizione",
    scegliVolume(voci, { title: "Eric", author: "Terry Pratchett" })?.testo,
    DESCRIZIONE
  );
  // «Eric» deve trovare anche «Eric. Faust», che è la nostra edizione col
  // sottotitolo — e viceversa, un titolo nostro più lungo trova il corto
  t.c(
    "il sottotitolo del catalogo non lo nasconde",
    !!scegliVolume([{ titolo: "Eric Faust", autori: ["Terry Pratchett"], testo: DESCRIZIONE }], {
      title: "Eric",
      author: "Terry Pratchett",
    })
  );
  t.c(
    "e nemmeno il sottotitolo nostro",
    !!scegliVolume([{ titolo: "Eric", autori: ["Terry Pratchett"], testo: DESCRIZIONE }], {
      title: "Eric Faust",
      author: "Terry Pratchett",
    })
  );
  // UN AUTORE DIVERSO È UNA SMENTITA, uno mancante no: come nei doppioni
  t.eq(
    "l'omonimo di un altro autore non passa",
    scegliVolume([{ titolo: "Eric", autori: ["Un Altro Scrittore"], testo: DESCRIZIONE }], {
      title: "Eric",
      author: "Terry Pratchett",
    }),
    null
  );
  t.c(
    "ma senza autore nel catalogo il titolo basta",
    !!scegliVolume([{ titolo: "Eric", autori: [], testo: DESCRIZIONE }], {
      title: "Eric",
      author: "Terry Pratchett",
    })
  );
  // e un titolo che CONTIENE il nostro in mezzo a una frase non è il libro
  t.eq(
    "«Notes on Eric and other essays» non è «Eric»",
    scegliVolume([{ titolo: "Notes on Eric and other essays", autori: [], testo: DESCRIZIONE }], {
      title: "Eric",
    }),
    null
  );
  t.eq("senza titolo cercato non si sceglie niente", scegliVolume(voci, {}), null);
  t.eq("e senza voci nemmeno", scegliVolume([], { title: "Eric" }), null);

  // ---- le forme dei due cataloghi ---------------------------------------
  const google = daGoogle({
    items: [{ volumeInfo: { title: "Eric", authors: ["Terry Pratchett"], description: DESCRIZIONE } }],
  });
  t.eq("Google si riduce alla forma comune", google[0].titolo, "Eric");
  t.eq("con la descrizione", google[0].testo, DESCRIZIONE);
  t.eq("una risposta vuota non esplode", daGoogle({}).length, 0);
  t.eq("nemmeno il niente", daGoogle(undefined).length, 0);

  const ol = daOpenLibrary({ title: "Eric", author_name: ["Terry Pratchett"] }, { description: DESCRIZIONE });
  t.eq("Open Library pure", ol[0].testo, DESCRIZIONE);
  t.eq(
    "anche quando la descrizione è un oggetto",
    daOpenLibrary({ title: "Eric" }, { description: { value: DESCRIZIONE } })[0].testo,
    DESCRIZIONE
  );

  // ---- il giro intero, con una rete finta -------------------------------
  const rispondi = (mappa) => async (url) => {
    for (const [pezzo, corpo] of Object.entries(mappa)) {
      if (url.includes(pezzo)) return { ok: true, json: async () => corpo };
    }
    return { ok: false };
  };

  let r = await cercaRetro(
    { title: "Eric", author: "Terry Pratchett" },
    rispondi({
      "googleapis.com": {
        items: [{ volumeInfo: { title: "Eric", authors: ["Terry Pratchett"], description: `<p>${DESCRIZIONE}</p>` } }],
      },
    })
  );
  t.c("Google risponde e si prende", !!r);
  t.eq("con la fonte dichiarata", r?.fonte, "Google Books");
  t.c("e l'HTML ripulito", !r.testo.includes("<p>"), r.testo.slice(0, 40));

  // Google tace → si passa a Open Library
  r = await cercaRetro(
    { title: "Eric", author: "Terry Pratchett" },
    rispondi({
      "googleapis.com": { items: [] },
      "search.json": { docs: [{ key: "/works/OL1W", title: "Eric", author_name: ["Terry Pratchett"] }] },
      "/works/OL1W.json": { description: DESCRIZIONE },
    })
  );
  t.eq("il ripiego su Open Library funziona", r?.fonte, "Open Library");

  // LA SPAZZATURA NON PASSA: una descrizione-segnaposto non è un retro
  r = await cercaRetro(
    { title: "Eric" },
    rispondi({
      "googleapis.com": { items: [{ volumeInfo: { title: "Eric", description: "No description available" } }] },
    })
  );
  t.eq("un segnaposto non diventa il retro", r, null);

  // UN BUCO DI RETE È NULL, MAI LA STRINGA VUOTA: salvarlo come «guardato,
  // non c'è» impedirebbe di riprovare — la regola della cache del dizionario
  r = await cercaRetro({ title: "Eric" }, async () => {
    throw new Error("niente rete");
  });
  t.eq("senza rete si torna null", r, null);
  t.c("e non stringa vuota", r !== "");
  t.eq("senza titolo non si chiama nessuno", await cercaRetro({}, async () => {
    throw new Error("non dovevi chiamare");
  }), null);

  // ---- IL TITOLO CHE ABBIAMO NON È QUELLO CHE IL CATALOGO CONOSCE -------
  //
  // Misurato sul catalogo vero, sui titoli della forma che gli ePub portano
  // davvero: **4 su 15** prima, 15 su 15 dopo. Il difetto non era il
  // catalogo, era la domanda — e il ripiego dell'import è il NOME DEL FILE,
  // quindi ogni ePub senza metadati arriva qui con la spazzatura attaccata.
  const prima = (t2, a) => varianti(t2, a)[0];
  const ultima = (t2, a) => varianti(t2, a).slice(-1)[0];

  t.eq("la parentesi con la saga e il numero se ne va", ultima("Eric (Discworld, #9)", "Terry Pratchett"), "Eric");
  t.eq("anche senza cancelletto", ultima("Guards! Guards! (Discworld 8)", "Terry Pratchett"), "Guards! Guards!");
  t.eq("la quadra pure", ultima("Small Gods [Discworld Novel 13]", "Terry Pratchett"), "Small Gods");
  t.eq("la numerazione in testa se ne va", ultima("09 - Eric", "Terry Pratchett"), "Eric");
  t.eq("e anche col punto", ultima("09. Eric", "Terry Pratchett"), "Eric");
  t.eq(
    "il nome dell'autore in testa al nome del file se ne va",
    ultima("Terry Pratchett - Discworld 09 - Eric", "Terry Pratchett"),
    "Eric"
  );
  t.eq("il sottotitolo che è solo la saga se ne va", ultima("The Blade Itself: Book One of The First Law", "Joe Abercrombie"), "The Blade Itself");
  // QUI NON BASTA «TIENI L'ULTIMO PEZZO»: l'etichetta sta in CODA, e
  // l'ultimo pezzo sarebbe «Book 1 of the Farseer Trilogy», che non è il
  // titolo di niente. I segmenti-etichetta vanno riconosciuti e tolti, da
  // qualunque parte stiano.
  t.eq(
    "l'etichetta in coda se ne va, e non si tiene lei al posto del titolo",
    ultima("Assassin's Apprentice - Book 1 of the Farseer Trilogy", "Robin Hobb"),
    "Assassin's Apprentice"
  );
  // e il numero scritto a parole è un numero: senza, «Book One of…»
  // sopravvive e si prende il posto del titolo
  t.eq(
    "anche col numero scritto a parole",
    ultima("Assassin's Apprentice - Book One of the Farseer Trilogy", "Robin Hobb"),
    "Assassin's Apprentice"
  );
  t.eq("gli underscore tornano spazi", ultima("Best_Served_Cold", "Joe Abercrombie"), "Best Served Cold");
  t.eq("la versione del rilascio se ne va", ultima("Mistborn - The Final Empire (v5.0)", "Brandon Sanderson"), "The Final Empire");
  t.eq("e l'estensione che è colata dentro al titolo", ultima("Horus Rising.epub", "Dan Abnett"), "Horus Rising");

  // SI PULISCE UNA COSA PER VOLTA, e il titolo com'è arrivato resta il
  // PRIMO tentativo: se una parentesi era parte del titolo vero, la scala
  // l'ha già provata prima di spogliarla.
  t.eq("il titolo grezzo resta il primo tentativo", prima("Eric (Discworld, #9)", "Terry Pratchett"), "Eric (Discworld, #9)");
  // IL CASO PEGGIORE, ED È QUELLO NORMALE: il titolo è il nome del file
  // (è il ripiego dell'import) proprio perché l'ePub non ha metadati —
  // quindi l'autore NON lo sappiamo, e il segmento col suo nome non lo
  // possiamo riconoscere. Il titolo deve arrivare lo stesso, dentro il
  // tetto. Preso nel browser, non leggendo il diff: la scala spendeva
  // tutti e tre i giri senza mai chiedere «Eric».
  t.c(
    "col nome di file e senza autore il titolo si raggiunge lo stesso",
    varianti("Terry Pratchett - Discworld 09 - Eric (v5.0)", "").includes("Eric"),
    JSON.stringify(varianti("Terry Pratchett - Discworld 09 - Eric (v5.0)", ""))
  );
  // ...e una parentesi che NON dichiara di essere un'etichetta non si tocca
  t.eq("«Eric (Faust)» non è un'etichetta e resta", varianti("Eric (Faust)", "Terry Pratchett").join("|"), "Eric (Faust)");
  t.eq("un titolo pulito non genera tentativi in più", varianti("Eric", "Terry Pratchett").length, 1);
  t.c("e non si superano mai i tentativi permessi", varianti("Terry Pratchett - Discworld 09 - Eric: Book One (v5.0)", "Terry Pratchett").length <= MAX_VARIANTI);
  t.eq("senza titolo non c'è niente da chiedere", varianti("", "Tizio").length, 0);
  t.eq("e nemmeno da un titolo tutto etichetta", varianti("Book 3", "").length <= MAX_VARIANTI, true);

  // GLI AUTORI CHE NON SONO AUTORI. Misurato: `author=Unknown` torna ZERO
  // risultati su Open Library, e con l'autore giusto lo stesso libro c'è.
  t.eq("«Unknown» non è un autore", autorePerIlCatalogo("Unknown"), "");
  t.eq("nemmeno «Anonimo»", autorePerIlCatalogo("anonimo"), "");
  t.eq("nemmeno «calibre»", autorePerIlCatalogo("Calibre"), "");
  t.eq("nemmeno il vuoto", autorePerIlCatalogo("   "), "");
  t.eq("nemmeno il niente", autorePerIlCatalogo(undefined), "");
  t.eq("un autore vero resta", autorePerIlCatalogo("Terry Pratchett"), "Terry Pratchett");
  t.eq("anche rovesciato", autorePerIlCatalogo("Abercrombie, Joe"), "Abercrombie, Joe");

  // ---- la scala dei tentativi, con una rete finta -----------------------
  // il catalogo conosce «Eric» e basta: la scala deve arrivarci da sola
  const chiamate = [];
  const soloEric = async (url) => {
    chiamate.push(url);
    if (url.includes("googleapis.com")) return { ok: true, json: async () => ({ items: [] }) };
    if (url.includes("search.json")) {
      const cercato = decodeURIComponent(new URL(url).searchParams.get("title") || "");
      return {
        ok: true,
        json: async () => ({ docs: cercato === "Eric" ? [{ key: "/works/OL1W", title: "Eric", author_name: ["Terry Pratchett"] }] : [] }),
      };
    }
    return { ok: true, json: async () => ({ description: DESCRIZIONE }) };
  };
  r = await cercaRetro({ title: "Terry Pratchett - Discworld 09 - Eric", author: "Terry Pratchett" }, soloEric);
  t.eq("il nome di file spogliato trova il libro", r?.fonte, "Open Library");
  t.c(
    "e il titolo grezzo era stato provato per primo",
    chiamate.some((u) => u.includes("search.json") && decodeURIComponent(u).includes("Discworld 09"))
  );
  // OGNI VARIANTE È UN GIRO DI RETE, e la scheda si apre mentre il lettore
  // guarda: la scala deve avere una fine, non allungarsi coi titoli sporchi
  const cerca = chiamate.filter((u) => u.includes("search.json")).length;
  t.c(`i giri di ricerca restano entro il tetto (${cerca})`, cerca <= MAX_VARIANTI && cerca >= 1, String(cerca));

  // L'AUTORE SPAZZATURA NON SI MANDA: prima `author=Unknown` partiva per
  // davvero, e il catalogo rispondeva zero su libri che ha.
  const visti = [];
  const guarda = async (url) => {
    visti.push(url);
    if (url.includes("googleapis.com")) return { ok: true, json: async () => ({ items: [] }) };
    if (url.includes("search.json")) return { ok: true, json: async () => ({ docs: [{ key: "/works/OL1W", title: "Eric", author_name: [] }] }) };
    return { ok: true, json: async () => ({ description: DESCRIZIONE }) };
  };
  r = await cercaRetro({ title: "Eric", author: "Unknown" }, guarda);
  t.c("un autore ignoto non finisce nella domanda", !visti.some((u) => /author=[^&]/.test(u) || u.includes("inauthor")), visti.join("\n"));
  t.eq("e il libro si trova lo stesso", r?.fonte, "Open Library");

  // UNA RICERCA ANDATA STORTA NON È «QUESTO LIBRO NON ESISTE»: prima un 500
  // di passaggio sulla prima variante si portava via tutte le altre.
  let giri = 0;
  const primoRotto = async (url) => {
    if (url.includes("googleapis.com")) return { ok: false };
    if (url.includes("search.json")) {
      giri++;
      if (giri === 1) return { ok: false, status: 500 };
      return { ok: true, json: async () => ({ docs: [{ key: "/works/OL1W", title: "Eric", author_name: ["Terry Pratchett"] }] }) };
    }
    return { ok: true, json: async () => ({ description: DESCRIZIONE }) };
  };
  r = await cercaRetro({ title: "Eric (Discworld, #9)", author: "Terry Pratchett" }, primoRotto);
  t.eq("un 500 sulla prima variante non ferma la scala", r?.fonte, "Open Library");
}

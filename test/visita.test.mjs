// LA VISITA AI LIBRI.
//
// L'import dice com'è andata il giorno che il libro è entrato, e poi tace.
// I guai di un ePub si scoprono a pagina duecento — una giuntura che
// lascia mezza facciata bianca, l'encoding rotto — e lì il lettore non sa
// nemmeno se è colpa del file o dell'app.
//
// La regola che tiene in piedi tutto: **quello che l'app sa già curare da
// sé non si segnala**. Un elenco che grida a ogni libro fa ignorare anche
// le righe che contano.
import {
  tagliaAMetaFrase, PEZZO_VERO,
  esamina, grave, curabile, quantoMojibake, visita, resocontoVisita, fattiDaEpub,
  GUAI, CURABILI, TESTO_MINIMO, GIUNTURE_TANTE, MOJIBAKE_TANTI, POCHI_CAPITOLI, DOC_VUOTO,
} from "../src/lib/visita.js";

// un libro sano: tanto testo, indice pieno, niente di storto
const SANO = { caratteri: 400000, mojibake: 0, vuoti: 0, giunture: 0, documenti: 30, indice: 30 };

export default async function (t) {
  // ---- IL CASO NORMALE NON DICE NIENTE ---------------------------------
  // è la riga più importante del file: se un libro sano producesse anche
  // un solo guaio, il referto sarebbe rumore su tutta la biblioteca
  t.eq("un libro sano non ha guai", esamina(SANO).length, 0);

  // ---- quello che non si apre affatto ----------------------------------
  t.eq("un file rovinato", esamina({ rotto: true })[0], "nonSiApre");
  // e non si aggiunge altro: elencare «niente testo» su un file che non si
  // apre sarebbe dire due volte la stessa cosa
  t.eq("e basta quello", esamina({ rotto: true }).length, 1);
  t.c("è un guaio serio", grave(["nonSiApre"]));

  // ---- niente testo ------------------------------------------------------
  t.c("un guscio senza testo si segnala", esamina({ ...SANO, caratteri: 10 }).includes("senzaTesto"));
  t.c("appena sotto la soglia", esamina({ ...SANO, caratteri: TESTO_MINIMO - 1 }).includes("senzaTesto"));
  t.c("e appena sopra no", !esamina({ ...SANO, caratteri: TESTO_MINIMO }).includes("senzaTesto"));
  t.c("è serio: dizionario, ricerca e Oracolo non funzionano", grave(["senzaTesto"]));

  // ---- L'ENCODING ROTTO, che nessun reader può curare -------------------
  // UTF-8 letto come Latin-1: «perché» → «perchÃ©». I byte sbagliati sono
  // nel file, quindi è proprio il caso in cui vale la pena dirlo — l'unica
  // strada è un altro file.
  t.eq("«perchÃ©» si riconosce", quantoMojibake("perchÃ©"), 1);
  t.eq("e le virgolette storpiate", quantoMojibake("lâ€™uomo"), 1);
  t.c("si contano tutte", quantoMojibake("perchÃ© cosÃ¬ Ã¨ andata") >= 3);
  // UN TESTO PULITO NON DEVE MAI INSOSPETTIRE: gli accenti veri, le
  // maiuscole accentate, le lingue con la dieresi
  t.eq("l'italiano scritto bene non è mojibake", quantoMojibake("perché così è andata, però"), 0);
  t.eq("nemmeno il tedesco", quantoMojibake("Fräulein, schön, Grüße"), 0);
  t.eq("né il francese", quantoMojibake("à côté, déjà, où"), 0);
  t.eq("né le virgolette tipografiche vere", quantoMojibake("l'uomo «disse» — e poi…"), 0);
  t.eq("niente testo, niente mojibake", quantoMojibake(null), 0);
  t.c("tanti segnano il libro", esamina({ ...SANO, mojibake: MOJIBAKE_TANTI }).includes("mojibake"));
  // pochi non bastano: una citazione può contenerne uno per davvero
  t.c("pochi no", !esamina({ ...SANO, mojibake: MOJIBAKE_TANTI - 1 }).includes("mojibake"));

  // ---- il libro spezzato -------------------------------------------------
  t.c("tante giunture si dicono", esamina({ ...SANO, giunture: GIUNTURE_TANTE }).includes("spezzato"));
  // due o tre documenti corti fuori indice sono il frontespizio e il
  // colophon, non un romanzo fatto a pezzi
  t.c("due o tre no", !esamina({ ...SANO, giunture: 3 }).includes("spezzato"));
  t.c("non è serio, ma si può risolvere", !grave(["spezzato"]));
  t.c("e la cura è reimportare", /reimport/i.test(GUAI.spezzato.cura));

  // ---- capitoli vuoti ----------------------------------------------------
  t.c("anche uno solo si dice", esamina({ ...SANO, vuoti: 1 }).includes("capitoliVuoti"));
  t.c("zero no", !esamina({ ...SANO, vuoti: 0 }).includes("capitoliVuoti"));

  // ---- l'indice ----------------------------------------------------------
  t.c("un libro di trenta capitoli senza indice", esamina({ ...SANO, indice: 0 }).includes("senzaIndice"));
  // MA UN RACCONTO IN TRE DOCUMENTI NON HA UN INDICE PERCHÉ NON GLI SERVE:
  // segnalarlo sarebbe accusare un libro sano
  t.c(
    "un libro cortissimo senza indice non è un guaio",
    !esamina({ ...SANO, indice: 0, documenti: POCHI_CAPITOLI }).includes("senzaIndice")
  );

  // ---- ogni guaio sa dire cosa fare -------------------------------------
  // un elenco di guai senza la cura accanto lascia il lettore dov'era
  for (const [id, g] of Object.entries(GUAI)) {
    t.c(`«${id}» dice cosa non va`, typeof g.dice === "string" && g.dice.length > 8);
    t.c(`«${id}» dice cosa farci`, typeof g.cura === "string" && g.cura.length > 12);
    t.c(`«${id}» sa se è serio`, typeof g.grave === "boolean");
  }
  // e nessun guaio prodotto da `esamina` può essere senza voce, o il
  // pannello mostrerebbe `undefined`
  const tutti = [
    ...esamina({ rotto: true }),
    ...esamina({ caratteri: 0, mojibake: 99, giunture: 99, vuoti: 9, documenti: 99, indice: 0 }),
  ];
  t.c("ogni guaio ha la sua voce", tutti.every((g) => GUAI[g]), tutti.join(","));

  // ---- LA PASSATA --------------------------------------------------------
  const libri = [
    { id: "1", title: "Sano" },
    { id: "2", title: "Rotto" },
    { id: "3", title: "Nel cloud" },
  ];
  const byte = { 1: {}, 2: {}, 3: null };
  const apri = async (b) => {
    if (b.id === "2") throw new Error("archivio illeggibile");
    return SANO;
  };
  let e = await visita(libri, { leggiByte: (id) => byte[id], apri });
  t.eq("i tomi si esaminano", e.esaminati, 2);
  t.eq("il sano non finisce nell'elenco", e.malati.filter((m) => m.title === "Sano").length, 0);
  t.eq("il rotto sì", e.malati[0]?.title, "Rotto");
  t.eq("e con la ragione giusta", e.malati[0]?.guai[0], "nonSiApre");
  // UN TOMO NEL CLOUD NON È UN GUAIO: si conta e si dice, come ovunque
  // nell'app — scaricarne venti per una visita nessuno l'ha chiesto
  t.eq("i lontani si contano a parte", e.lontani.length, 1);
  t.eq("e non fra i malati", e.malati.length, 1);

  // un `getFile` che esplode subito non deve portarsi via il giro: è la
  // stessa trappola già presa nel ripasso delle impronte
  e = await visita([{ id: "x", title: "Boom" }], { leggiByte: () => { throw new Error("boom"); }, apri });
  t.eq("un archivio che esplode non ferma la visita", e.lontani.length, 1);

  // ---- si ferma a metà, e quel che è fatto resta fatto -------------------
  let visti = 0;
  e = await visita(
    [1, 2, 3, 4].map((n) => ({ id: String(n), title: `T${n}` })),
    { leggiByte: () => ({}), apri: async () => ({ ...SANO, vuoti: 1 }), vivo: () => visti < 2, onProgress: () => { visti += 1; } }
  );
  t.c("il giro si ferma", e.fermato);
  t.eq("e tiene quello che aveva guardato", e.esaminati, 2);

  // ---- il resoconto ------------------------------------------------------
  t.c("tutto a posto si dice", /a posto/.test(resocontoVisita({ esaminati: 5, malati: [] })));
  t.c(
    "e i malati si contano",
    /2 tomi da guardare/.test(resocontoVisita({ esaminati: 5, malati: [{ guai: ["spezzato"] }, { guai: ["capitoliVuoti"] }] }))
  );
  // i seri si dicono a parte: «due da guardare» non distingue una pagina
  // bianca da un file che non si apre
  t.c(
    "i seri si dicono a parte",
    /serio/.test(resocontoVisita({ esaminati: 5, malati: [{ guai: ["nonSiApre"] }] }))
  );
  t.c("i lontani si dicono", /dispositivo/.test(resocontoVisita({ esaminati: 1, malati: [], lontani: ["A"] })));
  t.eq("niente da guardare", resocontoVisita({}), "Nessun tomo da guardare");

  // ---- LA VISITA CURA QUELLO CHE SA CURARE ------------------------------
  // Chiesto dal lettore: «mi serve così che TU possa correggere il
  // problema, non io». Ricucibile → si ricuce; nei byte (encoding,
  // scansione) → si dice, e la copia nuova la sceglie lui.
  t.c("il libro spezzato è curabile", curabile(["spezzato"]));
  t.c("le pagine bianche pure", curabile(["capitoliVuoti"]));
  t.c("l'encoding rotto no", !curabile(["mojibake"]));
  t.c("un guaio curabile in mezzo ad altri basta", curabile(["mojibake", "spezzato"]));
  t.c("niente guai, niente cura", !curabile([]));

  const spezzatoF = { ...SANO, giunture: GIUNTURE_TANTE };
  const dueLibri = [
    { id: "s", title: "Spezzato" },
    { id: "m", title: "Rotto dentro" },
  ];
  const apriDue = async (b) => (b.id === "s" ? spezzatoF : { ...SANO, mojibake: 99 });

  // la cura riesce: il libro esce dai malati ed entra nei ricuciti
  e = await visita(dueLibri, {
    leggiByte: () => ({}),
    apri: apriDue,
    cura: async (b) => (b.id === "s" ? { fatti: SANO } : null),
  });
  t.eq("il ricucito entra fra i curati", e.curati[0]?.title, "Spezzato");
  t.c("e non è più fra i malati", !e.malati.some((m) => m.title === "Spezzato"));
  // l'encoding non si cura MAI: la cura non va nemmeno chiamata
  t.c("il mojibake resta fra i malati", e.malati.some((m) => m.title === "Rotto dentro"));

  // NON CI SI FIDA DELLA CURA: si riesamina il libro nuovo, e se è ancora
  // spezzato resta fra i malati — spuntare la casella sulla fiducia è il
  // modo in cui un guasto sparisce dal referto senza sparire dal libro
  e = await visita([dueLibri[0]], {
    leggiByte: () => ({}),
    apri: apriDue,
    cura: async () => ({ fatti: spezzatoF }),
  });
  t.eq("una cura che non cura non conta", e.curati.length, 0);
  t.c("e il libro resta fra i malati", e.malati[0]?.title === "Spezzato");

  // IL LIBRO IN LETTURA NON SI TOCCA: la ricucitura sposterebbe segnalibri
  // e punto di lettura — si spiega, non si agisce
  e = await visita([dueLibri[0]], {
    leggiByte: () => ({}),
    apri: apriDue,
    cura: async () => ({ protetto: true }),
  });
  t.c("il protetto resta malato", e.malati[0]?.title === "Spezzato");
  t.c("ma si dichiara protetto", e.malati[0]?.protetto === true);
  // e una cura che ESPLODE non porta via la visita
  e = await visita([dueLibri[0]], {
    leggiByte: () => ({}),
    apri: apriDue,
    cura: async () => { throw new Error("boom"); },
  });
  t.eq("una cura che esplode lascia il referto onesto", e.malati[0]?.title, "Spezzato");

  t.c("i ricuciti si dicono nel resoconto",
    /ricuciti da me/.test(resocontoVisita({ esaminati: 5, malati: [], curati: [{}, {}] })));

  // ---- I FATTI DI UN ePub, col finto -------------------------------------
  // Il referto vero del lettore accusava quasi ogni libro di «capitoli
  // senza niente dentro»: erano le pagine di SOLA IMMAGINE (copertina,
  // mappe) e il materiale di contorno in testa — falsi malati.
  const finto = (docs, toc) => ({
    load: () => {},
    loaded: { spine: Promise.resolve(), navigation: Promise.resolve({ toc }) },
    spine: {
      items: docs.map((d, i) => ({
        href: `c${i}.xhtml`,
        load: async () => {},
        unload: () => {},
        document: {
          body: { textContent: d.testo },
          querySelector: () => (d.img ? {} : null),
        },
      })),
    },
  });
  const PROSA_LUNGA = "parole vere ".repeat(400);
  const tocDi = (...idx) => idx.map((i) => ({ href: `c${i}.xhtml` }));

  // copertina (immagine), frontespizio corto, capitoli veri, coda corta
  let fatti = await fattiDaEpub(
    finto(
      [
        { testo: "", img: true },
        { testo: "Dello stesso autore" },
        { testo: PROSA_LUNGA },
        { testo: PROSA_LUNGA },
        { testo: PROSA_LUNGA },
        { testo: "Ringraziamenti brevi" },
      ],
      tocDi(2, 3, 4)
    )
  );
  t.eq("la copertina non è un capitolo vuoto", fatti.vuoti, 0);
  t.eq("e il contorno non è una giuntura", fatti.giunture, 0);

  // una pagina di sola immagine IN MEZZO alla storia resta innocente
  fatti = await fattiDaEpub(
    finto(
      [{ testo: PROSA_LUNGA }, { testo: "", img: true }, { testo: PROSA_LUNGA }],
      tocDi(0, 2)
    )
  );
  t.eq("la mappa in mezzo al romanzo non è una pagina bianca", fatti.vuoti, 0);

  // ma un buco VERO in mezzo alla storia si vede ancora: pagina senza
  // testo e senza immagine fra due capitoli dell'indice
  fatti = await fattiDaEpub(
    finto(
      [{ testo: PROSA_LUNGA }, { testo: "" }, { testo: "Mezza scena fuori indice che continua qui" }, { testo: PROSA_LUNGA }],
      tocDi(0, 3)
    )
  );
  t.eq("il vuoto vero in mezzo si conta", fatti.vuoti, 1);
  t.eq("e la giuntura pure", fatti.giunture, 1);

  // ---- IL TAGLIO A META' FRASE: i pezzi LUNGHI di Calibre ---------------
  // La vecchia conta vedeva solo i pezzi corti: un Eric spezzato in
  // capitoli interi passava la visita da sano, e il lettore vedeva le
  // pagine finire a metà frase in mezzo alla scena.
  const lungo = (coda) => `${"He walked across the Library floor. ".repeat(10)}${coda}`;
  const inizia = (testa) => `${testa} ${"and the shelves creaked all around him. ".repeat(10)}`;
  t.c(
    "fine senza punteggiatura + inizio minuscolo = taglio",
    tagliaAMetaFrase(lungo("Some sort of a"), inizia("ghost, maybe."))
  );
  t.c(
    "un capitolo che chiude la frase non è un taglio",
    !tagliaAMetaFrase(lungo("The end of the chapter."), inizia("the next scene began quietly"))
  );
  t.c(
    "una scena che comincia in maiuscolo non è un taglio",
    !tagliaAMetaFrase(lungo("Some sort of a"), inizia("The Bursar sighed."))
  );
  t.c(
    "sotto la misura non si giudica: un frontespizio non è una frase",
    !tagliaAMetaFrase("ERIC", inizia("a novel of Discworld"))
  );
  t.c("e nemmeno col dopo corto", !tagliaAMetaFrase(lungo("Some sort of a"), "ok"));
  t.c("il niente non esplode", !tagliaAMetaFrase(null, undefined));
  t.c("PEZZO_VERO è una soglia vera", PEZZO_VERO >= 100);

  // e la decisione: basta UN moncone per dire «spezzato»
  t.c("un solo taglio a metà frase = spezzato", esamina({ ...SANO, monconi: 1 }).includes("spezzato"));
  t.c("senza monconi il sano resta sano", !esamina({ ...SANO }).includes("spezzato"));
  t.c("ed è curabile: la ricucitura lo sa fare", esamina({ ...SANO, monconi: 2 }).some((g) => ["spezzato"].includes(g)));
}

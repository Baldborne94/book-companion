// LE TRE RICERCHE, e il motore che le tiene tutte.
//
// «Dov'era quella frase?» è una domanda a cui l'app risponde in tre posti —
// dentro un EPUB, dentro un PDF, in tutta la biblioteca — e tutt'e tre
// passano dallo stesso motore: la domanda diventa un'espressione con tutte
// le forme flesse, perché chi cerca «muscle in» vuole trovare «muscling in».
//
// Una ricerca che non trova si vede subito, ed è il motivo per cui questi
// moduli erano scoperti. Ma ci sono due cose che sbagliano in silenzio: la
// MAPPA che riporta il testo normalizzato alle posizioni originali (sbagliata,
// i passaggi escono tagliati storti e nessuno se ne accorge) e l'ORDINE delle
// pagine (sbagliato, qualche pagina non viene cercata affatto e la risposta
// è «non c'è» invece di «eccola»).
import { varianti, queryRegex } from "../src/lib/wordForms.js";
import { normalizeWithMap, findMatches, scanOrder, searchPdf } from "../src/lib/pdfSearch.js";
import { abbastanzaLunga, spezza, cercaOvunque } from "../src/lib/librarySearch.js";
import { searchBook } from "../src/lib/epubSearch.js";

export default async function (t) {
  // =======================================================================
  // IL MOTORE: la domanda diventa tutte le forme della parola
  // =======================================================================
  {
    const v = varianti("muscle");
    t.c("la parola stessa c'è", v.has("muscle"));
    t.c("il plurale", v.has("muscles"));
    t.c("il gerundio, senza la e", v.has("muscling"));
    t.c("e il passato", v.has("muscled"));
  }
  {
    // ALL'INDIETRO, che è la metà che si dimentica: chi cerca «muscling»
    // vuole trovare «muscle», non solo «muscling»
    const v = varianti("muscling");
    t.c("dalla forma flessa si risale alla base", v.has("muscle"));
    t.c("e dalla base si riparte in avanti", v.has("muscles") && v.has("muscled"));
  }
  {
    // le y: «carry» → «carried», e ritorno
    t.c("carry → carried", varianti("carry").has("carried"));
    t.c("carried → carry", varianti("carried").has("carry"));
    // la consonante doppia: «stop» → «stopped»
    t.c("stop → stopped", varianti("stop").has("stopped"));
    t.c("stop → stopping", varianti("stop").has("stopping"));
  }
  {
    // UNA PAROLA CORTA NON SI FLETTE: «in» non deve diventare «ins», o
    // «muscle ins» passerebbe per «muscle in». Rotta apposta, `flessioni`
    // regala «ins, ines, ined, ining, inned, inning».
    t.eq("«in» resta «in» e basta", [...varianti("in")].join(","), "in");
    t.eq("e «a» pure", [...varianti("a")].join(","), "a");
    // NOTA ONESTA: la guardia vera è quella dentro `flessioni`, non il
    // `w.length >= 3` di `queryRegex`. Quel secondo controllo è ridondante —
    // tolto, non casca niente — perché per una parola di due lettere
    // `varianti` torna comunque il solo termine, e l'alternanza di un
    // elemento è identica al termine sfuggito. Sembra portante e non lo è.
  }

  // =======================================================================
  // LA PROMESSA DELLA RICERCA
  // =======================================================================
  {
    const re = queryRegex("muscle in");
    const prende = (s) => (s.match(re) || [])[0] ?? null;
    t.eq("chi cerca «muscle in» trova il passato", prende("he muscled in on them"), "muscled in");
    t.eq("e il gerundio", prende("muscling in"), "muscling in");
    t.eq("e la forma esatta", prende("muscle in"), "muscle in");
    // LA PAROLA CORTA RESTA ESATTA, e qui si vede a cosa serve
    t.eq("«muscle ins» non è «muscle in»", prende("muscle ins"), null);
    // e i confini sono confini veri
    t.eq("dentro un'altra parola non conta", prende("musclein"), null);
  }
  {
    // IL MOTORE CONOSCE SOLO L'INGLESE, e va detto qui perché nel sorgente
    // c'era scritto il contrario: un commento prometteva che chi cerca
    // «pergamena» vede accendersi «pergamene». Non è vero, e un commento che
    // promette quel che il codice non fa è peggio di un commento assente.
    // Misurato: «libro» non trova «libri», «strega» non trova «streghe»,
    // «cane» non trova «cani».
    for (const [domanda, testo] of [
      ["libro", "due libri"],
      ["strega", "tre streghe"],
      ["cane", "i cani"],
    ]) {
      t.eq(`«${domanda}» non trova «${testo}»`, testo.match(queryRegex(domanda)), null);
    }
    // mentre la parola esatta si trova sempre, in qualunque lingua
    t.c("ma la parola esatta si trova comunque", "due libri".match(queryRegex("libri"))?.length === 1);
  }
  {
    const re = queryRegex("Scroll");
    t.c("le maiuscole non contano", "the old scroll".match(re)?.length === 1);
    // fra una parola e l'altra va bene qualunque separatore: nei PDF il testo
    // arriva con a capo e spazi strani in mezzo alle frasi
    const due = queryRegex("old scroll");
    t.c("un a capo in mezzo non spezza la ricerca", "old\n  scroll".match(due)?.length === 1);
    t.c("e nemmeno la punteggiatura", "old, scroll".match(due)?.length === 1);
  }
  {
    t.eq("una domanda vuota non è una domanda", queryRegex(""), null);
    t.eq("né fatta di sola punteggiatura", queryRegex("!!! ---"), null);
    // i caratteri speciali di una regex non devono far esplodere niente
    t.c("una domanda con la punteggiatura non rompe la regex", !!queryRegex("c'era (forse)"));
  }

  // =======================================================================
  // LA MAPPA: dove stava, nel testo VERO, quel che ho trovato
  // =======================================================================
  //
  // Normalizzare accorcia il testo — una lettera accentata sono due caratteri
  // in NFD, e gli spazi si stringono — quindi le posizioni non tornano più.
  // Senza la mappa i passaggi uscirebbero tagliati storti: nessun errore,
  // solo mezze parole in un elenco.
  {
    const { text, map } = normalizeWithMap("perché  no");
    t.eq("l'accento se ne va", text, "perche no");
    t.eq("gli spazi doppi diventano uno", text.indexOf("  "), -1);
    // OGNI POSIZIONE RIPORTA A DOVE STAVA DAVVERO
    t.eq("la «e» accentata sta al posto suo", map[5], 5);
    t.eq("e dopo lo spazio stretto si salta avanti", map[7], 8);
    t.eq("la mappa arriva fino in fondo", map[map.length - 1], "perché  no".length);
    t.eq("una mappa per ogni carattere normalizzato", map.length, text.length + 1);
  }
  {
    // IL PASSAGGIO SI TAGLIA SUL TESTO ORIGINALE, accenti compresi: è tutto
    // il punto della mappa. Se si tagliasse sul normalizzato, il lettore
    // leggerebbe «perche» in un libro che scrive «perché».
    const r = findMatches("Il perché è perché.", "perche", 3, 5);
    t.eq("due occorrenze", r.length, 2);
    t.eq("e il pezzo trovato è quello vero", r[0].hit, "perché");
    t.c("col suo contesto attorno", r[0].before.includes("Il"));
  }
  {
    // E QUI SI VEDE DAVVERO A COSA SERVE LA MAPPA: finché il testo
    // normalizzato è lungo quanto l'originale le due posizioni coincidono, e
    // tagliare sull'una o sull'altra dà lo stesso risultato — provato, e la
    // mutazione sopravviveva. Il caso che le fa divergere è lo SPAZIO che si
    // stringe: nei PDF il testo arriva pieno di spazi multipli, e ogni
    // spazio in meno sposta tutto quel che segue.
    const conSpazi = "Il    vecchio    scroll qui";
    const r = findMatches(conSpazi, "scroll", 3, 4);
    t.eq("il pezzo trovato è proprio quello", r[0].hit, "scroll");
    t.c("e non un ritaglio spostato", !r[0].hit.includes(" "), JSON.stringify(r[0]));
  }
  {
    // il tetto dei risultati per pagina, e una domanda che non c'è
    t.eq("il tetto si rispetta", findMatches("ana ana ana ana", "ana", 2).length, 2);
    t.eq("quel che non c'è non si trova", findMatches("niente qui", "pergamena").length, 0);
    t.eq("su un testo vuoto niente", findMatches("", "ana").length, 0);
    t.eq("e con una domanda vuota nemmeno", findMatches("ana ana", "").length, 0);
  }

  // =======================================================================
  // L'ORDINE DELLE PAGINE: si parte da dove stai leggendo
  // =======================================================================
  //
  // Quello che si cerca mentre si legge sta quasi sempre poco più avanti. Ma
  // il giro dev'essere COMPLETO: una pagina saltata non dà un errore, dà un
  // «non c'è» che è una bugia.
  {
    t.eq("si parte dalla pagina aperta e si torna in cima", scanOrder(10, 4).join(","), "4,5,6,7,8,9,10,1,2,3");
    t.eq("dalla prima è l'ordine naturale", scanOrder(5, 1).join(","), "1,2,3,4,5");
    // OGNI PAGINA UNA VOLTA SOLA, e tutte
    const giro = scanOrder(40, 17);
    t.eq("tutte le pagine", giro.length, 40);
    t.eq("nessun doppione", new Set(giro).size, 40);
    t.eq("e nessuna fuori scala", giro.filter((n) => n < 1 || n > 40).length, 0);
    // una pagina di partenza assurda non deve rompere il giro
    t.eq("oltre l'ultima si parte dall'ultima", scanOrder(5, 99).join(","), "5,1,2,3,4");
    t.eq("sotto la prima si parte dalla prima", scanOrder(5, 0).join(","), "1,2,3,4,5");
    t.eq("e senza pagina di partenza pure", scanOrder(3).join(","), "1,2,3");
  }

  // =======================================================================
  // LA RICERCA NEL PDF: si può fermare, e non muore su una pagina rotta
  // =======================================================================
  const pdfFinto = (pagine) => ({
    numPages: pagine.length,
    getPage: async (n) => {
      const testo = pagine[n - 1];
      if (testo === null) throw new Error("pagina illeggibile");
      return { getTextContent: async () => ({ items: [{ str: testo }] }) };
    },
  });
  {
    const pdf = pdfFinto(["niente", "c'è una pergamena qui", "niente", "un'altra pergamena"]);
    const r = await searchPdf(pdf, "pergamena", { from: 1 });
    t.eq("trova tutte le occorrenze", r.results.length, 2);
    t.eq("con la pagina giusta", r.results.map((x) => x.page).join(","), "2,4");
    t.c("e dichiara di aver finito", r.done && !r.full);
    t.eq("avendo sfogliato tutto", r.scanned, 4);
  }
  {
    // UNA PAGINA CHE NON SI LASCIA LEGGERE non si porta via le altre: in un
    // PDF scansionato capita, e perdere la ricerca intera per una pagina
    // sarebbe il danno peggiore
    const pdf = pdfFinto(["niente", null, "una pergamena"]);
    const r = await searchPdf(pdf, "pergamena", { from: 1 });
    t.eq("la pagina rotta si salta e le altre si cercano", r.results.length, 1);
    t.eq("ed è quella dopo", r.results[0].page, 3);
  }
  {
    // IL FILO `vivo` È L'UNICO MODO DI FERMARLA A METÀ, e quel che è stato
    // trovato resta: chi chiude il pannello non deve perdere i risultati
    const pdf = pdfFinto(["una pergamena", "pergamena", "pergamena", "pergamena"]);
    let giri = 0;
    const r = await searchPdf(pdf, "pergamena", { from: 1, alive: () => ++giri <= 2 });
    t.c("fermata a metà, non ha finito", !r.done);
    t.c("ma quel che aveva trovato resta", r.results.length > 0, String(r.results.length));
    t.c("e non ha sfogliato tutto", r.scanned < 4, String(r.scanned));
  }
  {
    // il tetto: su un libro dove la parola è ovunque non si torna con mille
    // righe, e si DICHIARA che l'elenco è tagliato
    const pdf = pdfFinto(Array(20).fill("pergamena pergamena"));
    const r = await searchPdf(pdf, "pergamena", { from: 1, limit: 5 });
    t.eq("il tetto si rispetta", r.results.length, 5);
    t.c("e l'elenco tagliato si dichiara", r.full);
  }
  {
    // il giro parte davvero dalla pagina aperta
    const pdf = pdfFinto(["pergamena", "niente", "niente", "pergamena"]);
    const r = await searchPdf(pdf, "pergamena", { from: 4 });
    t.eq("il primo risultato è quello più vicino a dove sei", r.results[0].page, 4);
  }

  // =======================================================================
  // LA RICERCA NELL'EPUB: si cammina sui nodi di testo
  // =======================================================================
  //
  // Non si usa il `find()` di epub.js, che cerca alla lettera. Qui il
  // capitolo si finge: quel che conta è che si guardino i NODI DI TESTO, che
  // il CFI esca dal range e che il tetto valga su tutto il libro, non per
  // capitolo.
  const capitolo = (testi, nome) => {
    const nodi = testi.map((textContent) => ({ textContent }));
    return {
      document: {
        body: {},
        createTreeWalker: () => {
          let i = 0;
          return { nextNode: () => (i < nodi.length ? nodi[i++] : null) };
        },
        createRange: () => ({ setStart() {}, setEnd() {} }),
      },
      cfiFromRange: () => `epubcfi(${nome})`,
    };
  };
  const libroFinto = (capitoli) => ({
    load: () => {},
    spine: {
      spineItems: capitoli.map((c) => ({ ...c, load: async () => {}, unload() {} })),
    },
  });
  {
    const b = libroFinto([capitolo(["c'era una pergamena antica"], "c1")]);
    const r = await searchBook(b, "pergamena");
    t.eq("trova nel capitolo", r.length, 1);
    t.c("col CFI del punto", r[0].cfi === "epubcfi(c1)");
    t.c("e il passaggio attorno", r[0].excerpt.includes("pergamena"), r[0].excerpt);
  }
  {
    // le forme flesse valgono anche qui: è lo stesso motore
    const b = libroFinto([capitolo(["they muscled in on us"], "c1")]);
    t.eq("«muscle in» trova «muscled in»", (await searchBook(b, "muscle in")).length, 1);
  }
  {
    // IL TETTO È DEL LIBRO, NON DEL CAPITOLO: se valesse per capitolo, su un
    // romanzo di quaranta capitoli tornerebbero quaranta volte tanto
    const b = libroFinto([
      capitolo(["pergamena", "pergamena"], "c1"),
      capitolo(["pergamena", "pergamena"], "c2"),
    ]);
    t.eq("il tetto vale su tutto il libro", (await searchBook(b, "pergamena", 3)).length, 3);
  }
  {
    // E RAGGIUNTO IL TETTO I CAPITOLI DOPO NON SI APRONO NEMMENO. È una cosa
    // diversa dal tetto: quello lo fa rispettare il ciclo dentro il capitolo
    // — provato, e togliendo il `break` esterno i risultati restano quelli
    // giusti. Il `break` serve a non caricare e scaricare trenta capitoli
    // che nessuno guarderà, che su un romanzo lungo è tutto il tempo
    // dell'attesa.
    let aperti = 0;
    const conteggio = (testi, nome) => ({
      ...capitolo(testi, nome),
      load: async () => { aperti++; },
      unload() {},
    });
    const b = {
      load: () => {},
      spine: { spineItems: [conteggio(["pergamena", "pergamena"], "c1"), conteggio(["pergamena"], "c2")] },
    };
    await searchBook(b, "pergamena", 2);
    t.eq("pieno il tetto, il capitolo dopo resta chiuso", aperti, 1);
  }
  {
    // un capitolo senza corpo, o vuoto, non deve fermare gli altri
    const rotto = { document: null, cfiFromRange: () => "x" };
    const b = libroFinto([rotto, capitolo(["una pergamena"], "c2")]);
    const r = await searchBook(b, "pergamena");
    t.eq("un capitolo illeggibile si salta", r.length, 1);
    t.eq("e si trova nel successivo", r[0].cfi, "epubcfi(c2)");
    // i nodi di soli spazi non sono testo
    const soloSpazi = libroFinto([capitolo(["   ", "\n"], "c1")]);
    t.eq("i nodi vuoti non danno risultati", (await searchBook(soloSpazi, "pergamena")).length, 0);
  }
  {
    t.eq("una domanda vuota non cerca niente", (await searchBook(libroFinto([]), "")).length, 0);
  }

  // =======================================================================
  // LA RICERCA IN TUTTA LA BIBLIOTECA
  // =======================================================================
  {
    // MENO DI TRE LETTERE NON È UNA DOMANDA: è un setaccio che raccoglie
    // tutto, e su venti libri vuol dire dieci minuti per niente
    t.c("due lettere non bastano", !abbastanzaLunga("il"));
    t.c("tre sì", abbastanzaLunga("chi"));
    t.c("gli spazi non contano come lettere", !abbastanzaLunga("  a  "));
    t.c("e niente non è una domanda", !abbastanzaLunga(""));
    t.c("né l'assenza di domanda", !abbastanzaLunga(null));
  }
  {
    // IL PEZZO TROVATO SI ACCENDE: la riga arriva intera e va spezzata in
    // tre. Se `spezza` non ritrova il pezzo, finisce tutto in `prima` e
    // sullo schermo non si accende niente — nessun errore, solo una riga
    // piatta dove l'occhio non trova più la parola che aveva cercato.
    const re = queryRegex("pergamena");
    const s = spezza("teneva una pergamena in mano", re);
    t.eq("quel che viene prima", s.prima, "teneva una ");
    t.eq("il pezzo acceso", s.dentro, "pergamena");
    t.eq("e quel che viene dopo", s.dopo, " in mano");
    // E SI ACCENDE ANCHE LA FORMA FLESSA: è la stessa espressione che l'ha
    // trovata nel libro, quindi chi ha chiesto «scroll» vede accendersi
    // «scrolls»
    const flessa = spezza("he held two scrolls", queryRegex("scroll"));
    t.eq("anche al plurale", flessa.dentro, "scrolls");
    // senza espressione, o senza riscontro, la riga resta intera invece di
    // sparire: meglio una riga piatta che una riga vuota
    t.eq("senza espressione la riga resta", spezza("una riga", null).prima, "una riga");
    t.eq("e senza riscontro pure", spezza("una riga", queryRegex("altro")).prima, "una riga");
  }
  {
    // I TOMI RIMASTI NEL CLOUD SI CONTANO E SI DICONO, non si scaricano: un
    // libro che vive solo lassù si tirerebbe giù intero per una domanda di
    // tre parole. Taciuto, il lettore leggerebbe «non c'è» credendo che si
    // sia cercato ovunque.
    const libri = [
      { id: "a", title: "Qui", fileType: "epub" },
      { id: "b", title: "Lassù", fileType: "epub" },
      { id: "c", title: "Anche lassù", fileType: "epub" },
    ];
    const r = await cercaOvunque(libri, "pergamena", {
      leggiByte: async (id) => (id === "a" ? null : null),
    });
    t.eq("i tomi senza byte si contano", r.lontani, 3);
    t.eq("e nessuno è stato esaminato", r.esaminati, 0);
  }
  {
    // UN `leggiByte` CHE ESPLODE IN MODO SINCRONO non deve portarsi via il
    // giro intero con tutti i libri già esaminati.
    //
    // NOTA ONESTA: qui basta il `try/catch`, perché la chiamata ci sta
    // DENTRO. `ripassaImpronte` fa lo stesso mestiere con un giro
    // `Promise.resolve().then(…)`, e lì serve davvero — là la chiamata sta
    // fuori da ogni try. Provato a copiarlo anche qui: nessuna differenza,
    // e l'ho tolto invece di lasciarlo a sembrare necessario.
    const libri = [{ id: "a", title: "Uno" }, { id: "b", title: "Due" }];
    let arrivato = false;
    const r = await cercaOvunque(libri, "pergamena", {
      leggiByte: (id) => {
        if (id === "a") throw new Error("archivio chiuso");
        arrivato = true;
        return null;
      },
    });
    t.c("il giro arriva in fondo lo stesso", arrivato);
    t.eq("e li conta tutt'e due come lontani", r.lontani, 2);
  }
  {
    // il filo `vivo` ferma anche questo giro, e i libri già guardati restano
    const libri = [{ id: "a" }, { id: "b" }, { id: "c" }];
    let visti = 0;
    await cercaOvunque(libri, "pergamena", {
      leggiByte: async () => null,
      onLibro: () => visti++,
      vivo: () => visti < 2,
    });
    t.c("fermata a metà, non li guarda tutti", visti < 3, String(visti));
  }
  {
    // l'avanzamento dice a che punto è e su cosa: su venti libri una
    // rotellina muta si legge come un blocco
    const libri = [{ id: "a", title: "Primo" }, { id: "b", title: "Secondo" }];
    const passi = [];
    await cercaOvunque(libri, "pergamena", {
      leggiByte: async () => null,
      onLibro: (p) => passi.push(`${p.i + 1}/${p.totale} ${p.titolo}`),
    });
    t.eq("l'avanzamento porta il titolo", passi.join(" · "), "1/2 Primo · 2/2 Secondo");
  }
}

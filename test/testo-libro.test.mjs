// IL TESTO DI UN LIBRO SI ESTRAE UNA VOLTA E SI TIENE (`testoLibro.js`), e
// le tre domande — la ricerca in biblioteca, «Chi e' costui?», «Dove eravamo
// rimasti» — leggono da li'. Le regole di ognuna sono quelle di quando il
// libro si apriva, e qui si provano sul testo tenuto: il punto della parola,
// il taglio sul segno, il contorno che chiude, la memoria legata al file.
import {
  spezzaPunto,
  puntoNelNodo,
  testoDelLibro,
  dimenticaTesti,
  scrittureFinite,
  comprimi,
  decomprimi,
  testoCapitolo,
  testoBlocco,
  puntoBlocco,
  chiaveTesto,
  VERSIONE_TESTO,
} from "../src/lib/testoLibro.js";
import { cercaNelTesto, cercaOvunque } from "../src/lib/librarySearch.js";
import { tramaDaTesto } from "../src/lib/trama.js";
import { menzioniNelTesto, nuoveNelTesto, aliasNelTesto } from "../src/lib/chiSono.js";
import { regexNome, nuovoRegistro } from "../src/lib/nomi.js";

// un confronto di CFI che basta ai finti: i numeri in ordine
const numeri = (c) => String(c).match(/\d+/g).map(Number);
const cmp = (a, b) => {
  const x = numeri(a);
  const y = numeri(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i] ?? -1;
    const q = y[i] ?? -1;
    if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
};

const nodo = (t, cfi, b = 0) => ({ b, c: cfi ? spezzaPunto(cfi) : null, t });
const lungo = (x) => `${x} ${"parole di riempimento ".repeat(4)}`.trim();

export default async function (t) {
  // ---- il punto dentro un nodo ----
  t.eq("il CFI si spezza nello scostamento", JSON.stringify(spezzaPunto("epubcfi(/6/4!/4/2/1:0)")), JSON.stringify(["epubcfi(/6/4!/4/2/1", 0, ""]));
  t.eq(
    "la parola al carattere 12 e' lo stesso CFI spostato di 12",
    puntoNelNodo(nodo("x", "epubcfi(/6/4!/4/2/1:3)"), 12),
    "epubcfi(/6/4!/4/2/1:15)"
  );
  t.eq(
    "un'asserzione dopo lo scostamento resta al suo posto",
    puntoNelNodo(nodo("x", "epubcfi(/6/4!/4/2/1:0[;s=a])"), 5),
    "epubcfi(/6/4!/4/2/1:5[;s=a])"
  );
  t.eq("un CFI senza scostamento vale per il nodo", puntoNelNodo(nodo("x", "epubcfi(/6/4!/4/2)"), 5), "epubcfi(/6/4!/4/2)");
  t.eq("un nodo senza punto non ne inventa uno", puntoNelNodo(nodo("x", null), 5), null);

  // ---- la ricerca sul testo tenuto ----
  const libroE = {
    tipo: "epub",
    capitoli: [
      {
        base: "/6/2",
        contorno: false,
        blocchi: [{ t: "", c: null }],
        prosa: [],
        nodi: [
          nodo("   ", null),
          nodo("Il mago prese la pergamena dal tavolo.", "epubcfi(/6/2!/4/2/1:0)"),
          nodo("Due pergamene, anzi tre pergamene.", "epubcfi(/6/2!/4/4/1:0)"),
        ],
      },
    ],
  };
  {
    const r = cercaNelTesto(libroE, "pergamena", 6);
    t.eq("trova le forme flesse in tutti i nodi", r.length, 3);
    t.eq("il punto della prima parola", r[0].punto, "epubcfi(/6/2!/4/2/1:17)");
    t.eq("…e della terza, nel secondo nodo", r[2].punto, "epubcfi(/6/2!/4/4/1:24)");
    t.eq("la parola si accende nel passaggio", r[0].dentro, "pergamena");
    t.eq("il tetto per libro si rispetta", cercaNelTesto(libroE, "pergamena", 2).length, 2);
    t.eq("una domanda vuota non trova niente", cercaNelTesto(libroE, "", 6).length, 0);
  }
  {
    const lungoTesto = `${"a ".repeat(40)}pergamena${" b".repeat(40)}`;
    const r = cercaNelTesto({ tipo: "epub", capitoli: [{ base: "/6/2", nodi: [nodo(lungoTesto, "epubcfi(/6/2!/4/2/1:0)")] }] }, "pergamena");
    t.c("il passaggio si taglia coi puntini da tutt'e due i lati", r[0].prima.startsWith("…") && r[0].dopo.endsWith("…"));
  }
  {
    const pdf = { tipo: "pdf", pagine: ["niente qui", "una pergamena e una pergamena e una pergamena e una pergamena"] };
    const r = cercaNelTesto(pdf, "pergamena", 6);
    t.eq("nel PDF il punto e' la pagina, contata da uno", r[0].punto, "2");
    t.eq("…e si dice", r[0].dove, "pag. 2");
    t.eq("tre per pagina, come prima", r.length, 3);
  }

  // ---- cercaOvunque sul testo ----
  {
    const libri = [
      { id: "a", title: "A", fileType: "epub" },
      { id: "b", title: "B", fileType: "epub" },
      { id: "c", title: "C", fileType: "cbz" },
      { id: "d", title: "D", fileType: "epub" },
    ];
    const trovati = [];
    const r = await cercaOvunque(libri, "pergamena", {
      leggiTesto: async (l) => {
        if (l.id === "a") return libroE;
        if (l.id === "b") return null;
        throw new Error("rotto");
      },
      onTrovato: (x) => trovati.push(x.libro.id),
    });
    t.eq("il libro senza testo e' lontano", r.lontani, 1);
    t.eq("…quello col testo esaminato", r.esaminati, 1);
    t.eq("…il fumetto saltato, e quello rotto non conta", trovati.join(), "a");
  }

  // ---- la memoria legata al file ----
  {
    dimenticaTesti();
    const disco = new Map();
    let estrazioni = 0;
    const opzioni = (byte) => ({
      leggiByte: async () => byte,
      leggi: async (k) => disco.get(k),
      scrivi: async (k, v) => disco.set(k, v),
      estrai: async () => {
        estrazioni++;
        return libroE;
      },
    });
    const libro = { id: "x", fileType: "epub" };
    const file = { size: 1000 };
    const primo = await testoDelLibro(libro, opzioni(file));
    await scrittureFinite();
    t.eq("la prima volta si estrae", estrazioni, 1);
    t.eq("…e si tiene col segno della misura", disco.get(chiaveTesto("x")).di, 1000);
    t.eq("…e della versione", disco.get(chiaveTesto("x")).v, VERSIONE_TESTO);
    t.eq("il testo e' quello estratto", primo.capitoli.length, 1);
    dimenticaTesti();
    const secondo = await testoDelLibro(libro, opzioni(file));
    t.eq("la seconda volta si legge dal disco, senza estrarre", estrazioni, 1);
    t.eq("…e il testo e' lo stesso", JSON.stringify(secondo), JSON.stringify(libroE));
    await testoDelLibro(libro, opzioni(file));
    t.eq("…anche la terza, dalla memoria", estrazioni, 1);
    dimenticaTesti();
    await testoDelLibro(libro, opzioni({ size: 2000 }));
    await scrittureFinite();
    t.eq("un file cambiato si rifa'", estrazioni, 2);
    t.eq("…e il segno si aggiorna", disco.get(chiaveTesto("x")).di, 2000);
    await testoDelLibro(libro, opzioni({ size: 3000 }));
    await scrittureFinite();
    t.eq("anche la memoria viva guarda la misura", estrazioni, 3);
    dimenticaTesti();
    const lontano = await testoDelLibro(libro, opzioni(null));
    t.eq("senza byte qui il testo tenuto vale lo stesso", lontano?.capitoli?.length, 1);
    t.eq("…senza estrarre niente", estrazioni, 3);
    dimenticaTesti();
    disco.set(chiaveTesto("x"), { ...disco.get(chiaveTesto("x")), v: VERSIONE_TESTO + 1 });
    t.eq("una versione diversa senza byte non vale", await testoDelLibro(libro, opzioni(null)), null);
    await testoDelLibro(libro, opzioni({ size: 3000 }));
    t.eq("…e coi byte si rifa'", estrazioni, 4);
    dimenticaTesti();
    t.eq("niente byte e niente testo: il libro e' lontano", await testoDelLibro({ id: "y" }, opzioni(null)), null);
  }
  {
    dimenticaTesti();
    let estrazioni = 0;
    let lascia;
    const aspetta = new Promise((r) => (lascia = r));
    const opzioni = {
      leggiByte: async () => ({ size: 5 }),
      leggi: async () => null,
      scrivi: async () => {
        throw new Error("pieno");
      },
      estrai: async () => {
        estrazioni++;
        await aspetta;
        return libroE;
      },
    };
    const due = [testoDelLibro({ id: "z" }, opzioni), testoDelLibro({ id: "z" }, opzioni)];
    lascia();
    const [p, q] = await Promise.all(due);
    t.eq("due domande insieme fanno un'estrazione sola", estrazioni, 1);
    t.c("…e tutt'e due hanno il testo, anche se il disco e' pieno", p === q && p.capitoli.length === 1);
    dimenticaTesti();
  }
  {
    const dati = { tipo: "pdf", pagine: ["àèìòù — «virgolette»", "due"] };
    t.eq("compresso e scompattato torna identico", JSON.stringify(await decomprimi(await comprimi(dati))), JSON.stringify(dati));
    t.c("…ed e' compresso davvero", (await comprimi({ tipo: "pdf", pagine: ["a".repeat(10000)] })).size < 1000);
  }

  // ---- «Dove eravamo rimasti» sul testo ----
  // un capitolo coi suoi paragrafi: un blocco e un nodo per paragrafo, e il
  // blocco rilegge il testo dal nodo come fa l'estrazione
  const cap = (base, blocchiPar, { contorno = false } = {}) => ({
    base,
    contorno,
    blocchi: blocchiPar.map(([testo, c], i) => ({ t: c ? null : testo, n: c ? i : null })),
    prosa: blocchiPar.map((_, i) => i),
    nodi: blocchiPar.map(([testo, c], i) => nodo(testo, c, i)),
  });
  {
    const libro = {
      tipo: "epub",
      capitoli: [
        cap("/6/2", [[lungo("indice"), "epubcfi(/6/2!/4/2)"]], { contorno: true }),
        cap("/6/4", [[lungo("uno"), "epubcfi(/6/4!/4/2)"], [lungo("due"), "epubcfi(/6/4!/4/4)"]]),
        cap("/6/6", [[lungo("tre"), "epubcfi(/6/6!/4/2)"], [lungo("quattro"), "epubcfi(/6/6!/4/8)"], [lungo("cinque"), null]]),
        cap("/6/8", [[lungo("sei"), "epubcfi(/6/8!/4/2)"]]),
      ],
    };
    const tutto = tramaDaTesto(libro, null, cmp);
    t.eq("il contorno in testa si salta, e senza segno si prende tutto", tutto.coda.map((x) => x.split(" ")[0]).join(), "uno,due,tre,quattro,cinque,sei");
    const fin = tramaDaTesto(libro, "epubcfi(/6/6!/4/4)", cmp);
    t.eq("nel capitolo del segno si taglia al primo paragrafo oltre", fin.coda.map((x) => x.split(" ")[0]).join(), "uno,due,tre");
    const bucoCfi = tramaDaTesto(libro, "epubcfi(/6/6!/4/10)", cmp);
    t.eq("un paragrafo che non sa dove sta si considera oltre", bucoCfi.coda.map((x) => x.split(" ")[0]).join(), "uno,due,tre,quattro");
    const primi = tramaDaTesto(libro, "epubcfi(/6/4!/4/99)", cmp);
    t.eq("i capitoli oltre il segno non si leggono", primi.coda.map((x) => x.split(" ")[0]).join(), "uno,due");
  }
  {
    const tanti = Array.from({ length: 40 }, (_, i) => [lungo(`p${i}`), `epubcfi(/6/4!/4/${i * 2 + 2})`]);
    const libro = {
      tipo: "epub",
      capitoli: [cap("/6/4", tanti), cap("/6/6", [[lungo("ringraziamenti"), "epubcfi(/6/6!/4/2)"]], { contorno: true }), cap("/6/8", [[lungo("estratto"), "epubcfi(/6/8!/4/2)"]])],
    };
    const r = tramaDaTesto(libro, null, cmp);
    t.c("il contorno in fondo chiude la storia", !r.coda.some((x) => x.startsWith("estratto")));
  }
  {
    // una spaziatura vuota PRIMA del segno non chiude la raccolta: non ha un
    // posto perche' non ha testo, e senza la guardia si leggerebbe «oltre»
    const c = cap("/6/4", [[lungo("uno"), "epubcfi(/6/4!/4/2)"], ["", "epubcfi(/6/4!/4/3)"], [lungo("due"), "epubcfi(/6/4!/4/4)"], [lungo("tre"), "epubcfi(/6/4!/4/8)"]]);
    c.blocchi[1] = { t: "   ", n: null };
    const r = tramaDaTesto({ tipo: "epub", capitoli: [c] }, "epubcfi(/6/4!/4/6)", cmp);
    t.eq("il paragrafo vuoto prima del segno si salta", r.coda.map((x) => x.split(" ")[0]).join(), "uno,due");
  }
  {
    const c = { blocchi: [{ t: null, n: 0 }, { t: "citazione intera", n: 0 }, { t: "vuoto", n: null }], nodi: [nodo("il nodo", "epubcfi(/6/4!/4/2/1:0)")] };
    t.eq("un blocco senza testo proprio lo rilegge dal nodo", testoBlocco(c, 0), "il nodo");
    t.eq("uno col testo proprio tiene il suo", testoBlocco(c, 1), "citazione intera");
    t.eq("il punto di un blocco e' l'inizio del suo primo nodo", puntoBlocco(c, 1), "epubcfi(/6/4!/4/2/1:0)");
    t.eq("un blocco senza nodi non ha un punto", puntoBlocco(c, 2), null);
  }
  {
    const r = tramaDaTesto({ tipo: "pdf", pagine: [lungo("uno"), lungo("due"), lungo("tre")] }, "2", null);
    t.eq("nel PDF si legge fino alla pagina del segno", r.coda.map((x) => x.split(" ")[0]).join(), "uno,due");
  }

  // ---- «Chi e' costui?» sul testo ----
  {
    const libro = { id: "l" };
    const testo = {
      tipo: "epub",
      capitoli: [
        {
          base: "/6/2",
          blocchi: [{ t: "Logen guardo' il fiume. Poi Logen si sedette.", c: null }, { t: "Nessuno qui.", c: null }, { t: null, n: 2 }],
          nodi: [
            nodo("Logen guardo' il fiume. Poi Logen si sedette.", "epubcfi(/6/2!/4/2/1:0)", 0),
            nodo("Nessuno qui.", "epubcfi(/6/2!/4/4/1:0)", 1),
            nodo("Logen ancora.", "epubcfi(/6/2!/4/10/1:0)", 2),
          ],
        },
        { base: "/6/4", blocchi: [{ t: "E Logen parti'.", c: null }], nodi: [nodo("E Logen parti'.", "epubcfi(/6/4!/4/2/1:0)", 0)] },
      ],
    };
    const re = regexNome(["Logen"]);
    const tutte = menzioniNelTesto(testo, { libro, re, nomi: ["Logen"], fino: null, cmp });
    t.eq("una menzione per nodo", tutte.length, 3);
    t.eq("il punto e' la parola", tutte[0].cfi, "epubcfi(/6/2!/4/2/1:0)");
    t.eq("il passaggio e' il paragrafo intero", tutte[0].testo, "Logen guardo' il fiume. Poi Logen si sedette.");
    t.eq("la misura del volume conta il testo scorso", tutte[0].esteso, 45 + 12 + 13 + 15);
    const fin = menzioniNelTesto(testo, { libro, re, nomi: ["Logen"], fino: "epubcfi(/6/2!/4/9)", cmp });
    t.eq("oltre il segno non si raccoglie, nemmeno nel capitolo del segno", fin.map((x) => x.testo).join(" | "), "Logen guardo' il fiume. Poi Logen si sedette.");
    t.eq("…e i capitoli dopo non si scorrono", fin[0].esteso, 45 + 12 + 13);
    t.eq("il nodo senza blocco usa il suo testo", menzioniNelTesto({ tipo: "epub", capitoli: [{ base: "/6/2", blocchi: [], nodi: [nodo("Logen.", "epubcfi(/6/2!/4/2/1:0)", null)] }] }, { libro, re, nomi: ["Logen"], fino: null, cmp })[0].testo, "Logen.");

    t.c("nuove menzioni fra allora e adesso", nuoveNelTesto(testo, { re, nomi: ["Logen"], da: "epubcfi(/6/2!/4/3)", a: "epubcfi(/6/4!/4/9)", cmp }));
    t.c("…nessuna se da allora non compare", !nuoveNelTesto(testo, { re, nomi: ["Logen"], da: "epubcfi(/6/2!/4/3)", a: "epubcfi(/6/2!/4/9)", cmp }));
    t.c("…e quelle prima di allora non contano", !nuoveNelTesto(testo, { re, nomi: ["Logen"], da: "epubcfi(/6/2!/4/2/1:0)", a: "epubcfi(/6/2!/4/9)", cmp }));

    t.eq("il testo del capitolo e' quello dei suoi nodi in fila", testoCapitolo({ nodi: [{ t: "Monza" }, { t: " " }, { t: "Murcatto" }] }), "Monza Murcatto");
    const reg = nuovoRegistro("Logen");
    let letti = 0;
    const spia = { ...reg };
    aliasNelTesto({ tipo: "epub", capitoli: [{ base: "/6/2", nodi: [{ t: "uno" }] }, { base: "/6/4", nodi: [{ t: "due" }] }] }, spia, "epubcfi(/6/2!/4/2)", (a, b) => {
      letti++;
      return cmp(a, b);
    });
    t.eq("gli alias si cercano fin dove sei arrivato", letti, 2);
  }
  {
    const pdf = { tipo: "pdf", pagine: ["Logen arriva.", "niente", "Logen riparte."] };
    const re = regexNome(["Logen"]);
    const r = menzioniNelTesto(pdf, { libro: {}, re, nomi: ["Logen"], fino: "2", cmp: null });
    t.eq("nel PDF si raccoglie fino alla pagina del segno", r.map((x) => x.cfi).join(), "1");
    t.c("…e le novita' si guardano fra le due pagine", nuoveNelTesto(pdf, { re, nomi: ["Logen"], da: "2", a: "3" }));
    t.c("…nessuna se non ce ne sono", !nuoveNelTesto(pdf, { re, nomi: ["Logen"], da: "1", a: "2" }));
  }
}

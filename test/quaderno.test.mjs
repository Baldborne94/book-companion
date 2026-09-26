// IL QUADERNO DELLE PAROLE. Ogni errore qui e' muto: un nome della saga
// finito fra le parole da imparare, la frase sbagliata sotto la parola, una
// parola imparata che resta imparata anche dopo averla cercata di nuovo, un
// dispositivo che cancella le parole dell'altro. Nessuno alza un errore.
import {
  chiaveParola,
  daAnnotare,
  fraseAttorno,
  pezziFrase,
  annota,
  togliParola,
  segnaImparata,
  ripassata,
  daRipassare,
  filtraQuaderno,
  libriDelQuaderno,
  rigaQuaderno,
  fondiQuaderno,
  esportaQuaderno,
  paroleVive,
  INCONTRI_MAX,
  FRASE_MAX,
  DOVE_MAX,
  doveTornare,
} from "../src/lib/quaderno.js";
import { mergePrefs } from "../src/lib/syncCore.js";

const risposta = (x = {}) => ({
  word: "gormless",
  raw: "gormless",
  loading: false,
  cercando: false,
  entries: [{ pos: "adjective", text: "Lacking intelligence; stupid." }],
  italiano: [{ pos: "aggettivo", parole: ["stupido", "tonto", "ottuso", "babbeo"] }],
  ...x,
});
const ERIC = { id: "b1", title: "Eric" };
const MORT = { id: "b2", title: "Mort" };

export default async function (t) {
  // ---- la chiave -----------------------------------------------------------
  t.eq("maiuscole e punteggiatura ai bordi non fanno due parole", chiaveParola(" Gormless, "), "gormless");
  t.eq("gli accenti nemmeno", chiaveParola("Café"), "cafe");
  t.eq("dentro la parola il trattino resta", chiaveParola("well-being"), "well-being");

  // ---- cosa entra ----------------------------------------------------------
  const v = daAnnotare(risposta());
  t.eq("una risposta piena entra", v?.id, "gormless");
  t.eq("la resa: le prime tre parole del primo gruppo", v?.resa, "stupido, tonto, ottuso");
  t.eq("la prima definizione", v?.definizione, "Lacking intelligence; stupid.");
  t.eq("la categoria", v?.pos, "adjective");
  t.eq(
    "due gruppi di resa si separano col punto",
    daAnnotare(risposta({ italiano: [{ pos: "n", parole: ["corsa"] }, { pos: "v", parole: ["correre"] }] }))?.resa,
    "corsa · correre"
  );
  t.eq("si scrive a risposta FINITA (loading)", daAnnotare(risposta({ loading: true })), null);
  t.eq("… e non mentre la rete cerca ancora", daAnnotare(risposta({ cercando: true })), null);
  t.eq(
    "un termine del mondo non e' una parola da imparare",
    daAnnotare(risposta({ gloss: { t: "Ankh-Morpork", d: "la citta'" } })),
    null
  );
  t.eq("un passaggio lungo non e' una voce", daAnnotare(risposta({ raw: "one two three four five" })), null);
  t.c("quattro parole si'", !!daAnnotare(risposta({ raw: "egg them on now" })));
  t.eq("una risposta vuota non entra", daAnnotare(risposta({ entries: [], italiano: [] })), null);
  t.eq(
    "la traduzione a macchina di un passaggio non e' una resa",
    daAnnotare(risposta({ entries: [], italiano: [], translation: "uniti, scherzo'", machine: true })),
    null
  );
  t.eq(
    "la traduzione di una parola si'",
    daAnnotare(risposta({ entries: [], italiano: [], translation: "stupido" }))?.resa,
    "stupido"
  );
  t.eq("il lemma comanda sulla forma", daAnnotare(risposta({ word: "fuming", raw: "fuming", lemma: "fume" }))?.id, "fume");
  const modo = daAnnotare(
    risposta({ raw: "take the mickey", word: "take the mickey", entries: [], italiano: [], slang: { t: "take the mickey", d: "prendere in giro" } })
  );
  t.eq("un modo di dire entra con la sua spiegazione", modo?.definizione, "prendere in giro");
  t.eq("… col nome del modo di dire", modo?.id, "take the mickey");
  t.eq("niente risposta, niente voce", daAnnotare(null), null);

  // ---- la frase ------------------------------------------------------------
  const par =
    "Rincewind ran. He was good at it. The demon looked gormless, which was saying something. Then it ate the chair.";
  t.eq("si prende la frase che contiene la parola", fraseAttorno(par, "gormless"), "The demon looked gormless, which was saying something.");
  t.eq("anche se la parola e' in maiuscolo nel testo", fraseAttorno("It was Gormless. Really.", "gormless"), "It was Gormless.");
  t.eq("la prima frase", fraseAttorno(par, "Rincewind"), "Rincewind ran.");
  t.eq("l'ultima, senza punto dopo", fraseAttorno("One. Two ate it", "ate"), "Two ate it");
  t.eq(
    "le virgolette di chiusura restano con la frase",
    fraseAttorno("«He is gormless.» She laughed.", "gormless"),
    "«He is gormless.»"
  );
  t.eq("a confine: «ire» dentro «fire» non e' la parola", fraseAttorno("The fire burned.", "ire"), "");
  t.eq("… e la trova piu' avanti", fraseAttorno("The fire burned. Ire rose.", "ire"), "Ire rose.");
  t.eq("parola assente: niente frase, non il paragrafo", fraseAttorno(par, "wizard"), "");
  t.eq("contesto vuoto", fraseAttorno("", "x"), "");
  const lunga = `${"a ".repeat(200)}gormless ${"b ".repeat(200)}end.`;
  const presa = fraseAttorno(lunga, "gormless");
  t.c("una frase lunga si taglia al tetto (piu' i puntini)", presa.length <= FRASE_MAX + 2, `lunga ${presa.length}`);
  t.c("… e la finestra contiene la parola", presa.includes("gormless"));
  t.c("… coi puntini dai due lati", presa.startsWith("…") && presa.endsWith("…"));
  const inTesta = fraseAttorno(`gormless ${"b ".repeat(300)}end.`, "gormless");
  t.c("in testa niente puntini davanti", !inTesta.startsWith("…") && inTesta.endsWith("…"));
  t.eq("gli a capo diventano spazi", fraseAttorno("It was\n  gormless.", "gormless"), "It was gormless.");

  const pz = pezziFrase("The demon looked Gormless, truly.", "gormless");
  t.eq("la parola in evidenza e' quella scritta nel testo", pz.find((p) => p.qui)?.t, "Gormless");
  t.eq("i pezzi ricompongono la frase", pz.map((p) => p.t).join(""), "The demon looked Gormless, truly.");
  t.eq("senza la parola, un pezzo solo", pezziFrase("Niente qui.", "gormless").length, 1);

  // ---- annotare ------------------------------------------------------------
  let q = annota([], v, { libro: ERIC, frase: "The demon looked gormless.", forma: "gormless", ora: 1000 });
  t.eq("la prima ricerca fa una voce", paroleVive(q).length, 1);
  t.eq("… contata una volta", q[0].volte, 1);
  t.eq("… col libro dell'incontro", q[0].incontri[0].titolo, "Eric");
  q = segnaImparata(q, "gormless", true, 1500);
  t.c("segnata come imparata", q[0].imparata);
  q = annota(q, v, { libro: MORT, frase: "Mort felt gormless.", ora: 2000 });
  t.eq("cercata di nuovo: una voce sola, non due", paroleVive(q).length, 1);
  t.eq("… contata due volte", q[0].volte, 2);
  t.eq("… con la frase nuova per prima", q[0].incontri[0].frase, "Mort felt gormless.");
  t.eq("… e la vecchia dietro", q[0].incontri[1].frase, "The demon looked gormless.");
  t.eq("cercarla di nuovo la rimette DA RIPASSARE", q[0].imparata, false);
  t.eq("l'ora si aggiorna", q[0].updatedAt, 2000);
  const stessa = annota(q, v, { libro: MORT, frase: "Mort felt gormless.", ora: 3000 });
  t.eq("la stessa frase nello stesso libro non si ripete", stessa[0].incontri.length, 2);
  let tante = q;
  for (let i = 0; i < 6; i++) tante = annota(tante, v, { libro: ERIC, frase: `Frase ${i}.`, ora: 4000 + i });
  t.eq("le frasi sono al massimo tre", tante[0].incontri.length, INCONTRI_MAX);
  t.eq("… le piu' recenti", tante[0].incontri[0].frase, "Frase 5.");
  const vuota = annota(q, { ...v, resa: "", definizione: "" }, { ora: 5000 });
  t.eq("una risposta piu' scarna non cancella la resa che c'era", vuota[0].resa, "stupido, tonto, ottuso");
  t.eq("senza voce non cambia niente", annota(q, null), q);

  // ---- il punto del libro --------------------------------------------------
  // Dal quaderno si torna dove l'hai incontrata: il CFI nell'ePub, la pagina
  // nel PDF. Intero o niente: un CFI tagliato non porta da nessuna parte.
  const cfi = "epubcfi(/6/14!/4/2/8,/1:10,/1:18)";
  const conPunto = annota([], v, { libro: ERIC, frase: "The demon looked gormless.", dove: cfi, ora: 1 });
  t.eq("l'incontro si tiene il punto", conPunto[0].incontri[0].dove, cfi);
  t.eq("la pagina di un PDF, anche come numero", annota([], v, { libro: ERIC, dove: 42, ora: 1 })[0].incontri[0].dove, "42");
  t.c("senza punto la chiave non c'e' affatto", !("dove" in annota([], v, { libro: ERIC, ora: 1 })[0].incontri[0]));
  t.c("… nemmeno con gli spazi", !("dove" in annota([], v, { libro: ERIC, dove: "   ", ora: 1 })[0].incontri[0]));
  t.c("un punto troppo lungo non si tronca: si lascia", !("dove" in annota([], v, { libro: ERIC, dove: "x".repeat(DOVE_MAX + 1), ora: 1 })[0].incontri[0]));
  t.c("… ma fino al tetto si tiene", annota([], v, { libro: ERIC, dove: "x".repeat(DOVE_MAX), ora: 1 })[0].incontri[0].dove.length === DOVE_MAX);
  const ritrovata = annota(conPunto, v, { libro: ERIC, frase: "The demon looked gormless.", dove: "epubcfi(/6/14!/4/2/9)", ora: 2 });
  t.eq("la stessa frase ritrovata tiene il punto NUOVO", ritrovata[0].incontri[0].dove, "epubcfi(/6/14!/4/2/9)");

  const scaffale = [ERIC, { ...MORT, fileTolto: true }];
  const x = conPunto[0].incontri[0];
  t.eq("si torna al libro giusto e al suo punto", JSON.stringify(doveTornare(x, scaffale)), JSON.stringify({ id: ERIC.id, dove: cfi }));
  t.eq("senza punto non si torna", doveTornare({ ...x, dove: undefined }, scaffale), null);
  t.eq("… ne' senza libro", doveTornare({ ...x, libroId: null }, scaffale), null);
  t.eq("un libro cancellato non si apre", doveTornare(x, [MORT]), null);
  t.eq("un libro senza ebook nemmeno", doveTornare({ ...x, libroId: MORT.id }, scaffale), null);
  t.eq("… e nemmeno con la biblioteca assente (null, non undefined: il default la copre gia')", doveTornare(x, null), null);

  // ---- togliere -------------------------------------------------------------
  const tolta = togliParola(q, "gormless", 6000);
  t.eq("tolta non si vede piu'", paroleVive(tolta).length, 0);
  t.c("… ma resta la lapide, o l'altro dispositivo la rimanderebbe su", tolta[0].deleted && tolta[0].updatedAt === 6000);
  const rinata = annota(tolta, v, { libro: ERIC, frase: "x gormless.", ora: 7000 });
  t.eq("cercata dopo averla tolta, rinasce", paroleVive(rinata).length, 1);
  t.eq("… da capo", rinata[0].volte, 1);
  t.eq("imparare una lapide non la resuscita", paroleVive(segnaImparata(tolta, "gormless", true)).length, 0);

  // ---- il ripasso -------------------------------------------------------------
  const voce = (id, aggiunta, extra = {}) => ({ id, parola: id, aggiunta, updatedAt: aggiunta, incontri: [], ...extra });
  const mazzo = [
    voce("alfa", 10, { ultimoRipasso: 500 }),
    voce("beta", 30),
    voce("gamma", 20),
    voce("delta", 5, { imparata: true }),
    { id: "morta", deleted: true, updatedAt: 1 },
  ];
  t.eq(
    "prima le mai ripassate, la piu' vecchia per prima; le imparate e le lapidi no",
    daRipassare(mazzo).map((x) => x.id).join(","),
    "gamma,beta,alfa"
  );
  t.eq("il giro ha un tetto", daRipassare(mazzo, 2).length, 2);
  const dopo = ripassata(mazzo, "gamma", 900);
  t.eq("ripassata: si conta", dopo.find((x) => x.id === "gamma").ripassi, 1);
  t.eq("… e torna in fondo alla fila", daRipassare(dopo).map((x) => x.id).join(","), "beta,alfa,gamma");

  // ---- filtri e porta -------------------------------------------------------
  const lib = [
    voce("uno", 1, { resa: "primo", updatedAt: 1, incontri: [{ libroId: "b1", titolo: "Eric", frase: "The first one.", quando: 1 }] }),
    voce("due", 2, { updatedAt: 3, imparata: true, incontri: [{ libroId: "b2", titolo: "Mort", frase: "Two birds.", quando: 3 }] }),
    voce("tre", 3, { updatedAt: 2, incontri: [{ libroId: "b1", titolo: "Eric", frase: "Tre.", quando: 2 }] }),
  ];
  t.eq("le piu' recenti in cima", filtraQuaderno(lib).map((x) => x.id).join(","), "due,tre,uno");
  t.eq("da ripassare", filtraQuaderno(lib, { stato: "ripasso" }).map((x) => x.id).join(","), "tre,uno");
  t.eq("imparate", filtraQuaderno(lib, { stato: "imparate" }).map((x) => x.id).join(","), "due");
  t.eq("per libro", filtraQuaderno(lib, { libroId: "b2" }).map((x) => x.id).join(","), "due");
  t.eq("la ricerca guarda la resa", filtraQuaderno(lib, { query: "PRIMO" }).map((x) => x.id).join(","), "uno");
  t.eq("… e le frasi", filtraQuaderno(lib, { query: "birds" }).map((x) => x.id).join(","), "due");
  const libri = libriDelQuaderno(lib);
  t.eq("i libri per numero di parole", libri.map((l) => `${l.titolo}:${l.n}`).join(","), "Eric:2,Mort:1");
  t.eq("la porta dice il conto", rigaQuaderno(lib), "3 parole da 2 libri · 2 da ripassare");
  t.eq("… al singolare", rigaQuaderno([lib[1]]), "1 parola da 1 libro");
  t.eq("gli zeri non si dicono", rigaQuaderno([{ id: "x", deleted: true }]), null);
  const md = esportaQuaderno(filtraQuaderno(lib, { libroId: "b1" }));
  t.c("l'esportazione porta le parole guardate", md.includes("## tre") && md.includes("## uno") && !md.includes("## due"));
  t.c("… con la frase e il libro", md.includes("> The first one.") && md.includes("— Eric"));

  // ---- due dispositivi --------------------------------------------------------
  const tablet = [voce("alfa", 1, { updatedAt: 10, resa: "tablet" }), voce("beta", 1, { updatedAt: 5 })];
  const telefono = [voce("alfa", 1, { updatedAt: 20, resa: "telefono" }), voce("gamma", 1, { updatedAt: 7 })];
  const fuso = fondiQuaderno(tablet, telefono);
  t.eq("unione: le parole di tutt'e due", fuso.map((x) => x.id).join(","), "alfa,beta,gamma");
  t.eq("per ogni parola vince la versione piu' recente", fuso[0].resa, "telefono");
  const lap = fondiQuaderno([{ id: "beta", deleted: true, updatedAt: 9 }], tablet);
  t.c("la lapide piu' recente vince", lap.find((x) => x.id === "beta").deleted);
  t.c("… quella piu' vecchia no", !fondiQuaderno([{ id: "beta", deleted: true, updatedAt: 1 }], tablet).find((x) => x.id === "beta").deleted);
  t.eq(
    "a parita' d'ora resta quella di casa",
    fondiQuaderno([voce("x", 1, { updatedAt: 5, resa: "casa" })], [voce("x", 1, { updatedAt: 5, resa: "cloud" })])[0].resa,
    "casa"
  );
  const rimescolata = JSON.parse(JSON.stringify(fuso)).map((o) => Object.fromEntries(Object.entries(o).reverse()));
  t.eq("le chiavi riordinate (jsonb) non fanno un quaderno diverso", JSON.stringify(fondiQuaderno(rimescolata)), JSON.stringify(fuso));
  t.eq("spazzatura fuori", fondiQuaderno([null, { no: 1 }, "x"], "boh").length, 0);

  const base = { reader: null, music_favs: [], music_lists: [], glossari: {}, racconti: [], tempo: {}, obiettivi: {}, updated_at: 5 };
  const m = mergePrefs({ ...base, quaderno: tablet }, { ...base, quaderno: telefono, updated_at: 1 });
  t.eq("la sincronizzazione fonde il quaderno anche se il cloud e' piu' vecchio", m.merged.quaderno.length, 3);
  t.c("… e lo scrive in casa", m.applyLocal);
  t.c("… e lo manda su", m.pushRemote);
  const pari = mergePrefs(
    { ...base, quaderno: fuso },
    { ...base, quaderno: rimescolata, updated_at: 5 }
  );
  t.c("in pari non si muove niente, nemmeno con le chiavi riordinate", !pari.applyLocal && !pari.pushRemote);
}

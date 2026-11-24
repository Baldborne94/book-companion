// I LIBRI DA PRENDERE. Tutto quel che sbaglia qui sbaglia in silenzio: un
// buco inventato dove i numeri sono di due storie, una proposta che torna
// dopo che hai detto di no, un libro arrivato che resta «da prendere», una
// voce scritta sul tablet che sul telefono sparisce.
import {
  proposte,
  aggiungi,
  tieni,
  togli,
  scarta,
  arrivato,
  vive,
  nomeVoce,
  testoLista,
  rigaDaPrendere,
  fondiDaPrendere,
  idTitolo,
  idNumero,
  IN_VISTA,
} from "../src/lib/daPrendere.js";
import { mergePrefs } from "../src/lib/syncCore.js";

// una tavola finta: cinque tappe, e una lettura di sfondo senza numero
const TAV = {
  saga: "Guida",
  libri: [
    { t: "Primo", a: "Aa", o: 1 },
    { t: "Secondo", a: "Aa", o: 2 },
    { t: "Sfondo", a: "Aa", o: null },
    { t: "Terzo", a: "Aa", o: 3 },
    { t: "Quarto", a: "Aa", o: 4 },
    { t: "Quinto", a: "Aa", o: 5 },
  ],
  ordine: (v) => v.o,
};
const riconosceFinto = (b) => {
  const v = TAV.libri.find((x) => x.t === b.title);
  return v ? { saga: TAV.saga, titolo: v.t } : null;
};
const libro = (id, title, extra = {}) => ({ id, title, ...extra });
const opzioni = (stati, extra = {}) => ({
  statusOf: (id) => stati[id] || "unread",
  riconosce: riconosceFinto,
  tavole: [TAV],
  contorno: () => false,
  ...extra,
});

export default async function (t) {
  // ---- dalle tavole: i titoli veri -------------------------------------------
  let g = proposte([libro("a", "Primo"), libro("b", "Terzo")], [], opzioni({ a: "read" }));
  t.eq("una saga di tavola propone per titolo", g[0]?.nome, "Guida");
  t.eq(
    "il buco fra le tue tappe, poi il primo volume dopo l'ultima",
    g[0].voci.map((v) => v.titolo).join(","),
    "Secondo,Quarto"
  );
  t.eq("… con autore e numero", `${g[0].voci[0].autore} ${g[0].voci[0].numero}`, "Aa 2");
  t.eq("la lettura di sfondo non si propone", g[0].voci.some((v) => v.titolo === "Sfondo"), false);
  g = proposte([libro("a", "Primo"), libro("b", "Terzo")], [], opzioni({ b: "reading" }));
  t.eq("in lettura vale come riferimento: i buchi DIETRO di te non si propongono", g[0].voci.map((v) => v.titolo).join(","), "Quarto");
  t.eq(
    "una lettura di sfondo letta non fa da riferimento: senza numero non sta in nessun punto",
    proposte([libro("s", "Sfondo")], [], opzioni({ s: "read" })).length,
    0
  );
  t.eq("una saga mai cominciata non chiede niente", proposte([libro("a", "Primo")], [], opzioni({})).length, 0);
  t.eq(
    "l'abbandonato non apre un filo",
    proposte([libro("a", "Primo")], [], opzioni({ a: "abandoned" })).length,
    0
  );
  t.eq(
    "letta tutta la guida, niente da prendere",
    proposte(TAV.libri.filter((v) => v.o).map((v, i) => libro(`x${i}`, v.t)), [], opzioni({ x4: "read" })).length,
    0
  );


  // una fila di numeri senza titoli non si propone piu': «n° 3 (se esiste)»
  // non e' un libro che si possa chiedere in libreria (detto dal lettore)
  const fl = (id, n, extra = {}) => libro(id, `First ${n}`, { saga: "First Law", sagaOrder: n, ...extra });
  t.eq("i soli numeri non fanno proposte", proposte([fl("1", 1), fl("2", 2), fl("4", 4)], [], opzioni({ 1: "read" })).length, 0);

  // ---- la lista e le proposte si parlano -------------------------------------
  const base = [libro("1", "Primo"), libro("3", "Terzo")];
  const [p3] = proposte(base, [], opzioni({ 1: "read", 3: "read" }))[0].voci;
  let lista = tieni([], p3, 100);
  t.eq("tenuta, la proposta sta nella lista", vive(lista).length, 1);
  t.eq("… e sparisce dalle proposte", proposte(base, lista, opzioni({ 1: "read", 3: "read" })).length, 0);
  lista = togli(lista, p3.id, 200);
  t.eq("tolta dalla lista, torna fra le proposte", proposte(base, lista, opzioni({ 1: "read", 3: "read" })).length, 1);
  lista = scarta(lista, p3.id, 300);
  t.eq("scartata, non si ripropone", proposte(base, lista, opzioni({ 1: "read", 3: "read" })).length, 0);
  t.eq("… e nella lista non compare", vive(lista).length, 0);
  t.eq("lo scarto e' un segno solo, non si accumula", scarta(lista, p3.id, 400).filter((v) => v.id === p3.id).length, 1);

  // ---- scrivere a mano ------------------------------------------------------------
  let mia = aggiungi([], { titolo: "  Tigana ", autore: "Guy Gavriel Kay", nota: "edizione rilegata" }, 10);
  t.eq("una voce scritta a mano", vive(mia)[0]?.titolo, "Tigana");
  t.eq("senza titolo non entra niente", aggiungi(mia, { titolo: "  " }).length, 1);
  mia = aggiungi(mia, { titolo: "Tigana", autore: "Kay, Guy Gavriel" }, 20);
  t.eq("lo stesso libro scritto due volte resta uno", vive(mia).length, 1);
  t.eq("… la nota non si perde", vive(mia)[0].nota, "edizione rilegata");
  t.eq("… e la data d'ingresso resta la prima", vive(mia)[0].aggiunta, 10);
  t.eq("l'id ignora maiuscole, articoli e ordine del nome", idTitolo("The Tigana", "Kay, Guy Gavriel"), idTitolo("tigana", "Guy Gavriel Kay"));
  const scartataPoiScritta = aggiungi(scarta([], idTitolo("Tigana", "Kay")), { titolo: "Tigana", autore: "Kay" }, 5);
  t.eq("scriverla a mano dopo averla scartata: adesso la vuoi", vive(scartataPoiScritta).length, 1);

  // ---- e' arrivato? ------------------------------------------------------------------
  t.c("per titolo e autore, un'altra edizione vale", !!arrivato(vive(mia)[0], [libro("x", "Tigana", { author: "Kay, Guy Gavriel" })]));
  t.eq("un omonimo di un altro autore no", arrivato(vive(mia)[0], [libro("x", "Tigana", { author: "Qualcun Altro" })]), null);
  const buco = { saga: "First Law", ciclo: "", numero: 3 };
  t.c("per numero: stessa saga e stesso numero", !!arrivato(buco, [fl("3", 3)]));
  t.c("… anche con la saga scritta in un'altra grafia", !!arrivato({ ...buco, saga: "The First Law" }, [fl("3", 3)]));
  t.eq("… non un altro numero", arrivato(buco, [fl("5", 5)]), null);
  t.eq("… non lo stesso numero di un'altra saga", arrivato(buco, [libro("z", "Z", { saga: "Dune", sagaOrder: 3 })]), null);
  t.eq(
    "… e dove conta la serie, non un'altra serie",
    arrivato({ saga: "Cosmere", ciclo: "Stormlight", numero: 2 }, [libro("x", "Hero", { saga: "Cosmere", series: "Mistborn", sagaOrder: 2 })]),
    null
  );

  // ---- la lista copiata e la porta -----------------------------------------------------
  const conArrivo = tieni(mia, { id: idNumero("First Law", "", 3), saga: "First Law", numero: 3 }, 30);
  const copia = testoLista(conArrivo, [fl("3", 3)]);
  t.c("la lista copiata porta titolo, autore e nota", copia.includes("• Tigana — Kay, Guy Gavriel · edizione rilegata"));
  t.eq("… ma non i libri gia' arrivati", copia.includes("First Law"), false);
  t.eq("lista vuota, niente da copiare", testoLista([], []), "");
  t.eq("la porta dice il conto", rigaDaPrendere(conArrivo, [fl("3", 3)], 2), "1 libro da prendere · 2 proposte dalle tue saghe");
  t.eq("… solo le proposte", rigaDaPrendere([], [], 1), "1 proposta dalle tue saghe");
  t.eq("gli zeri non si dicono", rigaDaPrendere([], [], 0), null);

  t.c("in vista ne stanno poche", IN_VISTA >= 1 && IN_VISTA <= 5);

  // ---- due dispositivi ---------------------------------------------------------------------
  const tablet = aggiungi([], { titolo: "Tigana", autore: "Kay" }, 10);
  const telefono = scarta(aggiungi([], { titolo: "Piranesi", autore: "Clarke" }, 12), "n:x||3", 13);
  const fuso = fondiDaPrendere(tablet, telefono);
  t.eq("unione: le voci dei due lati", vive(fuso).map((v) => v.titolo).sort().join(","), "Piranesi,Tigana");
  t.c("… e lo scarto viaggia", fuso.some((v) => v.id === "n:x||3" && v.scartata));
  const tolta = fondiDaPrendere(togli(tablet, idTitolo("Tigana", "Kay"), 50), tablet);
  t.eq("la lapide piu' recente vince", vive(tolta).length, 0);
  const base0 = { reader: null, music_favs: [], music_lists: [], glossari: {}, racconti: [], tempo: {}, obiettivi: {}, quaderno: [], updated_at: 5 };
  const m = mergePrefs({ ...base0, da_prendere: tablet }, { ...base0, da_prendere: telefono, updated_at: 1 });
  t.eq("la sincronizzazione fonde la lista anche col cloud piu' vecchio", vive(m.merged.da_prendere).length, 2);
  t.c("… la scrive in casa e la manda su", m.applyLocal && m.pushRemote);
  const pari = mergePrefs({ ...base0, da_prendere: fuso }, { ...base0, da_prendere: JSON.parse(JSON.stringify(fuso)) });
  t.c("in pari non si muove niente", !pari.applyLocal && !pari.pushRemote);
}

// UNA SAGA DAL SUO NOME (`lib/sagaDaNome.js`): chiesto dal lettore, «quando
// aggiungo il nome di una saga in automatico mi aggiungi nell'ordine
// corretto i libri». Prima le guide scritte a mano, poi Wikidata. Quel che
// sbaglia in silenzio e' l'ORDINE e cosa e' un VOLUME (una novella «2.5»,
// un'edizione, il volume di un'altra serie).
import { sagaDalNome, guidaDalNome, sceltaSerie, volumeDa, inOrdine, senzaParoleGeneriche, serieSenzaTipo } from "../src/lib/sagaDaNome.js";

const tipo = (...q) => q.map((id) => ({ mainsnak: { datavalue: { value: { id } } } }));
const legame = (serie, n) => ({ mainsnak: { datavalue: { value: { id: serie } } }, ...(n != null ? { qualifiers: { P1545: [{ datavalue: { value: String(n) } }] } } : {}) });
const opera = (en, { serie = "Q101", n, anno, p31 = "Q7725634", forma = "Q8261", autore = "Q300", altre = [] } = {}) => ({
  labels: { en: { value: en } },
  claims: {
    P31: tipo(p31),
    ...(forma ? { P7937: tipo(forma) } : {}),
    P179: [legame(serie, n), ...altre],
    P50: tipo(autore),
    ...(anno ? { P577: [{ mainsnak: { datavalue: { value: { time: `+${anno}-01-01T00:00:00Z` } } } }] } : {}),
  },
});

export default async (t) => {
  // ── LE GUIDE, ANCHE COI NOMI DEL LETTORE ──────────────────────────────
  t.eq("«Mondo Disco» e' il Discworld", guidaDalNome("Mondo Disco")?.saga, "Discworld");
  t.eq("«gaunt's ghosts» senza maiuscole", guidaDalNome("gaunt's ghosts")?.saga, "Gaunt's Ghosts");
  t.eq("«The Siege of Terra» e' la parte 12 dell'Eresia", guidaDalNome("The Siege of Terra")?.parte, "Part 12 · The Siege of Terra");
  t.eq("un nome che nessuna guida ha", guidaDalNome("Una saga che non c'è"), null);
  const sot = await sagaDalNome("Siege of Terra", { libri: [] });
  t.eq("Siege of Terra: tredici volumi, dalla guida", `${sot.fonte} ${sot.volumi.length}`, "guida 13");
  t.eq("…dal primo all'ultimo", `${sot.volumi[0].titolo} … ${sot.volumi.at(-1).titolo}`, "The Solar War … The End and the Death: Volume III");
  t.eq("senza la rete, un nome sconosciuto non trova niente", await sagaDalNome("Una saga che non c'è", { libri: [] }), null);

  // ── WIKIDATA ──────────────────────────────────────────────────────────
  const E = {
    Q100: { labels: { en: { value: "Kingkiller universe" } }, claims: { P31: tipo("Q559618", "Q1667921") } },
    Q101: { labels: { en: { value: "The Kingkiller Chronicle" } }, claims: { P31: tipo("Q1667921") } },
    Q201: opera("The Name of the Wind", { n: 1, anno: 2007 }),
    Q202: opera("The Wise Man's Fear", { n: 2, anno: 2011 }),
    Q203: opera("The Slow Regard of Silent Things", { n: "2.5", anno: 2014, forma: "Q149537" }),
    Q204: opera("The Name of the Wind (Italian edition)", { n: 1, p31: "Q3331189", forma: null }),
    Q205: opera("Doors of Stone", { n: null }),
    Q206: opera("The Wise Man's Fear", { n: 2, anno: 2011 }),
    Q300: { labels: { en: { value: "Patrick Rothfuss" } } },
  };
  const chieste = [];
  const prendi = async (url) => {
    const q = new URL(url).searchParams;
    chieste.push(q.get("action"));
    if (q.get("action") === "wbsearchentities") return { search: [{ id: "Q100" }, { id: "Q101" }] };
    if (q.get("action") === "query") return { query: { search: ["Q201", "Q202", "Q203", "Q204", "Q205", "Q206"].map((title) => ({ title })) } };
    return { entities: Object.fromEntries(q.get("ids").split("|").filter((i) => E[i]).map((i) => [i, E[i]])) };
  };
  // (un nome che nessuna guida dell'app ha: la serie finta e' su Wikidata)
  const r = await sagaDalNome("Una cronaca finta", { libri: [{ title: "The Name of the Wind", author: "Patrick Rothfuss" }], prendi });
  t.eq("la serie, non l'universo", r.nome, "The Kingkiller Chronicle");
  t.eq("i volumi numerati, in ordine, una volta sola", r.volumi.map((v) => `${v.numero} ${v.titolo}`).join(" | "), "1 The Name of the Wind | 2 The Wise Man's Fear");
  t.eq("…con l'autore e l'anno", `${r.volumi[1].autore} ${r.volumi[1].anno}`, "Patrick Rothfuss 2011");
  t.eq("quello che hai e' segnato", r.volumi.map((v) => !!v.gia).join(), "true,false");
  t.eq("la saga in cui finiscono e' il nome della serie", r.saga, "The Kingkiller Chronicle");
  t.c("non piu' di sei domande", chieste.length <= 6, chieste.join(","));

  // le regole una per una
  t.eq("la prima candidata che e' una serie e non un universo", sceltaSerie(["Q100", "Q101"], E), "Q101");
  t.eq("niente serie, niente", sceltaSerie(["Q300"], E), null);
  t.eq("una novella «2.5» non e' un volume", volumeDa(E.Q203, "Q101"), null);
  t.eq("un'edizione non e' un volume", volumeDa(E.Q204, "Q101"), null);
  t.eq("«2.5» non e' un numero di volume, anche senza la forma di novella", volumeDa(opera("X", { n: "2.5", forma: null }), "Q101").numero, null);
  t.eq("il numero e' quello in QUESTA serie", volumeDa(opera("X", { serie: "Q999", n: 7, altre: [legame("Q101", 3)] }), "Q101").numero, 3);
  t.eq("senza numero, numero nullo", volumeDa(E.Q205, "Q101").numero, null);
  const senza = inOrdine([{ titolo: "B", numero: null, anno: 2010 }, { titolo: "A", numero: null, anno: 2001 }, { titolo: "C", numero: null, anno: null }]);
  t.eq("nessuno numerato: per anno, e lo si dice", `${senza.perAnno} ${senza.volumi.map((v) => `${v.numero}${v.titolo}`).join(",")}`, "true 1A,2B");
  const misti = inOrdine([{ titolo: "B", numero: 2 }, { titolo: "Z", numero: null, anno: 1990 }, { titolo: "A", numero: 1 }]);
  t.eq("in una saga numerata quello senza numero resta fuori", misti.volumi.map((v) => v.titolo).join(), "A,B");

  // IL NOME COME LO SCRIVE IL LETTORE: «raven's shadow series» non trovava
  // niente, perche' la ricerca di Wikidata combacia sull'etichetta e la
  // parola in piu' la manda a vuoto. Si riprova senza le parole generiche
  const cercati = [];
  const soloEsatto = async (url) => {
    const q = new URL(url).searchParams;
    if (q.get("action") === "wbsearchentities") {
      cercati.push(q.get("search"));
      return { search: q.get("search") === "raven's shadow" ? [{ id: "Q101" }] : [] };
    }
    return prendi(url);
  };
  const rs = await sagaDalNome("raven's shadow series", { libri: [], prendi: soloEsatto });
  t.eq("«raven's shadow series» trova la saga, ripulito il nome", `${rs?.nome} ${rs?.volumi.length}`, "The Kingkiller Chronicle 2");
  t.eq("…provato prima com'era scritto, poi senza «series»", cercati.join(" | "), "raven's shadow series | raven's shadow");
  t.eq("le parole generiche via, il nome resta", senzaParoleGeneriche("La saga di Raven's Shadow trilogy"), "Raven's Shadow");
  t.eq("anche in italiano", senzaParoleGeneriche("Il ciclo dell'Eredità"), "Eredità");
  t.eq("…e senza articolo", senzaParoleGeneriche("Saga di Shannara"), "Shannara");
  t.eq("e le guide pure: «Mistborn series» e' Mistborn", guidaDalNome("Mistborn series")?.saga, "Mistborn");
  // niente serie su Wikidata
  const vuoto = await sagaDalNome("Nessuna", { libri: [], prendi: async () => ({ search: [] }) });
  t.eq("un nome che Wikidata non conosce", vuoto, null);
  // UNA SERIE CHE WIKIDATA NOMINA E BASTA (il lettore ha cercato «Shadows of
  // the Apt»: la voce c'e', senza tipo e senza libri)
  const apt = [{ id: "Q137781299", description: "fantasy series by Adrian Tchaikovsky" }];
  t.eq("una voce senza tipo che si descrive come serie", serieSenzaTipo(apt, { Q137781299: { claims: {} } }), "Q137781299");
  t.eq("…non un libro senza tipo", serieSenzaTipo([{ id: "Q1", description: "2008 novel by Adrian Tchaikovsky" }], { Q1: { claims: {} } }), null);
  t.eq("…non una voce col suo tipo (quello lo giudica `sceltaSerie`)", serieSenzaTipo(apt, { Q137781299: { claims: { P31: [{ mainsnak: { datavalue: { value: { id: "Q5398426" } } } }] } } }), null);
  const vuota = await sagaDalNome("Shadows of the Apt", {
    prendi: async (url) => {
      const q = new URL(url).searchParams;
      if (q.get("action") === "wbsearchentities") return { search: apt };
      if (q.get("action") === "query") return { query: { search: [] } };
      return { entities: { Q137781299: { labels: { en: { value: "Shadows of the Apt" } }, claims: {} } } };
    },
  });
  t.eq("la saga c'e', l'elenco no: il pannello lo dice col suo nome", `${vuota?.nome} ${vuota?.volumi.length}`, "Shadows of the Apt 0");
};

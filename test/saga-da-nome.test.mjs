// UNA SAGA DAL SUO NOME (`lib/sagaDaNome.js`): chiesto dal lettore, «quando
// aggiungo il nome di una saga in automatico mi aggiungi nell'ordine
// corretto i libri». Prima le guide scritte a mano, poi Wikidata. Quel che
// sbaglia in silenzio e' l'ORDINE e cosa e' un VOLUME (una novella «2.5»,
// un'edizione, il volume di un'altra serie).
import { sagaDalNome, guidaDalNome, sceltaSerie, volumeDa, inOrdine } from "../src/lib/sagaDaNome.js";

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
  const r = await sagaDalNome("Kingkiller", { libri: [{ title: "The Name of the Wind", author: "Patrick Rothfuss" }], prendi });
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

  // niente serie su Wikidata
  const vuoto = await sagaDalNome("Nessuna", { libri: [], prendi: async () => ({ search: [] }) });
  t.eq("un nome che Wikidata non conosce", vuoto, null);
};

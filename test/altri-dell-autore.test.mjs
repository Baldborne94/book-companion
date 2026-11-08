// I LIBRI DEGLI AUTORI CHE SEGUI, PER SAGA (`lib/altriDellAutore.js`): da
// Wikidata solo i libri, col titolo inglese, raggruppati per saga nel loro
// ordine; per ogni saga quanti ne hai e quali mancano.
import { libroDa, sceltaAutore, ceLHai, perSaga, fraseGruppo, opereDaWikidata, opereDi, idDaPrendere, SCADENZA, API } from "../src/lib/altriDellAutore.js";

const memoria = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};
const tipo = (...q) => q.map((id) => ({ mainsnak: { datavalue: { value: { id } } } }));
const serie = (id, n) => [{ mainsnak: { datavalue: { value: { id } } }, qualifiers: n == null ? {} : { P1545: [{ datavalue: { value: String(n) } }] } }];
const anno = (a) => [{ mainsnak: { datavalue: { value: { time: `+${a}-00-00T00:00:00Z` } } } }];
const opera = (en, { it, alias = [], p31 = ["Q7725634"], forma = "Q8261", saga, n, a } = {}) => ({
  labels: { en: { value: en }, ...(it ? { it: { value: it } } : {}) },
  aliases: alias.length ? { en: alias.map((value) => ({ value })) } : {},
  claims: { P31: tipo(...p31), ...(forma ? { P7937: tipo(forma) } : {}), ...(saga ? { P179: serie(saga, n) } : {}), ...(a ? { P577: anno(a) } : {}) },
});

export default async function (t) {
  const nomi = { Q10: "Lockwood & Co.", Q11: "Bartimaeus Sequence" };
  t.eq("un libro: titolo inglese, saga col numero, anno", JSON.stringify((({ titolo, saga, numero, anno }) => ({ titolo, saga, numero, anno }))(libroDa(opera("The Hollow Boy", { saga: "Q10", n: 3, a: 2015 }), nomi))), JSON.stringify({ titolo: "The Hollow Boy", saga: "Lockwood & Co.", numero: 3, anno: 2015 }));
  t.c("…non un'edizione, una serie, un fumetto; non senza titolo inglese", !libroDa(opera("X", { p31: ["Q3331189"] })) && !libroDa(opera("Lockwood & Co.", { p31: ["Q1667921"] })) && !libroDa(opera("X", { p31: ["Q3496994"] })) && !libroDa({ labels: { it: { value: "Solo italiano" } }, claims: { P31: tipo("Q7725634") } }));
  t.eq("…un numero che non e' un numero non e' un numero, e nemmeno «2.5»", [libroDa(opera("X", { saga: "Q10", n: "prequel" }), nomi).numero, libroDa(opera("X", { saga: "Q10", n: "2.5" }), nomi).numero].join(), ",");
  // solo i romanzi: le novelle, i racconti, il volume diviso no (la foto
  // del lettore: Edgedancer, Dawnshard, Defending Elysium, «Part One»)
  t.c("solo i romanzi: non novelle, racconti, novelette, raccolte, volumi divisi", ["Q149537", "Q49084", "Q472808", "Q1279564", "Q133500522"].every((f) => !libroDa(opera("Edgedancer", { forma: f, saga: "Q10" }), nomi)));
  t.c("…anche dentro una saga e anche col numero, se la forma dice breve", !libroDa(opera("Legion", { forma: "Q149537", saga: "Q10", n: 1 }), nomi));
  t.c("…senza forma passa solo un volume numerato di una saga", !!libroDa(opera("The Empty Grave", { forma: null, saga: "Q10", n: 5 }), nomi) && !libroDa(opera("Hard Choices", { forma: null }), nomi) && !libroDa(opera("X", { forma: null, saga: "Q10" }), nomi) && !libroDa(opera("X", { forma: null, saga: "Q10", n: "2.5" }), nomi));
  t.eq("l'autore e' il primo omonimo che di mestiere scrive", sceltaAutore(["Q1", "Q2"], { Q1: { claims: { P106: tipo("Q1028181") } }, Q2: { claims: { P106: tipo("Q36180") } } }), "Q2");
  t.eq("…nessuno scrittore, nessun autore", sceltaAutore(["Q1"], { Q1: { claims: { P106: tipo("Q1028181") } } }), null);

  const libri = [
    opera("The Amulet of Samarkand", { it: "L'amuleto di Samarcanda", saga: "Q11", n: 1, a: 2003 }),
    opera("The Golem's Eye", { it: "L'occhio del golem", saga: "Q11", n: 2, a: 2004 }),
    opera("The Screaming Staircase", { saga: "Q10", n: 1, a: 2013 }),
    opera("The Whispering Skull", { saga: "Q10", n: 2, a: 2014 }),
    opera("The Creeping Shadow", { saga: "Q10", n: 4, a: 2012 }),
    opera("The Hollow Boy", { saga: "Q10", n: 3, a: 2015 }),
    opera("Buried Fire", { a: 1999 }),
    opera("The Leap", { a: 2001, alias: ["Il salto"] }),
  ].map((e) => libroDa(e, nomi));
  const miei = [{ title: "L'amuleto di Samarcanda" }, { title: "L'occhio del golem (Bartimaeus 2)" }, { title: "The Screaming Staircase" }, { title: "Il salto" }];
  t.c("ce l'hai: col titolo italiano, con la coda fra parentesi, con un alias", ceLHai(libri[0], miei) && ceLHai(libri[1], miei) && ceLHai(libri[7], miei) && !ceLHai(libri[3], miei));
  const lista = [{ id: idDaPrendere(libri[3], "Jonathan Stroud"), titolo: "The Whispering Skull" }];
  const g = perSaga(libri, miei, lista, "Jonathan Stroud");
  t.eq("le saghe nell'ordine in cui sono cominciate, i libri senza saga in fondo", g.map((x) => x.saga || "—").join("|"), "Bartimaeus Sequence|Lockwood & Co.|—");
  t.eq("per ogni saga: quanti libri, quanti ne hai, la riga", g.map((x) => `${x.totale}/${x.hai}: ${fraseGruppo(x)}`).join(" | "), "2/2: ✓ li hai tutti | 4/1: te ne mancano 3 | 2/1: te ne manca 1");
  t.eq("…sotto, solo quelli che mancano, nell'ordine della saga (non dell'elenco)", g[1].mancano.map((l) => `#${l.numero} ${l.titolo}`).join("|"), "#2 The Whispering Skull|#3 The Hollow Boy|#4 The Creeping Shadow");
  t.c("…quel che e' gia' in «Da prendere» e' segnato", g[1].mancano[0].gia === true && g[1].mancano[1].gia === false);
  t.c("le altre righe: nessuno, un libro solo", fraseGruppo({ totale: 3, hai: 0, mancano: [1, 2, 3] }) === "non ne hai nessuno" && fraseGruppo({ totale: 1, hai: 1, mancano: [] }) === "✓ ce l'hai" && fraseGruppo({ totale: 1, hai: 0, mancano: [1] }) === "non ce l'hai");
  t.eq("lo stesso titolo due volte e' un libro solo", perSaga([...libri, libri[2]], [], [], "x").find((x) => x.saga === "Lockwood & Co.").totale, 4);

  // il giro su un Wikidata finto
  const chieste = [];
  const prendi = async (url) => {
    const p = Object.fromEntries(new URL(url).searchParams);
    chieste.push(p.action);
    if (!url.startsWith(API) || p.origin !== "*") throw new Error(url);
    if (p.action === "wbsearchentities") return { search: [{ id: "Q1" }, { id: "Q2" }] };
    if (p.action === "query") return { query: { search: p.srsearch === "haswbstatement:P50=Q2" ? [{ title: "Q21" }, { title: "Q22" }, { title: "Q23" }] : [] } };
    const tutte = {
      Q1: { claims: { P106: tipo("Q1028181") } },
      Q2: { claims: { P106: tipo("Q6625963") } },
      Q21: opera("The Hollow Boy", { saga: "Q10", n: 3, a: 2015 }),
      Q22: opera("Lockwood & Co.", { p31: ["Q1667921"] }),
      Q23: opera("Buried Fire", { a: 1999 }),
      Q10: { labels: { en: { value: "Lockwood & Co." } } },
    };
    return { entities: Object.fromEntries(p.ids.split("|").filter((i) => tutte[i]).map((i) => [i, tutte[i]])) };
  };
  const trovati = await opereDaWikidata("Jonathan Stroud", prendi);
  t.eq("da Wikidata: l'autore che scrive, i suoi libri, le saghe coi nomi", trovati.map((l) => `${l.titolo}:${l.saga || "—"}`).join("|"), "The Hollow Boy:Lockwood & Co.|Buried Fire:—");
  t.eq("…cinque domande", chieste.length, 5);
  let domande = 0;
  const nessuno = await opereDaWikidata("X", async (u) => (domande++, new URL(u).searchParams.get("action") === "wbsearchentities" ? { search: [{ id: "Q1" }] } : { entities: { Q1: { claims: {} } } }));
  t.c("senza un autore che scrive, niente, e le opere non si chiedono", nessuno.length === 0 && domande === 2);

  const st = memoria();
  chieste.length = 0;
  await opereDi("Jonathan Stroud", prendi, { st, ora: 1000 });
  const n = chieste.length;
  const ancora = await opereDi("Jonathan Stroud", prendi, { st, ora: 1000 + SCADENZA - 1 });
  t.c("dentro la settimana dalla memoria", chieste.length === n && ancora.length === 2);
  await opereDi("Jonathan Stroud", prendi, { st, ora: 1000 + SCADENZA + 1 });
  t.c("…dopo si richiede", chieste.length === 2 * n);
  st.setItem("bc_altri_autore", JSON.stringify({ "jonathan stroud": { quando: 1000, docs: [{ title: "Mroczny sobowtór" }] } }));
  chieste.length = 0;
  await opereDi("Jonathan Stroud", prendi, { st, ora: 1001 });
  t.c("la memoria di Open Library della versione di prima non vale: si richiede a Wikidata", chieste.length === n);
  st.setItem("bc_altri_autore", JSON.stringify({ "jonathan stroud": { quando: 1000, libri: [{ titolo: "Edgedancer" }] } }));
  chieste.length = 0;
  const rifatte = await opereDi("Jonathan Stroud", prendi, { st, ora: 1001 });
  t.c("…neanche quella di Wikidata scritta con la regola di prima (le novelle): si richiede", chieste.length === n && !rifatte.some((l) => l.titolo === "Edgedancer"));
}

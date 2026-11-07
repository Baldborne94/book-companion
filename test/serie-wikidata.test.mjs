// LA SAGA SU WIKIDATA (`lib/serieWikidata.js`): dai titoli della raccolta
// alla serie, e la serie scelta per i titoli che ha, non per il nome.
import {
  formeDelTitolo, titoliDellaRaccolta, titoliFraIMembri, serieDegli, serieCheCoprono, domandaMembri, cercaSerie, API_WIKIDATA, SERIE_MAX,
} from "../src/lib/serieWikidata.js";

const voce = (en, it, alias = []) => ({
  labels: { ...(en ? { en: { value: en } } : {}), ...(it ? { it: { value: it } } : {}) },
  aliases: alias.length ? { en: alias.map((value) => ({ value })) } : {},
});
const parte = (...ids) => ({ claims: { P179: ids.map((id) => ({ mainsnak: { datavalue: { value: { id } } } })) } });

// un Wikidata finto: risponde alle stesse domande dell'API vera
function wikidata({ cerca = {}, entita = {}, membri = {} }) {
  const chiesti = [];
  const prendi = async (url) => {
    const u = new URL(url);
    chiesti.push(u.searchParams.get("action"));
    if (!url.startsWith(API_WIKIDATA) || u.searchParams.get("origin") !== "*") throw new Error(`indirizzo storto ${url}`);
    const p = Object.fromEntries(u.searchParams);
    if (p.action === "wbsearchentities") return { search: (cerca[p.search] || []).map((id) => ({ id })) };
    if (p.action === "wbgetentities") return { entities: Object.fromEntries(p.ids.split("|").filter((id) => entita[id]).map((id) => [id, entita[id]])) };
    if (p.action === "query") {
      const q = /P179=(Q\d+)/.exec(p.srsearch)?.[1];
      return { query: { search: (membri[q] || []).map((title) => ({ title })) } };
    }
    throw new Error(p.action);
  };
  return { prendi, chiesti };
}

export default async function (t) {
  t.c("le forme di un titolo: intero, senza la coda fra parentesi, i due lati dei due punti, senza articolo e accenti", ["mistborn the final empire", "mistborn", "final empire"].every((f) => formeDelTitolo("Mistborn: The Final Empire (Book 1)").includes(f)) && formeDelTitolo("L'Età dell'Oro").includes("eta dell'oro"));
  t.eq("…niente forme di due lettere", formeDelTitolo("It").length, 0);
  t.eq("i titoli di una raccolta, una volta sola", titoliDellaRaccolta([{ title: "Horus Rising" }, { title: "horus  rising" }, { title: "" }, { title: "False Gods" }]).join("|"), "Horus Rising|False Gods");

  const membri = { Q1: voce("The Way of Kings", "La via dei re"), Q2: voce("Words of Radiance", null, ["Stormlight 2"]) };
  t.eq("un titolo combacia con l'etichetta inglese, quella italiana o un alias", titoliFraIMembri(membri, ["La via dei re", "Stormlight 2", "Elantris", "The Way of Kings (The Stormlight Archive Book 1)"]).join("|"), "La via dei re|Stormlight 2|The Way of Kings (The Stormlight Archive Book 1)");
  t.eq("le serie di cui sono parte gli elementi trovati", serieDegli({ A: parte("Q10", "Q11"), B: { claims: { P1434: [{ mainsnak: { datavalue: { value: { id: "Q12" } } } }], P361: [{ mainsnak: {} }] } }, C: parte("Q10") }).join("|"), "Q10|Q11|Q12");
  t.eq("i membri di una serie: parte della serie, dell'opera, dell'universo", domandaMembri("Q7"), "haswbstatement:P179=Q7|P361=Q7|P1434=Q7");

  // la scelta
  const stormlight = { id: "S", nome: "The Stormlight Archive", membri: 8, titoli: ["a", "b"] };
  const cosmere = { id: "C", nome: "Cosmere", membri: 16, titoli: ["a", "b"] };
  const mistborn = { id: "M", nome: "Mistborn", membri: 7, titoli: ["c"] };
  t.eq("vince la serie che copre piu' titoli, poi quelle che ne aggiungono", serieCheCoprono([{ ...cosmere, titoli: ["a"] }, stormlight, mistborn]).map((x) => x.id).join(), "S,M");
  t.eq("…a pari titoli la piu' stretta", serieCheCoprono([cosmere, stormlight]).map((x) => x.id).join(), "S");
  t.eq("…ma quella che si chiama come la raccolta prima", serieCheCoprono([stormlight, cosmere], { nome: "Il Cosmere" }).map((x) => x.id).join(), "C");
  t.eq("…una serie senza titoli nuovi non entra, e niente titoli niente serie", serieCheCoprono([stormlight, { ...cosmere, titoli: ["b"] }, { id: "Z", membri: 1, titoli: [] }]).map((x) => x.id).join() + "/" + serieCheCoprono([{ id: "Z", membri: 1, titoli: [] }]).length, "S/0");
  t.eq("…al piu' tre", serieCheCoprono("abcde".split("").map((x, i) => ({ id: x, membri: 1, titoli: [String(i)] }))).length, SERIE_MAX);

  // il giro intero, su un Wikidata finto
  const wd = wikidata({
    cerca: {
      "The Way of Kings": ["Q101", "Q102"],
      "Mistborn: The Final Empire": ["Q103"],
      Cosmoverse: [],
      Berserk: ["Q900"],
    },
    entita: {
      Q101: parte("Q201"),
      Q102: { claims: {} },
      Q103: parte("Q202"),
      Q201: voce("The Stormlight Archive", "Le Cronache della Folgoluce"),
      Q202: voce("Mistborn"),
      Q301: voce("The Way of Kings"),
      Q302: voce("Words of Radiance"),
      Q303: voce("Mistborn: The Final Empire", "L'ultimo impero"),
      Q304: voce("The Well of Ascension"),
    },
    membri: { Q201: ["Q301", "Q302"], Q202: ["Q303", "Q304"], Q900: ["Q901"] },
  });
  const trovate = await cercaSerie({ nome: "Cosmoverse", libri: [{ title: "The Way of Kings" }, { title: "Words of Radiance" }, { title: "Mistborn: The Final Empire" }] }, wd.prendi);
  t.eq("la «Cosmoverse» del lettore: le due serie dai titoli, non dal nome", JSON.stringify(trovate), JSON.stringify([
    { id: "Q201", nome: "Le Cronache della Folgoluce", membri: 2, combaciano: 2 },
    { id: "Q202", nome: "Mistborn", membri: 2, combaciano: 1 },
  ]));
  const film = wikidata({ cerca: { Berserk: ["Q900"] }, entita: { Q901: voce("Berserk (film)") }, membri: { Q900: ["Q901"] } });
  t.eq("un nome che Wikidata conosce, ma senza un titolo in comune, non e' la saga", await cercaSerie({ nome: "Berserk", libri: [{ title: "Berserk Deluxe Volume 1" }] }, film.prendi), null);
  const vuota = wikidata({});
  t.c("senza titoli non si chiede niente", (await cercaSerie({ nome: "X", libri: [] }, vuota.prendi)) === null && vuota.chiesti.length === 0);
  let rotto = false;
  try {
    await cercaSerie({ nome: "X", libri: [{ title: "Y" }] }, async () => {
      throw new Error("rete");
    });
  } catch {
    rotto = true;
  }
  t.c("un intoppo di rete sale a chi chiede (che non segna la saga come cercata)", rotto);
}

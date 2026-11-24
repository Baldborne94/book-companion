// THE REALM OF THE ELDERLINGS (`data/elderlings.js`): chiesta dal lettore
// con la foto delle saghe di Robin Hobb, «perché non mi raccoglie tutto
// sotto the realm of the elderlings?». Wikidata ha le cinque serie ma non
// il mondo che le tiene insieme: una guida, con le serie come cicli.
import { riconosci } from "../src/lib/sagaBooks.js";
import { guidaDalNome, sagaDalNome, saghePerAutore } from "../src/lib/sagaDaNome.js";
import { sagaPerLaGuida } from "../src/lib/senzaFile.js";
import { TAVOLE } from "../src/lib/sagaBooks.js";
import ELDERLINGS from "../src/data/elderlings.js";

const chi = (title, author) => {
  const r = riconosci({ title, author });
  return r ? `${r.saga} · ${r.sagaOrder} · ${r.ciclo}` : null;
};

export default async (t) => {
  t.eq("sedici romanzi, 1-16", ELDERLINGS.map((v) => v.o).join(","), Array.from({ length: 16 }, (_, i) => i + 1).join(","));
  const cicli = [...new Set(ELDERLINGS.map((v) => v.c))];
  t.eq("cinque serie, nell'ordine di uscita", cicli.join(" | "), "The Farseer Trilogy | Liveship Traders | The Tawny Man | The Rain Wilds Chronicles | Fitz and the Fool");
  t.eq("…di tre romanzi, tranne le Rain Wilds (quattro)", cicli.map((c) => ELDERLINGS.filter((v) => v.c === c).length).join(""), "33343");
  for (const v of ELDERLINGS) t.eq(`«${v.t}» si riconosce`, riconosci({ title: v.t, author: v.a })?.titolo, v.t);
  t.eq("la serie e' il ciclo", chi("Ship of Magic", "Robin Hobb"), "The Realm of the Elderlings · 4 · Liveship Traders");
  t.eq("il titolo italiano", chi("L'apprendista assassino", "Robin Hobb"), "The Realm of the Elderlings · 1 · The Farseer Trilogy");
  t.eq("il titolo italiano dei Rain Wilds", chi("Il custode del drago", "Robin Hobb"), "The Realm of the Elderlings · 10 · The Rain Wilds Chronicles");
  t.eq("…anche la meta' dell'edizione italiana spezzata", chi("La nave in fuga", "Robin Hobb"), "The Realm of the Elderlings · 4 · Liveship Traders");
  t.eq("col titolo come lo scrive lo scaffale", chi("The Golden Fool", "Robin Hobb"), "The Realm of the Elderlings · 8 · The Tawny Man");
  t.eq("«Dragon Keeper» di un altro autore no", chi("Dragon Keeper", "Joe Bloggs"), null);
  t.eq("la Soldier Son non e' degli Elderlings", chi("Shaman's Crossing", "Robin Hobb"), null);
  // per nome: la guida intera, o una sua serie
  t.eq("il mondo per nome", guidaDalNome("The Realm of the Elderlings")?.saga, "The Realm of the Elderlings");
  const lt = await sagaDalNome("Liveship Traders", { libri: [] });
  t.eq("una sua serie per nome: i suoi tre, col posto nel mondo", lt.volumi.map((v) => `${v.numero} ${v.titolo} (${v.serie})`).join(" | "), "4 Ship of Magic (Liveship Traders) | 5 The Mad Ship (Liveship Traders) | 6 Ship of Destiny (Liveship Traders)");
  t.eq("…sotto il mondo", lt.saga, "The Realm of the Elderlings");
  t.eq("«The Farseer Trilogy» com'e' su Wikidata", guidaDalNome("The Farseer Trilogy")?.parte, "The Farseer Trilogy");
  t.eq("«The Rain Wild Chronicles» com'e' su Wikidata", guidaDalNome("The Rain Wild Chronicles")?.parte, "The Rain Wilds Chronicles");
  // le saghe dell'autore: il mondo, e le sue serie su Wikidata non si ripetono
  const tipo = (...q) => q.map((id) => ({ mainsnak: { datavalue: { value: { id } } } }));
  const E = {
    Q1: { labels: { en: { value: "Robin Hobb" } }, claims: { P106: tipo("Q6625963") } },
    Q10: { labels: { en: { value: "Liveship Traders" } }, claims: { P31: tipo("Q13593966") } },
    Q11: { labels: { en: { value: "Soldier Son Trilogy" } }, claims: { P31: tipo("Q13593966") } },
    Q20: { labels: { en: { value: "Ship of Magic" } }, claims: { P31: tipo("Q7725634"), P50: tipo("Q1"), P179: [{ mainsnak: { datavalue: { value: { id: "Q10" } } }, qualifiers: { P1545: [{ datavalue: { value: "1" } }] } }] } },
    Q21: { labels: { en: { value: "Shaman's Crossing" } }, claims: { P31: tipo("Q7725634"), P50: tipo("Q1"), P179: [{ mainsnak: { datavalue: { value: { id: "Q11" } } }, qualifiers: { P1545: [{ datavalue: { value: "1" } }] } }] } },
  };
  const prendi = async (url) => {
    const q = new URL(url).searchParams;
    if (q.get("action") === "wbsearchentities") return { search: [{ id: "Q1" }] };
    if (q.get("action") === "query") return { query: { search: [{ title: "Q20" }, { title: "Q21" }] } };
    return { entities: Object.fromEntries(q.get("ids").split("|").filter((i) => E[i]).map((i) => [i, E[i]])) };
  };
  const hobb = await saghePerAutore("Robin Hobb", { prendi });
  t.eq("Robin Hobb: il mondo dalla guida, poi la Soldier Son", hobb.saghe.map((s) => `${s.fonte}:${s.nome}:${s.quanti}`).join(" | "), "guida:The Realm of the Elderlings:16 | wikidata:Soldier Son Trilogy:1");
  // dove finiscono le schede nuove: mai nella raccolta che si chiama come una serie
  const tav = TAVOLE.find((x) => x.saga === "The Realm of the Elderlings");
  const libro = (title, saga) => ({ title, author: "Robin Hobb", saga });
  t.eq("chi tiene i Liveship in «Liveship Traders» aggiunge il Farseer sotto il mondo", sagaPerLaGuida(tav, [libro("Ship of Magic", "Liveship Traders"), libro("The Mad Ship", "Liveship Traders")]), "The Realm of the Elderlings");
  const eis = TAVOLE.find((x) => x.saga === "Eisenhorn");
  t.eq("una serie semplice ha per ciclo il suo nome: la raccolta «Eisenhorn» resta la sua casa", sagaPerLaGuida(eis, [{ title: "Xenos", author: "Dan Abnett", saga: "Eisenhorn" }]), "Eisenhorn");
  t.eq("…ma una raccolta sua col suo nome si rispetta", sagaPerLaGuida(tav, [libro("Ship of Magic", "Hobb")]), "Hobb");
};

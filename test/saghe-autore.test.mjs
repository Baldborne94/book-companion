// LE SAGHE DI UN AUTORE (`saghePerAutore`, `guideDellAutore`,
// `serieDellAutore`, `libriDellaSaga` in `lib/sagaDaNome.js`): chiesto dal
// lettore, «permettimi la ricerca per autore così da sapere che saghe ha
// fatto, così le puoi aggiungere direttamente». Prima le guide dell'app in
// cui l'autore ha dei volumi, poi le serie di Wikidata, senza doppioni.
import { saghePerAutore, guideDellAutore, sceltaAutore, eLAutore, libriDellaSaga } from "../src/lib/sagaDaNome.js";
import HORUS from "../src/data/horusHeresy.js";

const tipo = (...q) => q.map((id) => ({ mainsnak: { datavalue: { value: { id } } } }));
const opera = (en, serie, n, { p31 = "Q7725634", forma = "Q8261" } = {}) => ({
  labels: { en: { value: en } },
  claims: {
    P31: tipo(p31),
    ...(forma ? { P7937: tipo(forma) } : {}),
    P50: tipo("Q1"),
    ...(serie ? { P179: [{ mainsnak: { datavalue: { value: { id: serie } } }, qualifiers: { P1545: [{ datavalue: { value: String(n) } }] } }] } : {}),
  },
});

export default async (t) => {
  // ── LE GUIDE ──────────────────────────────────────────────────────────
  t.eq("il nome si confronta a parole, anche solo il cognome", [eLAutore("Abnett", "Dan Abnett"), eLAutore("dan abnett", "Dan Abnett"), eLAutore("Dan Brown", "Dan Abnett")].join(), "true,true,false");
  const abnett = guideDellAutore("Dan Abnett").map((g) => g.saga);
  t.c("le guide di Abnett: Gaunt's Ghosts, Eisenhorn, Ravenor…", ["Gaunt's Ghosts", "Eisenhorn", "Ravenor"].every((s) => abnett.includes(s)), abnett.join(", "));
  t.c("…e l'Eresia, dove ne ha scritti", abnett.includes("The Horus Heresy"));
  // i racconti non sono libri: «N libri» conta i volumi che si prendono
  const suoiHH = HORUS.filter((v) => v.tipo !== "racconto" && v.a === "Dan Abnett").length;
  t.eq("nell'Eresia contano i suoi volumi, non i suoi racconti", guideDellAutore("Dan Abnett").find((g) => g.saga === "The Horus Heresy").quanti, suoiHH);
  t.eq("prima quella dove ne ha di piu'", abnett[0], "Gaunt's Ghosts");
  t.c("il Mondo Disco e' di Pratchett anche se la tavola non lo scrive", guideDellAutore("Terry Pratchett").some((g) => g.saga === "Discworld"));
  t.eq("un autore senza guide", guideDellAutore("Umberto Eco").length, 0);

  // ── WIKIDATA ──────────────────────────────────────────────────────────
  const E = {
    Q9: { claims: { P106: tipo("Q33999") } },
    Q1: { labels: { en: { value: "Jonathan Stroud" } }, claims: { P106: tipo("Q6625963") } },
    Q10: { labels: { en: { value: "Lockwood & Co." } }, claims: { P31: tipo("Q1667921") } },
    Q11: { labels: { en: { value: "Some Other Series" } }, claims: { P31: tipo("Q1667921") } },
    Q12: { labels: { en: { value: "An Universe" } }, claims: { P31: tipo("Q559618") } },
    Q21: opera("The Screaming Staircase", "Q10", 1),
    Q22: opera("The Whispering Skull", "Q10", 2),
    Q23: opera("A", "Q11", 1),
    Q24: opera("B", "Q11", 2),
    Q25: opera("C", "Q11", 3),
    Q26: opera("Mondo", "Q12", 1),
    Q27: opera("Un racconto", "Q11", 4, { forma: "Q49084" }),
    Q28: opera("Un'edizione", "Q11", 5, { p31: "Q3331189", forma: null }),
  };
  const prendi = async (url) => {
    const q = new URL(url).searchParams;
    if (q.get("action") === "wbsearchentities") return { search: [{ id: "Q9" }, { id: "Q1" }] };
    if (q.get("action") === "query" && /P50=Q1/.test(q.get("srsearch"))) return { query: { search: ["Q21", "Q22", "Q23", "Q24", "Q25", "Q26", "Q27", "Q28"].map((title) => ({ title })) } };
    if (q.get("action") === "query" && /P179=Q11/.test(q.get("srsearch"))) return { query: { search: ["Q23", "Q24", "Q25", "Q27", "Q28"].map((title) => ({ title })) } };
    return { entities: Object.fromEntries(q.get("ids").split("|").filter((i) => E[i]).map((i) => [i, E[i]])) };
  };
  t.eq("l'autore e' chi di mestiere scrive, non il primo omonimo", sceltaAutore(["Q9", "Q1"], E), "Q1");
  const r = await saghePerAutore("Jonathan Stroud", { prendi });
  t.eq("il nome dell'autore", r.autore, "Jonathan Stroud");
  const nomi = r.saghe.map((s) => `${s.fonte}:${s.nome}:${s.quanti}`);
  t.c("la guida di Lockwood, dall'app", nomi.includes("guida:Lockwood & Co.:5"), nomi.join(" | "));
  t.c("…e la stessa serie di Wikidata non si ripete", !nomi.some((n) => n.startsWith("wikidata:Lockwood")), nomi.join(" | "));
  t.c("la serie di Wikidata coi soli libri (niente racconto ne' edizione)", nomi.includes("wikidata:Some Other Series:3"), nomi.join(" | "));
  t.c("niente universi", !nomi.some((n) => /Universe/.test(n)), nomi.join(" | "));
  const altra = r.saghe.find((s) => s.nome === "Some Other Series");
  const libri = await libriDellaSaga(altra, { libri: [{ title: "B", author: "Jonathan Stroud" }], prendi });
  t.eq("toccata, i suoi libri in ordine", libri.volumi.map((v) => `${v.numero}${v.titolo}`).join(","), "1A,2B,3C");
  t.eq("…con quello che hai segnato", libri.volumi.filter((v) => v.gia).map((v) => v.titolo).join(), "B");
  const lw = await libriDellaSaga(r.saghe.find((s) => s.fonte === "guida" && s.saga === "Lockwood & Co."), { libri: [] });
  t.eq("la guida toccata: i libri della guida", `${lw.fonte} ${lw.volumi.length}`, "guida 5");
  t.eq("un autore che nessuno conosce", await saghePerAutore("Nessuno", { prendi: async () => ({ search: [] }) }), null);
};

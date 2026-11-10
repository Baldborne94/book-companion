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
  const tutte = guideDellAutore("Dan Abnett");
  t.eq("prima il suo mondo, se ha volumi in piu' guide dello stesso universo", `${tutte[0].universo} ${tutte[0].quanti > 30}`, "Warhammer 40K true");
  t.eq("un autore con una guida sola non ha un mondo", guideDellAutore("Jonathan Stroud").filter((g) => g.universo).length, 0);
  const abnett = tutte.filter((g) => !g.universo).map((g) => g.saga);
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
    // il Cosmere vero e' universo e serie di libri insieme
    Q12: { labels: { en: { value: "An Universe" } }, claims: { P31: [...tipo("Q559618"), ...tipo("Q277759")] } },
    Q21: opera("The Screaming Staircase", "Q10", 1),
    Q22: opera("The Whispering Skull", "Q10", 2),
    Q23: opera("A", "Q11", 1),
    Q24: opera("B", "Q11", 2),
    Q25: opera("C", "Q11", 3),
    Q26: opera("Mondo", "Q12", 1),
    Q27: opera("Un racconto", "Q11", 4, { forma: "Q49084" }),
    Q28: opera("Un'edizione", "Q11", 5, { p31: "Q3331189", forma: null }),
    Q13: { labels: { en: { value: "A TV Show" } }, claims: { P31: tipo("Q5398426") } },
    Q29: opera("Il romanzo dalla serie TV", "Q13", 1),
    // un volume dell'edizione spezzata francese: senza titolo in inglese o italiano
    Q41: { ...opera("", "Q11", 2), labels: { fr: { value: "Le volume" } } },
    Q40: (() => { const o = opera("Una novità", null); o.claims.P577 = [{ mainsnak: { datavalue: { value: { time: "+2025-03-01T00:00:00Z" } } } }]; return o; })(),
    Q42: opera("A", null),
    Q43: opera("The Hollow Boy", null),
    // senza numero in una serie numerata: l'elenco non lo mostra, e il conto nemmeno
    Q44: opera("Senza numero", "Q11"),
    Q45: opera("Una novità", null),
    Q47: opera("Some Other Series", null),
    Q14: { labels: { en: { value: "Empty Series" } }, claims: { P31: tipo("Q1667921") } },
    Q46: opera("Solo", "Q14"),
    // MAGNUS CHASE su Wikidata e' una «novel sequence», e la serie TV una
    // sottoclasse di «serie di opere creative»: i tipi si chiedono
    Q15: { labels: { en: { value: "A Novel Sequence" } }, claims: { P31: tipo("Q2005755") } },
    Q30: opera("Summer", "Q15", 1),
    Q31: opera("Thor", "Q15", 2),
    Q2005755: { labels: { en: { value: "novel sequence" } }, claims: {} },
    Q5398426: { labels: { en: { value: "television series" } }, claims: { P279: tipo("Q15416", "Q7725310") } },
  };
  const prendi = async (url) => {
    const q = new URL(url).searchParams;
    if (q.get("action") === "wbsearchentities") return { search: [{ id: "Q9" }, { id: "Q1" }] };
    if (q.get("action") === "query" && /P50=Q1/.test(q.get("srsearch"))) return { query: { search: ["Q21", "Q22", "Q23", "Q24", "Q25", "Q26", "Q27", "Q28", "Q29", "Q40", "Q41", "Q42", "Q43", "Q44", "Q45", "Q46", "Q47", "Q30", "Q31"].map((title) => ({ title })) } };
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
  t.c("una serie di romanzi che Wikidata chiama «novel sequence» (Magnus Chase di Riordan)", nomi.includes("wikidata:A Novel Sequence:2"), nomi.join(" | "));
  t.c("il conto e' quello dell'elenco: un volume senza titolo leggibile non conta (i «13 libri» dei Liveship Traders)", nomi.includes("wikidata:Some Other Series:3"), nomi.join(" | "));
  const altri = r.saghe.find((s) => s.fonte === "sciolti");
  t.eq(
    "gli altri suoi libri, fuori da ogni serie dell'elenco, per anno (senza anno in fondo): non la serie scritta come un libro, non i doppioni di un volume, non quelli che una guida conosce",
    altri?.volumi.map((v) => v.titolo).join(" | "),
    "Una novità | Il romanzo dalla serie TV | Mondo | Solo"
  );
  t.c("una serie che nell'elenco non avrebbe libri non si mostra", !nomi.some((n) => /Empty Series/.test(n)), nomi.join(" | "));
  t.eq("…ultimi nell'elenco, col conto", `${r.saghe.at(-1).nome} ${r.saghe.at(-1).quanti}`, "Altri libri 4");
  const sciolti = await libriDellaSaga(altri, { libri: [{ title: "Mondo", author: "Jonathan Stroud" }], prendi });
  t.eq("toccati, senza raccolta e col loro autore", sciolti.volumi.map((v) => `${v.titolo}:${v.autore}:${v.saga}:${v.gia}`).join(" | "), "Una novità:Jonathan Stroud::false | Il romanzo dalla serie TV:Jonathan Stroud::false | Mondo:Jonathan Stroud::true | Solo:Jonathan Stroud::false");
  t.c("niente serie TV (il «Doctor Who» di Abnett: toccato, nessun libro)", !nomi.some((n) => /TV Show/.test(n)), nomi.join(" | "));
  const altra = r.saghe.find((s) => s.nome === "Some Other Series");
  const libri = await libriDellaSaga(altra, { libri: [{ title: "B", author: "Jonathan Stroud" }], prendi });
  t.eq("toccata, i suoi libri in ordine", libri.volumi.map((v) => `${v.numero}${v.titolo}`).join(","), "1A,2B,3C");
  t.eq("…con quello che hai segnato", libri.volumi.filter((v) => v.gia).map((v) => v.titolo).join(), "B");
  const lw = await libriDellaSaga(r.saghe.find((s) => s.fonte === "guida" && s.saga === "Lockwood & Co."), { libri: [] });
  t.eq("la guida toccata: i libri della guida", `${lw.fonte} ${lw.volumi.filter((v) => !v.novella).length}`, "guida 5");
  t.eq("un autore che nessuno conosce", await saghePerAutore("Nessuno", { prendi: async () => ({ search: [] }) }), null);
};

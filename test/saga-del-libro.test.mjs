// DI CHE SAGA E' UN LIBRO, FRA LE RACCOLTE CHE HAI (`lib/sagaDelLibro.js`):
// chiesto dal lettore, «se cerco un libro riesci a riconoscermi a quale
// saga appartiene di quelle che ho già creato?». Prima senza rete (guida,
// titolo, gli altri libri dell'autore), poi la serie di Wikidata e la
// raccolta che la tiene; si propone e basta.
import { sagaDaQui, raccolteDellAutore, sagaDelLibro, fraseSagaDelLibro } from "../src/lib/sagaDelLibro.js";

const tipo = (...q) => q.map((id) => ({ mainsnak: { datavalue: { value: { id } } } }));
const legame = (serie, n) => ({ mainsnak: { datavalue: { value: { id: serie } } }, ...(n != null ? { qualifiers: { P1545: [{ datavalue: { value: String(n) } }] } } : {}) });
const libro = (en, serie = [], { p31 = "Q7725634", forma = "Q8261", autore = "Q1" } = {}) => ({
  labels: { en: { value: en } },
  claims: { P31: tipo(p31), ...(forma ? { P7937: tipo(forma) } : {}), P50: tipo(autore), P179: serie.map(([q, n]) => legame(q, n)) },
});

export default async (t) => {
  // ── SENZA RETE ────────────────────────────────────────────────────────
  const scaffale = [
    { id: "1", title: "Xenos", author: "Dan Abnett", saga: "Warhammer 40K", series: "Eisenhorn", sagaOrder: 1 },
    { id: "2", title: "Horus Rising", author: "Dan Abnett", saga: "Warhammer 40K", series: "The Horus Heresy" },
    { id: "3", title: "Tigana", author: "Guy Gavriel Kay", saga: "Fionavar" },
    { id: "4", title: "The Summer Tree", author: "Guy Gavriel Kay", saga: "Fionavar" },
    { id: "5", title: "Elantris", author: "Brandon Sanderson", saga: "Cosmoverse" },
    { id: "6", title: "Skyward", author: "Brandon Sanderson", saga: "Skyward" },
    { id: "7", title: "Steelheart", author: "Brandon Sanderson", saga: "Sanderson ragazzi", series: "Reckoners" },
  ];
  const m = sagaDaQui({ titolo: "Malleus", autore: "Dan Abnett" }, scaffale);
  t.eq(
    "la guida, ma nella raccolta che usi per lo stesso universo (non una raccolta «Eisenhorn» nuova), col posto del cammino",
    `${m?.fonte} ${m?.saga} | ${m?.serie} | ${m?.numero}`,
    "guida Warhammer 40K | Eisenhorn | 2"
  );
  t.c("…e lo dice", /guida di Eisenhorn.*«Warhammer 40K», Eisenhorn, n° 2/.test(fraseSagaDelLibro(m)), fraseSagaDelLibro(m));
  const tit = sagaDaQui({ titolo: "Hyperion (Hyperion Cantos 1)", autore: "Dan Simmons" }, scaffale);
  t.eq("il titolo che dice la saga", `${tit?.fonte} ${tit?.saga} ${tit?.numero}`, "titolo Hyperion Cantos 1");
  const kay = sagaDaQui({ titolo: "The Wandering Fire", autore: "Guy Gavriel Kay" }, scaffale);
  t.eq("gli altri libri dell'autore stanno tutti in una raccolta", `${kay?.fonte} ${kay?.saga}`, "autore Fionavar");
  t.c("…e lo dice col suo nome", /libri di Guy Gavriel Kay.*«Fionavar»/.test(fraseSagaDelLibro(kay, "Guy Gavriel Kay")), fraseSagaDelLibro(kay, "Guy Gavriel Kay"));
  t.eq("in piu' raccolte la deduzione tace", sagaDaQui({ titolo: "The Rithmatist", autore: "Brandon Sanderson" }, scaffale), null);
  t.eq("senza titolo niente", sagaDaQui({ titolo: "  " }, scaffale), null);
  // …e allora le sue raccolte si scelgono a mano, anche dal solo cognome
  t.eq(
    "le raccolte dell'autore, la piu' piena prima",
    raccolteDellAutore("Sanderson", [...scaffale, { title: "Mistborn", author: "Brandon Sanderson", saga: "Cosmoverse" }]).map((r) => `${r.saga}:${r.quanti}`).join(" "),
    "Cosmoverse:2 Sanderson ragazzi:1 Skyward:1"
  );
  t.eq("un autore senza raccolte", raccolteDellAutore("Umberto Eco", scaffale).length, 0);
  t.eq("nessun autore scritto, nessuna raccolta", raccolteDellAutore("", scaffale).length, 0);

  // ── SU WIKIDATA ───────────────────────────────────────────────────────
  const E = {
    Q1: { labels: { en: { value: "Brandon Sanderson" } } },
    Q2: { labels: { en: { value: "Someone Else" } } },
    Q200: { labels: { en: { value: "Skyward series" } }, claims: { P31: tipo("Q277759") } },
    Q201: { labels: { en: { value: "The Epics" } }, claims: { P31: tipo("Q1667921") } },
    Q202: { labels: { en: { value: "A New Series" } }, claims: { P31: tipo("Q1667921") } },
    // il Cosmere vero e' universo e serie di libri insieme
    Q203: { labels: { en: { value: "Cosmere" } }, claims: { P31: tipo("Q559618", "Q277759") } },
    Q204: { labels: { en: { value: "A TV Show" } }, claims: { P31: tipo("Q5398426") } },
    Q205: { labels: { en: { value: "Reckoners" } }, claims: { P31: tipo("Q1667921") } },
    // l'universo prima nei dati: la serie si guarda comunque per prima
    Q100: libro("Starsight", [["Q203", null], ["Q200", 2]]),
    Q101: libro("Firefight", [["Q201", 2]]),
    Q111: libro("Steelheart", [["Q201", 1]]),
    Q102: libro("Lonely Book", [["Q202", 3]]),
    Q103: libro("Universe Book", [["Q203", null]]),
    Q113: libro("Elantris", [["Q203", null]]),
    Q104: libro("Tie-in", [["Q204", 1]]),
    // la novella col titolo del romanzo: un'opera letteraria, ma non un volume
    Q105: libro("Firefight", [["Q202", 2]], { forma: "Q49084" }),
    Q106: libro("Calamity", [["Q205", 3]]),
    Q206: { labels: { en: { value: "Mistborn" } }, claims: { P31: tipo("Q1667921") } },
    Q107: libro("Secret History", [["Q206", null]]),
  };
  const ricerche = { Starsight: ["Q100"], Firefight: ["Q105", "Q101"], "Lonely Book": ["Q102"], "Universe Book": ["Q103"], "Tie-in": ["Q104"], Calamity: ["Q106"], "Secret History": ["Q107"] };
  const membri = { Q201: ["Q101", "Q111"], Q203: ["Q103", "Q113"] };
  let domande = 0;
  const prendi = async (url) => {
    domande += 1;
    const q = new URL(url).searchParams;
    if (q.get("action") === "wbsearchentities") return { search: (ricerche[q.get("search")] || []).map((id) => ({ id })) };
    if (q.get("action") === "query") return { query: { search: (membri[q.get("srsearch").split("=")[1]] || []).map((title) => ({ title })) } };
    return { entities: Object.fromEntries(q.get("ids").split("|").filter((i) => E[i]).map((i) => [i, E[i]])) };
  };
  const s = await sagaDelLibro({ titolo: "Starsight", autore: "Brandon Sanderson" }, scaffale, { prendi });
  t.eq("la raccolta che si chiama come la serie (senza «series»), col numero della serie", `${s?.saga} ${s?.numero} ${s?.come}`, "Skyward 2 nome");
  t.c("…e lo dice", /serie «Skyward series»: la tieni in «Skyward», n° 2/.test(fraseSagaDelLibro(s)), fraseSagaDelLibro(s));
  const f = await sagaDelLibro({ titolo: "Firefight", autore: "Sanderson" }, scaffale, { prendi });
  t.eq(
    "una novella non e' il libro; la serie si trova dai libri che hai gia' (Steelheart), col ciclo che gli hai dato",
    `${f?.saga} | ${f?.serie} | ${f?.numero} | ${f?.come}`,
    "Sanderson ragazzi | Reckoners | null | fratelli"
  );
  t.c("…e lo dice", /serie «The Epics», e gli altri libri di quella serie li tieni in «Sanderson ragazzi», Reckoners/.test(fraseSagaDelLibro(f)), fraseSagaDelLibro(f));
  const c = await sagaDelLibro({ titolo: "Calamity", autore: "Sanderson" }, scaffale, { prendi });
  t.eq("la serie scritta come ciclo di una raccolta", `${c?.saga} | ${c?.serie} | ${c?.come}`, "Sanderson ragazzi | Reckoners | ciclo");
  const u = await sagaDelLibro({ titolo: "Universe Book", autore: "Sanderson" }, scaffale, { prendi });
  t.eq("un universo serve a trovare la raccolta (il Cosmere e' un mondo di guide, e Elantris sta in «Cosmoverse»)", `${u?.saga} ${u?.come}`, "Cosmoverse guida");
  const g = await sagaDelLibro({ titolo: "Secret History", autore: "Sanderson" }, [...scaffale, { title: "The Final Empire", author: "Brandon Sanderson", saga: "Cosmoverse" }], { prendi });
  t.eq("una serie che ha la sua guida va dove tieni i libri di quella guida", `${g?.saga} ${g?.come}`, "Cosmoverse guida");
  // (senza Elantris: e' del Cosmere, e porterebbe la raccolta del Cosmere)
  const g0 = await sagaDelLibro({ titolo: "Secret History", autore: "Sanderson" }, scaffale.filter((b) => b.title !== "Elantris"), { prendi });
  t.eq("…solo se quella raccolta ce l'hai: se no e' una raccolta nuova, detta", `${g0?.saga} ${g0?.nuova}`, "Mistborn true");
  t.eq("…ma non e' mai una raccolta nuova", await sagaDelLibro({ titolo: "Universe Book", autore: "Sanderson" }, [], { prendi }), null);
  const n = await sagaDelLibro({ titolo: "Lonely Book", autore: "Sanderson" }, scaffale, { prendi });
  t.eq("una serie che nessuna raccolta tiene: raccolta nuova, detta", `${n?.saga} ${n?.numero} ${n?.nuova}`, "A New Series 3 true");
  t.c("…e lo dice", /non c'è: la propongo come raccolta nuova, n° 3/.test(fraseSagaDelLibro(n)), fraseSagaDelLibro(n));
  t.eq("una serie TV non e' una serie di libri", await sagaDelLibro({ titolo: "Tie-in", autore: "Sanderson" }, scaffale, { prendi }), null);
  t.eq("il libro di un altro autore con lo stesso titolo no", await sagaDelLibro({ titolo: "Lonely Book", autore: "Someone Else" }, scaffale, { prendi }), null);
  t.eq("senza autore scritto si prende il libro", (await sagaDelLibro({ titolo: "Lonely Book" }, scaffale, { prendi }))?.saga, "A New Series");
  domande = 0;
  await sagaDelLibro({ titolo: "Malleus", autore: "Dan Abnett" }, scaffale, { prendi });
  t.eq("quel che si sa qui non chiede niente a Wikidata", domande, 0);
  t.c("non riconosciuto, si dice", /Non l'ho riconosciuto/.test(fraseSagaDelLibro(null)));
};

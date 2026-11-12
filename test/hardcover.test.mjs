// LE SERIE DA HARDCOVER (`lib/hardcover.js`): chiesto dal lettore, «siti
// affidabili dove vedere la lista completa delle serie ce l'abbiamo?», poi
// «sì, aggiungi hardcover». I casi sono quelli veri del 10 novembre 2026:
// The Bound and the Broken (novelle a numeri frazionari, il quinto
// annunciato, la traduzione polacca alla posizione 1), le ventidue serie di
// Riordan (traduzioni, l'universo, le edizioni spezzate), «Magnus Chase»
// cercato col nome corto.
import {
  chiaveNuda, chiaveHardcover, salvaChiaveHardcover, domandaHardcover, ChiaveRifiutata, volumiDaHardcover,
  sceltaSerieHC, sceltaAutoreHC, serieCheValgono, serieHardcover, serieDellAutoreHC, fraseHardcover, HARDCOVER,
  sceltaCopertinaHC, copertinaHardcover, PASSO_MS, NON_CE_MS, autoreDi,
} from "../src/lib/hardcover.js";
import { sagaDalNome, saghePerAutore } from "../src/lib/sagaDaNome.js";
import { pulisci } from "../src/lib/registro.js";

const lingua = (code3) => (code3 ? { default_physical_edition: { language: { code3 } } } : {});
const legame = (position, id, title, { anno = 2021, data = `${anno}-03-01`, lettori = 100, autore = "Ryan  Cahill", lang = "eng" } = {}) => ({
  position,
  book: { id, title, release_year: anno, release_date: data, users_count: lettori, contributions: [{ author: { name: autore } }], ...lingua(lang) },
});
const BOUND = [
  legame(0.5, 1, "The Fall", { anno: 2020 }),
  legame(1, 2, "Of Blood and Fire", { lettori: 1149 }),
  legame(1, 3, "Z krwi i ognia", { lettori: 0, autore: "Wiesław Marcysiak", lang: "pol" }),
  legame(2, 4, "Of Darkness and Light"),
  legame(2.5, 5, "The Exile", { anno: 2022 }),
  legame(3, 6, "Of War and Ruin", { anno: 2023 }),
  legame(4, 7, "Of Empires and Dust", { anno: 2025, lettori: 176 }),
  legame(4, 8, "Of Empires and Dust", { anno: 2025, lettori: 1 }),
  legame(5, 9, "Of Gods and Ashes", { anno: 2028, data: "2028-01-01" }),
];

export default async (t) => {
  // ── LA CHIAVE ─────────────────────────────────────────────────────────
  t.eq("la chiave si incolla anche col «Bearer » che la pagina mostra", chiaveNuda("  Bearer hc_pat_abc "), "hc_pat_abc");
  const st = new Map();
  const finto = { getItem: (k) => st.get(k) ?? null, setItem: (k, v) => st.set(k, v), removeItem: (k) => st.delete(k) };
  salvaChiaveHardcover("Bearer hc_pat_xyz", finto);
  t.eq("si salva nuda, sul dispositivo", chiaveHardcover(finto), "hc_pat_xyz");
  salvaChiaveHardcover("", finto);
  t.eq("…e si toglie", chiaveHardcover(finto), "");
  t.eq("nel rapporto dei guasti la chiave non compare", pulisci("errore con hc_pat_qss2C2pXv8nD dentro"), "errore con [chiave] dentro");

  // ── LA DOMANDA ────────────────────────────────────────────────────────
  const risposta = (status, corpo, intestazioni = {}) => ({ ok: status < 300, status, json: async () => corpo, headers: { get: (k) => intestazioni[k] ?? null } });
  let mandata = null;
  await domandaHardcover("Bearer hc_pat_1", async (url, opz) => ((mandata = { url, opz }), risposta(200, { data: { ok: 1 } })))("{ ok }");
  t.eq("all'API di Hardcover, con la chiave una volta sola dopo «Bearer»", `${mandata.url} ${mandata.opz.headers.authorization}`, `${HARDCOVER} Bearer hc_pat_1`);
  const rifiuto = async (r) => domandaHardcover("k", async () => r)("{ ok }").then(() => "passata", (e) => (e instanceof ChiaveRifiutata ? "chiave" : `guasto: ${e.message}`));
  t.eq("un token che non e' di nessuno e' la chiave", await rifiuto(risposta(200, { error: "invalid_token", error_description: "Token is not associated with a user" })), "chiave");
  t.eq("…e anche il formato sbagliato", await rifiuto(risposta(400, { error: "invalid_request", error_description: "Invalid Authorization format. Use 'Bearer <token>'" })), "chiave");
  t.eq("un 500 e' un guasto, non la chiave", await rifiuto(risposta(500, null)), "guasto: Hardcover 500");
  let giri = 0;
  const attese = [];
  const dopo429 = await domandaHardcover("k", async () => (++giri < 3 ? risposta(429, null, { "retry-after": "3" }) : risposta(200, { data: { ok: 1 } })), { aspetta: async (ms) => attese.push(ms) })("{ ok }");
  t.eq("troppe domande: si aspetta quanto dice e si riprova", `${dopo429.ok} ${giri} ${attese.join(",")}`, "1 3 3000,3000");
  giri = 0;
  t.c("…ma non per sempre", (await rifiuto({ ...risposta(429, null), headers: { get: () => null } }).catch(() => "")) !== "passata");

  // ── I VOLUMI DI UNA SERIE ─────────────────────────────────────────────
  const v = volumiDaHardcover(BOUND, { oggi: "2026-11-10" });
  t.eq("uno per numero, in ordine, le storie di mezzo al loro posto", v.map((x) => `${x.numero} ${x.titolo}`).join(" | "), "0.5 The Fall | 1 Of Blood and Fire | 2 Of Darkness and Light | 2.5 The Exile | 3 Of War and Ruin | 4 Of Empires and Dust | 5 Of Gods and Ashes");
  // il lettore: «non mi consideri anche le storie di intramezzo delle serie?»
  t.eq("…segnate come storie di mezzo: i numeri a meta'", v.filter((x) => x.novella).map((x) => x.titolo).join(), "The Fall,The Exile");
  t.eq("…e anche lo zero", volumiDaHardcover([legame(0, 1, "A Ghost Return"), legame(1, 2, "First and Only")]).map((x) => `${x.numero}${x.novella ? "s" : "r"}`).join(), "0s,1r");
  t.eq("…col nome dell'autore senza i doppi spazi, non quello del traduttore", v[0].autore, "Ryan Cahill");
  t.eq("quello non ancora uscito e' annunciato", v.filter((x) => x.annunciato).map((x) => x.titolo).join(), "Of Gods and Ashes");
  t.eq("…anche senza data", volumiDaHardcover([{ position: 1, book: { id: 1, title: "Forse", users_count: 1 } }])[0].annunciato, true);
  // dalla biblioteca del lettore (12 novembre): il narratore e l'illustratore
  // davanti all'autore facevano l'«autore» della scheda, e un doppione
  const contributi = (...c) => ({ position: 1, book: { id: 1, title: "Pile of Bones", users_count: 71, contributions: c.map(([ruolo, name]) => ({ contribution: ruolo, author: { name } })) } });
  t.eq("il narratore non è l'autore", volumiDaHardcover([contributi(["Narrator", "Tim Gerard Reynolds"], ["Author", "Michael J. Sullivan"])])[0].autore, "Michael J. Sullivan");
  t.eq("l'illustratore nemmeno", autoreDi([{ contribution: "Illustrator", author: { name: "Larry Elmore" } }, { contribution: null, author: { name: "R. A.  Salvatore" } }]), "R. A. Salvatore");
  t.eq("senza un autore fra i contributi, nessun autore (non chi ha fatto la copertina)", autoreDi([{ contribution: "Cover Artist", author: { name: "Chris McGrath" } }]), "");
  // UN NUMERO A META' E' SPESSO UN ROMANZO SPEZZATO, NON UNA STORIA (la
  // Ruota a 1.1 «Part 1 of 2», Malazan «Том 1», gli Elderlings «Split»)
  const misto = volumiDaHardcover([
    legame(1, 1, "The Eye of the World", { lettori: 900 }),
    legame(1.1, 2, "The Eye of the World, Part 1 of 2: From The Two Rivers", { lettori: 300 }),
    legame(1.2, 3, "Assassin's Apprentice (Split Edition), Part 2 of 2", { lettori: 50 }),
    legame(3.1, 4, "Память льда. Том 1", { lettori: 20, lang: "" }),
    legame(3.2, 5, "Wspomnienie lodu", { lettori: 0, lang: "" }),
    legame(0.5, 6, "La principessa testarda e il principe pezzato", { lettori: 3, lang: "" }),
    legame(0.5, 7, "The Wilful Princess and the Piebald Prince", { lettori: 300 }),
    legame(0, 8, "In Remembrance", { lettori: 15 }),
    legame(0, 9, "Born Unto Us", { lettori: 9 }),
    legame(0.6, 10, "The Narrow Road Between Desires", { lettori: 672 }),
    legame(2.6, 11, "The Narrow Road Between Desires: Kingkiller Chronicle", { lettori: 4 }),
    legame(2.5, 12, "La música del silencio", { lettori: 40, lang: "spa" }),
    legame(4.2, 13, "The Eye of the World: The Graphic Novel", { lettori: 30 }),
    legame(7.5, 14, "Буря Жнеца", { lettori: 5, lang: "" }),
    legame(1.4, 15, "The Eye of the World: The Illustrated Edition", { lettori: 20 }),
  ]);
  t.eq(
    "le storie di mezzo vere: non le edizioni divise, non le traduzioni, non il titolo del romanzo, una volta sola",
    misto.filter((x) => x.novella).map((x) => `${x.numero} ${x.titolo}`).join(" | "),
    "0 Born Unto Us | 0 In Remembrance | 0.5 The Wilful Princess and the Piebald Prince | 0.6 The Narrow Road Between Desires"
  );
  const tradotto = volumiDaHardcover([legame(1, 1, "Prastarý meč", { lettori: 50, lang: "ces" }), legame(1, 2, "The Sword of Summer", { lettori: 40 })]);
  t.eq("l'inglese prima della traduzione, anche se ha meno lettori", tradotto[0].titolo, "The Sword of Summer");

  // ── QUALE SERIE, QUALE AUTORE ─────────────────────────────────────────
  const hits = [
    { document: { id: "1", name: "Magnus Chase a bohové Ásgardu", readers_count: 2 } },
    { document: { id: "2", name: "Magnus Chase and the Gods of Asgard", readers_count: 2729 } },
    { document: { id: "3", name: "Bloodsworn", readers_count: 0 } },
  ];
  t.eq("il nome corto: la serie che ha tutte le parole cercate, la piu' letta", sceltaSerieHC(hits, "Magnus Chase")?.id, "2");
  t.eq("il nome esatto vince anche con meno lettori", sceltaSerieHC([...hits, { document: { id: "4", name: "Magnus Chase", readers_count: 1 } }], "Magnus Chase")?.id, "4");
  t.eq("…anche senza «series»", sceltaSerieHC([{ document: { id: "5", name: "Skyward", readers_count: 1 } }], "skyward series")?.id, "5");
  t.eq("nessuna col nome, nessuna serie", sceltaSerieHC(hits, "Wheel of Time"), null);
  t.eq("l'autore anche dal cognome, quello con piu' libri", sceltaAutoreHC([{ document: { id: "9", name: "Ryan  Cahill", books_count: 3 } }, { document: { id: "8", name: "Ryan  Cahill", books_count: 12 } }, { document: { id: "7", name: "Ryan Smith", books_count: 99 } }], "Cahill")?.id, "8");

  // ── LE SERIE DI UN AUTORE CHE VALGONO ─────────────────────────────────
  const libro = (id, lettori = 100, lang = "eng") => ({ id, titolo: `L${id}`, numero: id, lettori, lingua: lang, annunciato: false });
  const tutte = [
    { q: 9839, nome: "Camp Half-Blood Chronicles", volumi: [1, 2, 3, 6, 7, 11, 12].map((i) => libro(i, 5000)) },
    { q: 5193, nome: "Percy Jackson and the Olympians", volumi: [1, 2, 3, 4].map((i) => libro(i, 3000)) },
    { q: 164368, nome: "Percy Jackson and the Olympians: The Senior Year Adventures", volumi: [4, 5].map((i) => libro(i, 500)) },
    { q: 5670, nome: "The Heroes of Olympus", volumi: [6, 7].map((i) => libro(i, 2000)) },
    { q: 1588, nome: "The Trials of Apollo", volumi: [11, 12].map((i) => libro(i, 2000)) },
    { q: 260530, nome: "Magnus Chase ve Asgard Tanrıları", volumi: [libro(20, 0, "tur")] },
    { q: 300, nome: "Les cités des Anciens", volumi: [libro(30, 200, "fre"), libro(31, 200, "fre")] },
    { q: 301, nome: "The Tawny Man (French Split)", volumi: [libro(40, 300)] },
    { q: 302, nome: "Camp Half-Blood Chronicles: The Graphic Novels", volumi: [libro(50, 491)] },
    { q: 303, nome: "Coleccionable Percy Jackson", volumi: [libro(60, 4)] },
    { q: 8088, nome: "Tres Navarre", volumi: [libro(70, 156)] },
    { q: 304, nome: "Vuota", volumi: [] },
  ];
  const nomi = serieCheValgono(tutte).map((s) => s.nome);
  t.c("l'universo che contiene le altre resta fuori", !nomi.includes("Camp Half-Blood Chronicles"), nomi.join(" | "));
  t.c("…ma Percy Jackson, che divide i suoi libri con l'universo e coi suoi seguiti, resta", nomi.includes("Percy Jackson and the Olympians") && nomi.includes("Percy Jackson and the Olympians: The Senior Year Adventures"), nomi.join(" | "));
  t.c("le traduzioni no: per lingua o per lettori", !nomi.some((n) => /Tanrıları|Anciens|Coleccionable/.test(n)), nomi.join(" | "));
  t.c("le edizioni spezzate e i fumetti no", !nomi.some((n) => /Split|Graphic/.test(n)), nomi.join(" | "));
  t.c("una serie vera con pochi lettori si' (Tres Navarre, 156)", nomi.includes("Tres Navarre"), nomi.join(" | "));
  t.c("una serie senza romanzi no", !nomi.includes("Vuota"));
  t.eq("la piu' letta prima", nomi[0], "Percy Jackson and the Olympians");
  t.eq("se nessuna ha lettori, la piu' letta resta", serieCheValgono([{ q: 1, nome: "Piccola", volumi: [libro(1, 3)] }, { q: 2, nome: "Piccolissima", volumi: [libro(2, 1)] }]).map((s) => s.nome).join(), "Piccola");

  // ── LE DOMANDE INTERE ─────────────────────────────────────────────────
  const domande = [];
  const chiedi = async (query, vars) => {
    domande.push(query.match(/search|series_by_pk|books\(|series\(/)[0]);
    if (/query_type: "Series"/.test(query)) return { search: { results: { hits: vars.q === "the bound and the broken" ? [{ document: { id: "4979", name: "The Bound and the Broken", readers_count: 1006 } }] : vars.q === "serie finta" ? [{ document: { id: "4980", name: "Serie Finta", readers_count: 5 } }] : [] } } };
    if (/query_type: "Author"/.test(query)) return { search: { results: { hits: [{ document: { id: "254520", name: "Ryan  Cahill", books_count: 12 } }] } } };
    if (/series_by_pk/.test(query)) return { series_by_pk: { id: 4979, name: "The Bound and the Broken", book_series: BOUND } };
    if (/books\(/.test(query)) return { books: [{ book_series: [{ series: { id: 4979 } }] }] };
    return { series: [{ id: 4979, name: "The Bound and the Broken", book_series: BOUND }] };
  };
  const bb = await serieHardcover("the bound and the broken", chiedi);
  t.eq("una serie per nome: due domande, il nome di Hardcover, nella sua raccolta", `${domande.join(",")} | ${bb.fonte} ${bb.nome} ${bb.saga} ${bb.volumi.length}`, "search,series_by_pk | hardcover The Bound and the Broken The Bound and the Broken 7");
  t.eq("…ogni volume nella raccolta della serie, col suo numero, la storia di mezzo segnata", `${bb.volumi[1].saga} ${bb.volumi[1].numero} ${bb.volumi[1].serie === ""} ${bb.volumi[0].novella}`, "The Bound and the Broken 1 true true");
  t.eq("un nome che Hardcover non ha", await serieHardcover("niente", chiedi), null);
  domande.length = 0;
  const cahill = await serieDellAutoreHC("Ryan Cahill", chiedi);
  t.eq("le serie di un autore: le sue serie e quelle dei suoi libri (che qui sono le stesse: niente domanda in piu'), col conto dell'elenco", `${domande.join(",")} | ${cahill.autore}: ${cahill.serie.map((s) => `${s.nome} · ${s.quanti} + ${s.storie}`).join()}`, "search,series(,books( | Ryan Cahill: The Bound and the Broken · 5 + 2");

  // ── LE SERIE DEI SUOI LIBRI ───────────────────────────────────────────
  // il lettore: «l'aggiungi senza file vale anche per manga e fumetti?».
  // Hardcover lega «One Piece» a un altro «Eiichiro Oda» della sua anagrafe:
  // fra le serie di Oda c'erano i quiz e gli artbook, e One Piece no
  {
    const op = (n, autore = "Eiichiro Oda") => legame(n, 100 + n, `One Piece, Vol. ${n}`, { autore });
    const chiesti = [];
    const oda = async (query, vars) => {
      if (/query_type: "Author"/.test(query)) return { search: { results: { hits: [{ document: { id: "109411", name: "Eiichiro Oda", books_count: 198 } }] } } };
      if (/books\(/.test(query)) return { books: [{ book_series: [{ series: { id: 4624 } }, { series: { id: 150021 } }] }, { book_series: [{ series: { id: 777 } }] }] };
      if (/_in: \$ids/.test(query)) {
        chiesti.push(...vars.ids);
        return { series: [
          { id: 4624, name: "One Piece", book_series: [op(1), op(2), op(3)] },
          // un'antologia di altri dove c'e' anche lui: non e' sua
          { id: 777, name: "Shonen Jump Anthology", book_series: [legame(1, 201, "Antologia 1", { autore: "Masashi Kishimoto" }), legame(2, 202, "Antologia 2", { autore: "Akira Toriyama" }), legame(3, 203, "Antologia 3", { autore: "Eiichiro Oda" })] },
        ] };
      }
      return { series: [{ id: 150021, name: "One Piece Color Walk Compendiums", book_series: [legame(1, 301, "Color Walk Compendium", { autore: "Eiichiro Oda" })] }] };
    };
    const r = await serieDellAutoreHC("Eiichiro Oda", oda);
    t.c("One Piece arriva dai suoi libri", r.serie.some((x) => x.nome === "One Piece" && x.quanti === 3), r.serie.map((x) => x.nome).join(" | "));
    t.c("…e la serie che c'era gia' resta", r.serie.some((x) => x.nome === "One Piece Color Walk Compendiums"));
    t.c("l'antologia di altri dove ha un volume no", !r.serie.some((x) => /Anthology/.test(x.nome)));
    t.eq("e non si richiede la serie che c'e' gia'", chiesti.join(), "4624,777");
  }

  // ── LE EDIZIONI DI UN FUMETTISTA ──────────────────────────────────────
  {
    const una = (q, nome) => ({ q, nome, volumi: [libro(q, 100)] });
    const nomi = serieCheValgono([
      una(1, "Hellboy"), una(2, "Hellboy: Edición cartoné"), una(3, "Hellboy Edição Histórica"), una(4, "AIDP Integral"), una(5, "Hellboy Omnibus"),
      una(6, "Absolute Y: the Last Man"), una(7, "Runaways Deluxe"), una(8, "Runaways: The Complete Collection"), una(9, "Berserk 2-in-1"), una(15, "L'Intégrale Hellboy"), una(16, "Hellboy Édition"), una(17, "Coleção Hellboy"), una(18, "Hellboy Gesamtausgabe"), una(19, "Mangaverse Tales"),
      una(10, "Colección Extra Superhéroes"), una(11, "Berserk Ausgabe"), una(12, "Hellboy Edizione"), una(13, "B.P.R.D. Hell on Earth"), una(14, "Saga"),
    ]).map((s) => s.nome);
    t.eq("le edizioni, le raccolte e le traduzioni di una serie restano fuori (una parola che comincia allo stesso modo resta)", [...nomi].sort().join(" | "), "B.P.R.D. Hell on Earth | Hellboy | Mangaverse Tales | Saga");
  }

  // ── NELLA STRADA DELL'APP ─────────────────────────────────────────────
  domande.length = 0;
  const guida = await sagaDalNome("Gaunt's Ghosts", { libri: [], hardcover: chiedi });
  t.eq("la guida dell'app viene prima, e Hardcover non si chiede", `${guida.fonte} ${domande.length}`, "guida 0");
  // (The Bound and the Broken ha la sua guida: qui una serie che nessuna guida conosce)
  const daHC = await sagaDalNome("serie finta", { libri: [{ title: "Of War and Ruin", author: "Ryan Cahill" }], hardcover: chiedi, prendi: async () => { throw new Error("Wikidata non va chiesto"); } });
  t.eq("poi Hardcover, con quel che hai gia'", `${daHC.fonte} ${daHC.volumi.filter((x) => x.gia).map((x) => x.titolo).join()}`, "hardcover Of War and Ruin");
  const wikidata = async (url) => {
    const q = new URL(url).searchParams;
    if (q.get("action") === "wbsearchentities") return { search: [{ id: "Q101" }] };
    if (q.get("action") === "query") return { query: { search: [{ title: "Q201" }] } };
    return { entities: { Q101: { labels: { en: { value: "Una Serie" } }, claims: { P31: [{ mainsnak: { datavalue: { value: { id: "Q1667921" } } } }] } }, Q201: { labels: { en: { value: "Libro Uno" } }, claims: { P31: [{ mainsnak: { datavalue: { value: { id: "Q7725634" } } } }], P179: [{ mainsnak: { datavalue: { value: { id: "Q101" } } }, qualifiers: { P1545: [{ datavalue: { value: "1" } }] } }] } } } };
  };
  const senza = await sagaDalNome("una serie", { libri: [], hardcover: chiedi, prendi: wikidata });
  t.eq("quel che Hardcover non ha, Wikidata", `${senza.fonte} ${senza.nome} ${senza.hardcover ?? "-"}`, "wikidata Una Serie -");
  const rifiutata = await sagaDalNome("una serie", { libri: [], hardcover: async () => { throw new ChiaveRifiutata("no"); }, prendi: wikidata });
  t.eq("una chiave rifiutata: Wikidata lo stesso, e lo si dice", `${rifiutata.fonte} ${rifiutata.hardcover}`, "wikidata chiave");
  t.c("…con la strada per sistemarla", /Impostazioni/.test(fraseHardcover("chiave")) && /non risponde/.test(fraseHardcover("guasto")) && fraseHardcover(null) === null);

  // le saghe di un autore: Hardcover prima, Wikidata per quel che manca
  const autoreHC = async (query) => {
    if (/query_type: "Author"/.test(query)) return { search: { results: { hits: [{ document: { id: "1", name: "John Gwynne", books_count: 20 } }] } } };
    return {
      series: [
        { id: 5874, name: "Bloodsworn Saga", book_series: [legame(1, 11, "The Shadow of the Gods", { autore: "John Gwynne" })] },
        { id: 7, name: "Una Serie", book_series: [legame(1, 12, "Libro Uno", { autore: "John Gwynne" })] },
        { id: 8, name: "Nuova Serie", book_series: [legame(1, 13, "Nuovo", { autore: "John Gwynne" })] },
      ],
    };
  };
  const gwynne = await saghePerAutore("John Gwynne", { hardcover: autoreHC, prendi: async (url) => {
    const q = new URL(url).searchParams;
    if (q.get("action") === "wbsearchentities") return { search: [{ id: "Q1" }] };
    if (q.get("action") === "query") return { query: { search: [{ title: "Q201" }, { title: "Q202" }] } };
    return { entities: {
      Q1: { labels: { en: { value: "John Gwynne" } }, claims: { P106: [{ mainsnak: { datavalue: { value: { id: "Q6625963" } } } }] } },
      Q101: { labels: { en: { value: "Una Serie" } }, claims: { P31: [{ mainsnak: { datavalue: { value: { id: "Q1667921" } } } }] } },
      Q201: { labels: { en: { value: "Libro Uno" } }, claims: { P31: [{ mainsnak: { datavalue: { value: { id: "Q7725634" } } } }], P179: [{ mainsnak: { datavalue: { value: { id: "Q101" } } }, qualifiers: { P1545: [{ datavalue: { value: "1" } }] } }] } },
      Q202: { labels: { en: { value: "Nuovo" } }, claims: { P31: [{ mainsnak: { datavalue: { value: { id: "Q7725634" } } } }] } },
    } };
  } });
  const voci = gwynne.saghe.map((s) => `${s.fonte}:${s.nome}`);
  t.c("le guide dell'app prima, e la serie di Hardcover che ha una guida non si ripete", voci[0].startsWith("guida:") && !voci.includes("hardcover:Bloodsworn Saga"), voci.join(" | "));
  t.c("poi le serie di Hardcover", voci.includes("hardcover:Una Serie") && voci.includes("hardcover:Nuova Serie"), voci.join(" | "));
  t.c("…e la stessa serie da Wikidata non si ripete", !voci.includes("wikidata:Una Serie"), voci.join(" | "));
  t.c("un libro che sta in una serie di Hardcover non e' fra gli altri libri", !gwynne.saghe.some((s) => s.fonte === "sciolti" && s.volumi.some((x) => x.titolo === "Nuovo")), JSON.stringify(gwynne.saghe.find((s) => s.fonte === "sciolti")?.volumi));

  // ── LE COPERTINE CHE MANCANO (il lettore: «non riesci a trovare le
  // copertine?», poi «sì, mostra le copertine di Hardcover quando mancano»)
  const img = (url) => ({ url });
  const hc = [
    { document: { title: "The Ice", author_names: ["Ryan  Cahill"], users_count: 153, image: img("https://assets.hardcover.app/editions/1/ice.jpg") } },
    { document: { title: "The Ice", author_names: ["Someone Else"], users_count: 900, image: img("https://assets.hardcover.app/x.jpg") } },
    { document: { title: "The Ice Storm", author_names: ["Ryan Cahill"], users_count: 999, image: img("https://assets.hardcover.app/storm.jpg") } },
  ];
  t.eq("lo stesso titolo e lo stesso autore, anche se un altro e' piu' letto", sceltaCopertinaHC(hc, { titolo: "The Ice", autore: "Ryan Cahill" }), "https://assets.hardcover.app/editions/1/ice.jpg");
  t.eq("…anche col sottotitolo dopo", sceltaCopertinaHC([{ document: { title: "The Truth: A Bound and the Broken Novella", author_names: ["Ryan Cahill"], image: img("https://a/t.jpg") } }], { titolo: "The Truth", autore: "Ryan Cahill" }), "https://a/t.jpg");
  t.eq("un titolo che solo comincia uguale no («The Ice Storm»)", sceltaCopertinaHC(hc.slice(2), { titolo: "The Ice", autore: "Ryan Cahill" }), null);
  t.eq("senza autore scritto, il piu' letto", sceltaCopertinaHC(hc.slice(0, 2), { titolo: "The Ice" }), "https://assets.hardcover.app/x.jpg");
  t.eq("un indirizzo che non e' https no", sceltaCopertinaHC([{ document: { title: "The Ice", image: img("http://a/x.jpg") } }], { titolo: "The Ice" }), null);

  const memoria = new Map();
  const st2 = { getItem: (k) => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, v) };
  const domande2 = [];
  const pause = [];
  const chiedi2 = async (query, vars) => {
    domande2.push(vars.q);
    return { search: { results: { hits: /Ice/.test(vars.q) ? hc : [] } } };
  };
  const aspetta = async (ms) => pause.push(ms);
  const ghiaccio = { id: "ice", title: "The Ice", author: "Ryan Cahill" };
  const [a, b] = await Promise.all([copertinaHardcover(ghiaccio, { chiedi: chiedi2, st: st2, aspetta }), copertinaHardcover(ghiaccio, { chiedi: chiedi2, st: st2, aspetta })]);
  t.eq("trovata; e due copertine dello stesso libro fanno una domanda sola", `${a === b} ${a} ${domande2.length}`, "true https://assets.hardcover.app/editions/1/ice.jpg 1");
  await copertinaHardcover(ghiaccio, { chiedi: chiedi2, st: st2, aspetta });
  t.eq("…poi si ricorda: nessuna domanda in piu'", domande2.length, 1);
  const nessuno = { id: "n", title: "Nessuno", author: "X" };
  await copertinaHardcover(nessuno, { chiedi: chiedi2, st: st2, aspetta, ora: 1000 });
  await copertinaHardcover(nessuno, { chiedi: chiedi2, st: st2, aspetta, ora: 1000 + NON_CE_MS - 1 });
  t.eq("il «non c'e'» si ricorda per trenta giorni…", domande2.length, 2);
  await copertinaHardcover(nessuno, { chiedi: chiedi2, st: st2, aspetta, ora: 1000 + NON_CE_MS + 1 });
  t.eq("…poi si richiede", domande2.length, 3);
  t.c("una domanda alla volta, col passo fra l'una e l'altra", pause.length >= 3 && pause.every((ms) => ms === PASSO_MS), pause.join());
  t.eq("senza chiave non si chiede niente", await copertinaHardcover({ id: "z", title: "The Ice" }, { st: st2, aspetta }), null);
  // per ultima: la chiave rifiutata vale fino alla prossima apertura
  let tentativi = 0;
  const rifiuta = async () => {
    tentativi += 1;
    throw new ChiaveRifiutata("no");
  };
  await copertinaHardcover({ id: "k1", title: "Uno" }, { chiedi: rifiuta, st: st2, aspetta });
  await copertinaHardcover({ id: "k2", title: "Due" }, { chiedi: rifiuta, st: st2, aspetta });
  t.eq("una chiave rifiutata non si riprova a ogni copertina", tentativi, 1);
};

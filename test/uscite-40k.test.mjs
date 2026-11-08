// LE USCITE DEL 40K DA LEXICANUM (`lib/uscite40k.js`): dalle pagine nuove
// del wiki, solo i libri; la prima volta un mese, poi da dove si era; i nuovi
// davanti, quel che si e' visto resta visto.
import {
  libroDallaPagina, domandaNuove, controllaUscite, leggiUscite, scriviUscite, daControllare, nuove, segnaViste, fraseUscite, indirizzoPagina,
  OGNI, PRIMA_VOLTA, PAGINE_MAX, TENUTE, CHIAVE,
} from "../src/lib/uscite40k.js";

const memoria = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};
const API = "https://wh40k.lexicanum.com/mediawiki/api.php";

export default async function (t) {
  t.eq("una pagina di un libro: titolo e tipo", JSON.stringify(libroDallaPagina({ title: "Hive (Novel)", timestamp: "2026-11-01T10:00:00Z" })), JSON.stringify({ pagina: "Hive (Novel)", titolo: "Hive", tipo: "romanzo", quando: "2026-11-01T10:00:00Z" }));
  t.c("…anche antologie, novelle, audiodrammi, omnibus", ["X (Anthology)", "X (Novella)", "X (Audio Drama)", "X (Omnibus)"].every((title) => libroDallaPagina({ title })));
  t.c("…non un personaggio, un pianeta, un racconto, o un tipo scritto a meta' titolo", ["Konrad Curze", "Terra", "X (Short Story)", "Novel (Planet)", "The Novel War", "Xenos (Novel) cover gallery"].every((title) => !libroDallaPagina({ title })));
  const u = new URL(domandaNuove(API, { fino: Date.UTC(2026, 9, 1), continua: "20261001|5" }));
  t.c("la domanda: le pagine nuove fra le voci, dalla piu' nuova fino al punto di prima, per il browser", u.searchParams.get("list") === "recentchanges" && u.searchParams.get("rctype") === "new" && u.searchParams.get("rcnamespace") === "0" && u.searchParams.get("rcend") === "2026-10-01T00:00:00.000Z" && u.searchParams.get("rcdir") === "older" && u.searchParams.get("origin") === "*" && u.searchParams.get("rccontinue") === "20261001|5");
  t.eq("l'indirizzo della pagina sul wiki", indirizzoPagina("https://wh40k.lexicanum.com", "Hive (Novel)"), "https://wh40k.lexicanum.com/wiki/Hive_(Novel)");

  // un giro su un wiki finto: due pagine di risposta
  const ora = Date.UTC(2026, 10, 8);
  const chieste = [];
  const prendi = async (url) => {
    const p = new URL(url).searchParams;
    chieste.push(p.get("rcend"));
    if (!p.get("rccontinue"))
      return { query: { recentchanges: [{ title: "Hive (Novel)", timestamp: "2026-11-07T00:00:00Z" }, { title: "Ordo Minoris", timestamp: "2026-11-06T00:00:00Z" }] }, continue: { rccontinue: "x|1" } };
    return { query: { recentchanges: [{ title: "Sons of the Emperor (Anthology)", timestamp: "2026-10-20T00:00:00Z" }] } };
  };
  const primo = await controllaUscite({ api: API, prendi, ora });
  t.eq("la prima volta: un mese indietro, le due pagine, solo i libri", primo.voci.map((v) => v.titolo).join("|") + " / " + chieste[0], `Hive|Sons of the Emperor / ${new Date(ora - PRIMA_VOLTA).toISOString()}`);
  t.eq("…due domande: l'elenco finisce alla seconda pagina", chieste.length, 2);
  t.c("…nuovi, e il giro si ricorda", nuove(primo).length === 2 && primo.dal === new Date(ora).toISOString() && primo.quando === ora);
  t.eq("la riga: quanti libri nuovi", fraseUscite(primo), "2 libri nuovi su Lexicanum");
  const visti = segnaViste(primo);
  t.c("visti: niente di nuovo, e la riga lo dice", nuove(visti).length === 0 && fraseUscite(visti) === "Niente di nuovo dall'ultima volta" && fraseUscite({ voci: [] }) === "");
  chieste.length = 0;
  const secondo = await controllaUscite({
    api: API,
    prendi: async (url) => {
      chieste.push(new URL(url).searchParams.get("rcend"));
      return { query: { recentchanges: [{ title: "The Emperor's Gift (Novel)", timestamp: "2026-11-09T00:00:00Z" }, { title: "Hive (Novel)", timestamp: "2026-11-07T00:00:00Z" }] } };
    },
    stato: visti,
    ora: ora + OGNI,
  });
  t.c("il giro dopo parte da dove si era, il nuovo davanti, il gia' visto resta visto e non si ripete", chieste[0] === visti.dal && secondo.voci.map((v) => `${v.titolo}:${v.vista}`).join("|") === "The Emperor's Gift:false|Hive:true|Sons of the Emperor:true");
  let pagine = 0;
  await controllaUscite({ api: API, prendi: async () => (pagine++, { query: { recentchanges: [] }, continue: { rccontinue: "y" } }), ora });
  t.eq("al piu' quattro pagine dell'elenco a giro", pagine, PAGINE_MAX);
  const tante = { dal: null, quando: 0, voci: Array.from({ length: 50 }, (_, i) => ({ pagina: `P${i}`, titolo: `P${i}`, vista: true })) };
  t.eq("si tengono le ultime quaranta", (await controllaUscite({ api: API, prendi: async () => ({ query: { recentchanges: [{ title: "Nuovo (Novel)" }] } }), stato: tante, ora })).voci.length, TENUTE);
  let rotto = false;
  try {
    await controllaUscite({ api: API, prendi: async () => { throw new Error("pagina anti-bot"); }, stato: visti, ora });
  } catch {
    rotto = true;
  }
  t.c("un intoppo sale a chi chiede (lo stato di prima resta)", rotto);

  t.c("non piu' di un giro ogni sei ore", daControllare({}, ora) && !daControllare({ quando: ora }, ora + OGNI - 1) && daControllare({ quando: ora }, ora + OGNI));
  const st = memoria();
  scriviUscite(secondo, st);
  t.eq("lo stato si rilegge", leggiUscite(st).voci.length, 3);
  st.setItem(CHIAVE, "{rotto");
  t.eq("uno stato rotto riparte da capo", JSON.stringify(leggiUscite(st)), JSON.stringify({ dal: null, quando: 0, voci: [] }));
}

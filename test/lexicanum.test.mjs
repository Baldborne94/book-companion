// LEXICANUM SUL DISPOSITIVO.
//
// Chiesto dal lettore: «vorrei poter avere in locale Lexicanum per tutti i
// miei libri del 40K». Tre parti che sbagliano in silenzio:
//
//   - il WIKITESTO: una fonte letta male non da' errori, da' un paragrafo
//     senza velo che racconta come finisce un libro non ancora letto;
//   - lo SCARICAMENTO: una pagina saltata alla ripresa e' una voce che manca
//     per sempre, e un rinvio scritto sopra la sua voce la fa sparire;
//   - il VELO: la regola che decide cosa si legge e cosa no.
//
// IndexedDB e la rete si fingono: il deposito e' una mappa, Lexicanum una
// funzione che risponde come l'API MediaWiki.
import {
  chiave,
  daWikitesto,
  rinvioDi,
  testoPiano,
  recordDi,
  scaricaLexicanum,
  statoLexicanum,
  giroLexicanum,
  rimuoviLexicanum,
  voceLore,
  cercaLore,
  candidati,
  giudiceFonti,
  velaVoce,
  pezzi,
  del40k,
  loreAttivo,
  trovaApi,
  fraseLexicanum,
} from "../src/lib/lexicanum.js";

const deposito = () => {
  const m = new Map();
  return {
    m,
    scritture: [],
    leggi: async (k) => m.get(k),
    async scrivi(k, v) {
      this.scritture.push(k);
      m.set(k, v);
    },
    async scriviMolti(voci) {
      for (const [k, v] of voci) {
        this.scritture.push(k);
        m.set(k, v);
      }
    },
    togli: async (k) => m.delete(k),
    togliPrefisso: async (p) => {
      for (const k of [...m.keys()]) if (k.startsWith(p)) m.delete(k);
    },
  };
};

// Una voce come le scrive Lexicanum: infobox, immagine con link nella
// didascalia, citazioni in fondo ai paragrafi, fonti con le lettere.
const HORUS = `{{Primarch
|image=[[Image:Horus.jpg|250px]]
|name=Horus Lupercal
}}
[[Image:Horus2.jpg|thumb|Horus, by [[John Blanche]]]]
'''Horus Lupercal''' was the [[Primarch]] of the [[Sons of Horus|Luna Wolves]] and [[Warmaster]].{{Fn|1}}

==History==
===Great Crusade===
He led the [[Ultramarines]]' allies at [[Ullanor]].{{Fn|2a}}{{Fn|2b}}

He was wounded on [[Davin]]'s moon.{{Fn|3}}
<!-- nota degli editori -->
{| class="wikitable"
| riga di tabella
|}
* He fought his brothers.{{Fn|4}}

==Sources==
*{{Endn|1}}: ''[[Codex: Space Marines (5th Edition)]]'', pg. 12
*{{Endn|2}}: ''[[Horus Rising (Novel)|Horus Rising]]'' (Novel) by [[Dan Abnett]], Chapter 3
*{{Endn|3}}: ''[[False Gods (Novel)|False Gods]]'' by [[Graham McNeill]]
*{{Endn|4}}: ''[[The Solar War (Novel)|The Solar War]]'' by [[John French]]

==See also==
* [[Erebus]]
===Novels===
* [[Horus Rising (Novel)|Horus Rising]]

[[Category:H]]
[[de:Horus]]`;

export default async function (t) {
  // ---- IL WIKITESTO -----------------------------------------------------
  const v = daWikitesto("Horus Lupercal", HORUS);
  const testi = v.p.filter((b) => b.x).map((b) => testoPiano(b.x));
  t.eq("il primo paragrafo e' l'incipit, senza infobox ne' immagini", testi[0], "Horus Lupercal was the Primarch of the Luna Wolves and Warmaster.");
  t.c("il link tiene bersaglio e testo", v.p.find((b) => b.x).x.includes("[[Sons of Horus|Luna Wolves]]"));
  t.c("la coda di lettere resta attaccata al link", testi.some((x) => x.includes("Davin's moon")));
  t.c("i titoletti restano, coi livelli", v.p.some((b) => b.h === "History" && b.l === 2) && v.p.some((b) => b.h === "Great Crusade" && b.l === 3));
  t.c("la sezione delle fonti e i rimandi non sono racconto", !v.p.some((b) => b.h === "Sources" || b.h === "See also") && !testi.some((x) => x.includes("Erebus")));
  t.c("e nemmeno le loro sottosezioni", !v.p.some((b) => b.h === "Novels") && !testi.some((x) => x === "Horus Rising"));
  t.c("tabelle, commenti e categorie via", !testi.some((x) => /riga di tabella|editori|Category|de:Horus/.test(x)));
  t.c("niente segni di citazione nel testo", !testi.some((x) => /[\u0001-\u0004]|\{\{|Fn/.test(x)));
  const ullanor = v.p.find((b) => b.x && b.x.includes("Ullanor"));
  t.eq("«2a» e «2b» sono la stessa fonte, contata una volta", JSON.stringify(ullanor.f), '["2"]');
  t.eq("la fonte prende il titolo dal link, senza la parentesi del wiki", v.f["2"].t, "Horus Rising");
  t.eq("anche quando il link non ha testo suo", v.f["1"].t, "Codex: Space Marines");
  t.c("la riga della fonte si legge intera", v.f["2"].x.includes("Chapter 3"));
  const elenco = v.p.find((b) => b.li);
  t.c("un elemento d'elenco e' un blocco a se', con la sua fonte", elenco && elenco.f[0] === "4");

  const conRef = daWikitesto("X", `Uno.<ref name="a">''[[Xenos (Novel)|Xenos]]''</ref>\n\nDue.<ref name="a"/>`);
  t.eq("una <ref> nominata riusata cita la stessa fonte", conRef.p[1].f[0], conRef.p[0].f[0]);
  t.eq("e il suo contenuto e' la fonte", conRef.f[conRef.p[0].f[0]].t, "Xenos");

  const rotta = daWikitesto("Y", "Inizio {{modello che non si chiude\n\nResto della voce.");
  t.c("un modello che non si chiude non si mangia la voce", rotta.p.some((b) => b.x.includes("Resto della voce")));

  t.eq("il rinvio si legge", rinvioDi("#REDIRECT [[Garviel Loken#Early Life]]"), "Garviel Loken");
  t.eq("anche scritto in minuscolo", rinvioDi("#redirect[[Horus_Lupercal]]"), "Horus Lupercal");
  t.eq("una voce non e' un rinvio", rinvioDi("'''Horus''' was"), null);

  t.eq("la chiave non guarda maiuscole e accenti", chiave("  Lion El’Jonson "), "lion el'jonson");

  // ---- I RECORD ---------------------------------------------------------
  {
    const d = deposito();
    const pagine = [
      { ns: 0, title: "Garviel Loken", revisions: [{ slots: { main: { content: "'''Garviel Loken''' was a captain." } } }] },
      { ns: 0, title: "Garviel loken", revisions: [{ slots: { main: { content: "#REDIRECT [[Garviel Loken]]" } } }] },
      { ns: 0, title: "Loken", revisions: [{ slots: { main: { content: "#REDIRECT [[Garviel Loken]]" } } }] },
      { ns: 0, title: "Garro (Novel)", revisions: [{ content: "A novel." }] },
      // una pagina arrivata senza testo (continuazione delle revisioni): si
      // salta adesso, torna alla pagina dopo
      { ns: 0, title: "Erebus" },
    ];
    const { record, voci, rinvii } = await recordDi(pagine, d.leggi);
    const m = new Map(record);
    t.eq("due voci e un rinvio", `${voci}/${rinvii}`, "2/1");
    t.c("il rinvio a se stessa a meno delle maiuscole non copre la voce", !m.get("lex:garviel loken").r);
    // scritto prima della voce (le maiuscole vengono avanti nell'ordine del
    // wiki), la voce lo copre quando arriva
    const prima = await recordDi(
      [
        { ns: 0, title: "GARVIEL LOKEN", revisions: [{ content: "#REDIRECT [[Garviel Loken]]" }] },
        { ns: 0, title: "Garviel Loken", revisions: [{ content: "'''Garviel Loken''' was." }] },
      ],
      d.leggi
    );
    t.c("un rinvio arrivato prima della sua voce non la copre", prima.record.length === 1 && !prima.record[0][1].r);
    t.eq("il rinvio vero c'e'", m.get("lex:loken").r, "Garviel Loken");
    t.eq("la voce risponde anche senza parentesi", m.get("lex:garro").r, "Garro (Novel)");
    t.c("una pagina senza testo non diventa una voce vuota", !m.has("lex:erebus"));

    // un rinvio che cadrebbe su una voce vera GIA' SCRITTA (pagina prima)
    d.m.set("lex:horus", { t: "Horus", p: [] });
    const dopo = await recordDi([{ ns: 0, title: "HORUS", revisions: [{ content: "#REDIRECT [[Horus Lupercal]]" }] }], d.leggi);
    t.eq("un rinvio non copre una voce vera di una pagina prima", dopo.record.length, 0);
    // ...ma una voce vera copre la voce «senza parentesi»
    d.m.set("lex:garro", { t: "Garro", r: "Garro (Novel)", s: 1 });
    const vera = await recordDi([{ ns: 0, title: "Garro", revisions: [{ content: "'''Garro''' was a captain." }] }], d.leggi);
    t.c("una voce vera prende il posto di quella senza parentesi", !vera.record[0][1].r);
  }

  // ---- LO SCARICAMENTO --------------------------------------------------
  const pagina = (titoli) =>
    titoli.map((ti) => ({ ns: 0, title: ti, revisions: [{ slots: { main: { content: ti.startsWith("→") ? "" : `'''${ti}''' is.` } } }] }));
  const PAGINE = [pagina(["Abaddon", "Aximand"]), pagina(["Cadia", "Calth"]), pagina(["Davin"])];
  const finto = (chieste, { guastoAlla = -1 } = {}) => async (url) => {
    const u = new URL(url);
    const p = Object.fromEntries(u.searchParams);
    chieste.push(p);
    if (p.meta === "siteinfo") {
      if (!u.pathname.startsWith("/mediawiki/")) return { ok: false, status: 404, headers: { get: () => null } };
      return { ok: true, status: 200, text: async () => JSON.stringify({ query: { general: { sitename: "Lexicanum" }, statistics: { articles: 5 } } }) };
    }
    const i = p.gapcontinue ? Number(p.gapcontinue) : 0;
    if (i === guastoAlla) throw new TypeError("Failed to fetch");
    const corpo = { query: { pages: PAGINE[i] } };
    if (i + 1 < PAGINE.length) corpo.continue = { gapcontinue: String(i + 1), continue: "gapcontinue||" };
    return { ok: true, status: 200, text: async () => JSON.stringify(corpo) };
  };
  const attesa = async () => {};

  {
    const chieste = [];
    const api = await trovaApi({ fetcher: finto(chieste), attesa });
    t.c("l'API si trova provando i posti soliti", api.api.endsWith("/mediawiki/api.php") && api.voci === 5);
    t.c("ogni richiesta chiede il permesso del browser", chieste.every((p) => p.origin === "*"));
  }

  {
    const d = deposito();
    const chieste = [];
    let viste = 0;
    const primo = await scaricaLexicanum({ fetcher: finto(chieste), deposito: d, attesa, pausa: 0, fermo: () => viste++ >= 1 });
    t.c("fermato a meta' dice che si e' fermato", primo.fermato === true);
    t.eq("e non si dichiara sul dispositivo", await statoLexicanum(d), null);
    const g = await giroLexicanum(d);
    t.c("ma ricorda dove era arrivato", g?.cont?.gapcontinue === "1" && g.voci === 2);

    const meta = await scaricaLexicanum({ fetcher: finto(chieste), deposito: d, attesa, pausa: 0 });
    t.eq("ripreso, arriva in fondo con tutte le voci", meta.voci, 5);
    const pagineChieste = chieste.filter((p) => p.generator === "allpages").map((p) => p.gapcontinue || "0");
    t.eq("ripartendo dalla pagina dopo, senza rifare le prime", pagineChieste.join(","), "0,1,2");
    t.c("la continuazione si ripassa intera", chieste.some((p) => p.continue === "gapcontinue||"));
    t.c("il cartellino si scrive per ultimo", d.scritture.at(-1) === "lex_meta");
    // dopo ogni pagina: prima le voci, poi il segno della ripresa — al
    // contrario, un'interruzione fra le due salta una pagina per sempre
    const segni = d.scritture.map((k, i) => (k === "lex_giro" ? i : -1)).filter((i) => i >= 0);
    t.c("le voci di una pagina si scrivono prima del segno che la da' per fatta", d.scritture.indexOf("lex:calth") < segni[2]);
    t.eq("e il giro a meta' se ne va", await giroLexicanum(d), null);
    t.c("le voci ci sono", (await voceLore("Calth", d))?.t === "Calth");
    const prima = chieste.length;
    await scaricaLexicanum({ fetcher: finto(chieste), deposito: d, attesa, pausa: 0 });
    t.eq("gia' sceso, non si riscarica da solo", chieste.length, prima);
    await scaricaLexicanum({ fetcher: finto(chieste), deposito: d, attesa, pausa: 0, aggiorna: true, fermo: () => chieste.length > prima + 2 });
    t.c("aggiornare e' un giro nuovo dall'inizio", chieste.slice(prima).some((p) => p.generator === "allpages" && !p.gapcontinue));
    t.c("aggiornando, le voci di prima rispondono anche a meta' giro", !!(await statoLexicanum(d)) && (await voceLore("Davin", d))?.t === "Davin");

    await rimuoviLexicanum(d);
    t.eq("rimosso, non c'e' piu' niente", [...d.m.keys()].length, 0);
  }

  {
    const d = deposito();
    let guaio = null;
    await scaricaLexicanum({ fetcher: finto([], { guastoAlla: 1 }), deposito: d, attesa, pausa: 0 }).catch((e) => (guaio = e));
    t.c("una rete che cade si dice", /non risponde/.test(guaio?.message || ""));
    t.c("e quel che era sceso resta per la ripresa", (await giroLexicanum(d))?.voci === 2);
  }

  // ---- LA RICERCA -------------------------------------------------------
  {
    const d = deposito();
    d.m.set("lex:garviel loken", { t: "Garviel Loken", p: [] });
    d.m.set("lex:loken", { t: "Loken", r: "Garviel Loken" });
    d.m.set("lex:horus", { t: "Horus", r: "Horus Lupercal" });
    d.m.set("lex:horus lupercal", { t: "Horus Lupercal", p: [] });
    d.m.set("lex:primarch", { t: "Primarch", p: [] });
    d.m.set("lex:a", { t: "A", r: "B" });
    d.m.set("lex:b", { t: "B", r: "A" });
    t.eq("il rinvio porta alla voce e dice da dove", JSON.stringify(await voceLore("Loken", d).then((x) => [x.t, x.via])), '["Garviel Loken","Loken"]');
    t.eq("un giro di rinvii non e' infinito", await voceLore("A", d), null);
    t.eq("dalla selezione col resto della frase", (await cercaLore("Garviel Loken said", d))?.t, "Garviel Loken");
    t.eq("col genitivo", (await cercaLore("Horus's", d))?.t, "Horus Lupercal");
    t.eq("col plurale", (await cercaLore("Primarchs", d))?.t, "Primarch");
    t.eq("una frase lunga non e' un nome", candidati("one two three four five six seven").length, 0);
    t.c("una parola di due lettere non si cerca", !candidati("He").length);
  }

  // ---- QUALI LIBRI ------------------------------------------------------
  const nessuno = () => null;
  t.c("l'Eresia si riconosce dalla saga", del40k({ saga: "The Horus Heresy", title: "x" }));
  t.c("anche a saga vuota, dalla guida", del40k({ title: "The Horus Heresy 03 - Galaxy in Flames" }));
  t.c("e i Gaunt's Ghosts dalla serie", del40k({ saga: "Warhammer 40K", series: "Gaunt's Ghosts", title: "First and Only" }));
  t.c("il Mondo Disco no", !loreAttivo({ id: "d", saga: "Discworld", title: "Mort" }, nessuno));
  t.c("ma a mano si accende anche li'", loreAttivo({ id: "d", saga: "Discworld", title: "Mort" }, () => true));
  t.c("e a mano si spegne anche sull'Eresia", !loreAttivo({ id: "h", saga: "The Horus Heresy", title: "Horus Rising" }, () => false));

  // ---- IL VELO ----------------------------------------------------------
  const libri = [
    { id: "hr", title: "Horus Rising", saga: "The Horus Heresy", sagaOrder: 1 },
    { id: "fg", title: "The Horus Heresy 02 - False Gods", saga: "The Horus Heresy", sagaOrder: 2 },
    { id: "gf", title: "Galaxy in Flames", saga: "The Horus Heresy", sagaOrder: 3 },
    { id: "ab", title: "The Solar War", saga: "Altro", sagaOrder: 1 },
  ];
  const stati = { hr: "read", fg: "reading", gf: "unread" };
  const cfi = { fg: "epubcfi(/6/4)" };
  const giudice = giudiceFonti(libri[1], libri, { statusOf: (id) => stati[id] || "unread", cfiOf: (id) => cfi[id] || null });
  t.eq("una fonte di un volume finito prima si legge", giudice({ t: "Horus Rising" }), null);
  t.c("una fonte da questo libro si vela", /questo libro/.test(giudice({ t: "False Gods" })));
  t.c("un volume dopo, nella biblioteca, si vela", /viene dopo/.test(giudice({ t: "Galaxy in Flames" })));
  t.c("un volume dopo che non hai, ma che la guida colloca, si vela", /The Solar War.*viene dopo/.test(giudice({ t: "The Solar War" })));
  t.eq("un codex non e' un volume della saga", giudice({ t: "Codex: Space Marines" }), null);
  t.eq("una fonte senza titolo non vela niente", giudice({}), null);
  const senzaSaga = giudiceFonti({ id: "x", title: "Xenos" }, libri, { statusOf: () => "read", cfiOf: () => null });
  t.eq("un libro senza saga non sa cosa velare, e non vela", senzaSaga({ t: "The Solar War" }), null);

  const velata = velaVoce(v, giudice);
  const di = (s) => velata.find((b) => b.x && b.x.includes(s));
  t.c("l'incipit dal codex si legge", !di("Warmaster").v);
  t.c("un paragrafo da questo libro si vela", !!di("Davin").v);
  t.c("e uno dalla Guerra Solare si vela", !!di("brothers").v);
  t.c("i titoletti non si velano", velata.filter((b) => b.h).every((b) => !b.v));

  // ---- LA RIGA DEL LAVORO -----------------------------------------------
  t.eq("la riga del lavoro dice voci, totale e peso", fraseLexicanum({ voci: 12400, totale: 45000, byte: 85 * 1048576 }), "12.400 voci di circa 45.000 · 85 MB");
  t.eq("senza totale non si inventa", fraseLexicanum({ voci: 3, byte: 0 }), "3 voci");
  t.eq("e sotto il mega non si dice «0 MB»", fraseLexicanum({ voci: 3, byte: 4000 }), "3 voci");

  // ---- I PEZZI ----------------------------------------------------------
  const p = pezzi("The ''[[Horus Rising (Novel)|Horus Rising]]'' and [[Ullanor|the Triumph]].");
  t.eq("link e corsivi si separano", JSON.stringify(p.map((x) => [x.s, x.l || "", !!x.i])), JSON.stringify([
    ["The ", "", false],
    ["Horus Rising", "Horus Rising (Novel)", true],
    [" and ", "", false],
    ["the Triumph", "Ullanor", false],
    [".", "", false],
  ]));
}

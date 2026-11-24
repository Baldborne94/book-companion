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
  indiceLore,
  nomiNelTesto,
  parolePiccole,
  nomeSottoIlDito,
  nomiDaSegnare,
  avvisoVoce,
  scrittoComeNome,
  maiuscoleInMezzo,
  vociDiPrima,
  FORMATO_VOCI,
  immaginiDi,
  misuraImmagini,
  scaricaImmagini,
  statoImmagini,
  rimuoviImmagini,
  immagineDi,
  immaginePerVoce,
  figuraBreve,
  misuraIllustrazioni,
  illustrazioniDi,
  scaricaIllustrazioni,
  statoIllustrazioni,
  rimuoviIllustrazioni,
  illustrazioniPerVoce,
  fraseIllustrazioni,
  didascaliaDi,
  fileDelleVoci,
  riepilogoWiki,
  fraseImmagini,
  giroDaRiprendere,
  segnaFermato,
  LEXICANUM,
  FANDOM,
  altreVoci,
  sceltaDalContesto,
  voceNelContesto,
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
    chiaviPrefisso: async (p) => [...m.keys()].filter((k) => k.startsWith(p)),
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

  // ---- IL RIQUADRO, LE CITAZIONI, LE TABELLE ------------------------------
  // chiesto dal lettore: «la stessa esperienza della pagina online». Le
  // forme vere di Fandom (Cadia, le Legioni); quelle di Lexicanum come le
  // scrive il wiki, col riquadro a capo e le citazioni coi numeri delle fonti
  {
    const cadia = daWikitesto("Cadia", `{{Quote|This is Cadia, you silly fool!| Inquisitor-General Neve}}
{{Planet
|title1=Cadia Prime
|image1=[[File:Cadia.jpg|center|210px]]|
|caption1=Cadia as seen from orbit.
|affiliation= [[Chaos]] (Currently) <br> [[Imperium of Man]] (Formerly)
|temperature_/_climate=20°C; Arctic to Temperate
|segmentum= [[Segmentum Obscurus]]|
|tithe_grade=
}}
'''Cadia''' was a [[Fortress World]].`);
    t.eq("il riquadro ha il nome del suo modello", cadia.ib?.n, "Planet");
    t.eq(
      "e i suoi campi, senza immagine, didascalia e campi vuoti",
      JSON.stringify(cadia.ib?.c),
      JSON.stringify([
        ["Title", "Cadia Prime"],
        ["Affiliation", "[[Chaos]] (Currently) · [[Imperium of Man]] (Formerly)"],
        ["Temperature / climate", "20°C; Arctic to Temperate"],
        ["Segmentum", "[[Segmentum Obscurus]]"],
      ])
    );
    t.eq("la citazione in testa e' una citazione, con chi l'ha detta", JSON.stringify(cadia.p[0]), JSON.stringify({ q: "This is Cadia, you silly fool!", di: "Inquisitor-General Neve", f: [] }));
    t.eq("e il primo paragrafo resta il primo paragrafo", cadia.p.find((b) => b.x)?.x, "Cadia was a [[Fortress World]].");
    const solo = daWikitesto("X", "{{Main|Horus Heresy}}\n{{Primarch\n|image=[[Image:Horus.jpg|250px]]\n|name=Horus Lupercal\n}}\nTesto.");
    t.c("un modello senza campi da leggere non e' un riquadro", !solo.ib);

    const lex = daWikitesto("Loken", `{{Quote|I was never a Son of Horus.|[[Garviel Loken|Loken]] to [[Horus]]}}{{Fn|1}}
'''Loken''' was a Captain.{{Fn|2}}

==Sources==
*{{Endn|1}}: ''[[Galaxy in Flames (Novel)|Galaxy in Flames]]''
*{{Endn|2}}: ''[[Horus Rising (Novel)|Horus Rising]]''
==See also==
{{Quote|Una citazione fra i rimandi|Nessuno}}`);
    const q = lex.p.find((b) => b.q);
    t.eq("chi parla puo' avere un link col suo «|»", q?.di, "[[Garviel Loken|Loken]] to [[Horus]]");
    t.c("la citazione porta le sue fonti, e si vela come un paragrafo", q?.f?.includes("1") && lex.f["1"]?.t === "Galaxy in Flames");
    t.c("nelle sezioni che si buttano le citazioni se ne vanno con loro", lex.p.filter((b) => b.q).length === 1);

    const legioni = daWikitesto("Legions", `Intro.
{|border="1" cellspacing="0"
|+ The [[Legiones Astartes]]
!width="5%" style="background: #000080;"|'''Number'''
!style="background: #000080;"|'''Legion'''
|-
!<center>|'''I'''
|[[Dark Angels]]{{Fn|1}}
|-
|XVI || [[Sons of Horus|Luna Wolves]]
|}
Dopo.

==Sources==
*{{Endn|1}}: ''[[Codex: Dark Angels]]''`);
    const tab = legioni.p.find((b) => b.tab);
    t.eq("la tabella ha le sue righe, senza gli attributi delle celle", JSON.stringify(tab?.tab), JSON.stringify([["Number", "Legion"], ["I", "[[Dark Angels]]"], ["XVI", "[[Sons of Horus|Luna Wolves]]"]]));
    t.c("la prima riga e' l'intestazione, e la didascalia resta", tab?.th === 1 && tab?.c === "The [[Legiones Astartes]]");
    t.c("le fonti nelle celle velano la tabella", tab?.f?.join() === "1");
    t.eq("e la tabella sta dove l'aveva messa il wiki", legioni.p.map((b) => (b.tab ? "T" : b.x)).join("|"), "Intro.|T|Dopo.");
  }

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
  // `guasto`: sulla pagina `alla` il wiki sbaglia `volte` volte (o sempre),
  // nel modo `come` — la rete che cade, un 429, una pagina al posto dei dati
  const finto = (chieste, { guasto = null } = {}) => async (url) => {
    const u = new URL(url);
    const p = Object.fromEntries(u.searchParams);
    chieste.push(p);
    if (p.meta === "siteinfo") {
      if (!u.pathname.startsWith("/mediawiki/")) return { ok: false, status: 404, headers: { get: () => null } };
      return { ok: true, status: 200, text: async () => JSON.stringify({ query: { general: { sitename: "Lexicanum" }, statistics: { articles: 5 } } }) };
    }
    const i = p.gapcontinue ? Number(p.gapcontinue) : 0;
    if (guasto && i === guasto.alla && (guasto.volte == null || guasto.volte-- > 0)) {
      if (guasto.come === "429") return { ok: false, status: 429, headers: { get: (h) => (h === "retry-after" ? "30" : null) } };
      if (guasto.come === "pagina") return { ok: true, status: 200, text: async () => "<html>Just a moment...</html>" };
      throw new TypeError("Failed to fetch");
    }
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
    t.eq("e dice il formato delle voci, perche' il pannello sappia se riscaricarle", meta.formato, FORMATO_VOCI);
    t.c("le voci col formato di adesso non chiedono di riscaricare", !vociDiPrima(meta));
    t.c("quelle scese prima si', e un Lexicanum assente no", vociDiPrima({ voci: 50000 }) && !vociDiPrima(null));
    // un giro cominciato col formato di prima e ripreso dopo resta di prima
    const vecchio = deposito();
    await vecchio.scrivi("lex_giro", { api: "https://wh40k.lexicanum.com/mediawiki/api.php", cont: { gapcontinue: "2", continue: "gapcontinue||" }, voci: 4, rinvii: 0, byte: 0 });
    t.eq("un giro di prima ripreso adesso resta di prima", (await scaricaLexicanum({ fetcher: finto([]), deposito: vecchio, attesa, pausa: 0 })).formato, 1);
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
    // la rete cade piu' volte di quante ne reggeva prima (quattro): il giro
    // aspetta e va avanti, dicendo che aspetta
    const d = deposito();
    const attese = [];
    const passi = [];
    const meta = await scaricaLexicanum({
      fetcher: finto([], { guasto: { alla: 1, volte: 7 } }),
      deposito: d,
      attesa: async (ms) => attese.push(ms),
      pausa: 0,
      onProgress: (p) => passi.push(p),
    });
    t.eq("la rete che cade non ferma il giro: arriva in fondo", meta.voci, 5);
    t.c("e intanto dice che aspetta la rete", passi.some((p) => p.attesa === "rete"));
    t.c("l'attesa cresce ma non supera il minuto", attese.length >= 7 && Math.max(...attese) <= 60000 && attese[1] > attese[0], JSON.stringify(attese));
    t.c("tornata la rete, la riga non dice piu' che aspetta", !passi.at(-1).attesa);
  }
  {
    const d = deposito();
    const attese = [];
    const passi = [];
    const meta = await scaricaLexicanum({
      fetcher: finto([], { guasto: { alla: 1, volte: 5, come: "429" } }),
      deposito: d,
      attesa: async (ms) => attese.push(ms),
      pausa: 0,
      onProgress: (p) => passi.push(p),
    });
    t.eq("il wiki che chiede di rallentare non ferma il giro", meta.voci, 5);
    t.c("si aspetta quanto chiede", attese.includes(30000) && passi.some((p) => p.attesa === "rallenta"));
  }
  {
    // la rete non torna, e il lettore ferma: il giro si ferma lì, con la
    // ripresa al punto giusto
    const d = deposito();
    let attese = 0;
    let ferma = false;
    const esito = await scaricaLexicanum({
      fetcher: finto([], { guasto: { alla: 1 } }),
      deposito: d,
      attesa: async () => {
        if (++attese === 3) ferma = true;
      },
      pausa: 0,
      fermo: () => ferma,
    });
    t.c("fermato mentre aspettava la rete, dice che si e' fermato", esito.fermato === true);
    t.c("e quel che era sceso resta per la ripresa", (await giroLexicanum(d))?.voci === 2 && (await giroLexicanum(d))?.cont?.gapcontinue === "1");
  }
  {
    const d = deposito();
    let guaio = null;
    await scaricaLexicanum({ fetcher: finto([], { guasto: { alla: 1, come: "pagina" } }), deposito: d, attesa, pausa: 0 }).catch((e) => (guaio = e));
    t.c("una pagina al posto dei dati, che non passa, alla fine si dice", /pagina invece che coi dati/.test(guaio?.message || ""));
  }
  {
    // al primo contatto invece si resta brevi: li' un rifiuto e' la notizia
    let guaio = null;
    await trovaApi({ fetcher: async () => { throw new TypeError("Failed to fetch"); }, attesa }).catch((e) => (guaio = e));
    t.c("se il sito non risponde al primo contatto si dice subito", /non risponde/.test(guaio?.message || ""));
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

  // ---- I NOMI NEL TESTO ------------------------------------------------
  {
    const d = deposito();
    for (const k of ["garviel loken", "loken", "horus", "sons of horus", "cadia", "battle", "lion el'jonson", "davin"]) d.m.set(`lex:${k}`, { t: k });
    d.m.set("lex_meta", { voci: 8 });
    const ix = await indiceLore(d);
    t.c("l'indice e' fatto delle sole chiavi delle voci, non dei cartellini", ix.chiavi.has("garviel loken") && !ix.chiavi.has("_meta") && ix.chiavi.size === 8);
    t.eq("e sa quante parole ha il nome piu' lungo", ix.max, 3);

    const frase = "Garviel Loken watched the Sons of Horus. Loken smiled. Battle was joined on Cadia, Horus's world, and the battle raged.";
    const nomi = nomiNelTesto(frase, ix, parolePiccole(frase)).map((m) => m.testo);
    t.eq("il nome lungo prima di quello corto", nomi[0], "Garviel Loken");
    t.eq("e senza accavallarsi: «Loken» dentro «Garviel Loken» non si conta di nuovo", nomi.filter((x) => x === "Loken").length, 1);
    t.c("un nome di piu' parole si trova intero", nomi.includes("Sons of Horus"));
    t.c("la parola sola maiuscola si trova", nomi.includes("Loken") && nomi.includes("Cadia"));
    t.c("col genitivo, senza il genitivo", nomi.includes("Horus"));
    t.c("una parola che nel capitolo compare anche minuscola non e' un nome", !nomi.includes("Battle"));
    t.c("una minuscola non e' mai un nome", nomiNelTesto("the cadia gate", ix).length === 0);
    t.eq("una virgola spezza il nome", nomiNelTesto("Garviel, Loken said", ix).map((m) => m.testo).join("|"), "Loken");
    t.eq("l'apostrofo dentro il nome resta", nomiNelTesto("then Lion El’Jonson spoke", ix)[0]?.chiave, "lion el'jonson");
    // «'Two hundred and fifty'»: la distanza, non il gruppo «Two Hundred»
    const numeri = { chiavi: new Set(["two hundred", "eye of terror"]), max: 3 };
    t.eq("un numero in minuscolo non e' il nome della voce", nomiNelTesto("'Two hundred and fifty,' said Bannan.", numeri).length, 0);
    t.eq("scritto come il nome si'", nomiNelTesto("the Two Hundred marched", numeri)[0]?.testo, "Two Hundred");
    t.eq("le paroline di mezzo restano minuscole", nomiNelTesto("into the Eye of Terror", numeri)[0]?.testo, "Eye of Terror");
    t.c("scritto come un nome: maiuscole le parole che contano", scrittoComeNome("Sons of Horus") && scrittoComeNome("Cadia") && scrittoComeNome("Isstvan III"));
    t.c("non come un nome: una parola che conta minuscola", !scrittoComeNome("Two hundred") && !scrittoComeNome("power armour") && !scrittoComeNome("of Horus"));
    // «Kilometres away, the Titan…»: a inizio frase la maiuscola non dice
    // niente. Una parola sola che apre la frase si segna solo se il capitolo
    // la scrive maiuscola anche in mezzo a una frase
    const comuni = { chiavi: new Set(["kilometres", "horus"]), max: 1 };
    const capitolo = "CHAPTER ONE\nKilometres away, the Titan stopped. Horus waited.\n\nThe Warmaster, Horus, smiled. \u201cKilometres,\u201d he said.";
    const mezzo = maiuscoleInMezzo(capitolo);
    t.c("in mezzo a una frase: «Horus» si', «Kilometres» no", mezzo.has("horus") && !mezzo.has("kilometres"));
    t.c("dopo un a capo comincia una frase, anche senza punto", !maiuscoleInMezzo("CHAPTER ONE\nKilometres").has("kilometres"));
    t.c("e dopo le virgolette aperte", !maiuscoleInMezzo("He stopped. \u201cKilometres").has("kilometres"));
    t.eq("«Kilometres» che apre la frase non si segna", nomiNelTesto("Kilometres away, the Titan stopped.", comuni, new Set(), mezzo).length, 0);
    t.eq("«Horus» che apre la frase si', perche' il capitolo lo scrive maiuscolo anche in mezzo", nomiNelTesto("Horus waited.", comuni, new Set(), mezzo)[0]?.testo, "Horus");
    t.eq("e in mezzo a una frase una parola maiuscola vale come prima", nomiNelTesto("far away Kilometres", comuni, new Set(), new Set())[0]?.testo, "Kilometres");
    const corto = { chiavi: new Set(["ork"]), max: 1 };
    t.eq("una parola sola sotto le quattro lettere non si segna", nomiNelTesto("The Ork roared", corto).length, 0);
    const pos = frase.indexOf("Loken smiled") + 2;
    t.eq("il dito su un nome segnato lo trova", nomeSottoIlDito(frase, pos, ix, parolePiccole(frase), new Set(["loken"]))?.testo, "Loken");
    t.eq("su un nome non segnato nel capitolo no: il tocco resta una voltata", nomeSottoIlDito(frase, pos, ix, parolePiccole(frase), new Set(["cadia"])), null);
    t.eq("fra due nomi, su una parola qualunque, niente", nomeSottoIlDito(frase, frase.indexOf("watched") + 1, ix, parolePiccole(frase), null), null);
  }

  {
    // un segno per voce: «Loken» porta alla stessa voce di «Garviel Loken»
    const ix = { chiavi: new Set(["garviel loken", "loken", "davin", "mournival"]), max: 2 };
    const voci = { "garviel loken": "Garviel Loken", loken: "Garviel Loken", davin: "Davin", mournival: "Mournival" };
    const risolvi = async (k) => ({ t: voci[k] });
    const gia = new Set();
    const testo = "Garviel Loken saw Davin. Loken thought of the Mournival and of Davin again.";
    const primi = await nomiDaSegnare(testo, ix, new Set(), gia, { risolvi });
    t.eq("un segno per voce, non per nome", primi.map((m) => m.testo).join("|"), "Garviel Loken|Davin|Mournival");
    t.c("ma il tocco risponde anche sull'altro nome della stessa persona", gia.has("lore:loken"));
    const dopo = await nomiDaSegnare("Davin burned. Loken wept.", ix, new Set(), gia, { risolvi });
    t.eq("nello stesso capitolo, un nome gia' segnato non si segna di nuovo", dopo.length, 0);
    const saltati = await nomiDaSegnare("Davin burned.", ix, new Set(), new Set(), { risolvi, salta: (m) => m.chiave === "davin" });
    t.eq("una voce del glossario vince sullo stesso nome di Lexicanum", saltati.length, 0);
  }

  // ---- FANDOM ----------------------------------------------------------
  // Un pezzo della voce vera di Garviel Loken sul Warhammer 40k Wiki: niente
  // citazioni per paragrafo, le fonti in fondo, il titolo del libro in
  // corsivo e il link sull'AUTORE.
  const LOKEN_FANDOM = `{{Quote|I was never a Son of Horus.| Garviel Loken's valediction to [[Horus|Horus Lupercal]]}}
[[File:Captain_Garviel_Loken_Portrait.jpg|thumb|250px|Garviel Loken, [[Captain]] of the [[Luna Wolves]].]]
'''Garviel Loken''' was originally the [[Captain]] of the [[Luna Wolves]] (later [[Sons of Horus]]) during the [[Great Crusade]].

However, after Horus' fall to [[Chaos]] on [[Davin]], he was considered too loyal.

== See Also ==
*'''[[Mournival]]'''

==Sources==
*''The Horus Heresy - Book One: Betrayal'' (Forge World Series) by Alan Bligh, pp. 46, 48
*''Horus Rising'' (Novel) by [[Dan Abnett]]
*''False Gods'' (Novel) by [[Graham McNeill]]
*''Galaxy In Flames'' (Novel) by Ben Counter
*[http://www.forgeworld.co.uk/en-GB/Abaddon-and-Loken ''Forgeworld - Abaddon vs. Loken Diorama'']

[[es:Garviel Loken]]
[[Category:Characters]]`;
  {
    const v = daWikitesto("Garviel Loken", LOKEN_FANDOM);
    t.eq("su Fandom il titolo della fonte e' il corsivo, non l'autore col link", v.fv.map((f) => f.t).slice(0, 4).join("|"), "The Horus Heresy - Book One: Betrayal|Horus Rising|False Gods|Galaxy In Flames");
    t.c("la citazione in testa e l'immagine non diventano un paragrafo", !v.p.some((b) => /valediction|Portrait/.test(testoPiano(b.x || ""))));
    const primo = v.p.find((b) => b.x);
    t.c("il link col testo uguale si scrive corto", primo.x.includes("[[Great Crusade]]") && !primo.x.includes("[[Great Crusade|Great Crusade]]"));
    t.eq("e si disegna come gli altri", JSON.stringify(pezzi("on [[Davin]].")[1]), JSON.stringify({ s: "Davin", l: "Davin", i: false }));
    t.c("i paragrafi di Fandom non hanno fonti proprie: niente veli per paragrafo", v.p.every((b) => !b.f?.length));
    // dopo il link rotto l'immagine va via e la coda di lettere si attacca
    // al link: segni che quei link sono stati letti, non copiati grezzi
    const rotto = daWikitesto("X", "Uno [[rotto e poi [[File:x.jpg|thumb|una didascalia]] e [[Davin]]s.");
    t.c("un link che non si chiude non lascia grezzi quelli dopo", !rotto.p[0].x.includes("didascalia") && rotto.p[0].x.includes("[[Davin|Davins]]"), rotto.p[0].x);

    const libri = [{ id: "hr", title: "Horus Rising", saga: "The Horus Heresy", sagaOrder: 1 }];
    const giudice = giudiceFonti(libri[0], libri, { statusOf: () => "reading", cfiOf: () => "x" });
    const a = avvisoVoce(v, giudice);
    t.c("l'avviso dice i libri delle fonti che vengono dopo", a.motivi.some((m) => /False Gods/.test(m)) && a.motivi.some((m) => /Galaxy in Flames/.test(m)));
    t.c("e anche questo stesso libro", a.motivi.some((m) => /questo libro/.test(m)));
    t.eq("i codex e le altre opere non li conta", a.motivi.length, 3);
    t.eq("lo stesso motivo da due fonti si dice una volta", avvisoVoce({ fv: [{ t: "A" }, { t: "B" }] }, () => "da questo libro").motivi.length, 1);
    t.c("una voce senza fonti lo dice", avvisoVoce(daWikitesto("Y", "Y is a world."), giudice).senzaFonti === true);
    const letti = giudiceFonti({ id: "gf", title: "Galaxy in Flames", saga: "The Horus Heresy", sagaOrder: 3 }, [
      { id: "hr", title: "Horus Rising", saga: "The Horus Heresy", sagaOrder: 1 },
      { id: "fg", title: "False Gods", saga: "The Horus Heresy", sagaOrder: 2 },
    ], { statusOf: () => "read", cfiOf: () => null });
    t.eq("con i volumi prima gia' letti resta solo questo libro", avvisoVoce(v, letti).motivi.join(""), "da questo libro, forse da più avanti");
  }
  {
    // i due wiki scendono nello stesso deposito senza pestarsi i dati
    const d = deposito();
    d.m.set("lex:davin", { t: "Davin", p: [] });
    d.m.set("lex_meta", { voci: 1 });
    const fandom = async (url) => {
      const u = new URL(url);
      if (u.host !== "warhammer40k.fandom.com" || u.pathname !== "/api.php") return { ok: false, status: 404, headers: { get: () => null } };
      const p = Object.fromEntries(u.searchParams);
      if (p.meta === "siteinfo") return { ok: true, status: 200, text: async () => JSON.stringify({ query: { general: {}, statistics: { articles: 1 } } }) };
      return { ok: true, status: 200, text: async () => JSON.stringify({ query: { pages: [{ ns: 0, title: "Garviel Loken", revisions: [{ slots: { main: { content: LOKEN_FANDOM } } }] }] } }) };
    };
    const meta = await scaricaLexicanum({ fetcher: fandom, deposito: d, attesa: async () => {}, pausa: 0, wiki: FANDOM });
    t.eq("Fandom scende col suo indirizzo", meta.voci, 1);
    t.c("nelle sue chiavi e col suo cartellino", d.m.has("fan:garviel loken") && d.m.has("fan_meta"));
    t.eq("Lexicanum resta com'era", (await statoLexicanum(d, LEXICANUM))?.voci, 1);
    t.eq("la voce di Fandom si trova in Fandom", (await voceLore("Garviel Loken", d, FANDOM))?.t, "Garviel Loken");
    t.eq("e non in Lexicanum", await voceLore("Garviel Loken", d, LEXICANUM), null);
    // un rinvio di Fandom non copre una voce vera di Fandom
    const sopra = await recordDi([{ ns: 0, title: "GARVIEL LOKEN", revisions: [{ content: "#REDIRECT [[Loken]]" }] }], d.leggi, FANDOM);
    t.eq("un rinvio di Fandom guarda le voci di Fandom", sopra.record.length, 0);
    await rimuoviLexicanum(d, FANDOM);
    t.c("rimuovere Fandom lascia Lexicanum", d.m.has("lex:davin") && d.m.has("lex_meta") && !d.m.has("fan:garviel loken") && !d.m.has("fan_meta"));
  }

  // ---- LA RIPRESA DA SOLO -----------------------------------------------
  // il giro lasciato a meta' riparte quando l'app si riapre, quello fermato
  // dal lettore no; e il fermo di un wiki non ferma l'altro
  {
    const prima = globalThis.localStorage;
    const dati = new Map();
    globalThis.localStorage = {
      getItem: (k) => (dati.has(k) ? dati.get(k) : null),
      setItem: (k, v) => dati.set(k, String(v)),
      removeItem: (k) => dati.delete(k),
    };
    try {
      const d = deposito();
      t.eq("niente giro, niente da riprendere", await giroDaRiprendere(d, LEXICANUM), null);
      await d.scrivi("lex_giro", { api: "https://x/api.php", cont: { gapcontinue: "B" }, voci: 50 });
      await d.scrivi("fan_giro", { api: "https://y/api.php", cont: { gapcontinue: "C" }, voci: 50 });
      t.eq("un giro a meta' si riprende", (await giroDaRiprendere(d, LEXICANUM))?.voci, 50);
      segnaFermato(LEXICANUM, true);
      t.eq("fermato a mano resta fermo", await giroDaRiprendere(d, LEXICANUM), null);
      t.eq("e Fandom no", (await giroDaRiprendere(d, FANDOM))?.voci, 50);
      segnaFermato(LEXICANUM, false);
      t.eq("ripreso a mano torna a riprendersi", (await giroDaRiprendere(d, LEXICANUM))?.voci, 50);
      segnaFermato(FANDOM, true);
      await rimuoviLexicanum(d, FANDOM);
      await d.scrivi("fan_giro", { api: "https://y/api.php", cont: null, voci: 0 });
      t.eq("rimosso, il fermo se ne va con lui", (await giroDaRiprendere(d, FANDOM))?.voci, 0);
    } finally {
      if (prima === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = prima;
    }
  }

  // ---- LE IMMAGINI PRINCIPALI ------------------------------------------
  // chiesto dal lettore: «passa alle immagini». Il wiki dice quale e'
  // l'immagine principale di ogni voce (pageimages) e la da' gia' ridotta
  {
    const PAGINE_IMG = [
      [{ title: "Garviel Loken", thumbnail: { source: "https://img/loken.webp" } }, { title: "Davin" }, { title: "Cadia", thumbnail: { source: "https://img/cadia.webp" } }],
      [{ title: "Horus", thumbnail: { source: "https://img/horus.webp" } }, { title: "Ullanor", thumbnail: { source: "https://img/manca.webp" } }],
    ];
    const blob = (n) => ({ size: n, type: "image/webp" });
    const wikiImg = (chieste, { bloccate = false, rete = 0 } = {}) => {
      let cadute = 0;
      return async (url) => {
        const u = new URL(url);
        chieste.push(u.href);
        if (u.hostname === "img") {
          if (bloccate) throw new TypeError("Failed to fetch");
          if (u.pathname === "/horus.webp" && cadute < rete) {
            cadute++;
            throw new TypeError("Failed to fetch");
          }
          if (u.pathname === "/manca.webp") return { ok: false, status: 404 };
          return { ok: true, status: 200, blob: async () => blob(u.pathname.length * 1000) };
        }
        const p = Object.fromEntries(u.searchParams);
        if (p.meta === "siteinfo") return { ok: true, status: 200, text: async () => JSON.stringify({ query: { general: {}, statistics: { articles: 10 } } }) };
        const i = Number(p.gapcontinue || 0);
        const corpo = { query: { pages: PAGINE_IMG[i] } };
        if (i + 1 < PAGINE_IMG.length) corpo.continue = { gapcontinue: String(i + 1), continue: "gapcontinue||" };
        return { ok: true, status: 200, text: async () => JSON.stringify(corpo) };
      };
    };
    const d = deposito();
    await d.scrivi("fan_meta", { voci: 10, api: "https://w/api.php" });
    const chieste = [];
    const misura = await misuraImmagini({ fetcher: wikiImg(chieste), deposito: d, attesa, wiki: FANDOM });
    t.c("la misura usa l'API del wiki gia' sceso, e chiede le immagini ridotte", chieste[0].startsWith("https://w/api.php") && chieste[0].includes("pithumbsize=400") && chieste[0].includes("prop=pageimages"));
    t.eq("e conta quante voci hanno l'immagine", misura.quota, 2 / 3);
    t.eq("e stima il peso sulle voci del wiki e sui pesi misurati", misura.stima, Math.round(10 * (2 / 3) * 11000));
    const senza = async (url) => ({ ok: true, status: 200, text: async () => JSON.stringify({ query: { pages: [{ title: "Davin" }, { title: "Cadia" }] } }) });
    const nessuna = await misuraImmagini({ fetcher: senza, deposito: d, attesa, wiki: FANDOM });
    t.c("un wiki che non segna l'immagine principale lo dice, senza un peso da promettere", nessuna.senzaPrincipale === true && nessuna.stima == null && nessuna.campione === 2);
    const chiuso = await misuraImmagini({ fetcher: wikiImg([], { bloccate: true }), deposito: d, attesa, wiki: FANDOM });
    t.c("un wiki che non lascia prendere le immagini si dice prima", chiuso.bloccate === true);

    let viste = 0;
    const primo = await scaricaImmagini({ fetcher: wikiImg([]), deposito: d, attesa, pausa: 0, wiki: FANDOM, fermo: () => viste++ >= 1 });
    t.c("fermato a meta' si ferma, e le immagini della prima pagina restano", primo.fermato && d.m.has("img:fan:garviel loken") && d.m.has("img:fan:cadia"));
    t.eq("e il segno della ripresa e' quello delle immagini", (await giroDaRiprendere(d, immaginiDi(FANDOM)))?.immagini, 2);
    t.c("non quello del testo, che e' gia' sceso", !d.m.has("fan_giro") && d.m.get("fan_meta")?.voci === 10);
    const chiesteDopo = [];
    const meta = await scaricaImmagini({ fetcher: wikiImg(chiesteDopo, { rete: 2 }), deposito: d, attesa, pausa: 0, wiki: FANDOM });
    t.eq("un'immagine che il wiki non ha si chiede una volta sola", chiesteDopo.filter((u) => u.endsWith("/manca.webp")).length, 1);
    t.eq("ripreso arriva in fondo: un'immagine che non c'e' e' saltata, la rete che cade si riprova", `${meta.immagini}/${meta.saltate}`, "3/1");
    t.eq("e il cartellino dice quante e quanto pesano", meta.byte, 3 * 11000);
    t.eq("l'immagine si trova dal titolo della voce", (await immagineDi("Garviel Loken", d, FANDOM))?.size, 11000);
    t.c("e una voce senza immagine non ne ha", (await immagineDi("Davin", d, FANDOM)) === null);
    t.c("e quelle di Fandom non sono di Lexicanum", (await immagineDi("Garviel Loken", d, LEXICANUM)) === null);
    t.eq("e una sola si dice al singolare", fraseImmagini({ immagini: 1, byte: 0 }), "un'immagine");
    t.eq("la riga del lavoro dice le immagini", fraseImmagini({ immagini: 12000, byte: 50 * 1048576, voci: 15000, totale: 73000 }), "12.000 immagini · 50 MB · 15.000 voci guardate di circa 73.000");

    const chiusa = deposito();
    await chiusa.scrivi("fan_meta", { voci: 10, api: "https://w/api.php" });
    const tre = [{ title: "A", thumbnail: { source: "https://img/a.webp" } }, { title: "B", thumbnail: { source: "https://img/b.webp" } }, { title: "C", thumbnail: { source: "https://img/c.webp" } }];
    PAGINE_IMG.unshift(tre);
    let guaio = "";
    await scaricaImmagini({ fetcher: wikiImg([], { bloccate: true }), deposito: chiusa, attesa, pausa: 0, wiki: FANDOM }).catch((e) => (guaio = e.message));
    PAGINE_IMG.shift();
    t.c("se dalla prima pagina non arriva nessuna immagine, il giro si ferma e lo dice", /non lascia salvare le sue immagini/.test(guaio));

    // Lexicanum non segna l'immagine principale: la sua voce prende quella
    // della stessa voce di Fandom, anche passando da un rinvio di Fandom
    const perLoken = await immaginePerVoce("Garviel Loken", d, LEXICANUM);
    t.c("la voce di Lexicanum prende l'immagine di Fandom, e dice da dove viene", perLoken?.blob?.size === 11000 && perLoken.da === FANDOM);
    await d.scrivi("fan:garviel loken", { t: "Garviel Loken", p: [], f: {} });
    await d.scrivi("fan:loken", { t: "Loken", r: "Garviel Loken" });
    t.eq("anche se su Fandom quel nome e' un rinvio", (await immaginePerVoce("Loken", d, LEXICANUM))?.blob?.size, 11000);
    await d.scrivi("img:lex:cadia", blob(5000));
    t.c("ma la sua, se c'e', vince", (await immaginePerVoce("Cadia", d, LEXICANUM))?.da === LEXICANUM);
    t.eq("una voce senza immagine da nessuna parte resta senza", await immaginePerVoce("Davin", d, LEXICANUM), null);
    await rimuoviImmagini(d, FANDOM);
    t.c("rimuovere le immagini lascia il testo", !d.m.has("img:fan:cadia") && !d.m.has("fan_img_meta") && d.m.has("fan_meta") && (await statoImmagini(d, FANDOM)) === null);
  }

  // ---- LE ALTRE ILLUSTRAZIONI DI FANDOM ---------------------------------
  // chiesto dal lettore, misurato, provato sulla microSD e scelto: nella
  // memoria dell'app. Prima l'elenco dei file di ogni voce, poi i file
  // distinti, meno principale, SVG, icone dei modelli e immagini piccole
  {
    const ELENCO = [
      // una pagina di voci i cui file non stanno in una risposta sola
      {
        pages: [
          { title: "Garviel Loken", pageimage: "Loken.jpg", images: [{ title: "File:Loken.jpg" }, { title: "File:Loken e Torgaddon.jpg" }, { title: "File:Aquila.svg" }] },
          { title: "Davin", images: [{ title: "File:Davin Moon.jpg" }, { title: "File:Stemma.png" }] },
          { title: "Cadia" },
        ],
        continue: { imcontinue: "1|Lupercal", continue: "gapcontinue||" },
      },
      { pages: [{ title: "Garviel Loken", images: [{ title: "File:Lupercal's Court.jpg" }] }], continue: { gapcontinue: "Horus", continue: "gapcontinue||" } },
      {
        pages: [
          { title: "Horus", pageimage: "Horus.jpg", images: [{ title: "File:Horus.jpg" }, { title: "File:Lupercal's Court.jpg" }, { title: "File:Stemma.png" }] },
          { title: "Ullanor", images: [{ title: "File:Stemma.png" }, { title: "File:Piccola.png" }] },
        ],
      },
    ];
    const pesoA = (lato) => (lato === "250" ? 18000 : 37000);
    const wikiIll = (chieste, { bloccate = false } = {}) => async (url) => {
      const u = new URL(url);
      chieste.push(u.href);
      if (u.hostname === "static.wikia.nocookie.net") {
        if (bloccate) throw new TypeError("Failed to fetch");
        if (u.pathname.includes("Davin")) return { ok: false, status: 404 };
        return { ok: true, status: 200, blob: async () => ({ size: pesoA(u.pathname.split("/").pop()), type: "image/webp" }) };
      }
      const p = Object.fromEntries(u.searchParams);
      const json = (x) => ({ ok: true, status: 200, text: async () => JSON.stringify(x) });
      if (p.meta === "siteinfo") return json({ query: { general: {}, statistics: { articles: 10 } } });
      if (p.prop === "imageinfo") {
        const pages = p.titles.split("|").map((title) => {
          const piccola = /Piccola/.test(title);
          return { title, imageinfo: [{ mime: "image/jpeg", width: piccola ? 60 : 800, height: piccola ? 60 : 600, thumburl: `https://static.wikia.nocookie.net/w/images/${encodeURIComponent(title)}/revision/latest/scale-to-width-down/${p.iiurlwidth}` }] };
        });
        return json({ query: { pages } });
      }
      const i = p.imcontinue ? 1 : p.gapcontinue ? 2 : 0;
      const { pages, continue: cont } = ELENCO[i];
      return json({ query: { pages }, ...(cont ? { continue: cont } : {}) });
    };

    t.eq("la didascalia e' il nome del file, senza «File:», trattini bassi ed estensione", didascaliaDi("File:Horus_Lupercal.jpeg"), "Horus Lupercal");
    const perVoce = fileDelleVoci(ELENCO[0].pages);
    t.eq("i file di una voce, senza la sua immagine principale e senza gli SVG", (perVoce.get("garviel loken") || []).join("|"), "Loken e Torgaddon.jpg");

    const d = deposito();
    await d.scrivi("fan_meta", { voci: 10, api: "https://w/api.php" });
    const chieste = [];
    const m = await misuraIllustrazioni({ fetcher: wikiIll(chieste), deposito: d, attesa, wiki: FANDOM });
    t.c("la misura parte da una lettera di mezzo, come quella delle immagini", chieste.some((u) => u.includes("gapfrom=G") && u.includes("prop=images")));
    t.c("e pesa le stesse illustrazioni alle due misure", m.stime[250] < m.stime[400] && m.stime[250] === m.stimaQuante * 18000 && m.stime[400] === m.stimaQuante * 37000);
    const chiusa = await misuraIllustrazioni({ fetcher: wikiIll([], { bloccate: true }), deposito: d, attesa, wiki: FANDOM });
    t.c("un wiki che non lascia prendere le illustrazioni si dice prima", chiusa.bloccate === true);

    let viste = 0;
    const primo = await scaricaIllustrazioni({ fetcher: wikiIll([]), deposito: d, attesa, pausa: 0, wiki: FANDOM, lato: 250, iconaDa: 3, fermo: () => viste++ >= 1 });
    t.c("fermato durante l'elenco si ferma, e il giro resta da riprendere", primo.fermato && primo.fase === "elenco" && !!(await giroDaRiprendere(d, illustrazioniDi(FANDOM))));
    const chiesteDopo = [];
    let vociViste = 0;
    const meta = await scaricaIllustrazioni({ fetcher: wikiIll(chiesteDopo), deposito: d, attesa, pausa: 0, wiki: FANDOM, lato: 250, iconaDa: 3, onProgress: (p) => (vociViste = Math.max(vociViste, p.voci || 0)) });
    t.eq("le voci guardate si contano una volta, anche quelle i cui file stanno in due risposte", vociViste, 5);
    t.eq("i file di una voce in piu' risposte si sommano", (await d.leggi("illv:fan:garviel loken")).join("|"), "Loken e Torgaddon.jpg|Lupercal's Court.jpg");
    t.c("un file in piu' voci si scarica una volta sola", chiesteDopo.filter((u) => u.includes("Lupercal") && u.includes("static.")).length === 1);
    t.c("le icone dei modelli (in tante voci) non si chiedono", !chiesteDopo.some((u) => u.includes("Stemma")));
    t.c("l'immagine principale non si richiede", !chiesteDopo.some((u) => /Loken\.jpg|Horus\.jpg/.test(decodeURIComponent(u)) && u.includes("static.")));
    t.c("le illustrazioni alla misura scelta", chiesteDopo.filter((u) => u.includes("static.")).every((u) => u.endsWith("/250")) && d.m.get("ill:fan:loken e torgaddon jpg")?.size === 18000);
    t.c("quelle piccole e quelle che non arrivano restano fuori, e si contano", meta.immagini === 2 && meta.saltate === 2 && meta.lato === 250);
    t.c("finito, il giro e la lista se ne vanno", !d.m.has("fan_ill_giro") && !d.m.has("fan_ill_lista") && (await statoIllustrazioni(d, FANDOM))?.immagini === 2);

    const diLoken = await illustrazioniPerVoce("Garviel Loken", d, FANDOM);
    t.eq("una voce mostra le sue illustrazioni, nell'ordine in cui le cita", diLoken.map((x) => x.didascalia).join("|"), "Loken e Torgaddon|Lupercal's Court");
    await d.scrivi("fan:garviel loken", { t: "Garviel Loken", p: [], f: {} });
    await d.scrivi("fan:loken", { t: "Loken", r: "Garviel Loken" });
    t.eq("la voce di Lexicanum prende quelle di Fandom, anche da un rinvio", (await illustrazioniPerVoce("Loken", d, LEXICANUM)).length, 2);
    t.eq("una voce di Fandom senza illustrazioni resta senza", (await illustrazioniPerVoce("Loken", d, FANDOM)).length, 0);

    const giaFatto = await scaricaIllustrazioni({ fetcher: wikiIll([]), deposito: d, attesa, pausa: 0, wiki: FANDOM });
    t.eq("un giro gia' finito non riparte", giaFatto.immagini, 2);

    const chiusoD = deposito();
    await chiusoD.scrivi("fan_meta", { voci: 10, api: "https://w/api.php" });
    let guaio = "";
    await scaricaIllustrazioni({ fetcher: wikiIll([], { bloccate: true }), deposito: chiusoD, attesa, pausa: 0, wiki: FANDOM, iconaDa: 3 }).catch((e) => (guaio = e.message));
    t.c("se dal primo blocco non arriva niente, il giro si ferma e lo dice", /non lascia salvare le sue illustrazioni/.test(guaio));

    await rimuoviIllustrazioni(d, FANDOM);
    t.c("rimuovere le illustrazioni toglie file ed elenchi, e lascia il resto", ![...d.m.keys()].some((k) => k.startsWith("ill:fan:") || k.startsWith("illv:fan:")) && !d.m.has("fan_ill_meta") && d.m.has("fan_meta"));

    t.eq("la riga dell'elenco", fraseIllustrazioni({ fase: "elenco", voci: 1200, totale: 7300 }), "elenco: 1200 voci guardate di circa 7300");
    t.eq("la riga delle illustrazioni", fraseIllustrazioni({ fase: "immagini", immagini: 3400, byte: 60 * 1048576, i: 4000, file: 20000 }), "3400 illustrazioni · 60 MB · 4000 file guardati di 20.000");
  }

  // ---- IL RIEPILOGO DEI WIKI --------------------------------------------
  {
    const tutto = riepilogoWiki({ lex: { voci: 50208 }, fan: { voci: 7314 }, img: { immagini: 5822, byte: 141 * 1048576 }, ill: { immagini: 17526, byte: 605 * 1048576, lato: 400 } });
    t.c("tutto sceso: si dice che non c'e' altro da scaricare", tutto.tutto && /non c'è altro da scaricare/.test(tutto.frase) && tutto.righe.every((r) => r.stato === "fatto"));
    t.eq("ogni riga dice cosa c'e'", tutto.righe.map((r) => r.dettaglio).join(" | "), "50.208 voci | 7314 voci | 5822 immagini · 141 MB | 17.526 illustrazioni · 605 MB · 400 px");
    const poco = riepilogoWiki({ lex: { voci: 10 }, illGiro: null });
    t.eq("senza Fandom, le sue immagini vengono dopo di lui", poco.righe.map((r) => r.stato).join(","), "fatto,manca,dopo,dopo");
    t.eq("e la frase dice cosa manca", poco.frase, "Da scaricare: Fandom, Immagini principali di Fandom, Altre illustrazioni di Fandom.");
    const meta = riepilogoWiki({ lex: { voci: 10 }, fan: { voci: 5 }, img: { immagini: 1, byte: 1 }, illGiro: { api: "x" } });
    t.c("un giro a meta' si dice da riprendere", meta.righe[3].stato === "aMeta" && /riprendi/.test(meta.righe[3].dettaglio) && !meta.tutto);
    t.eq("una riga senza giro e col wiki sceso e' da scaricare", riepilogoWiki({ lex: { voci: 1 }, fan: { voci: 1 } }).righe[2].stato, "manca");
    t.eq("una voce sola si dice al singolare", riepilogoWiki({ lex: { voci: 1 } }).righe[0].dettaglio, "una voce");
  }

  // ---- L'IMMAGINE ACCANTO ALLA DEFINIZIONE -------------------------------
  t.eq("su Fandom, letto l'avviso, l'immagine sta accanto alla definizione", figuraBreve({ wiki: FANDOM, haFigura: true, chiusa: false, svelata: false }), "visibile");
  t.eq("su Fandom, avviso ancora chiuso, niente immagine", figuraBreve({ wiki: FANDOM, haFigura: true, chiusa: true, svelata: false }), "niente");
  t.eq("su Lexicanum l'immagine sta velata", figuraBreve({ wiki: LEXICANUM, haFigura: true, chiusa: false, svelata: false }), "velata");
  t.eq("e toccato il velo si vede", figuraBreve({ wiki: LEXICANUM, haFigura: true, chiusa: false, svelata: true }), "visibile");
  t.eq("senza immagine non c'e' velo da toccare", figuraBreve({ wiki: LEXICANUM, haFigura: false, chiusa: false, svelata: false }), "niente");

  // ---- LA RIGA DEL LAVORO -----------------------------------------------
  t.eq("la riga del lavoro dice voci, totale e peso", fraseLexicanum({ voci: 12400, totale: 45000, byte: 85 * 1048576 }), "12.400 voci di circa 45.000 · 85 MB");
  t.eq("senza totale non si inventa", fraseLexicanum({ voci: 3, byte: 0 }), "3 voci");
  t.eq("e sotto il mega non si dice «0 MB»", fraseLexicanum({ voci: 3, byte: 4000 }), "3 voci");
  t.eq("e dice quando aspetta la rete", fraseLexicanum({ voci: 3, attesa: "rete" }), "3 voci · aspetto la rete…");

  // ---- I PEZZI ----------------------------------------------------------
  const p = pezzi("The ''[[Horus Rising (Novel)|Horus Rising]]'' and [[Ullanor|the Triumph]].");
  t.eq("link e corsivi si separano", JSON.stringify(p.map((x) => [x.s, x.l || "", !!x.i])), JSON.stringify([
    ["The ", "", false],
    ["Horus Rising", "Horus Rising (Novel)", true],
    [" and ", "", false],
    ["the Triumph", "Ullanor", false],
    [".", "", false],
  ]));

  // ---- UN NOME, PIU' VOCI ------------------------------------------------
  // Il caso del lettore in Mechanicum: «Reavers» rinvia ai Reaver Jetbike, e
  // nel paragrafo sono i Titani classe Reaver
  {
    const d = deposito();
    const V = (t, testo) => ({ t, p: [{ x: testo }] });
    d.m.set("lex:reavers", { t: "Reavers", r: "Reaver Jetbike" });
    d.m.set("lex:reaver jetbike", V("Reaver Jetbike", "Reaver Jetbikes are the twisted Dark Eldar cousins of the Eldar Jetbikes, racing ahead with anti-grav technology."));
    d.m.set("lex:reaver titan", V("Reaver Titan", "The Reaver is a Battle Titan of the Collegia Titanica. Its Princeps commands the engine from the cockpit, behind void shields, with a turbo laser and a melta cannon."));
    d.m.set("lex:reaver-class titan", { t: "Reaver-class Titan", r: "Reaver Titan" });
    d.m.set("lex:reavers dark eldar", V("Reavers (Dark Eldar)", "A gang of Commorragh."));
    d.m.set("lex:reaverine", V("Reaverine", "Una parola che comincia allo stesso modo, ma è un'altra."));
    const paragrafo =
      "Princeps Kasim in Raptoria darted through the ruins of the Arsia sub-silos to unleash a furious barrage into one of the flanking Reavers. The towering engine's shields soaked up the fire of the smaller war machine.";
    const trovata = await voceLore("Reavers", d);
    t.eq(
      "le altre voci col nome davanti, una per voce, senza la trovata",
      (await altreVoci("reavers", trovata, d)).map((v) => v.t).join(" | "),
      "Reaver Titan | Reavers (Dark Eldar)"
    );
    const r = await voceNelContesto("flanking Reavers", paragrafo, d);
    t.eq("dal paragrafo, il Titano", r?.voce.t, "Reaver Titan");
    t.eq("…e lo dice", r?.voce.dalParagrafo, true);
    t.eq("…e la voce del wiki passa fra le altre, in testa", r?.altre.map((v) => v.t).join(" | "), "Reaver Jetbike | Reavers (Dark Eldar)");
    const senza = await voceNelContesto("Reavers", "", d);
    t.eq("senza paragrafo resta la voce del wiki", `${senza?.voce.t} ${!!senza?.voce.dalParagrafo}`, "Reaver Jetbike false");
    t.eq("…con le altre sotto", senza?.altre.length, 2);
    t.eq("una parola sola in comune non basta a cambiare", sceltaDalContesto(trovata, [V("Reaver Titan", "engine")], "the engine roared"), trovata);
    t.eq("il plurale è la stessa parola", sceltaDalContesto(trovata, [V("Reaver Titan", "engine shield")], "the engines shields")?.t, "Reaver Titan");
    t.eq("due bastano", sceltaDalContesto(trovata, [V("Reaver Titan", "engine shields")], "the engine shields roared")?.t, "Reaver Titan");
    // il nome cercato non conta: la voce del wiki qui non lo nomina, e
    // l'altra lo porterebbe come un punto in più
    const raider = V("Raider", "A Dark Eldar transport.");
    t.eq("il nome cercato non è un indizio", sceltaDalContesto(raider, [V("Reaver Titan", "Reaver engine")], "the Reavers engine", "reavers"), raider);
    t.eq("nemmeno al plurale", (await voceNelContesto("Reavers", "", d))?.altre.some((v) => v.t === "Reaverine"), false);
    t.eq("e un nome senza altre voci non ne ha", (await voceNelContesto("Reaverine", paragrafo, d))?.altre.length, 0);
    // e Fandom, con le sue chiavi
    const f = deposito();
    f.m.set("fan:reaver", { t: "Reaver", r: "Reavers (Drukhari)" });
    f.m.set("fan:reavers drukhari", V("Reavers (Drukhari)", "Drukhari jetbike riders."));
    f.m.set("fan:reaver-class titan", V("Reaver-class Titan", "A Battle Titan: the Princeps and the engine, void shields."));
    t.eq("su Fandom il Titano dal paragrafo", (await voceNelContesto("Reaver", paragrafo, f, FANDOM))?.voce.t, "Reaver-class Titan");
  }
}

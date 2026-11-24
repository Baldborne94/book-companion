// WIKTIONARY INGLESE SUL DISPOSITIVO.
//
// Chiesto dal lettore: «non voglio solo il dizionario inglese italiano ma
// anche il dizionario solo inglese che mi da' il significato delle parole».
// Tre parti che sbagliano in silenzio:
//
//   - la RIDUZIONE dei dati di wiktextract (gira nella CI, su un milione di
//     voci: una regola sbagliata non da' errori, da' un dizionario povero o
//     pieno di cognomi e alfabeti che un romanzo inglese non usa);
//   - lo SCARICAMENTO a file, che si riprende: un file saltato e' un'iniziale
//     intera che risponde «non la conosco»;
//   - il POSTO nella scheda: deve rispondere al posto della rete, anche sulle
//     forme flesse e sui modi di dire, senza chiamare Wiktionary in rete.
import { gzipSync } from "node:zlib";
import {
  saccoWikt,
  fileDi,
  chiaveKaikki,
  sensiDaKaikki,
  accoda,
  LIMITI,
  scaricaWiktionary,
  statoWiktionary,
  giroWiktionary,
  rimuoviWiktionary,
  sensiWikt,
  fraseWiktionary,
} from "../src/lib/wiktionaryOffline.js";
import { lookup, lookupPhrase, usaWiktionaryLocale, usaDizionarioLocale } from "../src/lib/dictionary.js";

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

export default async function (t) {
  // ---- I SACCHI E I FILE --------------------------------------------------
  t.eq("tre lettere fanno il sacco", saccoWikt("grim"), "wik:gri");
  t.eq("le maiuscole non fanno un sacco a parte", saccoWikt("Grim"), saccoWikt("grim"));
  t.eq("una locuzione sta col suo prefisso", saccoWikt("kick the bucket"), "wik:kic");
  t.eq("lo spazio dentro il prefisso diventa un trattino basso", saccoWikt("a la carte"), "wik:a_l");
  t.eq("il file e' l'iniziale", fileDi("grim"), "g");
  t.eq("cifre e segni stanno nel file «_»", fileDi("1st"), "_");
  // il patto fra chi costruisce e chi cerca: il sacco di una parola sta nel
  // file della sua iniziale, o la ripresa file per file lascerebbe sacchi
  // a meta'
  for (const w of ["grim", "a", "kick the bucket", "o'clock", "well-known", "22", "élan"]) {
    const s = saccoWikt(w);
    t.eq(`«${w}»: il sacco e il file vanno d'accordo`, fileDi(w), /[a-z]/.test(s[4]) ? s[4] : "_");
  }

  // ---- LA RIDUZIONE -------------------------------------------------------
  t.eq("la chiave e' minuscola", chiaveKaikki("Grim"), "grim");
  t.eq("una voce di cinque parole e' una frase, non una voce", chiaveKaikki("one two three four five"), null);
  t.eq("un alfabeto che un romanzo inglese non usa resta fuori", chiaveKaikki("грим"), null);
  t.eq("gli accenti latini restano", chiaveKaikki("élan"), "élan");

  const grim = {
    word: "grim",
    pos: "adj",
    lang_code: "en",
    senses: [
      { raw_glosses: ["Dismal and gloomy."], glosses: ["Dismal and gloomy."], examples: [{ text: "Life was grim." }] },
      { raw_glosses: ["(archaic) Fierce, ferocious."], examples: [{ text: "una citazione lunga", ref: "1590, Spenser", type: "quotation" }] },
      { glosses: ["parent", "Ghastly or sinister."] },
      { glosses: ["teh"], tags: ["misspelling"] },
    ],
  };
  const sensi = sensiDaKaikki(grim);
  t.eq("tre sensi su quattro (il refuso fuori)", sensi.length, 3);
  t.eq("la glossa «raw» tiene l'etichetta", sensi[1][1], "(archaic) Fierce, ferocious.");
  t.eq("l'esempio corto si tiene", sensi[0][2], "Life was grim.");
  t.c("la citazione con la fonte no", sensi[1].length === 2);
  t.eq("del sottosenso si prende la glossa piu' precisa", sensi[2][1], "Ghastly or sinister.");
  t.eq("un nome proprio non entra", sensiDaKaikki({ ...grim, pos: "name" }).length, 0);
  t.eq("una voce di un'altra lingua non entra", sensiDaKaikki({ ...grim, lang_code: "de" }).length, 0);
  const forme = sensiDaKaikki({
    word: "x",
    pos: "noun",
    lang_code: "en",
    senses: [1, 2, 3, 4].map((i) => ({ glosses: [`plural of y${i}`], form_of: [{ word: `y${i}` }] })),
  });
  t.eq("le forme flesse si dicono al massimo due volte", forme.length, LIMITI.forme);

  const voce = accoda([], sensi);
  accoda(voce, [["n", "A ghost.", "un esempio"], ["n", "Dismal and gloomy."]]);
  t.eq("i sensi di un'altra categoria si accodano", voce.length, 4);
  t.c("lo stesso senso non si ripete", voce.filter((s) => s[1] === "Dismal and gloomy.").length === 1);
  const lunga = accoda([], Array.from({ length: 15 }, (_, i) => ["n", `senso ${i}`, `esempio ${i}`]));
  t.eq("una voce non supera il tetto dei sensi", lunga.length, LIMITI.sensiPerVoce);
  t.c("gli esempi solo sui primi sensi", lunga[LIMITI.esempi - 1].length === 3 && lunga[LIMITI.esempi].length === 2);

  // ---- LO SCARICAMENTO ----------------------------------------------------
  const FILE = {
    g: { "wik:gri": { grim: [["a", "Dismal and gloomy.", "Life was grim."]] } },
    k: { "wik:kic": { "kick the bucket": [["v", "(idiomatic) To die."]] } },
    s: { "wik:sul": { sullen: [["a", "Sulky."]] } },
  };
  const gz = (o) => gzipSync(JSON.stringify(o));
  const fintoSito = (chiesti, { versione = 1, guastoSu = null } = {}) => async (url) => {
    chiesti.push(url);
    if (url.endsWith("/meta.json")) {
      return {
        ok: true,
        json: async () => ({ voci: 3, versione, file: Object.keys(FILE).map((n) => ({ n, byte: gz(FILE[n]).length })) }),
      };
    }
    const n = url.match(/\/(\w)\.json\.gz$/)?.[1];
    if (n === guastoSu) throw new TypeError("Failed to fetch");
    const byte = gz(FILE[n]);
    return { ok: true, headers: { get: () => String(byte.length) }, arrayBuffer: async () => byte, body: null };
  };

  {
    const d = deposito();
    const chiesti = [];
    let n = 0;
    const primo = await scaricaWiktionary({ fetcher: fintoSito(chiesti), deposito: d, fermo: () => n++ >= 1 });
    t.c("fermato a meta' lo dice", primo.fermato === true);
    t.eq("e non si dichiara sul dispositivo", await statoWiktionary(d), null);
    t.eq("ma ricorda i file fatti", JSON.stringify((await giroWiktionary(d)).fatti), '["g"]');
    const meta = await scaricaWiktionary({ fetcher: fintoSito(chiesti), deposito: d });
    t.eq("ripreso, arriva in fondo", meta.voci, 3);
    const file = chiesti.filter((u) => u.endsWith(".gz")).map((u) => u.match(/(\w)\.json/)[1]);
    t.eq("senza riscaricare il file gia' fatto", file.join(","), "g,k,s");
    t.c("il cartellino per ultimo", d.scritture.at(-1) === "wik_meta");
    const segni = d.scritture.map((k, i) => (k === "wik_giro" ? i : -1)).filter((i) => i >= 0);
    t.c("i sacchi di un file prima del segno che lo da' per fatto", d.scritture.indexOf("wik:kic") < segni[1]);
    t.eq("il giro a meta' se ne va", await giroWiktionary(d), null);
    const g = await sensiWikt("Grim", d);
    t.eq("la parola si trova, con la categoria per nome", JSON.stringify(g[0]), '["adjective","Dismal and gloomy.","Life was grim."]');
    t.eq("una parola che non c'e' torna vuota", (await sensiWikt("zzz", d)).length, 0);
    await rimuoviWiktionary(d);
    t.eq("rimosso, non resta niente", d.m.size, 0);
  }
  {
    // il dizionario sul sito e' stato rifatto a meta' ripresa: si riparte
    // da capo, non si mescolano due annate
    const d = deposito();
    let n = 0;
    await scaricaWiktionary({ fetcher: fintoSito([]), deposito: d, fermo: () => n++ >= 1 });
    const chiesti = [];
    await scaricaWiktionary({ fetcher: fintoSito(chiesti, { versione: 2 }), deposito: d });
    t.eq("con un'altra versione si rifanno tutti i file", chiesti.filter((u) => u.endsWith(".gz")).length, 3);
  }
  {
    const d = deposito();
    let guaio = null;
    await scaricaWiktionary({ fetcher: fintoSito([], { guastoSu: "k" }), deposito: d }).catch((e) => (guaio = e));
    t.c("una rete che cade non passa in silenzio", !!guaio);
    t.eq("e il file fatto resta per la ripresa", JSON.stringify((await giroWiktionary(d))?.fatti), '["g"]');
  }
  {
    // il server manda il file gia' aperto: arrivano i byte del JSON, non
    // quelli del .gz, e il conto non deve superare il totale
    const d = deposito();
    const passi = [];
    const aperto = async (url) => {
      if (url.endsWith("/meta.json")) return fintoSito([])(url);
      const n = url.match(/\/(\w)\.json\.gz$/)[1];
      const byte = new TextEncoder().encode(JSON.stringify(FILE[n]) + " ".repeat(400));
      return { ok: true, headers: { get: () => null }, arrayBuffer: async () => byte, body: null };
    };
    await scaricaWiktionary({ fetcher: aperto, deposito: d, onProgress: (p) => passi.push(p) });
    const ultimo = passi.at(-1);
    t.c("un file arrivato gia' aperto si legge lo stesso", (await sensiWikt("sullen", d)).length === 1);
    t.eq("e il conto finisce sul totale, non oltre", ultimo.scaricati, ultimo.totale);
  }
  t.eq("la riga del lavoro", fraseWiktionary({ fatti: 3, file: 27, scaricati: 5 * 1048576, totale: 28 * 1048576 }), "3 di 27 parti · 5 MB di 28 MB");
  t.eq("prima del cartellino non dice «0 di 0»", fraseWiktionary({ fatti: 0, file: 0 }), "comincio…");

  // ---- NELLA SCHEDA, AL POSTO DELLA RETE ---------------------------------
  const QUI = {
    baleful: [["adjective", "Portending evil; ominous.", "a baleful glare"]],
    cudgels: [["noun", "plural of cudgel"]],
    cudgel: [["noun", "A short heavy club."], ["verb", "To beat with a cudgel."]],
    "beat around the bush": [["verb", "(idiomatic) To avoid getting to the point."]],
    grimmest: [["adjective", "Dismal and gloomy."], ["noun", "(obsolete) A ghost."]],
    "kicked the pail": [["verb", "simple past and past participle of kick the pail"]],
    "kick the pail": [["verb", "(idiomatic) To die."]],
  };
  usaWiktionaryLocale(async (p) => QUI[p] || []);
  usaDizionarioLocale(async () => []);
  const vecchioFetch = globalThis.fetch;
  const inRete = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("wiktionary.org")) inRete.push(u);
    return u.includes("mymemory") ? { ok: true, json: async () => ({ matches: [] }) } : { ok: false };
  };
  try {
    const b = await lookup("baleful", "en");
    t.c("la parola risponde dal dispositivo", /ominous/.test(b.entries[0]?.text || ""), JSON.stringify(b.entries));
    t.eq("con la categoria in italiano", b.entries[0]?.pos, "aggettivo");
    t.eq("e il suo esempio", b.entries[0]?.es, "a baleful glare");
    t.c("segnata come «sul dispositivo», per la banda della scheda", b.entries[0]?.qui === true);
    const c = await lookup("cudgels", "en");
    t.eq("la forma flessa rimanda alla base, sul dispositivo", c.lemma, "cudgel");
    t.c("coi sensi veri della base", c.entries.some((e) => /heavy club/.test(e.text)), JSON.stringify(c.entries));
    const o = await lookup("grimmest", "en");
    t.eq("i sensi restano nell'ordine di Wiktionary: il principale prima", o.entries.map((e) => e.pos).join(","), "aggettivo,sostantivo");
    const k = await lookupPhrase("old Vorn kicked the pail", "en");
    t.eq("il modo di dire al passato si spiega alla sua forma base", k.word, "kick the pail");
    t.c("coi sensi veri, non col rimando", /To die/.test(k.entries[0]?.text || ""), JSON.stringify(k.entries));
    const f = await lookupPhrase("he was beating around the bush", "en");
    t.eq("il modo di dire si trova sul dispositivo, dalla forma base", f.word, "beat around the bush");
    t.eq("e Wiktionary in rete non si chiama mai", inRete.join(" "), "");
  } finally {
    usaWiktionaryLocale(null);
    usaDizionarioLocale(null);
    globalThis.fetch = vecchioFetch;
  }
}

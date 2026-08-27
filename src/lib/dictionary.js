import { getAux, putAux } from "./bookStore.js";

const CACHE = new Map();
const AUX_KEY = "dict_cache";
const MAX_WORDS = 600;

// L'endpoint /page/definition esiste SOLO su en.wiktionary: sugli altri
// Wiktionary risponde 404, quindi il vecchio ripiego "prima l'italiano"
// falliva in silenzio su ogni parola. Le definizioni arrivano da
// en.wiktionary; la glossa italiana da MyMemory (gratuito, senza chiavi).
//
// QUESTO DIZIONARIO E' STATO TOLTO UNA VOLTA E POI RIMESSO, e la ragione
// per cui era stato tolto va tenuta a mente da chi lo tocca: le definizioni
// uscivano MACINATE A MACCHINA in italiano e finivano storte accanto al
// Collins di sistema. La cura non e' cosmetica ed e' in due parti:
// (1) la definizione NON SI TRADUCE PIU' — resta in lingua, come fa il
//     Collins nel suo primo riquadro, e cosi' non c'e' niente da storpiare;
// (2) a macchina si traduce solo la PAROLA, e solo da memorie il cui
//     segmento e' esattamente quella parola (vedi `fetchTranslation`).
// Chi rimette la traduzione delle glosse rimette anche il difetto.

// La cache vive anche fuori dalla sessione: le parole gia' cercate restano
// consultabili senza rete, che e' la condizione normale di chi legge in
// viaggio. In memoria per la velocita', su IndexedDB per il ritorno.

// DOMParser invece di innerHTML: il documento e' inerte, niente script o img
const strip = (html) => {
  try {
    const doc = new DOMParser().parseFromString(String(html), "text/html");
    return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
};

export const cleanWord = (raw) =>
  String(raw || "")
    .replace(/[.,;:!?«»"“”'’()\[\]…—–-]/g, " ")
    .trim()
    .replace(/\s+/g, " ");

export const wordCount = (s) => (cleanWord(s) ? cleanWord(s).split(" ").length : 0);

// prima quello che si cerca leggendo, in fondo le curiosita' grammaticali
const POS_ORDER = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "interjection",
  "determiner",
  "numeral",
  "proper noun",
];

const POS_IT = {
  noun: "sostantivo",
  verb: "verbo",
  adjective: "aggettivo",
  adverb: "avverbio",
  pronoun: "pronome",
  preposition: "preposizione",
  conjunction: "congiunzione",
  interjection: "interiezione",
  determiner: "determinante",
  numeral: "numerale",
  "proper noun": "nome proprio",
  participle: "participio",
  article: "articolo",
};

const rank = (pos) => {
  const i = POS_ORDER.indexOf(pos.toLowerCase());
  return i < 0 ? POS_ORDER.length : i;
};

// Sulle forme flesse Wiktionary non spiega: rimanda. «gutters» ha come unica
// definizione "plural of gutter", che a chi legge non dice nulla. Il rimando
// va seguito: la scheda mostra la natura della forma (in italiano) e sotto i
// significati veri della parola base.
const FORME = [
  [/third-person singular/, "terza persona singolare di"],
  [/past (?:tense|participle) and (?:past )?participle|past tense and past participle/, "passato e participio passato di"],
  [/past participle/, "participio passato di"],
  [/past tense|simple past/, "passato di"],
  [/present participle|gerund/, "participio presente di"],
  [/\bplural\b/, "plurale di"],
  [/comparative/, "comparativo di"],
  [/superlative/, "superlativo di"],
  [/diminutive/, "diminutivo di"],
  [/contraction/, "contrazione di"],
  [/(?:alternative|archaic|obsolete|dated|nonstandard|informal) (?:form|spelling|letter-case form)|alternative case form|pronunciation spelling|eye dialect/, "variante di"],
];

export function formaDi(text) {
  const m = /^(.*?\bof)\s+([a-z' -]+?)[.;,]?$/i.exec(String(text || "").trim());
  if (!m) return null;
  const lemma = m[2].trim().toLowerCase();
  if (!lemma || lemma.split(/\s+/).length > 3) return null;
  const desc = m[1].toLowerCase();
  for (const [re, label] of FORME) {
    if (re.test(desc)) return { lemma, label };
  }
  return null;
}

// UNA DEFINIZIONE CHE RIMANDA A UN'ALTRA PAROLA NON SPIEGA NIENTE.
//
// «gormlessness» ha come unica definizione «The quality or state of being
// gormless»: chi non sa cosa vuol dire «gormless» chiude la scheda
// esattamente dov'era, e il vocabolario non ha fatto il suo mestiere
// (chiesto dal lettore: «quando succede questo ho bisogno che mi dai anche
// la definizione della parola, in questo caso gormless»).
//
// E' il gemello di `formaDi`, ma per le forme DERIVATE, e la differenza
// conta: li' la parola base e' la STESSA parola in un'altra veste, e i suoi
// sensi si possono accodare come fossero suoi; qui e' un'ALTRA parola, e
// accodarne i sensi direbbe che «gormlessness» significa «stupido». La sua
// definizione va mostrata a parte, rientrata, come il rimando di un
// vocabolario di carta.
//
// Le forme si riconoscono solo quando occupano la definizione INTERA: una
// glossa che nomina un'altra parola di sfuggita («a hat worn by wizards»)
// non e' un rimando, e inseguirla riempirebbe la scheda di parole che
// nessuno ha chiesto.
const DERIVATE = [
  // gormlessness → gormless; kindness → kind
  /^(?:the\s+)?(?:quality|state|condition|property|fact)(?:\s+or\s+(?:quality|state|condition|property))?\s+of\s+being\s+([a-z][a-z'-]*)\.?$/i,
  // gormlessly → gormless
  /^in\s+an?\s+([a-z][a-z'-]*)\s+(?:manner|way|fashion)\.?$/i,
  // sylvan → of or relating to woods
  /^(?:of\s+or\s+)?(?:relating|pertaining|related)\s+to\s+([a-z][a-z'-]*)\.?$/i,
  // running → the act of running
  /^(?:the\s+)?(?:act|action|process|practice)\s+of\s+([a-z][a-z'-]*)\.?$/i,
  // characterized by gormlessness
  /^(?:characterized|characterised|marked)\s+by\s+([a-z][a-z'-]*)\.?$/i,
];

export function derivataDa(text, parola = "") {
  const t = String(text || "").trim();
  for (const re of DERIVATE) {
    const m = re.exec(t);
    if (!m) continue;
    const base = m[1].toLowerCase();
    // una parola che rimanda a se stessa non e' un rimando, ed e' proprio
    // la forma in cui girerebbe in tondo
    if (!base || base === String(parola).toLowerCase()) return null;
    return base;
  }
  return null;
}

// I sensi veri di una parola: se il vocabolario risponde solo con dei
// rimandi di forma flessa (`gormless` potrebbe essere «alternative form
// of…»), si segue quello — UN salto solo, come sulla parola cercata.
async function sensiVeri(parola, lang) {
  const sensi = await fetchSenses(parola, lang);
  const propri = sensi.filter((e) => !formaDi(e.text));
  if (propri.length) return propri;
  const f = sensi.map((e) => formaDi(e.text)).find((x) => x && x.lemma !== parola);
  if (!f) return sensi;
  return (await fetchSenses(f.lemma, lang)).filter((e) => !formaDi(e.text));
}

// il rimando si attacca alla definizione che lo contiene, non in fondo alla
// scheda: e' quella riga che senza di lui non si capisce
async function seguiDerivata(entries, parola, lang) {
  for (const e of entries) {
    if (e.forma) continue;
    const base = derivataDa(e.text, parola);
    if (!base) continue;
    try {
      const sensi = await sensiVeri(base, lang);
      if (sensi.length) e.rimando = { parola: base, sensi: sensi.slice(0, 3) };
    } catch {
      /* resta la definizione del vocabolario: gia' e' quella giusta, solo muta */
    }
    return;
  }
}

async function fetchSenses(word, section) {
  const res = await fetch(
    `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  // solo la sezione della lingua del libro: le altre sono voci omografe di
  // altre lingue (era da li' che spuntavano i codici ISO fra le definizioni)
  const blocks = data?.[section] || [];
  const out = [];
  for (const block of blocks) {
    const pos = String(block.partOfSpeech || "").toLowerCase();
    for (const d of block.definitions || []) {
      const text = strip(d.definition);
      if (text) out.push({ pos: POS_IT[pos] || pos, order: rank(pos), text });
    }
  }
  return out
    .filter((e, i, all) => all.findIndex((x) => x.text === e.text) === i)
    .sort((a, b) => a.order - b.order);
}

async function fetchTranslation(word, from, intera = false) {
  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${from}|it`
  );
  if (!res.ok) return "";
  const data = await res.json();
  // le proposte migliori per prime; via la parola stessa, i doppioni e i
  // frammenti di frase che MyMemory ripesca dalle sue memorie
  // Su una frase intera la resa e' lunga per forza: il filtro delle tre
  // parole, giusto per una voce di vocabolario, qui cancellerebbe tutto.
  if (intera) {
    const t = String(data?.responseData?.translatedText || "").trim();
    return t.toLowerCase() === word.toLowerCase() ? "" : t;
  }
  const seen = new Set([word.toLowerCase()]);
  const out = [];
  const take = (raw) => {
    const t = String(raw || "").trim().toLowerCase();
    // QUI NASCEVA LA VERGOGNA che ha fatto congedare il dizionario: da
    // MyMemory usciva «"uniti", scherzo' damien.» come traduzione di una
    // parola. Non era una traduzione: era un pezzo di romanzo pescato
    // dalle sue memorie. Una voce di vocabolario non ha virgolette, punti,
    // virgole ne' cifre — se ce le ha, e' un frammento di frase e si butta.
    if (!t || seen.has(t) || t.split(" ").length > 3) return;
    if (/["“”«».,;:!?\d]/.test(t)) return;
    seen.add(t);
    out.push(t);
  };
  // e soprattutto: si guardano solo le memorie il cui SEGMENTO di partenza
  // e' esattamente la parola chiesta. Una memoria che traduce una frase
  // dove la parola compare non sta traducendo la parola.
  const matches = [...(data?.matches || [])]
    .filter((m) => String(m.segment || "").trim().toLowerCase() === word.toLowerCase())
    .sort((a, b) => parseFloat(b.quality || 0) - parseFloat(a.quality || 0));
  for (const m of matches) if (out.length < 3) take(m.translation);
  if (!out.length) take(data?.responseData?.translatedText);
  return out.join(", ");
}

// le voci meno recenti cedono il posto: un vocabolario di lettura non ha
// bisogno di ricordare tutto, solo quello che si e' cercato ultimamente
export function trimCache(records, max = MAX_WORDS) {
  if (records.length <= max) return records;
  return [...records].sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, max);
}

let loaded;
function loadCache() {
  if (!loaded) {
    loaded = (async () => {
      try {
        const saved = await getAux(AUX_KEY);
        if (saved?.v !== 1 || !saved.words) return;
        for (const [k, v] of Object.entries(saved.words)) {
          if (v && Array.isArray(v.entries) && !CACHE.has(k)) CACHE.set(k, v);
        }
      } catch {
        /* senza IndexedDB resta la cache di sessione: si legge lo stesso */
      }
    })();
  }
  return loaded;
}

async function persist() {
  const kept = trimCache([...CACHE.entries()]);
  if (kept.length < CACHE.size) {
    CACHE.clear();
    for (const [k, v] of kept) CACHE.set(k, v);
  }
  const words = {};
  // «nessuna voce» non vale la pena di conservarlo: la selezione puo' aver
  // preso una parola spezzata, e al prossimo avvio si riprova
  for (const [k, v] of kept) if (v.entries.length || v.translation) words[k] = v;
  try {
    await putAux(AUX_KEY, { v: 1, words });
  } catch {
    /* quota piena o storage negato: la ricerca ha comunque risposto */
  }
}

// Gli idiomi su Wiktionary sono voci a sé («kick the bucket», «take the
// mickey»), ma la frase che si evidenzia leggendo non coincide quasi mai con
// il titolo della voce: dentro c'è il modo di dire più il resto del periodo.
// Si provano allora le sotto-frasi, dalla più lunga alla più corta, e vince
// la prima che esiste davvero. È un dizionario di modi di dire grande quanto
// Wiktionary, al posto di un elenco scritto a mano.
const MAX_TRIES = 50;

// Wiktionary indicizza l'infinito: nel libro c'e' «taking the mickey», la
// voce si chiama «take the mickey». Il verbo sta quasi sempre in testa al
// modo di dire, quindi si prova anche la prima parola riportata alla forma
// base. La tabella copre gli irregolari; le forme regolari si tentano per
// desinenza piu' sotto (basiDi), tanto un tentativo sbagliato non esiste su
// Wiktionary e la verifica di esistenza lo scarta gratis.
const LEMMI = {
  took: "take", takes: "take", taking: "take", taken: "take",
  kicked: "kick", kicks: "kick", kicking: "kick",
  went: "go", gone: "go", goes: "go", going: "go",
  came: "come", comes: "come", coming: "come",
  got: "get", gets: "get", getting: "get",
  gave: "give", given: "give", gives: "give", giving: "give",
  made: "make", makes: "make", making: "make",
  put: "put", puts: "put", putting: "put",
  kept: "keep", keeps: "keep", keeping: "keep",
  pulled: "pull", pulls: "pull", pulling: "pull",
  threw: "throw", thrown: "throw", throws: "throw", throwing: "throw",
  ran: "run", runs: "run", running: "run",
  saw: "see", seen: "see", sees: "see", seeing: "see",
  held: "hold", holds: "hold", holding: "hold",
  lost: "lose", loses: "lose", losing: "lose",
  blew: "blow", blown: "blow", blows: "blow", blowing: "blow",
  broke: "break", broken: "break", breaks: "break", breaking: "break",
  caught: "catch", catches: "catch", catching: "catch",
  spent: "spend", spends: "spend", spending: "spend",
  paid: "pay", pays: "pay", paying: "pay",
  drew: "draw", drawn: "draw", draws: "draw", drawing: "draw",
  fell: "fall", fallen: "fall", falls: "fall", falling: "fall",
  told: "tell", tells: "tell", telling: "tell",
  turned: "turn", turns: "turn", turning: "turn",
  strung: "string", strings: "string", stringing: "string",
  stood: "stand", stands: "stand", standing: "stand",
  cut: "cut", cuts: "cut", cutting: "cut",
  sent: "send", sends: "send", sending: "send",
  knocked: "knock", knocks: "knock", knocking: "knock",
  picked: "pick", picks: "pick", picking: "pick",
  pushed: "push", pushes: "push", pushing: "push",
  worked: "work", works: "work", working: "work",
  talked: "talk", talks: "talk", talking: "talk",
  did: "do", does: "do", doing: "do", done: "do",
  had: "have", has: "have", having: "have",
  was: "be", were: "be", been: "be", being: "be", is: "be", are: "be",
};

// Le forme regolari non stanno in LEMMI: «muscling» deve diventare «muscle»
// senza una riga di tabella. Indovinare per desinenza qui e' sicuro perche'
// ogni candidato passa comunque dalla verifica di esistenza: «muscl in» non
// e' una voce e muore li', «muscle in» lo e' e vince.
export function basiDi(w) {
  const out = new Set();
  if (LEMMI[w]) out.add(LEMMI[w]);
  const doppia = (stem) => /(.)\1$/.test(stem);
  if (w.endsWith("ing") && w.length > 4) {
    const stem = w.slice(0, -3);
    out.add(stem);
    out.add(`${stem}e`);
    if (doppia(stem)) out.add(stem.slice(0, -1));
  } else if (w.endsWith("ied") && w.length > 4) {
    out.add(`${w.slice(0, -3)}y`);
  } else if (w.endsWith("ed") && w.length > 3) {
    const stem = w.slice(0, -2);
    out.add(stem);
    out.add(`${stem}e`);
    if (doppia(stem)) out.add(stem.slice(0, -1));
  } else if (w.endsWith("ies") && w.length > 4) {
    out.add(`${w.slice(0, -3)}y`);
  } else if (w.endsWith("es") && w.length > 3) {
    out.add(w.slice(0, -1));
    out.add(w.slice(0, -2));
  } else if (w.endsWith("s") && w.length > 3) {
    out.add(w.slice(0, -1));
  }
  out.delete(w);
  return [...out];
}

// I verbi separabili sono il caso che le finestre contigue non prendono mai:
// nel libro c'e' «egg them on», il dizionario la indicizza come «egg on». Il
// complemento in mezzo va tolto, o l'idioma resta invisibile — ed e' successo
// davvero, con «at all» che vinceva per mancanza di avversari.
const OGGETTI = new Set([
  "them", "him", "her", "me", "us", "you", "it", "'em", "em", "himself",
  "herself", "themselves", "myself", "yourself", "ourselves", "one",
]);

// Locuzioni cosi' comuni che spiegarle non aiuta nessuno: se restano loro
// sole a vincere, la scheda risponde a una domanda che non era stata fatta.
const TROPPO_COMUNI = new Set([
  "at all", "of course", "as well", "in fact", "a lot", "a lot of", "sort of",
  "kind of", "and so on", "at last", "at once", "as if", "as though",
  "no one", "each other", "one another", "so that", "such as", "up to",
  // esistono su Wiktionary ma vincerebbero su meta' delle frasi inglesi
  "have to", "had to", "has to", "having to", "want to", "going to", "go to",
  "get to", "got to", "need to", "try to", "used to", "come in", "come on",
  "go on", "go in", "look at",
]);

// «out of the» non e' un modo di dire di niente: le finestre che finiscono
// con una parola vuota si scartano prima di sprecarci una richiesta. Con
// un'eccezione: molte parole vuote sono anche particelle o preposizioni su
// cui i verbi frasali finiscono — «muscle in», «get by», «see to», «fall
// for», «get away with», «get rid of» — e scartare ogni finestra che ci
// finisce li rendeva tutti introvabili.
const PARTICELLE = new Set([
  "in", "on", "up", "out", "off", "down", "over", "away", "back", "along",
  "around", "about", "through", "round", "to", "at", "by", "for", "with", "of",
]);

const VUOTE = new Set([
  "the", "a", "an", "of", "and", "or", "but", "to", "in", "on", "at", "by",
  "for", "with", "from", "that", "this", "it", "he", "she", "they", "you",
  "his", "her", "their", "your", "my", "was", "were", "is", "are", "had",
  "has", "been", "as", "so", "if", "then", "than", "very", "just", "only",
]);

// Tutte le finestre da 2 a 5 parole, le piu' lunghe per prime perche' piu'
// specifiche. Non si prova a indovinare quale sia quella buona: costano una
// richiesta sola tutte insieme (vedi esistenti()), quindi tanto vale
// chiederle tutte invece di sprecare il budget sulle prime della frase — che
// e' l'errore in cui questa funzione e' cascata due volte.
function subPhrases(words) {
  const out = [];
  const visti = new Set();
  const aggiungi = (t) => {
    if (visti.has(t) || out.length >= MAX_TRIES) return;
    visti.add(t);
    out.push(t);
  };
  for (let n = Math.min(5, words.length); n >= 2; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const f = words.slice(i, i + n);
      const ultima = f[f.length - 1];
      // la particella in coda salva la finestra solo se davanti c'e' un
      // verbo plausibile, non un'altra parola vuota («was in» non serve)
      const frasale = PARTICELLE.has(ultima) && !VUOTE.has(f[0]);
      if ((VUOTE.has(ultima) && !frasale) || f.every((w) => VUOTE.has(w))) continue;
      aggiungi(f.join(" "));
      const basi = basiDi(f[0]);
      for (const base of basi) aggiungi([base, ...f.slice(1)].join(" "));
      // verbo separabile: «egg them on» → «egg on», «egg on» all'infinito
      if (n === 3 && OGGETTI.has(f[1])) {
        aggiungi(`${f[0]} ${f[2]}`);
        for (const base of basi) aggiungi(`${base} ${f[2]}`);
      }
    }
  }
  // le locuzioni comuni si scartano solo come pezzi di una frase piu' lunga:
  // chi seleziona esattamente «used to» la sua risposta la vuole davvero
  const intera = words.join(" ");
  return out.filter((t) => t === intera || !TROPPO_COMUNI.has(t));
}

// Quali di questi titoli esistono davvero su Wiktionary: una domanda sola per
// tutti e cinquanta, invece di una richiesta a testa. Le voci mancanti
// tornano marcate `missing`, e i titoli normalizzati (la maiuscola iniziale)
// vanno riportati alla forma chiesta.
async function esistenti(titoli) {
  const url =
    "https://en.wiktionary.org/w/api.php?action=query&format=json&formatversion=2&origin=*&titles=" +
    encodeURIComponent(titoli.join("|"));
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const vive = new Set();
  for (const p of data?.query?.pages || []) {
    if (!p.missing && p.title) vive.add(p.title.toLowerCase());
  }
  return titoli.filter((t) => vive.has(t.toLowerCase()));
}

export async function lookupPhrase(raw, bookLang = "en") {
  const lang = (bookLang || "en").slice(0, 2).toLowerCase();
  const words = cleanWord(raw).toLowerCase().split(" ").filter(Boolean);
  if (words.length < 2) return lookup(raw, bookLang);
  await loadCache();

  const cands = subPhrases(words);
  const noti = cands.filter((c) => CACHE.get(`${c}|${lang}`)?.entries?.length);
  let offline = false;
  let vive = noti;
  if (!vive.length) {
    try {
      vive = await esistenti(cands);
    } catch {
      offline = true;
      vive = [];
    }
  }

  // fra le voci esistenti vince la piu' lunga: «take the mickey» batte
  // «the mickey», ed e' quella che spiega davvero il passaggio
  const scelta = vive.sort((a, b) => b.split(" ").length - a.split(" ").length)[0] || null;
  let entries = [];
  if (scelta) {
    const known = CACHE.get(`${scelta}|${lang}`);
    if (known?.entries?.length) entries = known.entries;
    else {
      try {
        entries = await fetchSenses(scelta, lang);
      } catch {
        offline = true;
      }
    }
  }

  const vinta = entries.length ? { c: scelta, entries } : null;
  const testo = vinta ? vinta.c : cleanWord(raw);
  let translation = "";
  if (lang !== "it" && !translation) {
    translation = await fetchTranslation(testo, lang, !vinta).catch(() => "");
  }

  const out = {
    word: testo,
    entries: (vinta?.entries || []).slice(0, 8),
    translation,
    // senza una voce, la resa è una traduzione a macchina dell'intero
    // passaggio: va detto, o si scambia per il significato del modo di dire
    machine: !vinta && !!translation,
    idiom: !!vinta,
    foreign: false,
    offline,
    at: Date.now(),
  };
  if (vinta && !out.offline) {
    CACHE.set(`${vinta.c}|${lang}`, { ...out, foreign: false });
    await persist();
  }
  return out;
}

export async function lookup(raw, bookLang = "en") {
  const word = cleanWord(raw).toLowerCase();
  if (!word) return { word: "", entries: [] };
  const lang = (bookLang || "en").slice(0, 2).toLowerCase();
  const key = `${word}|${lang}`;
  await loadCache();
  const known = CACHE.get(key);
  // le voci salvate prima che i rimandi si seguissero contengono ancora il
  // "plural of" nudo: si riprovano, cosi' si completano da sole. Stessa
  // cosa per i rimandi alle forme derivate, arrivati dopo: una voce che ne
  // avrebbe uno ma non ce l'ha e' di prima della cura — e solo quella si
  // ripesca, cosi' non si butta via una cache intera per una novita' che
  // riguarda una parola su venti.
  const vecchia =
    known?.entries?.some((e) => formaDi(e.text)) ||
    known?.entries?.some((e) => !e.forma && !e.rimando && derivataDa(e.text, word));
  if (known && !vecchia) {
    known.at = Date.now();
    return known;
  }

  let entries = [];
  let translation = "";
  let offline = false;
  const jobs = [
    fetchSenses(word, lang)
      .then((r) => (entries = r))
      .catch(() => (offline = true)),
  ];
  if (lang !== "it") {
    jobs.push(fetchTranslation(word, lang).then((r) => (translation = r)).catch(() => {}));
  }
  await Promise.all(jobs);

  // si segue il primo rimando (un salto solo: basta e non gira in tondo),
  // le altre righe-rimando si dicono almeno in italiano
  let base = null;
  for (const e of entries) {
    const f = formaDi(e.text);
    if (!f) continue;
    e.text = `${f.label} «${f.lemma}»`;
    e.forma = true;
    if (!base && f.lemma !== word) base = f;
  }
  if (base) {
    try {
      const senseBase = await fetchSenses(base.lemma, lang);
      entries = [...entries, ...senseBase.filter((e) => !formaDi(e.text))];
    } catch {
      /* resta il rimando in italiano: gia' meglio di prima */
    }
  }

  // e ora il rimando alla parola DERIVATA, sulle sole voci che si mostrano:
  // inseguirne una che il taglio a otto butterebbe via sarebbe una richiesta
  // spesa per niente
  const mostrate = entries.slice(0, 8);
  await seguiDerivata(mostrate, word, lang);

  const out = {
    word,
    translation,
    // la parola cercata e la voce sotto cui il dizionario la spiega non
    // sono sempre la stessa: «fuming» si spiega sotto «fume». La scheda
    // mostra tutte e due, come fa un vocabolario di carta.
    lemma: base?.lemma || null,
    forma: base?.label || null,
    entries: mostrate,
    // il libro e' straniero e la traduzione non e' arrivata: la scheda
    // avvisa che le definizioni restano in lingua originale
    foreign: lang !== "it" && !translation && entries.length > 0,
    offline: offline && !entries.length && !translation,
    at: Date.now(),
  };
  // un buco di rete non diventa una risposta definitiva: senza salvarlo,
  // la stessa parola riprova appena la connessione torna
  if (out.offline) return out;
  CACHE.set(key, out);
  await persist();
  return out;
}

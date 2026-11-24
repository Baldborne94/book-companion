// IL QUADERNO DELLE PAROLE (`components/Quaderno.jsx`, la registrazione in
// `DictionaryCard.jsx`, la porta sull'Ingresso, la colonna `quaderno` di
// `prefs`; scelto dal lettore fra le proposte dell'analisi «cosa manca»).
//
// Ogni parola cercata col dizionario l'app la teneva gia' — nella cache del
// vocabolario, per risponderti senza rete — ma non te la faceva piu'
// rivedere: chiusa la scheda, la parola se ne andava insieme alla frase in
// cui l'avevi incontrata. Chi legge in inglese cerca le stesse parole tre
// volte in tre libri diversi senza saperlo. Qui si tiene la parola, la sua
// resa italiana, la prima definizione e la FRASE: una parola ricordata con
// la frase in cui stava si ricorda, una parola in un elenco no.
//
// SI SCRIVE DA SE', senza un tasto «tieni»: e' la ragione per cui esiste.
// Un quaderno da riempire a mano si riempie la prima settimana e poi mai
// piu'; la ricerca e' gia' il gesto che dice «questa non la sapevo».
// Nella scheda una riga dice che la parola e' finita qui, e la toglie.
//
// Qui dentro stanno le decisioni che sbagliano in silenzio — cosa entra,
// quale frase si prende, come si fondono due dispositivi — fuori dal
// componente perche' un test in Node non importa un `.jsx`.

const KEY = "bc_quaderno";

// Oltre quattro parole non e' una voce di vocabolario, e' un passaggio: il
// quaderno di paragrafi non si ripassa. Stessa soglia del glossario tuo.
export const PAROLE_MAX = 4;
export const LUNGHEZZA_MAX = 60;
// Le frasi in cui l'hai incontrata: la piu' recente per prima, e tre
// bastano — una parola cercata venti volte non deve portarsi dietro venti
// frasi, e la ventesima non insegna niente che la terza non dica.
export const INCONTRI_MAX = 3;
export const FRASE_MAX = 240;
export const DOVE_MAX = 600;
// Un giro di ripasso: dieci parole si fanno in un minuto, e un minuto e'
// quello che uno concede prima di tornare al libro.
export const GIRO = 10;

const piano = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

// La chiave e' la parola ridotta: maiuscole, accenti, spazi e punteggiatura
// ai bordi non fanno due parole. «Gormless,» e «gormless» sono una.
export function chiaveParola(s) {
  return piano(s)
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .trim();
}

// Dalla risposta del dizionario alla voce del quaderno, o `null` se non e'
// una voce da tenere. Tre esclusioni, e la terza e' quella che conta:
//   - la risposta non e' ancora finita (`loading`/`cercando`): si scrive a
//     risposta completa, o si terrebbe la meta' scarna che arriva dal disco;
//   - un passaggio lungo, per la ragione di `PAROLE_MAX`;
//   - un TERMINE DEL MONDO (`gloss`): «Ankh-Morpork» non e' una parola da
//     imparare, e' un nome — ha il glossario della saga, e nel quaderno
//     affogherebbe le parole vere sotto i luoghi del Mondo Disco.
// E una risposta vuota non entra: «non la conosco» non si ripassa.
export function daAnnotare(dict) {
  if (!dict || dict.loading || dict.cercando || dict.gloss) return null;
  const testo = String(dict.raw || dict.word || "").trim();
  if (!testo || testo.length > LUNGHEZZA_MAX || testo.split(/\s+/).length > PAROLE_MAX) return null;

  const italiano = Array.isArray(dict.italiano) ? dict.italiano : [];
  const entries = Array.isArray(dict.entries) ? dict.entries : [];
  // la resa a macchina di un PASSAGGIO non e' una resa: e' la frase tradotta,
  // e la scheda stessa avverte che non e' il senso del modo di dire
  const traduzione = dict.translation && !dict.machine ? String(dict.translation).trim() : "";
  const slang = dict.slang && dict.slang.d ? dict.slang : null;

  let resa = "";
  if (italiano.length) {
    resa = italiano
      .slice(0, 2)
      .map((g) => (g.parole || []).slice(0, 3).join(", "))
      .filter(Boolean)
      .join(" · ");
  } else if (traduzione) {
    resa = traduzione;
  }
  const primo = entries.find((e) => e && e.text);
  const definizione = primo ? String(primo.text).trim() : slang ? String(slang.d).trim() : "";
  if (!resa && !definizione) return null;

  const parola = String((slang && !primo && !italiano.length ? slang.t : dict.lemma || dict.word) || testo).trim();
  const id = chiaveParola(parola);
  if (!id) return null;
  return {
    id,
    parola,
    resa,
    definizione,
    pos: (primo && primo.pos) || (italiano[0] && italiano[0].pos) || "",
  };
}

// LA FRASE, NON IL PARAGRAFO. Il contesto che arriva dalla selezione e' il
// paragrafo intero (fino a un tetto), e in un romanzo un paragrafo puo'
// essere mezza pagina: nel quaderno la parola affogherebbe. Si prende la
// frase che la contiene, e se nemmeno quella sta nel tetto una finestra
// centrata sulla parola, coi puntini dal lato dove c'e' altro testo.
// La parola si cerca A CONFINE: «ire» dentro «fire» non e' la parola ire.
export function fraseAttorno(contesto, parola, max = FRASE_MAX) {
  const testo = String(contesto || "").replace(/\s+/g, " ").trim();
  const p = String(parola || "").trim();
  if (!testo || !p) return "";
  const dove = posizione(testo, p);
  if (dove < 0) return "";

  // i confini di frase: il punto (o ! ? …) seguito da spazio. Le virgolette
  // di chiusura restano con la frase che chiudono.
  let inizio = 0;
  const fineRe = /[.!?…]+["'»”’)\]]*\s+/g;
  let m;
  while ((m = fineRe.exec(testo)) && m.index + m[0].length <= dove) inizio = m.index + m[0].length;
  fineRe.lastIndex = dove + p.length;
  const dopo = fineRe.exec(testo);
  const fine = dopo ? dopo.index + dopo[0].trimEnd().length : testo.length;
  const frase = testo.slice(inizio, fine).trim();
  const rel = dove - inizio;

  if (frase.length <= max) return frase;
  const meta = Math.max(0, Math.floor((max - p.length) / 2));
  let da = Math.max(0, rel - meta);
  const a = Math.min(frase.length, da + max);
  da = Math.max(0, a - max);
  const pezzo = frase.slice(da, a).trim();
  return `${da > 0 ? "…" : ""}${pezzo}${a < frase.length ? "…" : ""}`;
}

function posizione(testo, parola) {
  const t = piano(testo);
  const p = piano(parola);
  let i = t.indexOf(p);
  while (i >= 0) {
    const prima = i === 0 ? "" : t[i - 1];
    const dopo = t[i + p.length] || "";
    if (!/[\p{L}\p{N}]/u.test(prima) && !/[\p{L}\p{N}]/u.test(dopo)) return i;
    i = t.indexOf(p, i + 1);
  }
  return -1;
}

// I pezzi di una frase con la parola messa in evidenza: la scheda la disegna
// in grassetto, e senza sapere DOVE sta la si cercherebbe a occhio.
export function pezziFrase(frase, parola) {
  const f = String(frase || "");
  const i = posizione(f, parola);
  if (i < 0 || !parola) return [{ t: f, qui: false }];
  const n = String(parola).trim().length;
  return [
    { t: f.slice(0, i), qui: false },
    { t: f.slice(i, i + n), qui: true },
    { t: f.slice(i + n), qui: false },
  ].filter((x) => x.t);
}

const vive = (tutte) => (Array.isArray(tutte) ? tutte.filter((v) => v && v.id && !v.deleted) : []);
export { vive as paroleVive };

// Una ricerca nuova entra nel quaderno. Se la parola c'e' gia' si CONTA e
// si aggiunge la frase — non si fa una seconda voce — e se l'avevi segnata
// come imparata TORNA DA RIPASSARE: se l'hai cercata di nuovo, vuol dire che
// non la sapevi piu', e il quaderno che la tiene fra le imparate direbbe il
// falso proprio sulla parola che ti serve. Una parola cancellata e cercata
// di nuovo rinasce: cancellarla voleva dire «non mi serve», cercarla dice
// il contrario, e il gesto piu' recente vince.
export function annota(tutte, voce, { libro = null, frase = "", forma = "", dove = "", ora = Date.now() } = {}) {
  const elenco = Array.isArray(tutte) ? tutte : [];
  if (!voce || !voce.id) return elenco;
  const incontro = {
    libroId: libro?.id || null,
    titolo: libro?.title || "",
    frase: String(frase || "").slice(0, FRASE_MAX + 2),
    forma: String(forma || voce.parola || "").trim(),
    quando: ora,
  };
  // IL PUNTO DEL LIBRO dove l'hai incontrata: il CFI della selezione
  // nell'ePub, il numero di pagina nel PDF. Intero o niente — un CFI
  // tagliato non porta da nessuna parte, e il segno che lo riceve lo
  // rifiuterebbe; e sulle voci di prima semplicemente non c'e'.
  const punto = typeof dove === "number" ? String(dove) : dove;
  if (typeof punto === "string" && punto.trim() && punto.length <= DOVE_MAX) incontro.dove = punto.trim();
  const vecchia = elenco.find((v) => v && v.id === voce.id);
  if (vecchia && !vecchia.deleted) {
    const altri = (vecchia.incontri || []).filter(
      (x) => !(x.libroId === incontro.libroId && x.frase === incontro.frase)
    );
    const aggiornata = {
      ...vecchia,
      parola: voce.parola || vecchia.parola,
      resa: voce.resa || vecchia.resa || "",
      definizione: voce.definizione || vecchia.definizione || "",
      pos: voce.pos || vecchia.pos || "",
      volte: (Number(vecchia.volte) || 1) + 1,
      incontri: [incontro, ...altri].slice(0, INCONTRI_MAX),
      imparata: false,
      updatedAt: ora,
    };
    return elenco.map((v) => (v && v.id === voce.id ? aggiornata : v));
  }
  const nuova = {
    id: voce.id,
    parola: voce.parola,
    resa: voce.resa || "",
    definizione: voce.definizione || "",
    pos: voce.pos || "",
    volte: 1,
    incontri: [incontro],
    imparata: false,
    ripassi: 0,
    ultimoRipasso: 0,
    aggiunta: ora,
    updatedAt: ora,
  };
  return [...elenco.filter((v) => !(v && v.id === voce.id)), nuova];
}

// Si torna al punto solo se il libro c'e' ancora e si puo' aprire: un
// tasto che porta a un libro cancellato, o a uno di cui hai tolto l'ebook,
// e' un tasto che promette quel che non puo' dare.
export function doveTornare(incontro, books = []) {
  if (!incontro?.libroId || !incontro.dove) return null;
  const libro = (books || []).find((b) => b && b.id === incontro.libroId);
  if (!libro || libro.fileTolto) return null;
  return { id: libro.id, dove: incontro.dove };
}

// Togliere lascia una LAPIDE, o l'altro dispositivo la rimanderebbe su al
// primo giro: una fusione per id non distingue «l'ho tolta» da «l'altro non
// ce l'ha ancora». Stessa regola delle evidenziazioni.
export function togliParola(tutte, id, ora = Date.now()) {
  return (tutte || []).map((v) => (v && v.id === id ? { id, deleted: true, updatedAt: ora } : v));
}

function tocca(tutte, id, cambia, ora) {
  return (tutte || []).map((v) => (v && v.id === id && !v.deleted ? { ...v, ...cambia(v), updatedAt: ora } : v));
}

export function segnaImparata(tutte, id, si = true, ora = Date.now()) {
  return tocca(tutte, id, () => ({ imparata: !!si }), ora);
}

// Un passaggio del ripasso che non l'ha imparata: si conta, e l'ora dice al
// giro dopo che questa l'hai vista da poco.
export function ripassata(tutte, id, ora = Date.now()) {
  return tocca(tutte, id, (v) => ({ ripassi: (Number(v.ripassi) || 0) + 1, ultimoRipasso: ora }), ora);
}

// Il giro di ripasso: le sole non imparate, prima quelle che non hai MAI
// ripassato e poi quelle ripassate da piu' tempo — niente calendario a
// intervalli, che vorrebbe un'abitudine quotidiana che nessuno ha chiesto;
// basta che la parola vista ieri non torni prima di quella mai vista.
// A parita', la piu' vecchia: e' quella che rischi di aver dimenticato.
export function daRipassare(tutte, n = GIRO) {
  return vive(tutte)
    .filter((v) => !v.imparata)
    .sort(
      (a, b) =>
        (Number(a.ultimoRipasso) || 0) - (Number(b.ultimoRipasso) || 0) ||
        (Number(a.aggiunta) || 0) - (Number(b.aggiunta) || 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    )
    .slice(0, n);
}

export const STATI = [
  { id: "tutte", label: "Tutte" },
  { id: "ripasso", label: "Da ripassare" },
  { id: "imparate", label: "Imparate" },
];

// L'elenco sullo schermo: le piu' recenti in cima (l'ultima parola cercata
// e' quella che uno viene a guardare), filtrate per stato, per libro e per
// testo — la ricerca guarda la parola, la resa, la definizione e le frasi,
// perche' spesso ci si ricorda la frase e non la parola.
export function filtraQuaderno(tutte, { query = "", libroId = null, stato = "tutte" } = {}) {
  const q = piano(query).trim();
  return vive(tutte)
    .filter((v) => (stato === "imparate" ? v.imparata : stato === "ripasso" ? !v.imparata : true))
    .filter((v) => !libroId || (v.incontri || []).some((x) => x.libroId === libroId))
    .filter((v) => {
      if (!q) return true;
      const dove = [v.parola, v.resa, v.definizione, ...(v.incontri || []).map((x) => x.frase)];
      return dove.some((s) => piano(s).includes(q));
    })
    .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
}

// I libri da cui vengono le parole, per i filtri: il titolo e' quello
// dell'incontro PIU' RECENTE, e l'ordine e' il numero di parole — il libro
// che ti ha fatto cercare di piu' e' quello che vuoi ripassare per primo.
export function libriDelQuaderno(tutte) {
  const per = new Map();
  for (const v of vive(tutte)) {
    const visti = new Set();
    for (const x of v.incontri || []) {
      if (!x.libroId || visti.has(x.libroId)) continue;
      visti.add(x.libroId);
      const c = per.get(x.libroId) || { id: x.libroId, titolo: x.titolo || "", n: 0, quando: 0 };
      c.n += 1;
      if ((x.quando || 0) >= c.quando) {
        c.quando = x.quando || 0;
        if (x.titolo) c.titolo = x.titolo;
      }
      per.set(x.libroId, c);
    }
  }
  return [...per.values()].sort((a, b) => b.n - a.n || a.titolo.localeCompare(b.titolo));
}

// La porta sull'Ingresso dice un numero, come il giardino e il diario — e
// gli zeri non si dicono: a quaderno vuoto la porta tiene la sua descrizione.
export function rigaQuaderno(tutte) {
  const v = vive(tutte);
  if (!v.length) return null;
  const libri = libriDelQuaderno(v).length;
  const ripasso = v.filter((x) => !x.imparata).length;
  const quante = `${v.length} ${v.length === 1 ? "parola" : "parole"}`;
  const da = libri ? ` da ${libri} ${libri === 1 ? "libro" : "libri"}` : "";
  const coda = ripasso ? ` · ${ripasso} da ripassare` : "";
  return `${quante}${da}${coda}`;
}

// Le chiavi in ordine, anche dentro gli oggetti annidati: jsonb di Postgres
// riordina le chiavi, e due quaderni identici scritti in ordine diverso si
// rimbalzerebbero a ogni giro della sincronizzazione.
function canonica(v) {
  if (Array.isArray(v)) return v.map(canonica);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = canonica(v[k]);
    return out;
  }
  return v;
}

// DUE DISPOSITIVI: unione per parola, e per ogni parola vince la versione
// toccata per ultima — lapide compresa. NON si segue l'orologio delle
// preferenze: «vince chi ha scritto per ultimo» sull'intero quaderno
// butterebbe via le parole cercate sull'altro dispositivo nella stessa
// sera. A parita' di ora resta quella di casa (`qui`), come nelle
// annotazioni: due dispositivi fermi non si rimbalzano la stessa voce.
export function fondiQuaderno(qui, lassu) {
  const per = new Map();
  for (const reg of [qui, lassu]) {
    if (!Array.isArray(reg)) continue;
    for (const v of reg) {
      if (!v || typeof v !== "object" || !v.id) continue;
      const prima = per.get(v.id);
      if (!prima || (Number(v.updatedAt) || 0) > (Number(prima.updatedAt) || 0)) per.set(v.id, v);
    }
  }
  return [...per.keys()].sort().map((k) => canonica(per.get(k)));
}

const dataIt = (ts) =>
  ts ? new Date(ts).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : "";

// In Markdown, come il giardino: non serve a rientrare nell'app, serve a
// finire in un quaderno vero. Si esporta quello che stai guardando.
export function esportaQuaderno(voci) {
  const righe = ["# Il quaderno delle parole", ""];
  for (const v of voci || []) {
    righe.push(`## ${v.parola}${v.pos ? ` _(${v.pos})_` : ""}`);
    if (v.resa) righe.push(`**${v.resa}**`);
    if (v.definizione) righe.push("", v.definizione);
    for (const x of v.incontri || []) {
      if (!x.frase) continue;
      righe.push("", `> ${x.frase}`, `> — ${x.titolo || "senza titolo"}${x.quando ? `, ${dataIt(x.quando)}` : ""}`);
    }
    righe.push("");
  }
  return righe.join("\n");
}

export function leggiQuaderno() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function scriviQuaderno(tutte) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tutte || []));
  } catch {
    /* storage pieno: la parola non entra, la lettura continua */
  }
}

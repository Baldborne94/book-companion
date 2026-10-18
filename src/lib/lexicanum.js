// LEXICANUM SUL DISPOSITIVO.
//
// Chiesto dal lettore: «vorrei poter avere in locale Lexicanum per tutti i
// miei libri del 40K, senza per forza recuperarmeli online». I romanzi della
// Black Library sono pieni di nomi, legioni e pianeti che il libro da' per
// saputi; il wiki li sa, ma aprirlo in rete a ogni nome vuol dire uscire
// dal libro — e in treno non si apre affatto.
//
// La strada: l'API MediaWiki di Lexicanum, chiesta DAL BROWSER (`origin=*`,
// la richiesta anonima che MediaWiki permette da qualunque sito), cinquanta
// pagine alla volta, piano. Il wikitesto si riduce qui a paragrafi, link e
// fonti; ogni voce e' un record suo in IndexedDB (`lex:<chiave>`), cosi'
// cercarne una e' una lettura sola e scriverne cinquanta una transazione.
//
// NIENTE SACCHI, a differenza del dizionario: le voci arrivano in ordine
// alfabetico di titolo e i sacchi per prefisso sarebbero sbilanciati («The
// …» da solo e' un migliaio di romanzi), mentre i sacchi per impronta
// vorrebbero dire riscrivere cinquanta sacchi a ogni pagina scaricata.
//
// LE FONTI SONO LA PARTE PREZIOSA. Lexicanum chiede una citazione in fondo a
// ogni paragrafo (`{{Fn|1}}`) e le elenca sotto «Sources» (`{{Endn|1}}:
// ''[[Horus Rising (Novel)|Horus Rising]]''`): sapere DA QUALE LIBRO viene
// un paragrafo e' quel che permette di velare quelli che vengono da un
// volume che non hai ancora letto (`giudiceFonti`).
import { getAux, putAux, putAuxMolti, removeAux, removeAuxPrefisso, chiaviAuxPrefisso } from "./bookStore.js";
import { frontiera } from "./frontiera.js";
import { riconosci } from "./sagaBooks.js";

const DEPOSITO = {
  leggi: getAux,
  scrivi: putAux,
  scriviMolti: putAuxMolti,
  togli: removeAux,
  togliPrefisso: removeAuxPrefisso,
  chiaviPrefisso: chiaviAuxPrefisso,
};

export const SITO = "https://wh40k.lexicanum.com";
// l'indirizzo dell'API non e' scritto da nessuna parte che si possa leggere
// da qui: si provano i posti dove MediaWiki di solito la mette, e vince il
// primo che risponde come un MediaWiki
const API_POSSIBILI = [`${SITO}/mediawiki/api.php`, `${SITO}/w/api.php`, `${SITO}/api.php`];
const PREFISSO = "lex:";
const META = "lex_meta";
const GIRO = "lex_giro";
// cinquanta e' il massimo che MediaWiki concede a chi non e' un bot quando
// si chiede il testo delle pagine
const PER_VOLTA = 50;
// un secondo fra una richiesta e l'altra: il wiki e' di volontari, e lo
// scaricamento si fa una volta sola
export const PAUSA_MS = 1000;

export const chiave = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/_/g, " ")
    .replace(/[^\p{L}\p{N}' -]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

// «Horus Rising (Novel)» → «Horus Rising»: la parentesi distingue le voci
// sul wiki, il lettore non la seleziona mai
export const senzaParentesi = (t) => String(t || "").replace(/\s*\([^()]*\)\s*$/, "").trim();

// ---------------------------------------------------------------------------
// IL WIKITESTO

const FN = "\u0001";
const FN_FINE = "\u0002";
const EN = "\u0003";
const EN_FINE = "\u0004";

// le sezioni che non sono racconto: elenchi di fonti, di immagini, di
// rimandi. Le fonti si leggono prima di buttarle.
const SEZIONI_VIA = new Set([
  "sources",
  "source",
  "references",
  "see also",
  "related articles",
  "related",
  "gallery",
  "image gallery",
  "external links",
  "external link",
  "links",
  "appearances",
  "videos",
]);

const ENTITA = { nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”" };
const entita = (s) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITA[e.toLowerCase()] ?? m;
  });

// `{{…}}` annidati e tabelle `{| … |}` via, tranne le citazioni: diventano
// segni che sopravvivono alla pulizia e si raccolgono alla fine. Un modello
// che non si chiude resta testo: mangiarsi il resto della voce per una
// graffa dimenticata sarebbe peggio.
function senzaModelli(testo) {
  let out = "";
  let i = 0;
  const n = testo.length;
  while (i < n) {
    const inizioRiga = i === 0 || testo[i - 1] === "\n";
    if (testo.startsWith("{{", i)) {
      let prof = 0;
      let j = i;
      while (j < n) {
        if (testo.startsWith("{{", j)) {
          prof++;
          j += 2;
        } else if (testo.startsWith("}}", j)) {
          prof--;
          j += 2;
          if (prof === 0) break;
        } else j++;
      }
      if (prof !== 0) {
        out += "{{";
        i += 2;
        continue;
      }
      out += sostituto(testo.slice(i + 2, j - 2));
      i = j;
    } else if (inizioRiga && testo.startsWith("{|", i)) {
      let prof = 0;
      let j = i;
      while (j < n) {
        const riga = j === 0 || testo[j - 1] === "\n";
        if (riga && testo.startsWith("{|", j)) {
          prof++;
          j += 2;
        } else if (riga && testo.startsWith("|}", j)) {
          prof--;
          j += 2;
          if (prof === 0) break;
        } else j++;
      }
      i = j;
    } else {
      out += testo[i];
      i++;
    }
  }
  return out;
}

function sostituto(dentro) {
  const parti = dentro.split("|");
  const nome = parti[0].trim().toLowerCase();
  const argomenti = parti.slice(1).map((a) => a.trim()).filter(Boolean);
  if (nome === "fn") return argomenti.map((a) => FN + a + FN_FINE).join("");
  if (nome === "endn") return argomenti.map((a) => EN + a + EN_FINE).join("");
  return "";
}

// «1a», «1b» sono pagine diverse della stessa fonte «1»
const numeroFonte = (s) => String(s).trim().replace(/[a-z]+$/i, "");

// I link doppi: immagini, categorie e rimandi alle altre lingue via (con le
// didascalie, che possono avere link dentro); gli altri si tengono nella
// forma `[[Bersaglio|testo]]`, che la scheda rende toccabile.
function link(testo) {
  let out = "";
  let i = 0;
  const n = testo.length;
  while (i < n) {
    if (!testo.startsWith("[[", i)) {
      out += testo[i];
      i++;
      continue;
    }
    let prof = 0;
    let j = i;
    while (j < n) {
      if (testo.startsWith("[[", j)) {
        prof++;
        j += 2;
      } else if (testo.startsWith("]]", j)) {
        prof--;
        j += 2;
        if (prof === 0) break;
      } else j++;
    }
    if (prof !== 0) {
      out += testo.slice(i);
      break;
    }
    const dentro = testo.slice(i + 2, j - 2);
    // la coda di lettere attaccata al link fa parte del testo: [[Primarch]]s
    let coda = "";
    while (j < n && /[a-z]/.test(testo[j])) coda += testo[j++];
    i = j;
    if (/^\s*(file|image|category|media|immagine)\s*:/i.test(dentro)) continue;
    if (/^[a-z]{2,3}(-[a-z]{2,4})?:/.test(dentro)) continue;
    const pipe = dentro.indexOf("|");
    let bersaglio = (pipe < 0 ? dentro : dentro.slice(0, pipe)).replace(/^:/, "").trim();
    let testoLink = pipe < 0 ? bersaglio : dentro.slice(pipe + 1).trim();
    if (pipe >= 0 && !testoLink) testoLink = senzaParentesi(bersaglio);
    testoLink = testoLink.replace(/^:?(category|file|image)\s*:/i, "");
    bersaglio = bersaglio.split("#")[0].trim();
    testoLink = (testoLink + coda).replace(/[[\]|]/g, "");
    out += bersaglio ? `[[${bersaglio}|${testoLink}]]` : testoLink;
  }
  return out;
}

function pulisci(s) {
  return entita(
    String(s)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/?[a-z][^>]*>/gi, "")
      .replace(/\[(?:https?:)?\/\/[^\s\]]+\s*([^\]]*)\]/g, "$1")
      .replace(/__[A-Z]+__/g, "")
      // il grassetto via (in testa a ogni voce c'e' il suo stesso nome in
      // neretto), il corsivo resta: e' come si scrivono i titoli dei libri
      .replace(/'''''/g, "''")
      .replace(/'''/g, "")
  )
    .replace(/[ \t]+/g, " ")
    .trim();
}

// il testo di una riga senza segni di wiki: per le fonti e per le prove
export const testoPiano = (s) =>
  String(s || "")
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
    .replace(/''/g, "")
    .replace(new RegExp(`[${FN}${FN_FINE}${EN}${EN_FINE}]`, "g"), "")
    .replace(/\s+/g, " ")
    .trim();

// Di una riga delle fonti serve il TITOLO dell'opera, per riconoscerla fra
// i libri: il primo link, poi il primo corsivo, poi quel che sta prima della
// virgola. La parentesi del wiki («(Novel)») via.
function titoloFonte(riga) {
  const l = riga.match(/\[\[([^\]|]*)\|([^\]]*)\]\]/);
  if (l) return senzaParentesi(l[1]) || senzaParentesi(l[2]);
  const c = riga.match(/''([^']+)''/);
  if (c) return senzaParentesi(c[1].trim());
  return senzaParentesi(testoPiano(riga).split(",")[0].replace(/\s+by\s+.*$/i, "").trim());
}

export function rinvioDi(testo) {
  const m = String(testo || "").match(/^\s*#\s*redirect\s*:?\s*\[\[([^\]|]+)/i);
  return m ? m[1].split("#")[0].replace(/_/g, " ").trim() : null;
}

// Wikitesto → voce. `p` sono i blocchi nell'ordine della pagina: un
// titoletto `{ h, l }` o un paragrafo `{ x, f, li }` (`f` = i numeri delle
// fonti citate in fondo al paragrafo). `f` della voce: numero → { t, x }.
export function daWikitesto(titolo, wikitesto) {
  let testo = String(wikitesto || "").replace(/\r/g, "").replace(/<!--[\s\S]*?-->/g, "");
  testo = testo.replace(/<(gallery|imagemap|math|score|timeline)\b[\s\S]*?<\/\1>/gi, "");

  // le <ref> alla Wikipedia: il contenuto E' la fonte, si numera da se'
  const fonti = {};
  const rifNomi = new Map();
  let rif = 0;
  testo = testo.replace(/<ref\b([^>]*?)(\/>|>([\s\S]*?)<\/ref>)/gi, (m, attr, chiusa, dentro) => {
    const nome = (attr.match(/name\s*=\s*"?([^"/>]+)"?/i) || [])[1]?.trim();
    if (dentro == null) return nome && rifNomi.has(nome) ? FN + rifNomi.get(nome) + FN_FINE : "";
    const k = `r${++rif}`;
    if (nome) rifNomi.set(nome, k);
    fonti[k] = { grezza: dentro };
    return FN + k + FN_FINE;
  });

  testo = link(senzaModelli(testo));

  const blocchi = [];
  let corrente = null;
  let via = 0; // il livello della sezione che si sta saltando, 0 = nessuna
  const chiudi = () => {
    if (!corrente) return;
    const f = [];
    const x = pulisci(
      corrente.righe.join(" ").replace(new RegExp(`${FN}([^${FN_FINE}]*)${FN_FINE}`, "g"), (m, n) => {
        const k = numeroFonte(n);
        if (k && !f.includes(k)) f.push(k);
        return "";
      })
    );
    if (testoPiano(x)) blocchi.push(corrente.li ? { x, f, li: true } : { x, f });
    corrente = null;
  };

  for (const grezza of testo.split("\n")) {
    const riga = grezza.trim();
    // le righe delle fonti si leggono ovunque stiano, anche nelle sezioni
    // che poi si buttano
    if (riga.includes(EN)) {
      const numeri = [...riga.matchAll(new RegExp(`${EN}([^${EN_FINE}]*)${EN_FINE}`, "g"))].map((m) => numeroFonte(m[1]));
      const resto = riga
        .replace(new RegExp(`${EN}[^${EN_FINE}]*${EN_FINE}`, "g"), "")
        .replace(/^[*#:;\s]+/, "")
        .replace(/^[:,\s]+/, "");
      for (const k of numeri) if (k && !fonti[k]) fonti[k] = { grezza: resto };
      continue;
    }
    const h = riga.match(/^(={2,6})\s*(.+?)\s*\1$/);
    if (h) {
      chiudi();
      const livello = h[1].length;
      const nome = testoPiano(pulisci(h[2]));
      if (via && livello > via) continue;
      via = SEZIONI_VIA.has(nome.toLowerCase()) ? livello : 0;
      if (!via && nome) blocchi.push({ h: nome, l: livello });
      continue;
    }
    if (via) continue;
    if (!riga) {
      chiudi();
      continue;
    }
    // resti di tabelle e di modelli spezzati su piu' righe
    if (/^(\||!|\{\||\|\})/.test(riga)) continue;
    const elenco = riga.match(/^([*#;:]+)\s*(.*)$/);
    if (elenco) {
      chiudi();
      corrente = { righe: [elenco[2]], li: /[*#]/.test(elenco[1]) };
      chiudi();
      continue;
    }
    if (!corrente) corrente = { righe: [] };
    corrente.righe.push(riga);
  }
  chiudi();

  // le fonti citate da nessuno non servono, e quelle citate senza riga
  // restano senza titolo (un paragrafo che le cita non si vela per loro)
  const usate = new Set(blocchi.flatMap((b) => b.f || []));
  const f = {};
  for (const k of usate) {
    const grezza = fonti[k]?.grezza;
    if (grezza == null) continue;
    const riga = pulisci(link(senzaModelli(grezza)));
    f[k] = { t: titoloFonte(riga), x: testoPiano(riga) };
  }
  return { t: titolo, p: blocchi, f };
}

// ---------------------------------------------------------------------------
// LO SCARICAMENTO

const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

export class GuaioLexicanum extends Error {}

// La rete che manca e il sito che non vuole parlare col browser arrivano
// tutt'e due come `TypeError: Failed to fetch`: non si distinguono, e il
// messaggio dice tutt'e due le cose invece di indovinarne una.
const NON_RISPONDE =
  "Lexicanum non risponde: o manca la rete, o il sito non accetta richieste da un'app nel browser.";

async function chiediJson(url, { fetcher, attesa, tentativi = 4 }) {
  let ultimo = null;
  for (let t = 0; t < tentativi; t++) {
    let res;
    try {
      res = await fetcher(url);
    } catch (e) {
      ultimo = new GuaioLexicanum(NON_RISPONDE);
      await attesa(2000 * 2 ** t);
      continue;
    }
    // troppe richieste o server occupato: si aspetta quanto chiede, poi si
    // riprova la STESSA pagina
    if (res.status === 429 || res.status === 503) {
      const dopo = Number(res.headers?.get?.("retry-after")) || 10;
      ultimo = new GuaioLexicanum(`Lexicanum chiede di rallentare (${res.status}).`);
      await attesa(Math.min(dopo, 120) * 1000);
      continue;
    }
    if (!res.ok) throw new GuaioLexicanum(`Lexicanum ha risposto ${res.status}.`);
    const testo = await res.text();
    let dati;
    try {
      dati = JSON.parse(testo);
    } catch {
      // una pagina di controllo anti-bot al posto della risposta
      throw new GuaioLexicanum("Lexicanum ha risposto con una pagina invece che coi dati.");
    }
    if (dati?.error?.code === "maxlag") {
      ultimo = new GuaioLexicanum("Lexicanum e' sotto carico.");
      await attesa(5000);
      continue;
    }
    if (dati?.error) throw new GuaioLexicanum(`Lexicanum: ${dati.error.info || dati.error.code}`);
    return { dati, byte: testo.length };
  }
  throw ultimo || new GuaioLexicanum(NON_RISPONDE);
}

const indirizzo = (api, parametri) =>
  `${api}?${new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...parametri })}`;

export async function trovaApi({ fetcher = fetch, attesa = dorme } = {}) {
  let guaio = null;
  for (const api of API_POSSIBILI) {
    try {
      const { dati } = await chiediJson(indirizzo(api, { action: "query", meta: "siteinfo", siprop: "general|statistics" }), {
        fetcher,
        attesa,
        tentativi: 2,
      });
      if (dati?.query?.general) return { api, voci: dati.query.statistics?.articles || null };
    } catch (e) {
      guaio = e;
    }
  }
  throw guaio || new GuaioLexicanum(NON_RISPONDE);
}

const contenutoDi = (pagina) => {
  const r = pagina?.revisions?.[0];
  return r?.slots?.main?.content ?? r?.content ?? r?.["*"] ?? null;
};

// Una pagina di risposta → i record da scrivere. Un rinvio che cadrebbe
// sopra una voce vera si salta: le chiavi non guardano le maiuscole, e
// «Horus lupercal» → «Horus Lupercal» scritto dopo la voce la farebbe
// sparire sotto un rinvio a se stessa. Scritto PRIMA (l'ordine alfabetico
// del wiki mette le maiuscole avanti) lo copre la voce quando arriva.
export async function recordDi(pagine, leggi) {
  const fuori = new Map();
  const giaVera = async (k) => {
    const qui = fuori.get(k);
    if (qui) return !qui.s;
    const v = await leggi(PREFISSO + k);
    return !!v && !v.s;
  };
  let voci = 0;
  let rinvii = 0;
  for (const pagina of pagine || []) {
    if (pagina?.ns !== 0 && pagina?.ns != null) continue;
    const testo = contenutoDi(pagina);
    if (testo == null || !pagina.title) continue;
    const k = chiave(pagina.title);
    if (!k) continue;
    const verso = rinvioDi(testo);
    if (verso) {
      if (await giaVera(k)) continue;
      fuori.set(k, { t: pagina.title, r: verso });
      rinvii++;
      continue;
    }
    fuori.set(k, daWikitesto(pagina.title, testo));
    voci++;
    // la voce risponde anche senza la parentesi del wiki, finche' nessuna
    // voce vera porta quel nome: «Garro (Novel)» per chi seleziona «Garro»
    // solo se «Garro» non c'e'. Segnata `s`, una voce vera la copre.
    const corta = chiave(senzaParentesi(pagina.title));
    if (corta && corta !== k && !(await giaVera(corta)) && !fuori.has(corta)) {
      fuori.set(corta, { t: senzaParentesi(pagina.title), r: pagina.title, s: 1 });
    }
  }
  return { record: [...fuori].map(([k, v]) => [PREFISSO + k, v]), voci, rinvii };
}

// LO SCARICAMENTO SI RIPRENDE. Sono migliaia di pagine: sul tablet l'app va
// in secondo piano, la rete cade, il lettore chiude. Dopo ogni pagina si
// scrivono PRIMA le voci e POI il segno di dove si e' arrivati, cosi' una
// pagina interrotta si rifa' da capo (le voci si riscrivono uguali) e
// nessuna resta saltata. Il cartellino `lex_meta` si scrive solo alla fine:
// finche' manca, Lexicanum non si dichiara sul dispositivo.
export async function scaricaLexicanum({
  fetcher = fetch,
  deposito = DEPOSITO,
  onProgress,
  fermo = () => false,
  pausa = PAUSA_MS,
  attesa = dorme,
  aggiorna = false,
} = {}) {
  // un giro cominciato si riprende sempre; uno nuovo sopra un Lexicanum
  // gia' sceso parte solo se lo si chiede (`aggiorna`): le voci si
  // riscrivono una per una e intanto quelle di prima continuano a rispondere
  let giro = await deposito.leggi(GIRO);
  if (!giro?.api) {
    const gia = await deposito.leggi(META);
    if (gia?.voci && !aggiorna) return gia;
    const { api, voci } = await trovaApi({ fetcher, attesa });
    giro = { api, cont: null, voci: 0, rinvii: 0, byte: 0, totale: voci, iniziato: Date.now() };
    await deposito.scrivi(GIRO, giro);
  }
  onProgress?.({ ...giro });
  for (;;) {
    if (fermo()) return { ...giro, fermato: true };
    const parametri = {
      action: "query",
      generator: "allpages",
      gapnamespace: "0",
      gaplimit: String(PER_VOLTA),
      gapfilterredir: "all",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      maxlag: "5",
      // `continue` vuoto alla prima richiesta: chiede la continuazione
      // «nuova» anche ai MediaWiki vecchi, quella che si ripassa intera
      ...(giro.cont || { continue: "" }),
    };
    const { dati, byte } = await chiediJson(indirizzo(giro.api, parametri), { fetcher, attesa });
    const { record, voci, rinvii } = await recordDi(dati?.query?.pages, deposito.leggi);
    if (record.length) await deposito.scriviMolti(record);
    giro = {
      ...giro,
      cont: dati?.continue || null,
      voci: giro.voci + voci,
      rinvii: giro.rinvii + rinvii,
      byte: giro.byte + byte,
    };
    if (!giro.cont) break;
    await deposito.scrivi(GIRO, giro);
    onProgress?.({ ...giro });
    if (pausa) await attesa(pausa);
  }
  const meta = { voci: giro.voci, rinvii: giro.rinvii, byte: giro.byte, quando: Date.now(), api: giro.api };
  await deposito.scrivi(META, meta);
  await deposito.togli(GIRO).catch(() => {});
  INDICE = null;
  onProgress?.({ ...giro, finito: true });
  return meta;
}

export async function statoLexicanum(deposito = DEPOSITO) {
  try {
    const m = await deposito.leggi(META);
    return m?.voci ? m : null;
  } catch {
    return null;
  }
}

// lo scaricamento lasciato a meta': quante voci sono gia' qui
export async function giroLexicanum(deposito = DEPOSITO) {
  try {
    const g = await deposito.leggi(GIRO);
    return g?.api ? g : null;
  } catch {
    return null;
  }
}

export async function rimuoviLexicanum(deposito = DEPOSITO) {
  VOCI.clear();
  INDICE = null;
  // il cartellino per primo, come nel dizionario: se la pulizia si
  // interrompe resta un Lexicanum spento, non uno acceso e bucato
  await deposito.togli(META).catch(() => {});
  await deposito.togli(GIRO).catch(() => {});
  await deposito.togliPrefisso(PREFISSO);
}

// ---------------------------------------------------------------------------
// LA RICERCA

const VOCI = new Map();
const VOCI_MAX = 40;

async function leggiVoce(k, deposito) {
  if (deposito === DEPOSITO && VOCI.has(k)) return VOCI.get(k);
  const v = (await deposito.leggi(PREFISSO + k)) || null;
  if (deposito === DEPOSITO) {
    VOCI.set(k, v);
    if (VOCI.size > VOCI_MAX) VOCI.delete(VOCI.keys().next().value);
  }
  return v;
}

// Un titolo → la voce, seguendo i rinvii (al massimo tre: un giro di rinvii
// sul wiki non deve diventare un giro infinito qui). `via` e' il nome da cui
// si e' arrivati, se diverso: la scheda lo dice («Loken → Garviel Loken»).
export async function voceLore(titolo, deposito = DEPOSITO) {
  let k = chiave(titolo);
  let via = null;
  for (let salti = 0; k && salti < 4; salti++) {
    const v = await leggiVoce(k, deposito);
    if (!v) return null;
    if (!v.r) return via ? { ...v, via } : v;
    via = via || v.t;
    k = chiave(v.r);
  }
  return null;
}

const FORMA = /[\p{L}\p{N}'’-]+/gu;

// La selezione → la voce. Si prova la selezione intera, poi le finestre di
// parole dalla piu' lunga («Garviel Loken said» → «Garviel Loken»), e per
// una parola sola anche senza il genitivo («Horus's») e senza il plurale
// («Primarchs»). Oltre sei parole non e' un nome: e' una frase, e il
// Lexicanum la' non c'entra.
export const MAX_PAROLE = 6;

export function candidati(raw) {
  const parole = (String(raw || "").match(FORMA) || []).map((p) => p.replace(/^['’-]+|['’-]+$/g, "")).filter(Boolean);
  if (!parole.length || parole.length > MAX_PAROLE) return [];
  const out = [];
  const metti = (s) => {
    const k = chiave(s);
    if (k && !out.includes(k)) out.push(k);
  };
  for (let n = parole.length; n >= 1; n--) {
    for (let i = 0; i + n <= parole.length; i++) {
      const pezzo = parole.slice(i, i + n);
      metti(pezzo.join(" "));
      const ultima = pezzo[n - 1];
      const senzaGenitivo = ultima.replace(/['’]s?$/i, "");
      if (senzaGenitivo !== ultima) metti([...pezzo.slice(0, -1), senzaGenitivo].join(" "));
      if (/[^s]s$/i.test(ultima) && ultima.length > 3) metti([...pezzo.slice(0, -1), ultima.slice(0, -1)].join(" "));
    }
  }
  // una parola sola di due lettere e' quasi sempre una parola comune
  return out.filter((k) => k.length >= 3);
}

export async function cercaLore(raw, deposito = DEPOSITO) {
  for (const k of candidati(raw)) {
    const v = await voceLore(k, deposito).catch(() => null);
    if (v) return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// I NOMI NEL TESTO
//
// Chiesto dal lettore: «segna i nomi del 40K nel testo come il glossario».
// L'indice e' l'elenco delle CHIAVI delle voci (titoli, rinvii, nomi senza
// parentesi), letto da IndexedDB senza aprire nessuna voce: cinquantamila
// articoli interi in memoria per sapere se «Cadia» e' un nome sarebbero
// centinaia di mega. Si costruisce una volta per sessione e si butta quando
// Lexicanum si riscarica o si rimuove.
let INDICE = null;
const PAROLE_MAX = 6;

async function costruisciIndice(deposito) {
  const chiavi = await deposito.chiaviPrefisso(PREFISSO);
  if (!chiavi?.length) return null;
  const set = new Set();
  let max = 1;
  for (const k of chiavi) {
    const c = String(k).slice(PREFISSO.length);
    if (!c) continue;
    set.add(c);
    max = Math.max(max, c.split(" ").length);
  }
  return { chiavi: set, max: Math.min(max, PAROLE_MAX) };
}

export function indiceLore(deposito = DEPOSITO) {
  if (deposito !== DEPOSITO) return costruisciIndice(deposito);
  if (!INDICE) {
    INDICE = costruisciIndice(deposito).catch(() => {
      INDICE = null;
      return null;
    });
  }
  return INDICE;
}

const PAROLA_RE = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

// Le parole che nel capitolo compaiono anche MINUSCOLE: «battle» minuscola
// vuol dire che «Battle» a inizio frase e' una parola, non un nome
export function parolePiccole(testo) {
  const s = new Set();
  for (const m of String(testo || "").matchAll(PAROLA_RE)) if (/^\p{Ll}/u.test(m[0])) s.add(m[0].toLowerCase());
  return s;
}

// I nomi di Lexicanum in un pezzo di testo, dal piu' lungo («Garviel Loken»
// prima di «Loken»), senza accavallarsi. Le regole tengono la pagina
// leggibile: un nome comincia con la MAIUSCOLA; fra le sue parole solo spazi
// (una virgola spezza: «Horus, Loken» sono due nomi); una parola SOLA vale
// se ha almeno quattro lettere e nel capitolo non compare mai minuscola
// (`minuscole`) — Lexicanum ha voci anche per «Battle» e «Captain», e
// segnarle ogni volta che aprono una frase farebbe solo rumore.
export function nomiNelTesto(testo, ix, minuscole = new Set()) {
  const t = String(testo || "");
  if (!ix?.chiavi?.size) return [];
  const parole = [...t.matchAll(PAROLA_RE)].map((m) => ({ da: m.index, a: m.index + m[0].length, w: m[0] }));
  const out = [];
  let i = 0;
  while (i < parole.length) {
    if (!/^\p{Lu}/u.test(parole[i].w)) {
      i++;
      continue;
    }
    let preso = 0;
    for (let n = Math.min(ix.max, parole.length - i); n >= 1 && !preso; n--) {
      const pezzo = t.slice(parole[i].da, parole[i + n - 1].a);
      if (n > 1 && /[^\p{L}\p{N}'’ -]/u.test(pezzo)) continue;
      for (const forma of new Set([pezzo, pezzo.replace(/['’]s?$/u, "")])) {
        const k = chiave(forma);
        if (!k || !ix.chiavi.has(k)) continue;
        if (n === 1 && (k.length < 4 || minuscole.has(k))) continue;
        out.push({ da: parole[i].da, a: parole[i].da + forma.length, testo: forma, chiave: k });
        preso = n;
        break;
      }
    }
    i += preso || 1;
  }
  return out;
}

// QUALI NOMI SEGNARE in un pezzo di testo, dato quel che il capitolo ha gia'
// segnato (`gia`, che si aggiorna). Un segno per VOCE, non per nome: «Garviel
// Loken» e poi «Loken» sono la stessa persona (il rinvio porta alla stessa
// voce), e due segni a due righe di distanza erano rumore (visto nel browser).
// Il nome rimasto senza segno entra lo stesso fra i segnati, perche' il
// tocco risponda anche li': e' la persona su cui il segno e' gia' passato.
export async function nomiDaSegnare(testo, ix, minuscole, gia, { risolvi = voceLore, salta = () => false } = {}) {
  const out = [];
  for (const m of nomiNelTesto(testo, ix, minuscole)) {
    if (gia.has(`lore:${m.chiave}`) || salta(m)) continue;
    const voce = await risolvi(m.chiave).catch(() => null);
    const chi = `voce:${chiave(voce?.t) || m.chiave}`;
    gia.add(`lore:${m.chiave}`);
    if (gia.has(chi)) continue;
    gia.add(chi);
    out.push(m);
  }
  return out;
}

// Il nome sotto il dito: risponde solo un nome gia' SEGNATO nel capitolo
// (`segnati`, le chiavi). Con cinquantamila voci quasi ogni maiuscola di un
// romanzo del 40K e' un nome di Lexicanum, e se ognuna rispondesse al tocco
// toccare il testo per voltare pagina diventerebbe una lotteria.
export function nomeSottoIlDito(testo, offset, ix, minuscole, segnati) {
  return (
    nomiNelTesto(testo, ix, minuscole).find((m) => m.da <= offset && offset < m.a && (!segnati || segnati.has(m.chiave))) || null
  );
}

// ---------------------------------------------------------------------------
// QUALI LIBRI

// Il Lexicanum risponde solo nei libri del 40K: su un Mondo Disco «Death» e'
// un altro signore. Si riconosce dalla saga, dalla serie e dal titolo — e
// dalla tavola dell'Eresia, che sa riconoscere i suoi volumi anche con la
// saga vuota. Il lettore puo' accenderlo o spegnerlo a mano, libro per
// libro (`bc_lore_<id>`, di questo dispositivo).
const QUARANTAK =
  /\b(?:warhammer|40\s?k|40[.,]?000|horus heresy|siege of terra|eisenhorn|ravenor|bequin|gaunt'?s ghosts|ciaphas cain|night lords|space marine battles|black library|the primarchs|beast arises|dark imperium|dawn of fire|word bearers|soul drinkers|ultramarines|grey knights|blood angels|space wolf|dark angels|inquisition war|imperial guard|astra militarum|necromunda)\b/i;

const chiaveAMano = (id) => `bc_lore_${id}`;

export function loreAMano(id) {
  try {
    const v = localStorage.getItem(chiaveAMano(id));
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

export function scriviLoreAMano(id, acceso) {
  try {
    if (acceso == null) localStorage.removeItem(chiaveAMano(id));
    else localStorage.setItem(chiaveAMano(id), acceso ? "1" : "0");
  } catch {
    /* senza localStorage resta la regola della saga */
  }
}

export function del40k(book) {
  if (!book) return false;
  const campi = [book.saga, book.series, book.title].filter(Boolean).join(" · ");
  if (QUARANTAK.test(campi)) return true;
  const r = riconosci({ title: book.title, author: book.author });
  return !!r && QUARANTAK.test(r.saga || "");
}

export const loreAttivo = (book, aMano = loreAMano) => {
  const scelto = book?.id ? aMano(book.id) : null;
  return scelto ?? del40k(book);
};

// ---------------------------------------------------------------------------
// IL VELO SUGLI SPOILER

const stessoTitolo = (a, b) => {
  const x = chiave(a);
  const y = chiave(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // il titolo del file porta spesso il resto («The Horus Heresy 01 - Horus
  // Rising»): la fonte vale se ci sta dentro a parole intere, e se non e'
  // cosi' corta da stare dentro qualunque titolo
  return y.length >= 8 && ` ${x} `.includes(` ${y} `);
};

// Chi decide se un paragrafo si puo' leggere. Torna una funzione: fonte →
// `null` (si legge) o il perche' del velo. La regola e' quella della
// frontiera dell'Oracolo (`frontiera.js`), letta dalla parte delle fonti:
//
//   fonte di un'ALTRA saga, o che non si riconosce → si legge
//   fonte = un volume della saga che hai finito, prima di questo → si legge
//   fonte = questo stesso libro → velata (potrebbe venire da piu' avanti)
//   fonte = un volume della saga dopo questo, o mai aperto → velata
//
// Un volume che la guida dell'Eresia conosce si colloca anche se non e'
// nella tua biblioteca: «The Solar War» e' dopo «Horus Rising» anche se il
// file non ce l'hai. Senza numero di lettura (prologo, antologie) si legge:
// la guida stessa dice che non e' un punto della storia.
export function giudiceFonti(book, libri = [], { statusOf, cfiOf, riconosci: ric = riconosci } = {}) {
  const saga = (book?.saga || "").trim();
  if (!book || !saga) return () => null;
  const ordine = book.sagaOrder ?? null;
  const dellaSaga = libri.filter((b) => b && b.id !== book.id && (b.saga || "").trim() === saga);
  const interi = new Set(
    ordine != null
      ? frontiera(book, libri, { statusOf, cfiOf })
          .filter((t) => t.tutto)
          .map((t) => t.libro.id)
      : dellaSaga.filter((b) => statusOf(b.id) === "read").map((b) => b.id)
  );
  const titoloGuida = (t) => ric({ title: t })?.titolo || null;
  const mio = titoloGuida(book.title);
  return (fonte) => {
    const t = fonte?.t;
    if (!t) return null;
    const guida = ric({ title: t });
    const daGuida = guida && (guida.saga || "").trim() === saga ? guida : null;
    if (stessoTitolo(book.title, t) || (daGuida && mio && daGuida.titolo === mio)) return "da questo libro, forse da più avanti";
    const libro = dellaSaga.find((b) => stessoTitolo(b.title, t) || (daGuida && titoloGuida(b.title) === daGuida.titolo));
    if (libro) {
      if (interi.has(libro.id)) return null;
      return ordine != null && libro.sagaOrder != null && libro.sagaOrder > ordine
        ? `da «${libro.title}», che viene dopo`
        : `da «${libro.title}», che non hai letto`;
    }
    if (!daGuida || daGuida.sagaOrder == null) return null;
    if (ordine != null && daGuida.sagaOrder > ordine) return `da «${daGuida.titolo}», che viene dopo`;
    return `da «${daGuida.titolo}», che non hai letto`;
  };
}

// I blocchi della voce col loro velo: `v` e' il perche', se il paragrafo
// cita almeno una fonte che non si puo' ancora leggere.
export function velaVoce(voce, giudice) {
  if (!voce?.p) return [];
  return voce.p.map((b) => {
    if (!b.f?.length) return b;
    for (const k of b.f) {
      const perche = giudice(voce.f?.[k]);
      if (perche) return { ...b, v: perche };
    }
    return b;
  });
}

// Il testo con link e corsivi → pezzi da disegnare. `l` = bersaglio del
// link, `i` = corsivo.
export function pezzi(x) {
  const out = [];
  let corsivo = false;
  const re = /\[\[([^\]|]*)\|([^\]]*)\]\]|''/g;
  let da = 0;
  for (const m of String(x || "").matchAll(re)) {
    if (m.index > da) out.push({ s: x.slice(da, m.index), i: corsivo });
    if (m[0] === "''") corsivo = !corsivo;
    else out.push({ s: m[2], l: m[1], i: corsivo });
    da = m.index + m[0].length;
  }
  if (da < String(x || "").length) out.push({ s: x.slice(da), i: corsivo });
  return out.filter((p) => p.s);
}

export const indirizzoVoce = (titolo) => `${SITO}/wiki/${encodeURIComponent(String(titolo).replace(/ /g, "_"))}`;

// La riga del lavoro: le voci scese, il totale che il wiki dichiara (e'
// «circa»: conta anche le voci che non sono racconto) e i byte, che sono
// quel che il lettore paga in rete.
const numero = (n) => Number(n || 0).toLocaleString("it-IT");
export function fraseLexicanum(p) {
  if (!p) return "";
  // sotto il mega non si dice: «0 MB» e' uno zero, e gli zeri non si dicono
  const mb = p.byte >= 1048576 ? ` · ${(p.byte / 1048576).toFixed(0)} MB` : "";
  const di = p.totale ? ` di circa ${numero(p.totale)}` : "";
  return `${numero(p.voci)} voci${di}${mb}`;
}

// IL DIZIONARIO CHE STA QUI, e risponde senza rete.
//
// Chiesto dal lettore: «ci sarebbe modo di avere dizionario anche
// offline?». Fino a ieri, senza rete, restavano due cose: il Collins del
// tablet (dal menu di selezione, che e' un'altra app) e la cache delle
// parole gia' cercate — cioe' proprio quelle che non hai bisogno di
// cercare di nuovo. Su un tablet in treno o in aereo il dizionario dell'app
// semplicemente non c'era.
//
// La fonte e' WordNet, ridotta a «parola → definizioni» da
// `scripts/dizionarioOffline.mjs`: 147.478 voci, locuzioni comprese, in
// 3,35 MB compressi. Le definizioni sono in INGLESE, e non e' una rinuncia:
// e' gia' la scelta dell'app — la glossa non si traduce a macchina, perche'
// tradotta usciva storta (vedi la cura del dizionario in CLAUDE.md). Quel
// che offline manca davvero e' la resa italiana della PAROLA, che arriva da
// MyMemory ed e' rete per forza.
//
// NON SI SCARICA DA SE'. Sono tre megabytes e mezzo: si scaricano quando il
// lettore lo chiede, dalle Impostazioni, come «Porta qui i tomi».
import { getAux, putAux, putAuxMolti, removeAux, chiaviAux } from "./bookStore.js";

// IL DEPOSITO SI PASSA DA FUORI, come `leggiByte` nelle impronte e la
// funzione di scrittura in `upsertBooks`: cosi' il giro intero — scarica,
// insacca, ritrova — si prova con una mappa invece di tirarsi dietro
// IndexedDB, ed e' proprio quel giro la parte che sbaglia in silenzio (una
// parola finita nel sacco sbagliato non da' un errore: da' «questa parola
// non la conosco» su una parola che il dizionario ha eccome).
const DEPOSITO = {
  leggi: getAux,
  scrivi: putAux,
  scriviMolti: putAuxMolti,
  togli: removeAux,
  chiavi: chiaviAux,
};

const INDIRIZZO = "/dizionario/en.json.gz";
const CARTELLINO = "/dizionario/meta.json";
const PREFISSO = "diz_";
const META = "diz_meta";

// Quanto pesa e quante voci porta, PRIMA di scaricarlo: lo scrive lo script
// che costruisce il dizionario, cosi' il pannello non cabla un numero che
// mente al primo dizionario rifatto. Se non si legge, il pannello dice
// quello che sa e il tasto resta: non sapere la misura non e' un guasto.
export async function cartellinoInRete(fetcher) {
  try {
    const r = await (fetcher || fetch)(CARTELLINO);
    if (!r.ok) return null;
    const j = await r.json();
    return j?.voci ? j : null;
  } catch {
    return null;
  }
}

// La lettera di WordNet torna il nome INGLESE della categoria, non quello
// italiano: cosi' chi chiama passa dalle stesse `POS_IT` e `rank` di
// Wiktionary, e come si scrive «sostantivo» e in che ordine vanno le
// categorie resta deciso in un posto solo. Nel file compresso, intanto, sta
// la sola lettera: la parola per intero si ripeterebbe quattrocentomila
// volte, ed e' lingua di interfaccia, non dizionario.
export const POS_WORDNET = { n: "noun", v: "verb", a: "adjective", r: "adverb" };

// I SACCHI. Centoquarantasettemila voci in un record solo vorrebbero dire
// tenere in memoria quindici megabyte di JSON per cercare una parola, su un
// dispositivo che intanto ha un romanzo aperto. Un record per voce vorrebbe
// dire centoquarantasettemila scritture. In mezzo c'e' il sacco: si
// raggruppa per le prime due lettere — settecento sacchi da una ventina di
// chilobyte — e per cercare se ne apre UNO.
export function sacco(parola) {
  const p = String(parola || "").toLowerCase();
  if (!p) return null;
  // quel che non e' lettera o cifra diventa `_`, o finirebbe in una chiave
  // di IndexedDB una punteggiatura che non aiuta nessuno
  const pulita = (s) => s.replace(/[^a-z0-9]/g, "_");
  return PREFISSO + pulita(p.length === 1 ? p : p.slice(0, 2));
}

export async function statoDizionario(deposito = DEPOSITO) {
  try {
    const m = await deposito.leggi(META);
    return m?.voci ? m : null;
  } catch {
    return null;
  }
}

// UN `.gz` PUO' ARRIVARE GIA' APERTO. Certi server mandano i file compressi
// con `Content-Encoding: gzip`, e allora il browser li apre da se': provare
// a decomprimerli una seconda volta fallirebbe. Si guarda il numero magico
// invece di fidarsi del nome del file.
const eGzip = (b) => b.length > 1 && b[0] === 0x1f && b[1] === 0x8b;

async function apri(byte) {
  if (!eGzip(byte)) return new TextDecoder().decode(byte);
  if (typeof DecompressionStream !== "function") {
    throw new Error("questo browser non sa aprire il file compresso");
  }
  const flusso = new Blob([byte]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(flusso).text();
}

async function raccogli(res, onProgress) {
  const atteso = Number(res.headers.get("content-length")) || 0;
  if (!res.body?.getReader) return new Uint8Array(await res.arrayBuffer());
  const lettore = res.body.getReader();
  const pezzi = [];
  let quanti = 0;
  for (;;) {
    const { done, value } = await lettore.read();
    if (done) break;
    pezzi.push(value);
    quanti += value.length;
    // senza `content-length` non si finge una percentuale: si dicono i byte
    onProgress?.({ scaricati: quanti, totale: atteso || null });
  }
  const tutto = new Uint8Array(quanti);
  let dove = 0;
  for (const p of pezzi) {
    tutto.set(p, dove);
    dove += p.length;
  }
  return tutto;
}

export async function scaricaDizionario({ onProgress, fetcher, deposito = DEPOSITO } = {}) {
  const res = await (fetcher || fetch)(INDIRIZZO);
  if (!res.ok) throw new Error(`il dizionario non si scarica (${res.status})`);
  const byte = await raccogli(res, onProgress);
  const dati = JSON.parse(await apri(byte));

  const sacchi = new Map();
  let voci = 0;
  for (const parola of Object.keys(dati)) {
    const s = sacco(parola);
    if (!s) continue;
    if (!sacchi.has(s)) sacchi.set(s, {});
    sacchi.get(s)[parola] = dati[parola];
    voci++;
  }
  // I SACCHI PRIMA, IL CARTELLINO DOPO. `statoDizionario` guarda il
  // cartellino: scrivendolo per primo, un'interruzione a meta' lascerebbe un
  // dizionario dichiarato intero e mezzo vuoto, che risponde «non lo so» su
  // meta' delle parole senza che niente lo dica.
  await deposito.scriviMolti([...sacchi.entries()]);
  const meta = { voci, sacchi: sacchi.size, byte: byte.length, quando: Date.now() };
  await deposito.scrivi(META, meta);
  return meta;
}

// Torna `[[pos, definizione], …]`, vuoto se il dizionario non c'e' o se la
// parola non la conosce. Non prova le forme flesse: le basi possibili le
// sa gia' fare `basiDi` in `dictionary.js`, e chiamarla da qui farebbe
// girare i due moduli in tondo.
export async function sensiOffline(parola, deposito = DEPOSITO) {
  const p = String(parola || "").toLowerCase().trim();
  const s = sacco(p);
  if (!s) return [];
  try {
    const dentro = await deposito.leggi(s);
    return dentro?.[p] || [];
  } catch {
    return [];
  }
}

export async function rimuoviDizionario(deposito = DEPOSITO) {
  // il cartellino se ne va per PRIMO: se la cancellazione dei sacchi si
  // interrompe, quel che resta e' un dizionario spento e incompleto, non uno
  // acceso e bucato
  await deposito.togli(META).catch(() => {});
  const chiavi = await deposito.chiavi().catch(() => []);
  for (const k of chiavi) {
    if (typeof k === "string" && k.startsWith(PREFISSO)) await deposito.togli(k).catch(() => {});
  }
}

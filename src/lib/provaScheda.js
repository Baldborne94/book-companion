// LA PROVA SULLA MICROSD (`components/ProvaScheda.jsx`, `test/prova-scheda.test.mjs`).
//
// Il lettore, misurato il peso delle illustrazioni di Fandom (circa 20.000,
// 350 MB a 250 px, 750 MB a 400 px): «lo spazio non è un problema, possiamo
// caricarle sulla micro SD del tablet». Chrome tiene i dati dell'app nella
// memoria interna e non c'e' modo di spostarli; la sola strada per la scheda
// e' una cartella scelta dal lettore (`showDirectoryPicker`, che Chrome per
// Android ha). Ma due cose non le sa nessuno finche' non si provano sul suo
// tablet: se Chrome RICORDA il permesso sulla cartella da un'apertura
// all'altra (se no ogni volta un tocco prima di vedere un'illustrazione), e
// quanto costa scrivere migliaia di file piccoli sulla scheda da Android 10.
// Questa prova lo misura, con illustrazioni vere, prima di costruire il giro.

import { nomeSicuro } from "./hdd.js";
import { FANDOM } from "./lexicanum.js";

export const QUANTE = 200;
// OGNI ATTESA HA UN TETTO (visto sul tablet del lettore: «…scrivo 200/200»
// e poi piu' niente, la rilettura ferma senza dire perche'): un file che
// non risponde entro il tetto si conta e si passa al prossimo, e dopo
// `FERMA_DOPO` di fila la rilettura si ferma e lo dice
export const TETTO_FILE = 10000;
export const FERMA_DOPO = 3;
export const CARTELLA = "Illustrazioni-prova";
export const LARGHEZZA = 400;
const GIRI_MAX = 12;

const TETTO = Symbol("tetto");
const entro = (promessa, ms, aspetta) =>
  Promise.race([promessa, new Promise((ok) => aspetta(ms).then(() => ok(TETTO)))]);
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

const indirizzo = (api, parametri) =>
  `${api}?${new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...parametri })}`;

export const nomeFile = (titolo) => nomeSicuro(String(titolo || "").replace(/^File:/, ""));

// LE ILLUSTRAZIONI VERE fra i file di una voce: immagini e non SVG (le
// icone dei modelli), almeno 120 px sul lato corto, con la miniatura
export function illustrazioniDa(pagine) {
  return (Array.isArray(pagine) ? pagine : Object.values(pagine || {}))
    .map((p) => ({ p, ii: (p?.imageinfo || [])[0] }))
    .filter(({ ii }) => ii?.thumburl && /^image\//.test(ii.mime || "") && !/svg/.test(ii.mime) && Math.min(ii.width || 0, ii.height || 0) >= 120)
    .map(({ p, ii }) => ({ nome: nomeFile(p.title), src: ii.thumburl }));
}

async function chiedi(fetcher, url) {
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`Fandom ha risposto ${res.status}.`);
  return res.json();
}

// le illustrazioni da provare: voci a caso, i loro file, le miniature
async function daProvare({ fetcher, api, quante }) {
  const scelte = new Map();
  for (let giro = 0; giro < GIRI_MAX && scelte.size < quante; giro++) {
    const voci = await chiedi(fetcher, indirizzo(api, { action: "query", generator: "random", grnnamespace: 0, grnlimit: 50, prop: "images", imlimit: "max" }));
    const file = [...new Set((voci?.query?.pages || []).flatMap((p) => (p.images || []).map((i) => i.title)))];
    for (let i = 0; i < file.length && scelte.size < quante; i += 50) {
      const info = await chiedi(fetcher, indirizzo(api, { action: "query", titles: file.slice(i, i + 50).join("|"), prop: "imageinfo", iiprop: "url|mime|size", iiurlwidth: LARGHEZZA }));
      for (const x of illustrazioniDa(info?.query?.pages)) if (scelte.size < quante && !scelte.has(x.nome)) scelte.set(x.nome, x);
    }
  }
  return [...scelte.values()];
}

// SCRIVERE E RILEGGERE: ogni illustrazione si scarica, si scrive nel suo
// file, e alla fine si rilegge tutto. Scaricare e scrivere si contano a
// parte: e' la scrittura sulla scheda quella che non conosciamo.
export async function provaScrittura({ cartella, fetcher = fetch, ora = () => performance.now(), quante = QUANTE, api = FANDOM.api[0], onProgress, onScritte, tetto = TETTO_FILE, aspetta = dorme } = {}) {
  const dentro = await cartella.getDirectoryHandle(CARTELLA, { create: true });
  const lista = await daProvare({ fetcher, api, quante });
  const esito = { scritte: 0, saltate: 0, byte: 0, msScaricare: 0, msScrivere: 0, bloccateScrivendo: 0, riletti: 0, msRileggere: 0, diverse: 0, bloccate: 0, fermata: false, finita: false, quando: Date.now() };
  const scritte = [];
  for (const { nome, src } of lista) {
    const t0 = ora();
    let blob = null;
    try {
      const res = await fetcher(src);
      if (res.ok) blob = await res.blob();
    } catch {
      /* contata fra le saltate */
    }
    const t1 = ora();
    esito.msScaricare += t1 - t0;
    if (!blob?.size) {
      esito.saltate++;
      continue;
    }
    const scritto = await entro(
      (async () => {
        const fh = await dentro.getFileHandle(nome, { create: true });
        const w = await fh.createWritable();
        await w.write(blob);
        await w.close();
      })(),
      tetto,
      aspetta
    );
    esito.msScrivere += ora() - t1;
    if (scritto === TETTO) {
      esito.bloccateScrivendo++;
      continue;
    }
    esito.scritte++;
    esito.byte += blob.size;
    scritte.push({ nome, size: blob.size });
    onProgress?.({ fatte: esito.scritte, di: lista.length });
  }
  // la scrittura e' gia' un risultato: si consegna prima di rileggere
  onScritte?.({ ...esito });
  const t2 = ora();
  let diFila = 0;
  onProgress?.({ fase: "rileggo", fatte: 0, di: scritte.length });
  for (const { nome, size } of scritte) {
    const f = await entro(dentro.getFileHandle(nome).then((h) => h.getFile()), tetto, aspetta);
    if (f === TETTO) {
      esito.bloccate++;
      onProgress?.({ fase: "rileggo", fatte: esito.riletti + esito.bloccate, di: scritte.length });
      if (++diFila >= FERMA_DOPO) {
        esito.fermata = true;
        break;
      }
      continue;
    }
    diFila = 0;
    esito.riletti++;
    if (f.size !== size) esito.diverse++;
    onProgress?.({ fase: "rileggo", fatte: esito.riletti + esito.bloccate, di: scritte.length });
  }
  esito.msRileggere = ora() - t2;
  esito.finita = true;
  return esito;
}

// RIAPERTA L'APP: i file della prova si rileggono dalla cartella ricordata
export async function rileggiProva({ cartella, ora = () => performance.now(), tetto = TETTO_FILE, aspetta = dorme, onProgress }) {
  const dentro = await cartella.getDirectoryHandle(CARTELLA);
  const t0 = ora();
  const r = { file: 0, byte: 0, bloccate: 0, fermata: false, ms: 0 };
  const voci = dentro.values();
  let diFila = 0;
  for (;;) {
    const passo = await entro(
      voci.next().then(async (x) => (x.done ? x : { done: false, size: (await x.value.getFile()).size })),
      tetto,
      aspetta
    );
    if (passo === TETTO) {
      r.bloccate++;
      if (++diFila >= FERMA_DOPO) {
        r.fermata = true;
        break;
      }
      continue;
    }
    if (passo.done) break;
    diFila = 0;
    r.file++;
    r.byte += passo.size;
    onProgress?.({ fase: "rileggo", fatte: r.file });
  }
  r.ms = ora() - t0;
  return r;
}

export const togliProva = (cartella) => cartella.removeEntry(CARTELLA, { recursive: true });

const sec = (ms) => (ms >= 60000 ? `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s` : `${(ms / 1000).toFixed(1).replace(".", ",")} s`);
const mb = (b) => `${(b / 1048576).toFixed(1).replace(".", ",")} MB`;

// LA RIGA DA LEGGERE e il testo da copiare: solo numeri e il nome della
// cartella, che il lettore ha scelto e conosce
export function rigaScrittura(e) {
  if (!e) return "";
  const l1 = e.scritte ? Math.round(e.msScrivere / e.scritte) : 0;
  const pezzi = [
    `${e.scritte} illustrazioni scritte (${mb(e.byte)})`,
    `scaricarle ${sec(e.msScaricare)}, scriverle ${sec(e.msScrivere)} (${l1} ms l'una)`,
  ];
  if (e.bloccateScrivendo) pezzi.push(`${e.bloccateScrivendo} senza risposta scrivendo (oltre ${sec(TETTO_FILE)})`);
  if (e.saltate) pezzi.push(`${e.saltate} non arrivate`);
  if (!e.finita) {
    pezzi.push("rilettura non finita (l'app si è chiusa o la scheda non ha risposto)");
    return pezzi.join(" · ");
  }
  const l2 = e.riletti ? Math.round(e.msRileggere / e.riletti) : 0;
  pezzi.push(`${e.riletti} rilette in ${sec(e.msRileggere)} (${l2} ms l'una)`);
  if (e.bloccate) pezzi.push(`${e.bloccate} senza risposta rileggendo (oltre ${sec(TETTO_FILE)})`);
  if (e.fermata) pezzi.push(`rilettura fermata dopo ${FERMA_DOPO} file di fila senza risposta`);
  if (e.riletti) pezzi.push(e.diverse ? `${e.diverse} rilette diverse da come scritte` : "rilette uguali a come scritte");
  return pezzi.join(" · ");
}

export function rigaRiapertura(r) {
  if (!r) return "";
  const permesso = r.permesso === "granted" ? "permesso ricordato" : r.permesso === "prompt" ? "permesso da richiedere (un tocco)" : `permesso: ${r.permesso}`;
  const l = r.rilettura;
  const letti = l
    ? ` · rilette ${l.file} in ${sec(l.ms)}${l.bloccate ? ` · ${l.bloccate} senza risposta` : ""}${l.fermata ? " · rilettura fermata" : ""}`
    : "";
  const guaio = r.errore ? ` · errore: ${r.errore}` : "";
  return `${new Date(r.quando).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}: ${permesso}${letti}${guaio}`;
}

export function testoProva(stato, ambiente = "") {
  if (!stato) return "";
  return [
    "Book Companion — prova sulla microSD",
    ambiente ? `Browser: ${ambiente}` : null,
    `Cartella: «${stato.cartella}»`,
    stato.ricordata === false ? "La cartella non si lascia ricordare dall'app" : null,
    stato.scrittura ? `Scrittura: ${rigaScrittura(stato.scrittura)}` : null,
    stato.errore ? `Errore: ${stato.errore}` : null,
    ...(stato.riaperture || []).map((r) => `Riapertura: ${rigaRiapertura(r)}`),
  ]
    .filter(Boolean)
    .join("\n");
}

const CHIAVE = "bc_prova_sd";
export const leggiStato = (st = globalThis.localStorage) => {
  try {
    return JSON.parse(st.getItem(CHIAVE)) || null;
  } catch {
    return null;
  }
};
export const scriviStato = (stato, st = globalThis.localStorage) => {
  try {
    if (stato) st.setItem(CHIAVE, JSON.stringify(stato));
    else st.removeItem(CHIAVE);
  } catch {
    /* una prova che non si ricorda non e' un guasto */
  }
};

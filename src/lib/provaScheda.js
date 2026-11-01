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
export const CARTELLA = "Illustrazioni-prova";
export const LARGHEZZA = 400;
const GIRI_MAX = 12;

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
export async function provaScrittura({ cartella, fetcher = fetch, ora = () => performance.now(), quante = QUANTE, api = FANDOM.api[0], onProgress } = {}) {
  const dentro = await cartella.getDirectoryHandle(CARTELLA, { create: true });
  const lista = await daProvare({ fetcher, api, quante });
  const esito = { scritte: 0, saltate: 0, byte: 0, msScaricare: 0, msScrivere: 0, msRileggere: 0, diverse: 0, quando: Date.now() };
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
    const fh = await dentro.getFileHandle(nome, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    esito.msScrivere += ora() - t1;
    esito.scritte++;
    esito.byte += blob.size;
    scritte.push({ nome, size: blob.size });
    onProgress?.({ fatte: esito.scritte, di: lista.length });
  }
  const t2 = ora();
  for (const { nome, size } of scritte) {
    const f = await (await dentro.getFileHandle(nome)).getFile();
    if (f.size !== size) esito.diverse++;
  }
  esito.msRileggere = ora() - t2;
  return esito;
}

// RIAPERTA L'APP: i file della prova si rileggono dalla cartella ricordata
export async function rileggiProva({ cartella, ora = () => performance.now() }) {
  const dentro = await cartella.getDirectoryHandle(CARTELLA);
  const t0 = ora();
  let file = 0;
  let byte = 0;
  for await (const voce of dentro.values()) {
    byte += (await voce.getFile()).size;
    file++;
  }
  return { file, byte, ms: ora() - t0 };
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
    `rilette in ${sec(e.msRileggere)}`,
  ];
  if (e.saltate) pezzi.push(`${e.saltate} non arrivate`);
  pezzi.push(e.diverse ? `${e.diverse} rilette diverse da come scritte` : "tutte uguali a come scritte");
  return pezzi.join(" · ");
}

export function rigaRiapertura(r) {
  if (!r) return "";
  const permesso = r.permesso === "granted" ? "permesso ricordato" : r.permesso === "prompt" ? "permesso da richiedere (un tocco)" : `permesso: ${r.permesso}`;
  const letti = r.rilettura ? ` · rilette ${r.rilettura.file} in ${sec(r.rilettura.ms)}` : "";
  return `${new Date(r.quando).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}: ${permesso}${letti}`;
}

export function testoProva(stato, ambiente = "") {
  if (!stato?.scrittura) return "";
  return [
    "Book Companion — prova sulla microSD",
    ambiente ? `Browser: ${ambiente}` : null,
    `Cartella: «${stato.cartella}»`,
    `Scrittura: ${rigaScrittura(stato.scrittura)}`,
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

// COSTRUISCE IL DIZIONARIO WIKTIONARY INGLESE: wiktextract (kaikki.org) →
// `public/dizionario/wikt/<iniziale>.json.gz` + `meta.json`.
//
// Lo lancia la CI (`.github/workflows/dizionario-wiktionary.yml`) e committa
// il risultato: kaikki.org dalla sandbox di sviluppo non si raggiunge, dai
// server di GitHub si'. A mano: `node scripts/dizionarioWiktionary.mjs
// [file.jsonl(.gz)]` — col file gia' scaricato non tocca la rete.
//
// I dati di kaikki sono qualche giga di JSON, una voce per riga: si leggono
// A FLUSSO, riga per riga, e in memoria restano solo le voci ridotte. Le
// regole della riduzione stanno in `src/lib/wiktionaryOffline.js`
// (`sensiDaKaikki`, `accoda`, `LIMITI`), dove un test le prova.
import { createReadStream, mkdirSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { createGunzip, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chiaveKaikki, sensiDaKaikki, accoda, saccoWikt, fileDi } from "../src/lib/wiktionaryOffline.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const FUORI = join(QUI, "..", "public", "dizionario", "wikt");
const PAGINA = "https://kaikki.org/dictionary/English/index.html";
const POSSIBILI = [
  "https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz",
  "https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl",
];

// L'indirizzo del file l'ha cambiato kaikki piu' di una volta: si provano
// quelli noti, poi si cerca il link nella pagina della lingua inglese.
async function sorgente() {
  const locale = process.argv[2];
  if (locale) return { nome: locale, flusso: createReadStream(locale), gz: locale.endsWith(".gz") };
  const prova = async (url) => {
    const r = await fetch(url);
    return r.ok ? { nome: url, flusso: Readable.fromWeb(r.body), gz: url.endsWith(".gz") } : null;
  };
  for (const url of POSSIBILI) {
    const s = await prova(url).catch(() => null);
    if (s) return s;
  }
  const html = await (await fetch(PAGINA)).text();
  const link = [...html.matchAll(/href="([^"]+\.jsonl(?:\.gz)?)"/g)].map((m) => new URL(m[1], PAGINA).href);
  console.log("link nella pagina:", link);
  for (const url of link) {
    const s = await prova(url).catch(() => null);
    if (s) return s;
  }
  throw new Error(`non trovo i dati inglesi di kaikki (${PAGINA})`);
}

const { nome, flusso, gz } = await sorgente();
console.log(`leggo ${nome}`);
const righe = createInterface({ input: gz ? flusso.pipe(createGunzip()) : flusso, crlfDelay: Infinity });

const voci = new Map();
let lette = 0;
let rotte = 0;
for await (const testo of righe) {
  if (!testo) continue;
  lette++;
  if (lette % 200000 === 0) console.log(`  ${lette} righe, ${voci.size} voci`);
  let riga;
  try {
    riga = JSON.parse(testo);
  } catch {
    rotte++;
    continue;
  }
  const k = chiaveKaikki(riga.word);
  if (!k) continue;
  const sensi = sensiDaKaikki(riga);
  if (!sensi.length) continue;
  voci.set(k, accoda(voci.get(k), sensi));
}
console.log(`righe: ${lette} (illeggibili: ${rotte}), voci: ${voci.size}`);

// per iniziale, e dentro per sacco: un sacco sta tutto in un file solo
const perFile = new Map();
for (const k of [...voci.keys()].sort()) {
  const f = fileDi(k);
  const s = saccoWikt(k);
  if (!perFile.has(f)) perFile.set(f, {});
  const sacchi = perFile.get(f);
  (sacchi[s] ||= {})[k] = voci.get(k);
}

mkdirSync(FUORI, { recursive: true });
for (const vecchio of readdirSync(FUORI)) if (vecchio.endsWith(".json.gz")) rmSync(join(FUORI, vecchio));
const file = [];
const impronta = createHash("sha1");
let crudo = 0;
for (const [n, sacchi] of [...perFile].sort(([a], [b]) => a.localeCompare(b))) {
  const json = JSON.stringify(sacchi);
  crudo += json.length;
  const byte = gzipSync(json, { level: 9 });
  writeFileSync(join(FUORI, `${n}.json.gz`), byte);
  impronta.update(byte);
  file.push({ n, byte: byte.length });
}

writeFileSync(
  join(FUORI, "LICENZA-Wiktionary.txt"),
  [
    "Le definizioni di questo dizionario vengono da Wiktionary inglese",
    "(https://en.wiktionary.org), dei suoi autori, e sono distribuite con la",
    "licenza Creative Commons Attribuzione-Condividi allo stesso modo 4.0:",
    "https://creativecommons.org/licenses/by-sa/4.0/",
    "",
    "Estratte con wiktextract e pubblicate da kaikki.org:",
    "Tatu Ylonen (2022). «Wiktextract: Wiktionary as Machine-Readable",
    "Structured Data». Proceedings of the 13th Conference on Language",
    "Resources and Evaluation (LREC), 1317-1325.",
    "",
    "Questo dizionario e' una riduzione (sensi, esempi brevi) fatta da",
    "scripts/dizionarioWiktionary.mjs, con la stessa licenza.",
    "",
  ].join("\n")
);

const totale = file.reduce((n, f) => n + f.byte, 0);
// IL CARTELLINO LO SCRIVE CHI COSTRUISCE. La `versione` e' l'impronta dei
// file, non l'ora: rifatto coi dati di ieri il dizionario e' identico, la
// CI non ha niente da committare e il tablet non riscarica niente. Con
// l'ora, ogni giro della CI avrebbe fatto ripartire da capo chi lo ha.
writeFileSync(
  join(FUORI, "meta.json"),
  JSON.stringify({ voci: voci.size, byte: totale, file, fonte: "Wiktionary inglese (wiktextract, kaikki.org)", versione: impronta.digest("hex").slice(0, 16) })
);
const mb = (n) => (n / 1048576).toFixed(1);
console.log(`crudo ${mb(crudo)} MB → compresso ${mb(totale)} MB in ${file.length} file`);
for (const f of file) console.log(`  ${f.n}: ${mb(f.byte)} MB`);

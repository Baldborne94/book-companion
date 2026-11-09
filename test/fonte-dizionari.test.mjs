// I DIZIONARI OFFLINE SCENDONO DA GITHUB, NON DALLA BUILD (`lib/fonteDizionari.js`):
// chiesto dal lettore dopo i 10 GB di Vercel pieni («togli il dizionario dalle
// build»). I file stanno in `dizionario/`, fuori da `public/`, e l'app li
// chiede a raw.githubusercontent.com dal ramo `main`: ogni indirizzo che l'app
// chiede deve essere un file che il repository ha davvero, in quel posto.
import { existsSync, readFileSync } from "node:fs";
import { DIZIONARI } from "../src/lib/fonteDizionari.js";
import { CARTELLA } from "../src/lib/wiktionaryOffline.js";

const radice = new URL("../", import.meta.url);
const BASE = "https://raw.githubusercontent.com/Baldborne94/book-companion/main/";
const nelRepo = (url) => (url.startsWith(BASE) ? existsSync(new URL(url.slice(BASE.length), radice)) : false);

export default async (t) => {
  t.c("la fonte e' il ramo main del repository su GitHub", DIZIONARI.startsWith(BASE), DIZIONARI);
  t.c("il cartellino di WordNet c'e' dove l'app lo chiede", nelRepo(`${DIZIONARI}/meta.json`));
  t.c("…e il suo file", nelRepo(`${DIZIONARI}/en.json.gz`));
  t.c("…e le licenze", nelRepo(`${DIZIONARI}/LICENZA-WordNet.txt`) && nelRepo(`${DIZIONARI}/LICENZA-MultiWordNet.txt`) && nelRepo(`${CARTELLA}/LICENZA-Wiktionary.txt`));
  const meta = JSON.parse(readFileSync(new URL(`${CARTELLA.slice(BASE.length)}/meta.json`, radice), "utf8"));
  t.c("Wiktionary: il cartellino c'e'", meta.file?.length > 20);
  t.c("…e ogni file che il cartellino nomina", meta.file.every((f) => nelRepo(`${CARTELLA}/${f.n}.json.gz`)), meta.file.filter((f) => !nelRepo(`${CARTELLA}/${f.n}.json.gz`)).map((f) => f.n).join());
  const codice = ["src/lib/dizionarioOffline.js", "src/lib/wiktionaryOffline.js", "src/components/SezioneDizionario.jsx"].map((f) => readFileSync(new URL(f, radice), "utf8")).join("\n");
  t.c("nessun indirizzo «/dizionario/» del sito resta nel codice", !/["'`]\/dizionario\//.test(codice));
};

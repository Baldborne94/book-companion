// IL GUSCIO SI COSTRUISCE DALLA MACCHINA (`.github/workflows/apk.yml`).
// Il `twa-manifest.json` non sta nel repository: si genera a ogni giro dal
// manifest del sito, con la stessa funzione che usa `bubblewrap init`, cosi'
// un tipo di file aggiunto a `file_handlers` o un'icona nuova arrivano al
// guscio senza che nessuno ricopi niente a mano. Sopra, le poche cose che
// `init` chiedeva e che il manifest del sito non sa dire.
//
//   node scripts/apk.mjs <codice> <nome-versione>   → twa-manifest.json
//   node scripts/apk.mjs impronta <file.apk-certs>  → controlla la firma
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

export const SITO = "https://book-companion-ruddy.vercel.app";

const qui = new URL("../", import.meta.url);
const leggiJson = (p) => JSON.parse(readFileSync(new URL(p, qui), "utf8"));

export const pacchettoDelSito = (assetlinks) => assetlinks[0].target.package_name;
export const improntaDelSito = (assetlinks) => assetlinks[0].target.sha256_cert_fingerprints;

// `twa` e' quel che genera Bubblewrap dal manifest del sito
export function guscio(twa, { codice, versione, assetlinks }) {
  if (!Number.isInteger(codice) || codice < 1) throw new Error(`versionCode non valido: ${codice}`);
  return {
    ...twa,
    // il valore di `init` e' il dominio rovesciato: Android legherebbe il
    // guscio a un pacchetto che `assetlinks.json` non conosce, e l'app
    // partirebbe con la barra di Chrome
    packageId: pacchettoDelSito(assetlinks),
    // l'app non manda notifiche, e acceso l'APK dichiara un permesso che non usa
    enableNotifications: false,
    // come rispondeva il lettore a `init` (docs/TWA.md): l'APK nuovo non
    // cambia come gira lo schermo rispetto a quello che ha sul tablet
    orientation: "default",
    // cresce a ogni commit su main: Android installa sopra solo un codice piu' alto
    appVersionCode: codice,
    appVersionName: versione,
    signingKey: { path: "./android.keystore", alias: "android" },
  };
}

// `apksigner verify --print-certs` scrive «SHA-256 digest: 062d23…»;
// assetlinks tiene «06:2D:23:…». Un APK firmato con un'altra chiave si
// installa, ma parte con la barra di Chrome: meglio non pubblicarlo.
export function firmaDelSito(certs, assetlinks) {
  const m = /SHA-256 digest:\s*([0-9a-f]{64})/i.exec(certs || "");
  if (!m) return false;
  const impronta = m[1].toUpperCase().match(/../g).join(":");
  return improntaDelSito(assetlinks).includes(impronta);
}

async function principale([primo, secondo]) {
  const assetlinks = leggiJson("public/.well-known/assetlinks.json");
  if (primo === "impronta") {
    if (firmaDelSito(readFileSync(secondo, "utf8"), assetlinks)) return console.log("firma: e' la chiave di assetlinks.json");
    console.error("firma: l'APK NON e' firmato con la chiave di assetlinks.json — non si pubblica");
    process.exit(1);
  }
  // Bubblewrap sta nella cartella del giro, non fra le dipendenze del sito
  const { TwaManifest } = createRequire(join(process.cwd(), "x.js"))("@bubblewrap/core");
  const sito = leggiJson("public/manifest.json");
  const twa = TwaManifest.fromWebManifestJson(new URL(`${SITO}/manifest.json`), sito).toJson();
  const pronto = guscio(twa, { codice: Number(primo), versione: secondo, assetlinks });
  writeFileSync("twa-manifest.json", JSON.stringify(pronto, null, 2));
  console.log(`twa-manifest.json: ${pronto.packageId} ${pronto.appVersionName} (${pronto.appVersionCode})`);
}

if (import.meta.url === `file://${process.argv[1]}`) await principale(process.argv.slice(2));

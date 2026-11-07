// IL GUSCIO SI COSTRUISCE DALLA MACCHINA (`.github/workflows/apk.yml`).
// Il `twa-manifest.json` non sta nel repository: si genera a ogni giro dal
// manifest del sito, con la stessa funzione che usa `bubblewrap init`, cosi'
// un tipo di file aggiunto a `file_handlers` o un'icona nuova arrivano al
// guscio senza che nessuno ricopi niente a mano. Sopra, le poche cose che
// `init` chiedeva e che il manifest del sito non sa dire.
//
//   node scripts/apk.mjs <codice> <nome-versione>   → twa-manifest.json
//   node scripts/apk.mjs cuci                        → il nostro codice nel progetto generato
//   node scripts/apk.mjs impronta <file.apk-certs>  → controlla la firma
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

export const SITO = "https://book-companion-ruddy.vercel.app";

const qui = new URL("../", import.meta.url);
const leggiJson = (p) => JSON.parse(readFileSync(new URL(p, qui), "utf8"));

export const pacchettoDelSito = (assetlinks) => assetlinks[0].target.package_name;
export const improntaDelSito = (assetlinks) => assetlinks[0].target.sha256_cert_fingerprints;

// `twa` e' quel che genera Bubblewrap dal manifest del sito
// L'ETICHETTA SOTTO L'ICONA E' IL NOME INTERO (chiesto dal lettore: «invece
// di Grimorio chiama l'app Book Companion»). Bubblewrap la prende dallo
// `short_name` del sito, che per la PWA deve stare in dodici caratteri;
// l'etichetta di Android non ha quel tetto, e `validate()` del core
// controlla solo che il nome ci sia. Il primo tentativo la riscriveva in
// `res/values/strings.xml`, che nel progetto generato non c'e': le stringhe
// nascono da `resValue` in `app/build.gradle`, da questo campo. «Grimorio»
// resta il nome interno del canale (`grimorio:…`) e del log.
export const ETICHETTA = "Book Companion";

export function guscio(twa, { codice, versione, assetlinks }) {
  if (!Number.isInteger(codice) || codice < 1) throw new Error(`versionCode non valido: ${codice}`);
  return {
    ...twa,
    launcherName: ETICHETTA,
    // il valore di `init` e' il dominio rovesciato: Android legherebbe il
    // guscio a un pacchetto che `assetlinks.json` non conosce, e l'app
    // partirebbe con la barra di Chrome
    packageId: pacchettoDelSito(assetlinks),
    // l'app non manda notifiche, e acceso l'APK dichiara un permesso che non usa
    enableNotifications: false,
    // come rispondeva il lettore a `init` (docs/TWA.md): l'APK nuovo non
    // cambia come gira lo schermo rispetto a quello che ha sul tablet
    orientation: "default",
    // la libreria del guscio (android-browser-helper 2.7.4, che il core di
    // Bubblewrap porta con se') vuole Android 7 (API 24) come minimo, e il
    // progetto generato partiva da 21: il merge dei manifest si fermava li',
    // prima ancora di compilare. Il tablet del lettore e' Android 10.
    minSdkVersion: 24,
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

// IL NOSTRO CODICE ANDROID SI CUCE NEL PROGETTO CHE BUBBLEWRAP GENERA
// (`android/*.java`, chiesto dal lettore: la copertina sulla schermata di
// blocco «tipo Kindle», che solo un'app nativa puo' mettere). Bubblewrap non
// prevede codice proprio e a ogni `update` riscrive il progetto da capo:
// quindi si cuce DOPO l'update e prima del build, su tre punti precisi, e
// se un punto non si trova piu' — Bubblewrap e' cambiato — il giro si
// ferma e lo dice, invece di pubblicare un guscio muto.
//
//   - la `LauncherActivity` generata estende la nostra `GuscioActivity`
//     invece di quella della libreria (che e' quel che la nostra estende);
//   - il manifest dichiara il permesso di cambiare lo sfondo e il
//     `PostMessageService` di androidx, senza il quale Chrome non apre il
//     canale;
//   - R8 (`minifyEnabled true`) rinominerebbe il campo privato della
//     libreria che leggiamo per riflessione (`mSession`): una regola
//     ProGuard gli tiene il nome.
//
// LA CLASSE INTERA, NON IL SOLO CAMPO: l'APK 1104 e' uscito con la regola
// `-keepclassmembers` sul campo e il guscio ha risposto «la sessione non si
// e' letta» — R8 fonde una classe con la sua unica figlia e rinomina quel
// che la regola sul membro non protegge. Una classe tenuta (`-keep … { *; }`)
// non si fonde, non si rinomina e tiene ogni campo; e le nostre si tengono
// con lei, perche' sono quelle che la leggono.
export const CAMPO_SESSIONE = "mSession";
export const regoleProguard = (pacchetto) => `# la sessione di Chrome si legge per riflessione (android/SchermataDiBlocco.java):
# la classe intera, o R8 la fonde nella nostra e rinomina ${CAMPO_SESSIONE}
-keep class com.google.androidbrowserhelper.trusted.TwaLauncher { *; }
-keep class ${pacchetto}.** { *; }
`;
// e quello di leggere lo sfondo di prima, che dal 13 non serve piu' a niente
const PERMESSO = '<uses-permission android:name="android.permission.SET_WALLPAPER"/>\n    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32"/>\n    <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>\n    <uses-permission android:name="android.permission.INTERNET"/>\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>\n    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>\n    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>';
// il servizio dei messaggi di Chrome, l'attivita' trasparente che chiede
// i permessi sopra la pagina (`android/PermessoActivity.java`), e il lavoro
// periodico degli avvisi dei capitoli nuovi (`android/Avvisi.java`)
const SERVIZIO = '<service android:name="androidx.browser.customtabs.PostMessageService" android:exported="true"/>\n    <activity android:name=".PermessoActivity" android:exported="false" android:theme="@android:style/Theme.Translucent.NoTitleBar"/>\n    <service android:name=".Avvisi" android:permission="android.permission.BIND_JOB_SERVICE" android:exported="false"/>';
const BASE_LIBRERIA = "extends com.google.androidbrowserhelper.trusted.LauncherActivity";
const BASE_NOSTRA = "extends GuscioActivity";
const REGOLE = "proguardFiles 'proguard-grimorio.pro'";

function unaVolta(testo, ancora, dove) {
  const prima = testo.indexOf(ancora);
  if (prima < 0 || testo.indexOf(ancora, prima + 1) >= 0)
    throw new Error(`cuci: in ${dove} l'ancora «${ancora}» ${prima < 0 ? "non c'e'" : "c'e' piu' di una volta"} — Bubblewrap e' cambiato, vedi scripts/apk.mjs`);
  return prima;
}

export function cuciGuscio({ manifest, launcher, gradle, pacchetto }) {
  if (!pacchetto) throw new Error("cuci: manca il package dell'APK per le regole ProGuard");
  let m = manifest;
  if (!m.includes(PERMESSO)) {
    const i = unaVolta(m, "<application", "AndroidManifest.xml");
    m = `${m.slice(0, i)}${PERMESSO}\n\n    ${m.slice(i)}`;
  }
  if (!m.includes(SERVIZIO)) {
    const i = unaVolta(m, "</application>", "AndroidManifest.xml");
    m = `${m.slice(0, i)}    ${SERVIZIO}\n\n    ${m.slice(i)}`;
  }
  let l = launcher;
  if (!l.includes(BASE_NOSTRA)) {
    unaVolta(l, BASE_LIBRERIA, "LauncherActivity.java");
    l = l.replace(BASE_LIBRERIA, BASE_NOSTRA);
  }
  let g = gradle;
  if (!g.includes(REGOLE)) {
    const i = unaVolta(g, "minifyEnabled true", "app/build.gradle");
    const fine = i + "minifyEnabled true".length;
    g = `${g.slice(0, fine)}\n            ${REGOLE}${g.slice(fine)}`;
  }
  return { manifest: m, launcher: l, gradle: g, proguard: regoleProguard(pacchetto) };
}

// il package dichiarato in ogni file di `android/` dev'essere quello
// dell'APK, o il build cade su un file nella cartella sbagliata
export const pacchettoDi = (java) => /^\s*package\s+([\w.]+)\s*;/m.exec(java)?.[1] || "";

function cuci(assetlinks) {
  const pacchetto = pacchettoDelSito(assetlinks);
  const cartella = `app/src/main/java/${pacchetto.replace(/\./g, "/")}`;
  const nostri = readdirSync(new URL("android/", qui)).filter((f) => f.endsWith(".java"));
  for (const f of nostri) {
    const java = readFileSync(new URL(`android/${f}`, qui), "utf8");
    if (pacchettoDi(java) !== pacchetto) throw new Error(`cuci: android/${f} dichiara il package «${pacchettoDi(java)}», l'APK e' «${pacchetto}»`);
  }
  const vie = { manifest: "app/src/main/AndroidManifest.xml", launcher: `${cartella}/LauncherActivity.java`, gradle: "app/build.gradle" };
  const cucito = cuciGuscio({ ...Object.fromEntries(Object.entries(vie).map(([k, v]) => [k, readFileSync(v, "utf8")])), pacchetto });
  for (const [k, v] of Object.entries(vie)) writeFileSync(v, cucito[k]);
  writeFileSync("app/proguard-grimorio.pro", cucito.proguard);
  mkdirSync(cartella, { recursive: true });
  for (const f of nostri) writeFileSync(join(cartella, f), readFileSync(new URL(`android/${f}`, qui), "utf8"));
  console.log(`cuci: ${nostri.join(", ")} in ${cartella}, manifest, build.gradle e regole ProGuard`);
}

async function principale([primo, secondo]) {
  const assetlinks = leggiJson("public/.well-known/assetlinks.json");
  if (primo === "cuci") return cuci(assetlinks);
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

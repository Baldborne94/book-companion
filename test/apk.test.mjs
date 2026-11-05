// IL GUSCIO CHE COSTRUISCE LA MACCHINA (`scripts/apk.mjs`). Sbaglia in
// silenzio: un APK col pacchetto sbagliato si installa ACCANTO all'app vera
// (con la biblioteca vuota) e parte con la barra di Chrome; uno con un
// versionCode fermo non si installa sopra; uno firmato con un'altra chiave
// si pubblica e il tablet non lo sa.
import { readFileSync, readdirSync } from "node:fs";
import { guscio, firmaDelSito, pacchettoDelSito } from "../scripts/apk.mjs";

export default async function (t) {
  const assetlinks = JSON.parse(readFileSync("public/.well-known/assetlinks.json", "utf8"));
  const init = { packageId: "app.vercel.book_companion_ruddy.twa", launcherName: "Grimorio", display: "fullscreen", enableNotifications: true, orientation: "any", appVersionCode: 1, signingKey: { path: "./x.keystore", alias: "x" } };
  const g = guscio(init, { codice: 842, versione: "1.0.0 (842)", assetlinks });

  t.eq("il pacchetto e' quello che assetlinks lega al sito", g.packageId, pacchettoDelSito(assetlinks));
  t.eq("…cioe' quello dell'APK gia' sul tablet", g.packageId, "it.bookcompanion.app");
  t.eq("niente permesso di notifica", g.enableNotifications, false);
  t.eq("l'orientamento del guscio fatto a mano (docs/TWA.md), non «any» del sito", g.orientation, "default");
  t.eq("il codice e' quello del giro", g.appVersionCode, 842);
  t.eq("…col nome che si legge nelle impostazioni", g.appVersionName, "1.0.0 (842)");
  t.eq("la chiave dove il giro la scrive", `${g.signingKey.path} ${g.signingKey.alias}`, "./android.keystore android");
  t.eq("quel che dice il manifest del sito resta", `${g.launcherName} ${g.display}`, "Grimorio fullscreen");
  for (const cattivo of [0, NaN, 1.5, "842"]) {
    let caduto = false;
    try { guscio(init, { codice: cattivo, versione: "x", assetlinks }); } catch { caduto = true; }
    t.c(`un versionCode storto (${cattivo}) ferma il giro`, caduto);
  }

  // la stampa di `apksigner verify --print-certs`
  const hex = assetlinks[0].target.sha256_cert_fingerprints[0].replace(/:/g, "").toLowerCase();
  const stampa = (h) => `Signer #1 certificate DN: CN=Baldborne94\nSigner #1 certificate SHA-256 digest: ${h}\nSigner #1 certificate SHA-1 digest: 0123`;
  t.c("firmato con la chiave di assetlinks: si pubblica", firmaDelSito(stampa(hex), assetlinks));
  t.c("con un'altra chiave no", !firmaDelSito(stampa("ab".repeat(32)), assetlinks));
  t.c("senza impronta leggibile no", !firmaDelSito("", assetlinks));
  await cucitura(t);
}

// ---- IL NOSTRO CODICE ANDROID NEL PROGETTO GENERATO ------------------------
// (chiesto dal lettore: la copertina sulla schermata di blocco «tipo
// Kindle»). Bubblewrap riscrive il progetto a ogni update: si cuce dopo, su
// ancore precise, e un'ancora sparita ferma il giro invece di pubblicare un
// guscio che non parla con la pagina.
export async function cucitura(t) {
  const { cuciGuscio, pacchettoDi, CAMPO_SESSIONE, PROGUARD } = await import("../scripts/apk.mjs");
  const assetlinks = JSON.parse(readFileSync("public/.well-known/assetlinks.json", "utf8"));
  const manifest = `<manifest package="it.bookcompanion.app">\n    <application android:name="Application">\n        <activity android:name="LauncherActivity" />\n    </application>\n</manifest>\n`;
  const launcher = `package it.bookcompanion.app;\n\npublic class LauncherActivity\n        extends com.google.androidbrowserhelper.trusted.LauncherActivity {\n}\n`;
  const gradle = `android {\n    buildTypes {\n        release {\n            minifyEnabled true\n        }\n    }\n}\n`;
  const c = cuciGuscio({ manifest, launcher, gradle });
  t.c("il permesso di cambiare lo sfondo, prima di <application>", /SET_WALLPAPER"\/>[\s\S]*<application/.test(c.manifest));
  t.c("il servizio dei messaggi, dentro <application>", /<application[\s\S]*PostMessageService"[^>]*android:exported="true"[\s\S]*<\/application>/.test(c.manifest));
  t.c("la LauncherActivity generata estende la nostra", c.launcher.includes("extends GuscioActivity") && !c.launcher.includes("trusted.LauncherActivity"));
  t.c("le regole ProGuard entrano nel build di release", /minifyEnabled true\s*\n\s*proguardFiles 'proguard-grimorio.pro'/.test(c.gradle));
  t.c("e tengono il nome del campo letto per riflessione", c.proguard.includes(`CustomTabsSession ${CAMPO_SESSIONE};`));
  const di_nuovo = cuciGuscio({ manifest: c.manifest, launcher: c.launcher, gradle: c.gradle });
  t.c("cucire due volte non raddoppia niente", di_nuovo.manifest === c.manifest && di_nuovo.launcher === c.launcher && di_nuovo.gradle === c.gradle);
  for (const [nome, rotto] of [
    ["senza <application>", { manifest: "<manifest/>", launcher, gradle }],
    ["con due <application>", { manifest: manifest + "<application/>", launcher, gradle }],
    ["con una LauncherActivity che non estende la libreria", { manifest, launcher: "class X {}", gradle }],
    ["senza minifyEnabled", { manifest, launcher, gradle: "android {}" }],
  ]) {
    let caduto = "";
    try { cuciGuscio(rotto); } catch (e) { caduto = e.message; }
    t.c(`un progetto ${nome} ferma il giro e dice dove`, /cuci: in .* l'ancora/.test(caduto), caduto);
  }
  // i file in android/ sono dell'APK giusto, e la riflessione legge il
  // campo che la regola ProGuard conserva
  const java = readdirSync("android").filter((f) => f.endsWith(".java"));
  t.c("c'e' del codice Android da cucire", java.length >= 2, java.join());
  for (const f of java) t.eq(`android/${f} e' nel package dell'APK`, pacchettoDi(readFileSync(`android/${f}`, "utf8")), pacchettoDelSito(assetlinks));
  const blocco = readFileSync("android/SchermataDiBlocco.java", "utf8");
  t.c("la riflessione legge il campo che ProGuard conserva", blocco.includes(`getDeclaredField("${CAMPO_SESSIONE}")`) && PROGUARD.includes(CAMPO_SESSIONE));
  t.c("…e manda un saluto che la pagina riconosce", blocco.includes('SALUTO = "grimorio:pronto"'));
  const yml = readFileSync(".github/workflows/apk.yml", "utf8");
  t.c("la CI cuce dopo l'update e prima del build", /bubblewrap update[^\n]*\n(?:[^\n]*\n)*?[^\n]*apk\.mjs cuci\n(?:[^\n]*\n)*?[^\n]*bubblewrap build/.test(yml));
  t.c("…e riparte quando cambia android/", /- android\/\*\*/.test(yml));
}

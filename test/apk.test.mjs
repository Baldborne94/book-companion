// IL GUSCIO CHE COSTRUISCE LA MACCHINA (`scripts/apk.mjs`). Sbaglia in
// silenzio: un APK col pacchetto sbagliato si installa ACCANTO all'app vera
// (con la biblioteca vuota) e parte con la barra di Chrome; uno con un
// versionCode fermo non si installa sopra; uno firmato con un'altra chiave
// si pubblica e il tablet non lo sa.
import { readFileSync, readdirSync } from "node:fs";
import { guscio, firmaDelSito, pacchettoDelSito, ETICHETTA } from "../scripts/apk.mjs";

export default async function (t) {
  const assetlinks = JSON.parse(readFileSync("public/.well-known/assetlinks.json", "utf8"));
  const init = { packageId: "app.vercel.book_companion_ruddy.twa", launcherName: "Grimorio", display: "fullscreen", enableNotifications: true, orientation: "any", appVersionCode: 1, signingKey: { path: "./x.keystore", alias: "x" } };
  const g = guscio(init, { codice: 842, versione: "1.0.0 (842)", assetlinks });

  t.eq("il pacchetto e' quello che assetlinks lega al sito", g.packageId, pacchettoDelSito(assetlinks));
  t.eq("…cioe' quello dell'APK gia' sul tablet", g.packageId, "it.bookcompanion.app");
  t.eq("niente permesso di notifica", g.enableNotifications, false);
  t.eq("l'orientamento del guscio fatto a mano (docs/TWA.md), non «any» del sito", g.orientation, "default");
  t.eq("il codice e' quello del giro", g.appVersionCode, 842);
  t.eq("Android 7 come minimo: lo vuole la libreria del guscio", g.minSdkVersion, 24);
  t.eq("…col nome che si legge nelle impostazioni", g.appVersionName, "1.0.0 (842)");
  t.eq("la chiave dove il giro la scrive", `${g.signingKey.path} ${g.signingKey.alias}`, "./android.keystore android");
  t.eq("quel che dice il manifest del sito resta", g.display, "fullscreen");
  // l'etichetta sotto l'icona e' il nome intero, non lo short_name della PWA
  t.eq("l'etichetta sotto l'icona e' il nome intero", g.launcherName, "Book Companion");
  t.c("…che e' il nome del manifest del sito", ETICHETTA === JSON.parse(readFileSync("public/manifest.json", "utf8")).name);
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
  const { cuciGuscio, pacchettoDi, CAMPO_SESSIONE, regoleProguard } = await import("../scripts/apk.mjs");
  const assetlinks = JSON.parse(readFileSync("public/.well-known/assetlinks.json", "utf8"));
  const manifest = `<manifest package="it.bookcompanion.app">\n    <application android:name="Application">\n        <activity android:name="LauncherActivity" />\n    </application>\n</manifest>\n`;
  const launcher = `package it.bookcompanion.app;\n\npublic class LauncherActivity\n        extends com.google.androidbrowserhelper.trusted.LauncherActivity {\n}\n`;
  const gradle = `android {\n    buildTypes {\n        release {\n            minifyEnabled true\n        }\n    }\n}\n`;
  const pacchetto = pacchettoDelSito(assetlinks);
  const c = cuciGuscio({ manifest, launcher, gradle, pacchetto });
  t.c("il permesso di cambiare lo sfondo, prima di <application>", /SET_WALLPAPER"\/>[\s\S]*<application/.test(c.manifest));
  // il guscio va in rete da se' (MangaDex, `chiediAllaRete`): una TWA di
  // solito non lo fa, ci va Chrome, e l'APK 1148 ha risposto «Permission
  // denied (missing INTERNET permission?)»
  t.c("e quello di andare in rete, per MangaDex", /android\.permission\.INTERNET"\/>[\s\S]*<application/.test(c.manifest));
  // gli avvisi dei capitoli nuovi ad app chiusa (`android/Avvisi.java`): le
  // notifiche, il lavoro periodico che sopravvive al riavvio, e il servizio
  // che solo il sistema puo' legare
  // Android 14 rifiuta un lavoro periodico con la rete a chi non dichiara di
  // guardare la rete: l'APK 1160 cadeva a ogni apertura (SecurityException)
  t.c("il permesso di guardare la rete, che il lavoro con la rete vuole da Android 14", /android\.permission\.ACCESS_NETWORK_STATE"\/>[\s\S]*<application/.test(c.manifest));
  t.c("il permesso delle notifiche e quello del riavvio", /android\.permission\.POST_NOTIFICATIONS"\/>[\s\S]*<application/.test(c.manifest) && /android\.permission\.RECEIVE_BOOT_COMPLETED"\/>[\s\S]*<application/.test(c.manifest));
  t.c("il lavoro degli avvisi dentro l'applicazione, legabile solo dal sistema", /<application[\s\S]*<service android:name="\.Avvisi" android:permission="android\.permission\.BIND_JOB_SERVICE" android:exported="false"\/>[\s\S]*<\/application>/.test(c.manifest));
  t.c("e quello di leggere lo sfondo di prima, fino ad Android 12", /READ_EXTERNAL_STORAGE" android:maxSdkVersion="32"\/>[\s\S]*<application/.test(c.manifest));
  // il tablet del lettore e' un Android 14: li' lo sfondo si legge solo con
  // l'«accesso a tutti i file» (StorageManager.checkPermissionReadImages guarda
  // MANAGE_EXTERNAL_STORAGE e poi READ_EXTERNAL_STORAGE, che a targetSdk 36
  // non si concede piu'; «Foto e video» non bastava, APK 1138)
  t.c("…e da Android 13 l'accesso a tutti i file", /MANAGE_EXTERNAL_STORAGE"\/>[\s\S]*<application/.test(c.manifest) && !/READ_MEDIA_IMAGES/.test(c.manifest));
  const blocco0 = readFileSync("android/SchermataDiBlocco.java", "utf8");
  const permesso0 = readFileSync("android/PermessoActivity.java", "utf8");
  t.c("il guscio da Android 13 guarda l'accesso a tutti i file, prima READ_EXTERNAL_STORAGE", /tuttiIFile\(\) \{\s*return Build\.VERSION\.SDK_INT >= Build\.VERSION_CODES\.TIRAMISU;/.test(blocco0) && /if \(tuttiIFile\(\)\) return android\.os\.Environment\.isExternalStorageManager\(\);/.test(blocco0) && /checkSelfPermission\(permessoLettura\(\)\)/.test(blocco0));
  t.c("…e la finestra del permesso da Android 13 porta all'interruttore e aspetta il ritorno", /if \(SchermataDiBlocco\.tuttiIFile\(\)\) \{[\s\S]*startActivityForResult\(SchermataDiBlocco\.intentoTuttiIFile\(this\), TUTTI_I_FILE\)/.test(permesso0) && /onActivityResult[\s\S]*codice != TUTTI_I_FILE[\s\S]*permessoRispostoDalleImpostazioni\(this\);\s*SchermataDiBlocco\.dopoIlPermesso\(this\)/.test(permesso0) && blocco0.includes("ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION"));
  t.c("…e su Android 13 non salta piu' la lettura in silenzio", !/TIRAMISU\) return true;/.test(blocco0) && !/TIRAMISU && !leggibile/.test(blocco0));
  // a tablet sdraiato Android ritaglia lo sfondo per lo schermo com'e': ne' si mette ne' si rimette
  t.c("a tablet sdraiato lo sfondo non si mette", /if \(sdraiato\(app\)\) throw new IllegalStateException\(SDRAIATO\);\s*boolean salvato = salvaPrima\(app, wm\);/.test(blocco0));
  t.c("…e non si rimette", /if \(prima\.exists\(\) && sdraiato\(app\)\) throw new IllegalStateException\(SDRAIATO\);/.test(blocco0) && /getRealMetrics\(m\);\s*return m\.widthPixels > m\.heightPixels;/.test(blocco0));
  t.c("…e il lancio dice la versione di Android, che lo user agent nasconde", /appendQueryParameter\("android", String\.valueOf\(Build\.VERSION\.SDK_INT\)\)/.test(blocco0));
  t.c("il servizio dei messaggi, dentro <application>", /<application[\s\S]*PostMessageService"[^>]*android:exported="true"[\s\S]*<\/application>/.test(c.manifest));
  t.c("e l'attivita' trasparente del permesso, non esportata, dentro <application>", /<application[\s\S]*<activity android:name="\.PermessoActivity" android:exported="false"[^>]*Theme\.Translucent[\s\S]*<\/application>/.test(c.manifest) && readdirSync("android").includes("PermessoActivity.java"));
  t.c("la LauncherActivity generata estende la nostra", c.launcher.includes("extends GuscioActivity") && !c.launcher.includes("trusted.LauncherActivity"));
  t.c("le regole ProGuard entrano nel build di release", /minifyEnabled true\s*\n\s*proguardFiles 'proguard-grimorio.pro'/.test(c.gradle));
  // la classe INTERA (l'APK 1104 e' uscito col solo campo, e R8 l'ha toccato)
  t.c("e tengono intera la classe della libreria che si legge per riflessione", /-keep class com\.google\.androidbrowserhelper\.trusted\.TwaLauncher \{ \*; \}/.test(c.proguard));
  t.c("…e le nostre, che la leggono", c.proguard.includes(`-keep class ${pacchetto}.** { *; }`));
  t.c("…dicendo il campo che si cerca", c.proguard.includes(CAMPO_SESSIONE));
  let senza = "";
  try { cuciGuscio({ manifest, launcher, gradle }); } catch (e) { senza = e.message; }
  t.c("senza il package le regole non si scrivono", /package/.test(senza));
  const di_nuovo = cuciGuscio({ manifest: c.manifest, launcher: c.launcher, gradle: c.gradle, pacchetto });
  t.c("cucire due volte non raddoppia niente", di_nuovo.manifest === c.manifest && di_nuovo.launcher === c.launcher && di_nuovo.gradle === c.gradle);
  for (const [nome, rotto] of [
    ["senza <application>", { manifest: "<manifest/>", launcher, gradle, pacchetto }],
    ["con due <application>", { manifest: manifest + "<application/>", launcher, gradle, pacchetto }],
    ["con una LauncherActivity che non estende la libreria", { manifest, launcher: "class X {}", gradle, pacchetto }],
    ["senza minifyEnabled", { manifest, launcher, gradle: "android {}", pacchetto }],
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
  t.c("la riflessione legge il campo che ProGuard conserva, e se no cerca per tipo", blocco.includes(`getDeclaredField("${CAMPO_SESSIONE}")`) && blocco.includes("f.getType() != CustomTabsSession.class") && regoleProguard("x.y").includes(CAMPO_SESSIONE));
  t.c("…e manda un saluto che la pagina riconosce", blocco.includes('SALUTO = "grimorio:pronto"'));
  // la finestra del permesso si apre dal guscio nel momento in cui serve, e
  // concesso la copertina messa da parte si mette da sola
  const permesso = readFileSync("android/PermessoActivity.java", "utf8");
  t.c("una copertina senza permesso si mette da parte e apre la finestra sopra Chrome", /scrivi\(fileAttesa\(app\)[\s\S]*chiediPermesso\(app\)/.test(blocco) && /PermessoActivity\.class\);\s*i\.addFlags\(Intent\.FLAG_ACTIVITY_NEW_TASK\)/.test(blocco));
  t.c("…e risposto il permesso la mette da sola", /permessoRisposto\(this, esiti\);\s*SchermataDiBlocco\.dopoIlPermesso\(this\)/.test(permesso) && /dopoIlPermesso[\s\S]*metti\(app, leggi\(fileAttesa\(app\)\)\)/.test(blocco));
  t.c("…e la diagnosi conta le finestre aperte (z) dopo i passi del canale", /"f", "e", "z" \}/.test(blocco));
  const yml = readFileSync(".github/workflows/apk.yml", "utf8");
  t.c("la CI cuce dopo l'update e prima del build", /bubblewrap update[^\n]*\n(?:[^\n]*\n)*?[^\n]*apk\.mjs cuci\n(?:[^\n]*\n)*?[^\n]*bubblewrap build/.test(yml));
  t.c("…e riparte quando cambia android/", /- android\/\*\*/.test(yml));
}

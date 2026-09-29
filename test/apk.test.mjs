// IL GUSCIO CHE COSTRUISCE LA MACCHINA (`scripts/apk.mjs`). Sbaglia in
// silenzio: un APK col pacchetto sbagliato si installa ACCANTO all'app vera
// (con la biblioteca vuota) e parte con la barra di Chrome; uno con un
// versionCode fermo non si installa sopra; uno firmato con un'altra chiave
// si pubblica e il tablet non lo sa.
import { readFileSync } from "node:fs";
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
}

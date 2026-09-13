// IL MANIFEST E' IL CONTRATTO COL SISTEMA, e nessun errore lo legge: un
// campo sbagliato non fa fallire la build, fa fallire l'installazione, o
// «Apri con» che non compare nel menu di Android, o la barra del browser
// che resta in cima al guscio. Qui si pinna quel che il guscio Android
// (TWA) e lo store pretendono, e che le due porte dichiarate qui dentro
// portino davvero a qualcosa che l'app sa servire.
import { readFileSync, existsSync } from "node:fs";
import { SECTIONS } from "../src/data/constants.js";
import { sezioneDaUrl } from "../src/lib/lancio.js";

const radice = new URL("../", import.meta.url);
const leggi = (p) => readFileSync(new URL(p, radice), "utf8");
const manifest = JSON.parse(leggi("public/manifest.json"));

export default async function (t) {
  // ---- QUEL CHE IL GUSCIO PRETENDE ------------------------------------------
  t.eq("`id` c'e' e sta nello scope", manifest.id, "/");
  t.eq("`scope` e' la radice", manifest.scope, "/");
  t.c("`start_url` sta nello scope", String(manifest.start_url).startsWith(manifest.scope));
  t.c("display standalone", manifest.display === "standalone");
  t.c("nome, nome corto e descrizione", manifest.name && manifest.short_name && manifest.description);
  // il nome corto e' l'etichetta sotto l'icona: Android lo tronca oltre i
  // dodici caratteri, e Bubblewrap lo rifiuta — «Book Companion» ne ha 14
  t.c("il nome corto sta in dodici caratteri", manifest.short_name.length <= 12, manifest.short_name);
  t.c("colori di fondo e di tema", /^#[0-9a-f]{6}$/i.test(manifest.background_color) && /^#[0-9a-f]{6}$/i.test(manifest.theme_color));
  t.c("lingua italiana", manifest.lang === "it");

  // ---- LE ICONE ESISTONO DAVVERO, nelle misure che Android chiede ----------
  const perScopo = (s) => manifest.icons.filter((i) => (i.purpose || "any") === s);
  t.c("una 192 e una 512 «any»", perScopo("any").some((i) => i.sizes === "192x192") && perScopo("any").some((i) => i.sizes === "512x512"));
  t.c("una maskable da 512", perScopo("maskable").some((i) => i.sizes === "512x512"));
  t.c("una monocroma da 512 (temi di Android 13)", perScopo("monochrome").some((i) => i.sizes === "512x512"));
  for (const i of manifest.icons) {
    t.c(`l'icona ${i.src} sta in public/`, existsSync(new URL(`public${i.src}`, radice)), i.src);
  }
  for (const s of manifest.shortcuts || []) {
    for (const i of s.icons || []) t.c(`l'icona della scorciatoia «${s.name}» esiste`, existsSync(new URL(`public${i.src}`, radice)));
  }

  // ---- LE SCORCIATOIE PORTANO A SEZIONI CHE L'APP HA ------------------------
  // `sezioneDaUrl` e' la stessa lettura che fa App.jsx al primo render:
  // una scorciatoia che lei non riconosce apre l'ingresso, in silenzio
  t.c("almeno una scorciatoia", (manifest.shortcuts || []).length >= 1);
  for (const s of manifest.shortcuts || []) {
    const search = s.url.slice(s.url.indexOf("?"));
    t.c(`«${s.name}» apre una sezione vera`, !!sezioneDaUrl(search, SECTIONS), s.url);
    t.c(`«${s.name}» sta nello scope`, s.url.startsWith(manifest.scope));
  }

  // ---- «APRI CON» ACCETTA QUEL CHE L'IMPORT ACCETTA -------------------------
  // e non di piu': dichiarare `.mobi` qui farebbe comparire l'app nel menu
  // di Android per un file che poi `importFiles` rifiuta
  const fh = manifest.file_handlers || [];
  t.eq("un gestore di file", fh.length, 1);
  const estensioni = Object.values(fh[0]?.accept || {}).flat().sort().join(",");
  t.eq("epub e pdf, e basta", estensioni, ".epub,.pdf");
  const importa = leggi("src/lib/importBook.js");
  for (const e of estensioni.split(",")) t.c(`${e} e' un'estensione che importFiles conosce`, importa.includes(`"${e}"`));
  t.c("l'azione sta nello scope", String(fh[0].action).startsWith(manifest.scope));
  t.c("e apre la Libreria, dove i file entrano", sezioneDaUrl(fh[0].action.slice(fh[0].action.indexOf("?")), SECTIONS) === "library");
  t.eq("il secondo lancio arriva sulla finestra aperta", manifest.launch_handler?.client_mode, "focus-existing");
  // e App.jsx ascolta davvero la coda dei lanci, o la dichiarazione qui
  // sopra farebbe comparire l'app nel menu per poi non aprire niente
  t.c("App.jsx registra il consumatore di launchQueue", /launchQueue\?\.setConsumer/.test(leggi("src/App.jsx")));

  // ---- IL COLLEGAMENTO COL GUSCIO ANDROID -----------------------------------
  const al = JSON.parse(leggi("public/.well-known/assetlinks.json"));
  t.c("assetlinks e' un elenco con una voce", Array.isArray(al) && al.length === 1);
  t.eq("delega la gestione degli URL", al[0]?.relation?.[0], "delegate_permission/common.handle_all_urls");
  t.eq("namespace android_app", al[0]?.target?.namespace, "android_app");
  t.c("il package e' un nome Java valido", /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(al[0]?.target?.package_name || ""));
  const impronte = al[0]?.target?.sha256_cert_fingerprints || [];
  t.c("un'impronta (o il segnaposto) c'e'", impronte.length >= 1);
  // il segnaposto e' lecito nel repository — l'impronta ce l'ha solo chi
  // firma l'APK — ma un'impronta vera dev'essere nella forma di Android
  for (const i of impronte) {
    t.c("impronta nella forma AA:BB:… o segnaposto", /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(i) || /IMPRONTA/.test(i), i);
  }

  // ---- LE PAGINE FUORI DALL'APP NON PASSANO DAL RIPIEGO DEL WORKER -------
  // `navigateFallback` serve `index.html` a ogni navigazione che non
  // conosce: la privacy diventerebbe l'app, e `assetlinks.json` — che
  // Android viene a leggere — pure, e la barra del browser resterebbe in
  // cima al guscio per sempre
  const vite = leggi("vite.config.js");
  const denylist = /navigateFallbackDenylist:\s*\[([^\]]*)\]/.exec(vite)?.[1] || "";
  t.c("la privacy e' fuori dal ripiego", /privacy/.test(denylist));
  t.c("e `.well-known` pure", /well-known/.test(denylist));
  t.c("e il dizionario ancora", /dizionario/.test(denylist));
  t.c("la pagina della privacy esiste in public/", existsSync(new URL("public/privacy.html", radice)));
  t.c("ed e' generata a ogni build", /"prebuild":\s*"node scripts\/privacy\.mjs"/.test(leggi("package.json")));
}

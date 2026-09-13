// LA PRIVACY A UN INDIRIZZO. `PRIVACY.md` sta nel repository, e va bene per
// chi legge su GitHub; lo store invece vuole un URL pubblico, e la pagina
// deve dire le stesse identiche cose del file — una copia scritta a mano
// resterebbe indietro alla prima modifica. Quindi la pagina si GENERA dal
// file, a ogni build (`prebuild`), e si tiene anche in `public/` cosi' chi
// guarda il repository vede quel che il sito serve.
//
// La pagina e' fuori dal guscio dell'app (nessun React, nessun service
// worker che la sostituisca con `index.html`: vedi `navigateFallbackDenylist`)
// perche' dev'essere leggibile anche da chi l'app non ce l'ha.
import { readFileSync, writeFileSync } from "node:fs";
import { daMarkdown, segniCrudi } from "./markdown.mjs";

const qui = new URL("../", import.meta.url);
const md = readFileSync(new URL("PRIVACY.md", qui), "utf8");
const corpo = daMarkdown(md);
if (segniCrudi(corpo)) {
  console.error("privacy: nella pagina restano dei segni Markdown crudi — aggiorna scripts/markdown.mjs");
  process.exit(1);
}

const pagina = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Informativa sulla privacy — Book Companion</title>
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<style>
  :root { color-scheme: light dark; }
  body { margin: 0 auto; max-width: 42rem; padding: 2rem 1.25rem 4rem; font: 17px/1.55 Georgia, "Times New Roman", serif; }
  h1 { font-size: 1.7rem; line-height: 1.2; }
  h2 { font-size: 1.25rem; margin-top: 2.2rem; }
  h3 { font-size: 1.05rem; margin-top: 1.6rem; }
  code { font: 0.9em ui-monospace, SFMono-Regular, Menlo, monospace; padding: 0 0.2em; }
  table { border-collapse: collapse; width: 100%; font-size: 0.92em; }
  th, td { text-align: left; vertical-align: top; padding: 0.4em 0.5em; border-bottom: 1px solid rgba(128,128,128,0.4); }
  hr { border: 0; border-top: 1px solid rgba(128,128,128,0.4); margin: 2rem 0; }
  a { color: inherit; }
  li { margin: 0.3em 0; }
  .app { margin-top: 3rem; font-size: 0.9em; opacity: 0.75; }
</style>
</head>
<body>
${corpo}
<p class="app"><a href="/">← Torna all'app</a></p>
</body>
</html>
`;

writeFileSync(new URL("public/privacy.html", qui), pagina);
console.log("privacy: public/privacy.html scritta da PRIVACY.md");

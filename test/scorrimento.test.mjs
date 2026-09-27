// IN SCORRIMENTO SI SCORRE TUTTO IL LIBRO, E LA PAGINA NON SALTA.
//
// Due righe che si rompono in silenzio, e nessuna alza un errore:
// (1) `manager: "continuous"` nelle opzioni di `renderTo` — senza, epub.js
//     torna al gestore di partenza e lo scorrimento si ferma a fine
//     capitolo (era il difetto segnalato: «mi mostri solo un capitolo per
//     volta»); il libro si apre, si legge, e il difetto si vede solo alla
//     fine del primo capitolo.
// (2) `.epub-container { overflow-anchor: none }` — senza, Chrome e Firefox
//     ancorano lo scroll da soli quando un capitolo viene aggiunto SOPRA, e
//     epub.js lo compensa una seconda volta: risalendo, la pagina salta
//     avanti di un capitolo (misurato con le pile di chiamata: `counter`
//     +2470 e +503 sopra un ancoraggio del browser che aveva gia' fatto
//     +503). La regola c'e' o non c'e', e la lettura del diff non lo dice.
//
// Si guarda l'albero per la prima (la riga si puo' scrivere in dieci modi)
// e il foglio per la seconda, come `guscio.test.mjs`.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const acorn = require("acorn");

function opzioniRenderTo(file) {
  const js = esbuild.transformSync(readFileSync(file, "utf8"), { loader: "jsx", jsx: "automatic" }).code;
  const albero = acorn.parse(js, { ecmaVersion: "latest", sourceType: "module" });
  let trovate = null;
  (function gira(n) {
    if (!n || typeof n !== "object") return;
    if (
      n.type === "CallExpression" &&
      n.callee?.type === "MemberExpression" &&
      n.callee.property?.name === "renderTo" &&
      n.arguments?.[1]?.type === "ObjectExpression"
    ) {
      trovate = {};
      for (const p of n.arguments[1].properties) {
        if (p.type !== "Property") continue;
        const k = p.key.type === "Identifier" ? p.key.name : p.key.value;
        // i valori che contano sono condizionali: si raccolgono i letterali
        // stringa che ci stanno dentro
        const letterali = [];
        (function raccogli(v) {
          if (!v || typeof v !== "object") return;
          if (v.type === "Literal" && typeof v.value === "string") letterali.push(v.value);
          for (const kk of Object.keys(v)) {
            const x = v[kk];
            if (Array.isArray(x)) x.forEach(raccogli);
            else if (x && typeof x === "object" && x.type) raccogli(x);
          }
        })(p.value);
        trovate[k] = letterali;
      }
    }
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach(gira);
      else if (v && typeof v === "object" && v.type) gira(v);
    }
  })(albero);
  return trovate;
}

export default async function (t) {
  const opz = opzioniRenderTo("src/components/Reader.jsx");
  t.c("il reader chiama `renderTo` con delle opzioni", !!opz, JSON.stringify(opz));
  t.c("in scorrimento il flusso e' «scrolled» (tutto il libro), non «scrolled-doc» (un capitolo)", (opz?.flow || []).includes("scrolled") && !(opz?.flow || []).includes("scrolled-doc"), JSON.stringify(opz?.flow));
  t.c("e il gestore e' «continuous»: e' lui che aggiunge e toglie i capitoli mentre scorri", (opz?.manager || []).includes("continuous"), JSON.stringify(opz?.manager));
  t.c("… con «default» per le pagine, che il gestore continuo non sa impaginare a facciate", (opz?.manager || []).includes("default"), JSON.stringify(opz?.manager));

  const css = readFileSync("src/index.css", "utf8");
  const inizio = css.indexOf(".epub-container");
  t.c("il contenitore di epub.js ha una regola sua nel foglio", inizio >= 0);
  const blocco = css.slice(inizio, css.indexOf("}", inizio));
  t.c("e non si ancora da se': la compensazione la fa epub.js, una volta sola", /overflow-anchor:\s*none/.test(blocco), blocco);
}

// UN NOME CHE NON ESISTE PIÙ NON LO PRENDE NESSUNO.
//
// È già successo due volte, e la prima è finita addosso al lettore come
// SCHERMATA BIANCA: tolta la soglia delle stelle restarono due `FAV_MIN`
// nelle schede-saga, e l'Ingresso esplodeva all'apertura. La seconda,
// presa qui: `ricuciOra` e `piuTardi` cancellati mentre il banner della
// ricucitura continuava a chiamarli col dito del lettore.
//
// Né `npm run build` né gli altri test lo vedono: Vite compila
// felicemente un identificatore libero — è JavaScript, il nome potrebbe
// arrivare da `window` — e l'errore salta fuori solo quando quel ramo
// della UI viene disegnato o quel tasto viene toccato. Un ramo raro
// (una scheda-saga, un banner che compare una volta nella vita del
// libro) può passare tutte le prove a mano e rompersi in produzione.
//
// La regola qui è volutamente GENEROSA: un nome dichiarato in qualunque
// punto del file conta come dichiarato dappertutto. Così non si litiga
// con gli ambiti e non ci sono falsi allarmi — questo test non deve mai
// costringere nessuno a riscrivere codice sano per farlo tacere. Prende
// solo il caso vero: un nome che nel file non c'è PROPRIO PIÙ.
import { readFileSync, readdirSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const acorn = require("acorn");

// quello che il browser mette a disposizione da sé: non è dichiarato in
// nessun file e non è un errore
const AMBIENTE = new Set([
  ...Object.getOwnPropertyNames(globalThis),
  "window", "document", "navigator", "location", "history", "screen",
  "localStorage", "sessionStorage", "indexedDB", "caches", "crypto",
  "fetch", "Request", "Response", "Headers", "FormData", "Blob", "File",
  "FileReader", "URL", "URLSearchParams", "AbortController", "Image",
  "Audio", "Event", "CustomEvent", "MutationObserver", "ResizeObserver",
  "IntersectionObserver", "requestAnimationFrame", "cancelAnimationFrame",
  "getComputedStyle", "matchMedia", "alert", "confirm", "prompt",
  "HTMLElement", "Node", "Range", "Selection", "DOMParser", "XMLSerializer",
  "TextEncoder", "TextDecoder", "CompressionStream", "DecompressionStream",
  "NodeFilter", "createImageBitmap", "OffscreenCanvas", "WakeLock",
  "React", "process", "arguments", "undefined", "globalThis",
  // le sostituzioni che Vite scrive al posto del nome in fase di build
  "__BC_VERSIONE__",
]);

// ogni posto in cui un nome NASCE
function dichiarati(nodo, fuori) {
  const giu = (n) => dichiarati(n, fuori);
  if (!nodo || typeof nodo !== "object") return;
  switch (nodo.type) {
    case "Identifier":
      fuori.add(nodo.name);
      return;
    case "ObjectPattern":
      for (const p of nodo.properties) giu(p.type === "RestElement" ? p.argument : p.value);
      return;
    case "ArrayPattern":
      for (const e of nodo.elements) if (e) giu(e);
      return;
    case "AssignmentPattern":
      giu(nodo.left);
      return;
    case "RestElement":
      giu(nodo.argument);
      return;
    default:
      return;
  }
}

function raccogli(albero) {
  const nati = new Set();
  const usati = new Map();
  const passa = (nodo, genitore, chiave) => {
    if (!nodo || typeof nodo !== "object") return;
    if (Array.isArray(nodo)) {
      for (const n of nodo) passa(n, genitore, chiave);
      return;
    }
    if (typeof nodo.type !== "string") return;
    switch (nodo.type) {
      case "VariableDeclarator":
        dichiarati(nodo.id, nati);
        break;
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
      case "ClassDeclaration":
      case "ClassExpression":
        if (nodo.id) nati.add(nodo.id.name);
        for (const p of nodo.params || []) dichiarati(p, nati);
        break;
      case "ImportSpecifier":
      case "ImportDefaultSpecifier":
      case "ImportNamespaceSpecifier":
        nati.add(nodo.local.name);
        break;
      case "CatchClause":
        if (nodo.param) dichiarati(nodo.param, nati);
        break;
      case "Identifier": {
        // un nome in posizione di LETTURA, non di etichetta
        const eProprieta = genitore?.type === "MemberExpression" && chiave === "property" && !genitore.computed;
        const eChiave = genitore?.type === "Property" && chiave === "key" && !genitore.computed;
        const eEtichetta = /^(LabeledStatement|BreakStatement|ContinueStatement)$/.test(genitore?.type || "");
        const eCampo =
          /^(PropertyDefinition|MethodDefinition)$/.test(genitore?.type || "") &&
          chiave === "key" &&
          !genitore.computed;
        // `import.meta`: esbuild lo lascia com'è, e non sono due nomi
        const eMeta = genitore?.type === "MetaProperty";
        if (!eProprieta && !eChiave && !eEtichetta && !eCampo && !eMeta && !usati.has(nodo.name))
          usati.set(nodo.name, nodo.loc?.start?.line ?? 0);
        return;
      }
      default:
        break;
    }
    for (const [k, v] of Object.entries(nodo)) {
      if (k === "loc" || k === "start" || k === "end" || k === "range") continue;
      passa(v, nodo, k);
    }
  };
  passa(albero, null, null);
  return { nati, usati };
}

export function orfani(sorgente, loader = "jsx") {
  const js = esbuild.transformSync(sorgente, { loader }).code;
  const albero = acorn.parse(js, { ecmaVersion: 2022, sourceType: "module", locations: true });
  const { nati, usati } = raccogli(albero);
  return [...usati].filter(([nome]) => !nati.has(nome) && !AMBIENTE.has(nome)).map(([nome, riga]) => ({ nome, riga }));
}

const file = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? file(`${d}/${e.name}`) : /\.(jsx?|mjs)$/.test(e.name) ? [`${d}/${e.name}`] : []
  );

export default async function (t) {
  // ---- la prova sul difetto, prima di quella su tutta l'app -------------
  // Se non prendesse questo, non varrebbe niente: è esattamente la forma
  // dei due guasti veri — un tasto che chiama una funzione cancellata.
  const rotto = `
    function Panel() { return null; }
    export default function Scheda() {
      return <button onClick={ricuciOra}>Ricuci</button>;
    }`;
  const presi = orfani(rotto);
  t.eq("un tasto che chiama una funzione cancellata si vede", presi.length, 1);
  t.eq("e si dice quale nome manca", presi[0]?.nome, "ricuciOra");

  // e la stessa cosa nella forma della schermata bianca: una costante
  // tolta e rimasta in un ramo raro della UI
  t.eq(
    "e una costante tolta ma ancora letta",
    orfani(`const libri = []; export const alte = () => libri.filter((b) => b.rating >= FAV_MIN);`)[0]?.nome,
    "FAV_MIN"
  );

  // ---- e nessun falso allarme sulle forme sane --------------------------
  const sano = `
    import { useState } from "react";
    import * as tutto from "./x.js";
    export default function A({ libro, su: giu = 1, ...resto }) {
      const [x, setX] = useState(0);
      const { a, b: [c] } = libro;
      try { tutto.f(); } catch (e) { console.log(e); }
      class Q { metodo() { return this.campo; } }
      const o = { chiave: x, [a]: c, giu, resto, q: new Q() };
      return <div onClick={() => setX(x + 1)} title={o.chiave}>{c}</div>;
    }`;
  t.eq("le forme sane non fanno rumore", JSON.stringify(orfani(sano)), "[]");

  // ---- TUTTA L'APP ------------------------------------------------------
  const guasti = [];
  for (const f of file("src")) {
    const loader = f.endsWith(".jsx") ? "jsx" : "js";
    try {
      for (const o of orfani(readFileSync(f, "utf8"), loader)) guasti.push(`${f}:${o.riga} — ${o.nome}`);
    } catch (e) {
      guasti.push(`${f} — non si legge: ${e.message}`);
    }
  }
  t.eq("nessun nome orfano in `src/`", guasti.join("\n"), "");
}

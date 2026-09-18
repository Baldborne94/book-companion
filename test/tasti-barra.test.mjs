// UN TASTO DELLA BARRA SENZA UN NOME NON È UN COMANDO.
//
// Chiesto dal lettore («c'è modo di rendere più user friendly
// l'applicazione?»): è la lezione della foglia grigia di «Aspetto»
// portata dentro il libro. Un glifo che riconosci solo se sai già cos'è
// non è un comando, e la cura non è renderlo più vistoso ma dargli un
// NOME. Il caso che conta è la bussola: 🧭 apre «Dove eravamo rimasti» e
// non lo indovina nessuno.
//
// QUI NON CASCA NIENTE DA SÉ: un tasto senza `nome` si disegna
// benissimo — glifo, bordo, tocco che risponde — e resta muto sullo
// schermo E per chi legge con la voce, perché `nome` è anche
// l'`aria-label`. Nessun errore, nessun test che se ne accorga: è
// esattamente il difetto da cui questo giro nasce, e senza un guardiano
// il prossimo tasto lo rimette.
//
// Si guarda l'ALBERO, non il testo: la riga si può scrivere in dieci modi
// e il difetto sarebbe identico (stessa scelta di `identificatori.test.mjs`
// e del guardiano di `syncNow`).
import { readFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const acorn = require("acorn");

const FILE = ["src/components/Reader.jsx", "src/components/PdfReader.jsx"];
const COMUNE = "src/components/TastoBarra.jsx";

// LA SOGLIA SI LEGGE DAL FILE, NON SI IMPORTA: un test in Node non importa
// un `.jsx` (regola di casa), e spostarla in `lib/` solo per poterla
// leggere vorrebbe dire allontanarla dal componente che la usa. Qui si
// guarda l'albero, che è quel che questo file fa comunque.
function sogliaDal(file) {
  const js = esbuild.transformSync(readFileSync(file, "utf8"), { loader: "jsx", jsx: "automatic" }).code;
  const albero = acorn.parse(js, { ecmaVersion: "latest", sourceType: "module" });
  let valore = null;
  (function gira(n) {
    if (!n || typeof n !== "object") return;
    if (n.type === "VariableDeclarator" && n.id?.name === "SOGLIA_NOMI" && typeof n.init?.value === "number")
      valore = n.init.value;
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach(gira);
      else if (v && typeof v === "object" && v.type) gira(v);
    }
  })(albero);
  return valore;
}

// esbuild trasforma `<TastoBarra …/>` in `jsx(TastoBarra, {…})`: si cerca
// quella chiamata e si guardano le sue proprietà.
function tastiDi(file) {
  const codice = readFileSync(file, "utf8");
  const js = esbuild.transformSync(codice, { loader: "jsx", jsx: "automatic" }).code;
  const albero = acorn.parse(js, { ecmaVersion: "latest", sourceType: "module" });
  const trovati = [];
  (function gira(n) {
    if (!n || typeof n !== "object") return;
    if (
      n.type === "CallExpression" &&
      n.arguments?.[0]?.type === "Identifier" &&
      n.arguments[0].name === "TastoBarra" &&
      n.arguments[1]?.type === "ObjectExpression"
    ) {
      const chiavi = n.arguments[1].properties
        .filter((p) => p.type === "Property")
        .map((p) => (p.key.type === "Identifier" ? p.key.name : p.key.value));
      trovati.push(chiavi);
    }
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach(gira);
      else if (v && typeof v === "object" && v.type) gira(v);
    }
  })(albero);
  return trovati;
}

export default async function (t) {
  // ---- OGNI TASTO HA UN NOME ---------------------------------------------
  for (const f of FILE) {
    const tasti = tastiDi(f);
    t.c(`${f} usa i tasti con nome`, tasti.length >= 5, `${tasti.length} tasti`);
    tasti.forEach((chiavi, i) => {
      // il NOME è anche l'`aria-label`: senza, il tasto è muto sullo
      // schermo e per chi legge con la voce
      t.c(`${f} · tasto ${i + 1} ha un nome`, chiavi.includes("nome"), chiavi.join(", "));
      // e un glifo: un tasto vuoto si tocca e non si vede
      t.c(`${f} · tasto ${i + 1} ha un glifo`, chiavi.includes("glifo"), chiavi.join(", "));
      // un tasto che apre un pannello dice se è acceso, o non si sa mai
      // quale dei due pannelli aperti si sta guardando — questo NON si
      // pretende da tutti: chi non apre niente (la bussola) non ha stato
    });
  }

  // ---- E NESSUNO È RIMASTO INDIETRO --------------------------------------
  {
    // i due reader hanno due barre gemelle: una cura scritta su uno solo
    // lascia metà app com'era, e nessun errore lo direbbe. È già successo
    // (lo schermo intero stava solo nell'ePub, ed era il rovescio di quel
    // che serviva: un PDF non si reimpagina e l'unico modo di far crescere
    // il testo è dargli più vetro).
    for (const f of FILE) {
      const grezzo = readFileSync(f, "utf8");
      t.c(`${f} prende i tasti dal file comune`, /from "\.\/TastoBarra\.jsx"/.test(grezzo));
      // la bussola è il tasto che nessuno indovina: se sparisce da un
      // reader, è sparita la funzione più preziosa dell'app da metà app
      t.c(`${f} nomina la bussola`, /nome="Dove eravamo"/.test(grezzo));
    }
  }

  // ---- LA SOGLIA È UNA LARGHEZZA, E STA IN UN POSTO SOLO -----------------
  {
    const SOGLIA_NOMI = sogliaDal(COMUNE);
    t.c("la soglia è un numero di pixel", Number.isFinite(SOGLIA_NOMI) && SOGLIA_NOMI > 0, String(SOGLIA_NOMI));
    // misurata in Chromium sulla barra vera, con un libro aperto: a 720 le
    // parole stanno su una riga sola e al titolo restano 206px (162 nel
    // PDF); a 700 spariscono e la barra torna 57. Più bassa, le parole
    // manderebbero la barra a capo su un telefono; più alta, il tablet in
    // piedi le perderebbe — ed è il dispositivo del lettore.
    t.c("sta sopra la larghezza di un telefono", SOGLIA_NOMI > 430, String(SOGLIA_NOMI));
    t.c("e sotto quella di un tablet in piedi", SOGLIA_NOMI <= 800, String(SOGLIA_NOMI));
    // scritta in un file solo: due reader con due soglie diverse darebbero
    // le parole a uno e non all'altro sullo stesso schermo
    for (const f of FILE)
      t.c(`${f} non ha una soglia sua`, !/SOGLIA_NOMI\s*=/.test(readFileSync(f, "utf8")));
  }

  // ---- LA RETE DI SICUREZZA È LEGATA ALLE PAROLE -------------------------
  {
    // Misurato, non supposto: senza `wrap` a stringersi NON sono i tasti ma
    // il titolo, che ha `flex: 1` e arriva a zero lasciandoli interi (412px:
    // una riga, barra 57, tasti tutti a 40). Col `wrap` sempre acceso lo
    // stesso telefono passava a due righe e 101px — la rete peggiorava il
    // caso che non ne aveva bisogno. Serve solo colle parole accese, dove
    // i tasti hanno un `minWidth` e finirebbero fuori dalla barra.
    for (const f of FILE) {
      const grezzo = readFileSync(f, "utf8");
      t.c(
        `${f} accende il «wrap» solo colle parole`,
        /flexWrap:\s*nomiNeiTasti\s*\?\s*"wrap"\s*:\s*"nowrap"/.test(grezzo),
        "flexWrap non è legato a `nomiNeiTasti`"
      );
    }
  }
}

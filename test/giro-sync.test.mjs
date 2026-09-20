// IL GIRO DELLA SINCRONIZZAZIONE: DUE PATTI, E TUTT'E DUE SONO GIA' STATI
// ROTTI.
//
// Lo stesso difetto e' tornato QUATTRO volte, sempre con la stessa forma, e
// ogni volta e' costato al lettore dei libri senza copia o delle copertine
// che non tornavano piu':
//
//   1. i file salivano dentro il ciclo di `push` — una riga ci passa una
//      volta sola, e sette romanzi su 115 sono rimasti scoperti per sempre;
//   2. le copertine scendevano dentro il ciclo di `pull` — stessa cosa
//      dall'altro lato, e restava il dorso disegnato per sempre;
//   3. le copertine salivano guardando un REGISTRO di questo dispositivo,
//      che non sa niente di un secchio svuotato o di un giro morto prima
//      di arrivarci;
//   4. un file rifiutato ALZAVA, e il `throw` si portava via il giro
//      intero: i libri dopo di lui, le copertine, le preferenze, gli
//      scaricamenti, e perfino il timbro dell'ora.
//
// I primi tre sono la stessa regola: **si decide sullo STATO, non su un
// registro né su un passaggio che capita una volta sola**. Il quarto e':
// **un intoppo su UN elemento e' di quell'elemento**.
//
// Nessuno dei quattro alza un errore: la biblioteca sembra sincronizzata e
// la verita' si scopre mesi dopo, da un romanzo che non si apre. Quindi qui
// si pinnano i patti, non le righe:
//
//   (a) un giro fa CONVERGERE casa e secchio, e il secondo giro non muove
//       piu' niente (se muovesse ancora, ci sarebbe un pendolo; se non
//       avesse mosso al primo, c'e' un buco);
//   (b) dentro i cicli per-elemento del giro non c'e' NESSUN `throw`.
import { readFileSync } from "fs";
import { createRequire } from "module";
import { daCaricare, copertineDaCaricare, copertineDaScaricare } from "../src/lib/syncCore.js";

const require = createRequire(import.meta.url);
const acorn = require("acorn");

// Un mondo finto: chi ha i byte qui, chi li ha lassu', chi ha la copertina
// di qua e di la'. Il giro e' fatto delle sole DECISIONI pure, che e'
// esattamente il pezzo dove i quattro difetti abitavano.
function mondo({ libri, casa = [], secchio = [], copQui = [], copLassu = [], registro = [] }) {
  return {
    libri,
    casa: new Set(casa),
    secchio: new Set(secchio),
    copQui: new Set(copQui),
    copLassu: new Set(copLassu),
    registro: new Set(registro),
    mosse: 0,
  };
}

function giro(m) {
  m.mosse = 0;
  for (const b of daCaricare(m.libri, {
    qui: m.casa,
    lassu: m.secchio,
    gia: m.registro,
    rimandi: new Set(),
    inUscita: new Set(),
  })) {
    m.secchio.add(b.id);
    m.registro.add(b.id);
    m.mosse += 1;
  }
  for (const b of copertineDaCaricare(m.libri, { qui: m.copQui, lassu: m.copLassu })) {
    m.copLassu.add(b.id);
    m.mosse += 1;
  }
  for (const b of copertineDaScaricare(m.libri, { qui: m.copQui, lassu: m.copLassu })) {
    m.copQui.add(b.id);
    m.mosse += 1;
  }
  return m;
}

const tomi = (n) => Array.from({ length: n }, (_, i) => ({ id: `L${i}` }));

export default async function (t) {
  // ---- (a) IL GIRO CONVERGE ------------------------------------------------
  {
    // il caso di tutti i giorni: qualcosa di qua, qualcosa di la'
    const m = mondo({
      libri: tomi(4),
      casa: ["L0", "L1", "L2"],
      secchio: ["L1"],
      copQui: ["L0"],
      copLassu: ["L3"],
    });
    giro(m);
    t.c("i file che ho qui adesso stanno anche lassù", ["L0", "L1", "L2"].every((id) => m.secchio.has(id)));
    t.c("la copertina che avevo qui è salita", m.copLassu.has("L0"));
    t.c("la copertina che stava lassù è scesa", m.copQui.has("L3"));
    // IL SECONDO GIRO NON MUOVE NIENTE. Se muovesse, sarebbe un pendolo:
    // due dispositivi si rimbalzerebbero le stesse copie a ogni giro, sul
    // traffico contato del piano gratuito.
    giro(m);
    t.eq("il secondo giro è fermo", m.mosse, 0);
  }

  // ---- il difetto storico numero 1, pinnato --------------------------------
  {
    // Il registro di QUESTO dispositivo dice «l'ho già mandato», ma nel
    // secchio non c'è: è esattamente il caso dei sette romanzi scoperti —
    // un giro che si fida del registro lo salta per sempre.
    const m = mondo({ libri: tomi(1), casa: ["L0"], secchio: [], registro: ["L0"] });
    giro(m);
    t.c("un file che il registro dà per mandato ma lassù non c'è, sale", m.secchio.has("L0"));
  }

  // ---- il difetto storico numero 3, pinnato -------------------------------
  {
    // la copertina c'è qui e lassù no: sale, qualunque cosa dica un
    // registro (che infatti non esiste più)
    const m = mondo({ libri: tomi(1), copQui: ["L0"], copLassu: [] });
    giro(m);
    t.c("una copertina scoperta sale", m.copLassu.has("L0"));
    giro(m);
    t.eq("e al secondo giro non si rispedisce", m.mosse, 0);
  }

  // ---- l'ebook tolto a mano: il giro NON lo rimette su ---------------------
  {
    // L'ALTRO DISPOSITIVO È IL CASO CHE CONTA: lì i byte ci sono ancora,
    // lassù la copia non c'è più (l'ha cancellata chi ha dato il comando),
    // e senza il segno quel libro ha la forma esatta di un file scoperto.
    // Il giro lo rispedirebbe nel secchio, e il lettore si ritroverebbe la
    // nuvoletta addosso al libro che aveva appena svuotato — con dentro i
    // megabyte che voleva togliersi.
    const m = mondo({
      libri: [{ id: "L0", fileTolto: true }, { id: "L1" }],
      casa: ["L0", "L1"],
      secchio: [],
    });
    giro(m);
    t.c("l'ebook tolto a mano non risale", !m.secchio.has("L0"));
    t.c("e il libro accanto sale come sempre", m.secchio.has("L1"));
    giro(m);
    t.eq("e il giro resta fermo, senza pendoli", m.mosse, 0);
  }

  // ---- e non si muove quel che non si può muovere --------------------------
  {
    // un tomo senza byte qui e senza copia lassù: non c'è niente da fare, e
    // il giro non deve inventarsi niente (è un «perduto», e lo dice la riga
    // in Libreria, non il giro)
    const m = mondo({ libri: tomi(1) });
    giro(m);
    t.eq("un perduto non muove niente", m.mosse, 0);
    t.eq("e non compare dal nulla nel secchio", m.secchio.size, 0);
  }
  {
    // SENZA L'ELENCO DEL SECCHIO non si carica niente: è il lato sicuro —
    // un giro saltato si rifà, centinaia di megabyte rispediti da un tablet
    // no. Vale per i file e per le copertine allo stesso modo.
    const libri = tomi(3);
    t.eq("file: senza elenco non si carica", daCaricare(libri, { qui: new Set(["L0"]), lassu: null }).length, 0);
    t.eq("copertine: senza elenco non si carica", copertineDaCaricare(libri, { qui: new Set(["L0"]) }).length, 0);
    t.eq("copertine: senza elenco non si scarica", copertineDaScaricare(libri, { qui: new Set() }).length, 0);
  }

  // ---- (b) DENTRO I CICLI DEL GIRO NON SI ALZA -----------------------------
  {
    // Il `throw` su un file rifiutato uccideva tutto quello che veniva dopo.
    // Qui non si legge una riga: si guarda la FORMA del giro, perché la
    // riga si può riscrivere in dieci modi e il difetto sarebbe identico.
    const sorgente = readFileSync(new URL("../src/lib/sync.js", import.meta.url), "utf8");
    const albero = acorn.parse(sorgente, { ecmaVersion: "latest", sourceType: "module" });

    // il corpo di `syncNow`, che è il giro della sincronizzazione
    let giroSync = null;
    const cerca = (n) => {
      if (!n || typeof n !== "object") return;
      if (n.type === "FunctionDeclaration" && n.id?.name === "syncNow") giroSync = n;
      for (const k of Object.keys(n)) {
        const v = n[k];
        if (Array.isArray(v)) v.forEach(cerca);
        else if (v && typeof v.type === "string") cerca(v);
      }
    };
    cerca(albero);
    t.c("`syncNow` si trova", !!giroSync);

    // ogni `throw` che sta dentro un `for (… of …)`
    const alzati = [];
    const dentro = (n, inCiclo) => {
      if (!n || typeof n !== "object") return;
      if (n.type === "ThrowStatement" && inCiclo) alzati.push(sorgente.slice(n.start, n.end).split("\n")[0]);
      // una funzione annidata ha vita sua: quello che alza là dentro lo
      // prende chi la chiama, e non è il ciclo a morirci
      const suo = n.type === "ForOfStatement" || n.type === "ForStatement" || n.type === "WhileStatement";
      for (const k of Object.keys(n)) {
        const v = n[k];
        if (Array.isArray(v)) v.forEach((x) => dentro(x, inCiclo || suo));
        else if (v && typeof v.type === "string") dentro(v, inCiclo || suo);
      }
    };
    dentro(giroSync, false);
    t.c(
      "nessun `throw` dentro i cicli per-elemento del giro",
      alzati.length === 0,
      alzati.join(" | ")
    );
  }
}

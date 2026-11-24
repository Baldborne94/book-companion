// LE PAUSE CHE IL TEMPO DI LETTURA SCARTA (`src/lib/pauseLettura.js`):
// ogni tratto fra due voltate si annota, contato o buttato, e il rapporto
// dice quanto si perde. Chiesto dal lettore: «mi sembra di aver letto di più
// di quanto dici».
import { annotaTratto, righePause, leggiPause, GIORNI_TENUTI } from "../src/lib/pauseLettura.js";
import { comincia, segnaVita, segnaAttivita, smetti, leggiTempo, giornoDi, ATTIVITA_OGNI } from "../src/lib/tempo.js";

export default async function (t) {
  // ---- L'ANNOTAZIONE ------------------------------------------------------
  let g = annotaTratto([], "2026-11-02", 30, { contato: true, tipo: "epub" });
  g = annotaTratto(g, "2026-11-02", 50, { contato: true, tipo: "epub" });
  g = annotaTratto(g, "2026-11-02", 400, { contato: false, come: "v", tipo: "epub" });
  g = annotaTratto(g, "2026-11-01", 1500, { contato: false, come: "c", tipo: "fumetto" });
  t.eq("un giorno per data, in ordine", g.map((d) => d.g).join(","), "2026-11-01,2026-11-02");
  t.eq("i tratti contati si sommano", `${g[1].v} ${g[1].s}`, "2 80");
  t.eq("le pause scartate si tengono una per una", JSON.stringify(g[1].x), '[[400,"v","epub"]]');
  t.eq("e i giorni di prima restano", JSON.stringify(g[0].x), '[[1500,"c","fumetto"]]');
  let tanti = [];
  for (let i = 1; i <= GIORNI_TENUTI + 3; i++) tanti = annotaTratto(tanti, `2026-10-${String(i).padStart(2, "0")}`, 10, { contato: true });
  t.eq("si tengono gli ultimi giorni", `${tanti.length} ${tanti[0].g}`, `${GIORNI_TENUTI} 2026-10-04`);
  let piene = [];
  for (let i = 0; i < 305; i++) piene = annotaTratto(piene, "2026-11-02", 300, { contato: false });
  t.eq("le pause di un giorno hanno un tetto", piene[0].x.length, 300);

  // ---- IL RAPPORTO --------------------------------------------------------
  const righe = righePause(g);
  t.eq(
    "un giorno per riga, dal più recente",
    righe.slice(0, 3).join("\n"),
    [
      "Tempo di lettura su questo dispositivo (ultimi 2 giorni):",
      "  02/11 · contati 1 min in 2 voltate (in media 40 s a pagina) · scartate 1 pausa per 7 min",
      "  01/11 · contati 0 min in 0 voltate · scartate 1 pausa per 25 min",
    ].join("\n")
  );
  t.eq("le pause per durata", righe[3], "Pause scartate per durata: 4–10 min 1 · 20–60 min 1");
  t.eq("da dove arrivano", righe[4], "  chiuse da una voltata 1 · alla chiusura o in secondo piano 1");
  // un tocco (la scheda del dizionario, una voce dei wiki) conta il tempo ma
  // non e' una pagina
  const tocco = annotaTratto([], "2026-11-05", 90, { contato: true, come: "t" });
  t.eq("un tocco conta il tempo, non una voltata", `${tocco[0].v} ${tocco[0].s}`, "0 90");
  const daTocco = righePause([{ g: "2026-11-05", v: 1, s: 60, x: [[300, "t", "epub"], [300, "v", "epub"]] }]);
  t.c("e una pausa chiusa da un tocco si dice", daTocco.includes("  chiuse da una voltata 1 · chiuse da un tocco 1"), daTocco.join(" / "));
  t.eq("per lettore", righe[5], "  per lettore: ePub 1 · fumetti 1");
  // l'altra strada: 40 s per la pausa del 2 (la media del giorno), niente
  // per quella dell'1, che non ha voltate contate
  t.eq("quanto varrebbe l'altra strada", righe[6], "Contando ogni pausa come una pagina media del suo giorno: 1 min in più.");
  t.eq("niente da dire, niente righe", righePause([]).length, 0);
  t.eq("un giorno solo", righePause([{ g: "2026-11-02", v: 1, s: 30, x: [] }])[0], "Tempo di lettura su questo dispositivo (un giorno):");
  t.eq(
    "senza pause lo dice, e un giorno solo si dice così",
    righePause([{ g: "2026-11-02", v: 3, s: 90, x: [] }]).at(-1),
    "Nessuna pausa oltre i 4 minuti scartata."
  );
  const fasce = righePause([{ g: "2026-11-02", v: 1, s: 60, x: [[600, "v", ""], [601, "v", ""], [1200, "v", ""], [3600, "v", ""], [3601, "v", ""]] }]);
  t.eq("i bordi delle fasce", fasce.find((r) => r.startsWith("Pause")), "Pause scartate per durata: 4–10 min 1 · 10–20 min 2 · 20–60 min 1 · oltre l'ora 1");
  t.c("senza lettore nessuna riga per lettore", !fasce.some((r) => r.includes("per lettore")));
  t.c("tutte chiuse da una voltata: non si spartisce", !fasce.some((r) => r.includes("chiuse da")));

  // ---- DAL READER: LE VOLTATE VERE ----------------------------------------
  const prima = globalThis.localStorage;
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  try {
    const t0 = new Date(2026, 10, 2, 21, 0, 0).getTime();
    comincia(t0);
    segnaVita(t0 + 60_000, "epub");
    segnaVita(t0 + 60_000 + 5 * 60_000, "epub");
    // due segnali nello stesso istante non sono un tratto
    segnaVita(t0 + 60_000 + 5 * 60_000, "epub");
    smetti(t0 + 60_000 + 5 * 60_000 + 10 * 60_000);
    const [oggi] = leggiPause();
    t.eq("la voltata vicina si conta", `${oggi.g} ${oggi.v} ${oggi.s}`, `${giornoDi(t0)} 1 60`);
    t.eq("quella lontana si annota scartata, e la chiusura pure", JSON.stringify(oggi.x), '[[300,"v","epub"],[600,"c","epub"]]');
    t.eq("e il tempo di lettura resta quello di prima", Object.values(leggiTempo())[0]?.[giornoDi(t0)], 60);
    // dopo la chiusura un segnale non conta niente finche' non si ricomincia
    segnaVita(t0 + 30 * 60_000, "pdf");
    t.eq("chiuso, niente si annota", leggiPause()[0].x.length + leggiPause()[0].v, 3);
    smetti(t0 + 31 * 60_000);
    // IL TEMPO NELLA SCHEDA DEL DIZIONARIO: aperto il libro, sette minuti
    // fra due voltate, toccando la scheda ogni tre — prima erano buttati
    mem.clear();
    const t1 = new Date(2026, 10, 5, 21, 0, 0).getTime();
    comincia(t1);
    segnaAttivita(t1 + 3 * 60_000);
    segnaAttivita(t1 + 6 * 60_000);
    segnaVita(t1 + 7 * 60_000, "epub");
    const [g5] = leggiPause();
    t.eq("i sette minuti si contano tutti", `${g5.s} ${g5.x.length}`, "420 0");
    t.eq("…e la voltata e' una sola", g5.v, 1);
    // uno ogni quindici secondi: lo scorrimento non scrive a ogni pixel
    segnaAttivita(t1 + 7 * 60_000 + ATTIVITA_OGNI - 1);
    t.eq("un tocco troppo vicino non scrive", leggiPause()[0].s, 420);
    segnaAttivita(t1 + 7 * 60_000 + ATTIVITA_OGNI);
    t.eq("…uno a quindici secondi si'", leggiPause()[0].s, 420 + ATTIVITA_OGNI / 1000);
    smetti(t1 + 8 * 60_000);
    // e a libro chiuso un tocco non comincia niente
    const fermo = JSON.stringify(leggiPause());
    segnaAttivita(t1 + 20 * 60_000);
    segnaAttivita(t1 + 21 * 60_000);
    t.eq("a libro chiuso i tocchi non contano", JSON.stringify(leggiPause()), fermo);
  } finally {
    globalThis.localStorage = prima;
  }
}

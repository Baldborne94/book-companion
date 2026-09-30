// LE VOLTATE MISURATE (`lib/voltate.js`) e il loro posto nel rapporto dei
// guasti. Sbagliano in silenzio se mescolano le aperture con le voltate (il
// primo archivio che si apre sembrerebbe una voltata lenta), se danno la
// colpa alla rete di una pagina che era gia' in memoria, o se perdono il
// conto oltre il tetto.
import { statoDelle, vocePerVoltata, segnaVoltata, voltateAnnotate, svuotaVoltate, righeVoltate, TENUTE } from "../src/lib/voltate.js";
import { rapporto } from "../src/lib/registro.js";

function memoria() {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => (m[k] = String(v)), removeItem: (k) => delete m[k] };
}

export default async (t) => {
  t.eq("tutte pronte", statoDelle(["pronta", "pronta"]), "P");
  t.eq("una in arrivo basta", statoDelle(["pronta", "in arrivo"]), "A");
  t.eq("una chiesta sul momento comanda", statoDelle(["in arrivo", "da chiedere"]), "C");

  const v = vocePerVoltata({ t0: 100, tPagine: 1300, tVista: 1450, stati: ["da chiedere"], da: "drive", doppia: true, kb: 2048.4, rete: "wifi 4g", ora: 5 });
  t.eq("i due tempi, e il resto", JSON.stringify(v), JSON.stringify({ q: 5, pagine: 1200, disegno: 150, s: "C", da: "drive", d: 1, kb: 2048, r: "wifi 4g" }));
  t.eq("a pagina singola e senza rete detta non si scrive niente in piu'", Object.keys(vocePerVoltata({ t0: 0, tPagine: 1, tVista: 2 })).join(), "q,pagine,disegno,s,da,kb");
  const storto = vocePerVoltata({ t0: 10, tPagine: 5, tVista: 1 });
  t.eq("un orologio che torna indietro non fa tempi negativi", `${storto.pagine}/${storto.disegno}`, "0/0");

  const st = memoria();
  for (let i = 0; i < TENUTE + 5; i++) segnaVoltata({ q: i, pagine: 1, disegno: 1, s: "P", da: "tablet", kb: 1 }, { st });
  const tenute = voltateAnnotate(st);
  t.eq("se ne tengono le ultime", `${tenute.length}/${tenute[0].q}`, `${TENUTE}/5`);
  svuotaVoltate(st);
  t.eq("e si svuotano", voltateAnnotate(st).length, 0);
  st.setItem("bc_voltate", "rotto");
  t.eq("una memoria rotta vale vuota", voltateAnnotate(st).length, 0);

  // ---- il riassunto -------------------------------------------------------
  const V = (pagine, disegno, s, da = "drive", extra = {}) => ({ q: Date.UTC(2026, 8, 30, 20), pagine, disegno, s, da, kb: 1024, ...extra });
  const voci = [
    V(3000, 200, "C", "drive", { p: 1 }),
    V(40, 60, "P"),
    V(50, 70, "P"),
    V(900, 80, "A"),
    V(2400, 100, "C", "drive", { d: 1 }),
    V(10, 30, "P", "tablet"),
  ];
  const righe = righeVoltate(voci);
  const testo = righe.join("\n");
  t.eq("le aperture si contano a parte", righe[0], "Voltate dei fumetti misurate: 5 (più 1 apertura)");
  t.c("da Drive e dal tablet separati", /^Da Drive: 4 ·/m.test(testo) && /^Dal tablet: 1 ·/m.test(testo));
  t.c("per stato delle pagine", testo.includes("già pronte in memoria: 2") && testo.includes("in arrivo (preparate prima): 1") && testo.includes("chieste sul momento: 1"));
  t.c("i secondi divisi fra i byte e il disegno", testo.includes("chieste sul momento: 1 · tipica 2,5 s (byte 2,4 s + disegno 100 ms)"));
  t.c("l'apertura non entra fra le voltate da Drive", righe.find((x) => x.startsWith("Da Drive:")).includes("la peggiore 2,5 s"));
  t.c("…e si dice a parte", testo.includes("Prima pagina all'apertura: 1 · tipica 3,2 s"));
  t.c("le lente si contano", testo.includes("oltre il secondo: 1"));
  t.c("la doppia pagina a parte, se si mescola alla singola", testo.includes("a doppia pagina: 1"));
  t.c("le ultime lente una per una, senza titoli", testo.includes("Le ultime voltate lente:") && testo.includes("drive · chieste sul momento · doppia · byte 2,4 s + disegno 100 ms"));
  t.eq("senza voltate niente righe", righeVoltate([]).length, 0);
  t.c("la tipica di due e' la piu' lenta delle due (a occhio, meglio pessimisti)", testo.includes("già pronte in memoria: 2 · tipica 120 ms"));
  t.c("tutte a doppia pagina: la riga in piu' ripeterebbe il totale", !righeVoltate([V(10, 10, "P", "drive", { d: 1 })]).join("\n").includes("a doppia pagina"));

  // ---- nel rapporto -----------------------------------------------------
  const r = rapporto({ errori: [], versione: "1", voltate: voci, ora: 0 });
  t.c("il rapporto senza guasti porta lo stesso le voltate", r.includes("Nessun guasto annotato.") && r.includes("Voltate dei fumetti misurate: 5"));
  t.c("senza voltate il rapporto e' quello di prima", !rapporto({ errori: [], versione: "1", ora: 0 }).includes("Voltate"));
};

// LE PAUSE CHE IL TEMPO DI LETTURA SCARTA, misurate prima di cambiare la
// regola (chiesto dal lettore davanti alla riga di oggi: «mi sembra di aver
// letto di più di quanto dici»; scelto fra le due strade «prima misuro»).
//
// `lib/tempo.js` conta solo il tratto fra due voltate, e un tratto oltre
// `PAUSA_MAX` lo butta via TUTTO: una pagina guardata cinque minuti vale
// zero. Quanto tempo vero si perde cosi' non lo sapeva nessuno: qui ogni
// tratto si annota, contato o scartato, e il rapporto dei guasti dice per
// ogni giorno quanto si e' contato e quanto si e' buttato, e di che durata.
// Del solo dispositivo, solo numeri.

const KEY = "bc_pause";
export const GIORNI_TENUTI = 14;
const SCARTATE_MAX = 300;

// Un tratto: `contato` se e' finito nel tempo di lettura; `come` dice da dove
// arriva una pausa scartata — «v» fra due voltate, «c» alla chiusura del
// libro o con l'app in secondo piano; `tipo` il lettore
export function annotaTratto(giorni, g, secondi, { contato, come = "v", tipo = "" } = {}) {
  const lista = Array.isArray(giorni) ? giorni.filter((d) => d && d.g !== g) : [];
  const prima = (Array.isArray(giorni) ? giorni.find((d) => d?.g === g) : null) || { g, v: 0, s: 0, x: [] };
  const oggi = { ...prima, x: [...(prima.x || [])] };
  if (contato) {
    oggi.v += 1;
    oggi.s += secondi;
  } else if (oggi.x.length < SCARTATE_MAX) oggi.x.push([secondi, come, tipo]);
  return [...lista, oggi].sort((a, b) => (a.g < b.g ? -1 : 1)).slice(-GIORNI_TENUTI);
}

export function leggiPause(st = globalThis.localStorage) {
  try {
    const v = JSON.parse(st.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function segnaTratto(g, secondi, opzioni, st = globalThis.localStorage) {
  try {
    st.setItem(KEY, JSON.stringify(annotaTratto(leggiPause(st), g, secondi, opzioni)));
  } catch {
    /* una misura che non si scrive non ferma la lettura */
  }
}

export function svuotaPause(st = globalThis.localStorage) {
  try {
    st.removeItem(KEY);
  } catch {
    /* niente */
  }
}

const min = (s) => `${Math.round(s / 60)} min`;
const FASCE = [
  [10 * 60, "4–10 min"],
  [20 * 60, "10–20 min"],
  [60 * 60, "20–60 min"],
  [Infinity, "oltre l'ora"],
];
const LETTORI = { epub: "ePub", pdf: "PDF", fumetto: "fumetti" };
const data = (g) => g.slice(8, 10) + "/" + g.slice(5, 7);

// Le righe per il rapporto. Per ogni giorno: il contato, le voltate, la
// pagina tipica (la media dei tratti contati) e le pause scartate. Poi le
// pause di tutti i giorni per durata e per lettore, e quanto varrebbe
// l'altra strada (ogni pausa contata come una pagina tipica): e' la domanda
// a cui la misura deve rispondere
export function righePause(dati = []) {
  if (!dati.length) return [];
  const out = [`Tempo di lettura su questo dispositivo (${dati.length === 1 ? "un giorno" : `ultimi ${dati.length} giorni`}):`];
  const tutte = [];
  let altra = 0;
  for (const d of [...dati].reverse()) {
    const media = d.v ? d.s / d.v : 0;
    const x = d.x || [];
    const buttati = x.reduce((a, [s]) => a + s, 0);
    altra += x.reduce((a, [s]) => a + Math.min(s, media), 0);
    tutte.push(...x);
    out.push(
      `  ${data(d.g)} · contati ${min(d.s)} in ${d.v} ${d.v === 1 ? "voltata" : "voltate"}` +
        (d.v ? ` (in media ${Math.round(media)} s a pagina)` : "") +
        (x.length ? ` · scartate ${x.length} ${x.length === 1 ? "pausa" : "pause"} per ${min(buttati)}` : "")
    );
  }
  if (!tutte.length) {
    out.push("Nessuna pausa oltre i 4 minuti scartata.");
    return out;
  }
  const fasce = FASCE.map(([fino, nome], i) => [nome, tutte.filter(([s]) => s <= fino && s > (i ? FASCE[i - 1][0] : 0))]).filter(([, l]) => l.length);
  out.push(`Pause scartate per durata: ${fasce.map(([nome, l]) => `${nome} ${l.length}`).join(" · ")}`);
  const fra = tutte.filter(([, come]) => come === "v").length;
  if (fra < tutte.length) out.push(`  fra due voltate ${fra} · alla chiusura o in secondo piano ${tutte.length - fra}`);
  const lettori = [...new Set(tutte.map(([, , t]) => t).filter(Boolean))];
  if (lettori.length) out.push(`  per lettore: ${lettori.map((t) => `${LETTORI[t] || t} ${tutte.filter(([, , q]) => q === t).length}`).join(" · ")}`);
  out.push(`Contando ogni pausa come una pagina media del suo giorno: ${min(altra)} in più.`);
  return out;
}

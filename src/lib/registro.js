// IL REGISTRO DEGLI ERRORI (chiesto dal lettore). Quando qualcosa si rompe
// sul tablet lo si scopre da una fotografia, e la fotografia dice la riga
// sullo schermo, non da dove veniva. Qui si tengono gli ultimi guasti —
// quelli che il disegno raccoglie (`Guasto`), quelli che nessuno raccoglie
// (`error`, `unhandledrejection`) e quelli della sincronizzazione — e dalle
// Impostazioni un tocco copia un rapporto da incollare in un messaggio.
//
// NIENTE TELEMETRIA: il registro sta in questo browser e parte solo se il
// lettore lo copia lui. E NIENTE DATI PERSONALI nel rapporto: prima di
// scrivere si oscurano indirizzi, chiavi e gettoni d'accesso (la chiave
// dell'Oracolo, quella di Google, un Bearer finito dentro un messaggio di
// rete), e i messaggi si accorciano.

const KEY = "bc_errori";
export const TENUTI = 30;
const MESSAGGIO_MAX = 300;
const PILA_RIGHE = 8;

export function pulisci(testo) {
  return String(testo ?? "")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .replace(/sk-ant-[\w-]+/g, "[chiave]")
    .replace(/AIza[\w-]{20,}/g, "[chiave]")
    .replace(/ya29\.[\w.-]+/g, "[gettone]")
    .replace(/Bearer\s+[\w.~+/=-]+/gi, "Bearer [gettone]")
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[gettone]")
    .replace(/([?&](?:key|token|access_token|apikey)=)[^&\s]+/gi, "$1[…]");
}

const leggi = (st) => {
  try {
    const v = JSON.parse(st.getItem(KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

// Uno stesso guasto ripetuto (un ciclo che esplode a ogni fotogramma)
// sarebbe trenta righe uguali che spingono fuori le altre: si conta.
export function annotaErrore(err, { dove = "", pila = "", ora = Date.now(), st = globalThis.localStorage } = {}) {
  try {
    const m = pulisci(err?.message || err || "errore senza messaggio").slice(0, MESSAGGIO_MAX);
    const s = pulisci(pila || err?.stack || "")
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean)
      .slice(0, PILA_RIGHE)
      .join("\n");
    const tutti = leggi(st);
    const ultimo = tutti[tutti.length - 1];
    if (ultimo && ultimo.m === m && ultimo.d === dove) {
      ultimo.n = (ultimo.n || 1) + 1;
      ultimo.q = ora;
    } else tutti.push({ q: ora, d: dove, m, s, n: 1 });
    st.setItem(KEY, JSON.stringify(tutti.slice(-TENUTI)));
  } catch {
    /* un registro che non scrive non deve diventare un secondo guasto */
  }
}

export const erroriAnnotati = (st = globalThis.localStorage) => {
  try {
    return leggi(st);
  } catch {
    return [];
  }
};

export function svuotaErrori(st = globalThis.localStorage) {
  try {
    st.removeItem(KEY);
  } catch {
    /* niente */
  }
}

// Rumore del browser, non guasti dell'app: il ResizeObserver che non fa in
// tempo a consegnare, e gli errori degli script di altri siti (Google), che
// arrivano senza messaggio.
export const eRumore = (m) => /ResizeObserver loop/.test(m || "") || String(m || "").trim() === "Script error.";

// Il rapporto: l'app e il dispositivo (senza nome, senza account) e i
// guasti, dal piu' recente.
export function rapporto({ errori = [], versione = "?", ambiente = {}, ora = Date.now() } = {}) {
  const data = (t) => new Date(t).toLocaleString("it-IT", { timeZone: "Europe/Rome" });
  const righe = [
    "Book Companion — rapporto dei guasti",
    `Versione: ${versione}`,
    `Scritto: ${data(ora)}`,
    ambiente.navigatore ? `Browser: ${pulisci(ambiente.navigatore)}` : null,
    ambiente.schermo ? `Schermo: ${ambiente.schermo}` : null,
    ambiente.guscio ? `Aperta come: ${ambiente.guscio}` : null,
    "",
  ].filter((r) => r !== null);
  if (!errori.length) return [...righe, "Nessun guasto annotato."].join("\n");
  righe.push(`Guasti annotati: ${errori.length}`);
  for (const e of [...errori].reverse()) {
    righe.push("", `— ${data(e.q)}${e.d ? ` · ${e.d}` : ""}${e.n > 1 ? ` · ${e.n} volte` : ""}`, e.m);
    if (e.s) righe.push(e.s);
  }
  return righe.join("\n");
}

// In ascolto dei guasti che nessuno raccoglie. Torna la funzione che smette.
export function ascoltaErrori(win = globalThis, annota = annotaErrore) {
  const suErrore = (ev) => {
    const m = ev?.error?.message || ev?.message;
    if (eRumore(m)) return;
    annota(ev?.error || m, { dove: "pagina" });
  };
  const suPromessa = (ev) => {
    const r = ev?.reason;
    if (eRumore(r?.message || r)) return;
    annota(r, { dove: "promessa" });
  };
  win.addEventListener?.("error", suErrore);
  win.addEventListener?.("unhandledrejection", suPromessa);
  return () => {
    win.removeEventListener?.("error", suErrore);
    win.removeEventListener?.("unhandledrejection", suPromessa);
  };
}

// IL TEMPO PASSATO A LEGGERE, e i numeri dell'anno che ne vengono fuori.
//
// Il diario sapeva QUANDO un libro e' cominciato e finito, non QUANTO ci
// avevi letto: fra le due date ci sono le sere di lettura e le settimane in
// cui il libro e' rimasto sul comodino, e dalla sola durata non si
// distinguono. Qui si misura il tempo vero.
//
// SI MISURA SULLE VOLTATE, non sul reader aperto: un libro aperto sul
// comodino mentre dormi non e' lettura. Il segnale e' quello che i due reader
// danno gia' a ogni pagina (`onAlive`, lo stesso che tiene sveglio lo
// schermo), e fra due segnali si conta il tempo SOLO se sono vicini — oltre
// `PAUSA_MAX` hai posato il libro, e quel buco non si conta. E' la soglia del
// passo di lettura (`readingSpeed.js`): chi legge sta sotto i quattro minuti
// a pagina, e sopra il tempo smette di essere lettura.
//
// OGNI DISPOSITIVO SCRIVE SOLO NEL SUO CASSETTO (`bc_dispositivo`), ed e'
// quello che rende la fusione onesta: il tablet e il telefono non possono
// mai aver letto «lo stesso minuto», quindi la fusione e' un'unione dei
// cassetti — e dentro lo stesso cassetto, a parita' di giorno, vince il
// valore piu' grande, perche' il tempo di un giorno puo' solo crescere.
// Sommare due copie dello stesso cassetto conterebbe due volte la stessa
// sera; tenerne una sola per giorno fra dispositivi diversi ne perderebbe
// una. Tutt'e due gli errori sarebbero numeri plausibili, cioe' invisibili.

export const PAUSA_MAX = 4 * 60 * 1000;

// Un giorno «letto» per la serie vuole almeno cinque minuti: aprire il libro
// per controllare una pagina non e' una sera di lettura, e una serie che la
// conta direbbe il falso proprio dove uno la guarda.
export const SOGLIA_GIORNO = 5 * 60;

const KEY = "bc_tempo";
const DISP_KEY = "bc_dispositivo";

// Il giorno si scrive nell'ora LOCALE: la lettura delle undici di sera e'
// di oggi, e con `toISOString` (UTC) finirebbe su domani per chi sta a est
// di Greenwich — cioe' per il lettore.
export function giornoDi(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Aggiunge al registro il tempo fra due segnali, se sono abbastanza vicini
// da essere lettura. Il tempo va al giorno del segnale d'ARRIVO: una voltata
// a mezzanotte e cinque porta il minuto prima su oggi, ed e' un minuto.
export function accumula(registro, dispositivo, da, a, pausaMax = PAUSA_MAX) {
  const dt = a - da;
  if (!dispositivo || !(dt > 0) || dt > pausaMax) return registro;
  const g = giornoDi(a);
  const cassetto = { ...(registro?.[dispositivo] || {}) };
  cassetto[g] = Math.round((cassetto[g] || 0) + dt / 1000);
  return { ...(registro || {}), [dispositivo]: cassetto };
}

export function fondiTempo(qui, lassu) {
  const out = {};
  for (const reg of [qui, lassu]) {
    if (!reg || typeof reg !== "object") continue;
    for (const [disp, giorni] of Object.entries(reg)) {
      if (!giorni || typeof giorni !== "object") continue;
      const c = (out[disp] = out[disp] || {});
      for (const [g, s] of Object.entries(giorni)) {
        const n = Number(s);
        if (Number.isFinite(n) && n > 0) c[g] = Math.max(c[g] || 0, n);
      }
    }
  }
  // chiavi in ordine: la sincronizzazione confronta il JSON, e due registri
  // uguali scritti in ordine diverso si rimbalzerebbero a ogni giro
  const ordinato = {};
  for (const d of Object.keys(out).sort()) {
    ordinato[d] = {};
    for (const g of Object.keys(out[d]).sort()) ordinato[d][g] = out[d][g];
  }
  return ordinato;
}

// Il tempo di ogni giorno, sommato sui dispositivi.
export function perGiorno(registro) {
  const out = {};
  for (const giorni of Object.values(registro || {})) {
    for (const [g, s] of Object.entries(giorni || {})) out[g] = (out[g] || 0) + (Number(s) || 0);
  }
  return out;
}

const giornoPrima = (g) => {
  const [y, m, d] = g.split("-").map(Number);
  return giornoDi(new Date(y, m - 1, d - 1, 12).getTime());
};

// I numeri dell'anno. La SERIE e' viva finche' il giorno non e' finito: se
// oggi non hai ancora letto si conta da ieri, o la mattina ogni serie
// sembrerebbe spezzata prima ancora che tu abbia avuto il tempo di leggere.
export function statisticheAnno(registro, anno, oggi = Date.now()) {
  const giorni = perGiorno(registro);
  const pref = `${anno}-`;
  let secondi = 0;
  let letti = 0;
  let serieMax = 0;
  let corsa = 0;
  let prec = null;
  for (const g of Object.keys(giorni).filter((k) => k.startsWith(pref)).sort()) {
    secondi += giorni[g];
    if (giorni[g] < SOGLIA_GIORNO) continue;
    letti += 1;
    corsa = prec && giornoPrima(g) === prec ? corsa + 1 : 1;
    prec = g;
    serieMax = Math.max(serieMax, corsa);
  }
  let g = giornoDi(oggi);
  if (!((giorni[g] || 0) >= SOGLIA_GIORNO)) g = giornoPrima(g);
  let serie = 0;
  while ((giorni[g] || 0) >= SOGLIA_GIORNO) {
    serie += 1;
    g = giornoPrima(g);
  }
  return {
    minuti: Math.round(secondi / 60),
    giorni: letti,
    mediaMinuti: letti ? Math.round(secondi / 60 / letti) : 0,
    serie,
    serieMax,
  };
}

export function durata(minuti) {
  const m = Math.max(0, Math.round(minuti || 0));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

// ---- storage e segnali -------------------------------------------------

export function leggiTempo() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function scriviTempo(registro) {
  try {
    localStorage.setItem(KEY, JSON.stringify(registro || {}));
  } catch {
    /* storage pieno: si perde un minuto di conto, non la lettura */
  }
}

export function dispositivo() {
  try {
    let id = localStorage.getItem(DISP_KEY);
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() || `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(DISP_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

let ultimo = null;

// Il reader si e' aperto, o l'app e' tornata in primo piano con un libro
// aperto: da qui si ricomincia a contare.
export function comincia(ora = Date.now()) {
  ultimo = ora;
}

// Una voltata: si conta il tratto dall'ultimo segnale.
export function segnaVita(ora = Date.now()) {
  if (ultimo != null) {
    const prima = leggiTempo();
    const dopo = accumula(prima, dispositivo(), ultimo, ora);
    if (dopo !== prima) scriviTempo(dopo);
  }
  ultimo = ora;
}

// Il libro si chiude o l'app va in secondo piano: si conta l'ultimo tratto
// e ci si ferma, o il tempo in background finirebbe nel conto.
export function smetti(ora = Date.now()) {
  if (ultimo != null) segnaVita(ora);
  ultimo = null;
}

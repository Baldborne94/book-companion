// L'OBIETTIVO DELL'ANNO: quanti libri vuoi finire, e a che punto sei.
//
// Si tiene per ANNO (`bc_obiettivi`, anno → { n, t }): l'obiettivo del 2026
// non deve diventare quello del 2027 da solo il primo gennaio, e quello
// dell'anno scorso resta scritto accanto al conto di come e' andata. `t` e'
// l'ora in cui l'hai scelto, e fra due dispositivi vince la scelta piu'
// recente — e' una preferenza, non un conto da sommare.
//
// Lo ZERO e' una scelta vera («quest'anno niente obiettivo») e non va
// confuso col campo mai scritto: tutt'e due non mostrano niente, ma lo zero
// scende sull'altro dispositivo e spegne l'obiettivo anche li'.

const KEY = "bc_obiettivi";

export const SCELTE_OBIETTIVO = [6, 12, 24, 36, 52];

// Il numero scritto a mano (chiesto dal lettore: i tasti arrivano a 52, e
// per 80 servivano ventotto tocchi di «+»). Si accettano solo cifre, e un
// numero che non ha senso NON si scrive affatto invece di scriverne uno
// storto: zero ha il suo tasto («Nessun obiettivo»), e oltre il tetto e' un
// dito scivolato — un obiettivo di 5000 libri renderebbe «in pari» e
// «indietro» parole senza senso per tutto l'anno.
export const MAX_OBIETTIVO = 999;

export function numeroObiettivo(testo) {
  const t = String(testo ?? "").trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= MAX_OBIETTIVO ? n : null;
}

export function leggiObiettivi() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function scriviObiettivi(tutti) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tutti || {}));
  } catch {
    /* storage pieno: l'obiettivo resta quello di prima */
  }
}

export function obiettivoDi(tutti, anno) {
  const n = Number(tutti?.[anno]?.n);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function conObiettivo(tutti, anno, n, ora = Date.now()) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  return { ...(tutti || {}), [anno]: { n: v, t: ora } };
}

export function fondiObiettivi(qui, lassu) {
  const out = {};
  for (const reg of [lassu, qui]) {
    if (!reg || typeof reg !== "object") continue;
    for (const [anno, v] of Object.entries(reg)) {
      if (!v || typeof v !== "object" || !Number.isFinite(Number(v.n))) continue;
      if (!out[anno] || (Number(v.t) || 0) > (Number(out[anno].t) || 0)) out[anno] = { n: Number(v.n), t: Number(v.t) || 0 };
    }
  }
  const ordinato = {};
  for (const a of Object.keys(out).sort()) ordinato[a] = out[a];
  return ordinato;
}

// Quanto dell'anno e' passato, da zero a uno.
export function frazioneAnno(anno, oggi = Date.now()) {
  const inizio = new Date(anno, 0, 1).getTime();
  const fine = new Date(anno + 1, 0, 1).getTime();
  return Math.min(1, Math.max(0, (oggi - inizio) / (fine - inizio)));
}

// A che punto sei rispetto al PASSO, non solo rispetto al traguardo: «7 di
// 24» a marzo e a novembre sono due notizie opposte, e il numero nudo non
// dice quale. Il passo e' l'obiettivo spalmato sull'anno; lo scarto si dice
// in libri interi, e sotto un libro di differenza sei in pari — un mezzo
// libro «in ritardo» a fine gennaio sarebbe un rimprovero per niente.
export function passoObiettivo(finiti, obiettivo, anno, oggi = Date.now()) {
  if (!(obiettivo > 0)) return null;
  const atteso = obiettivo * frazioneAnno(anno, oggi);
  const scarto = finiti - atteso;
  const libri = (n) => (n === 1 ? "un libro" : `${n} libri`);
  let passo;
  if (finiti >= obiettivo) passo = "obiettivo raggiunto ✨";
  else if (scarto >= 1) passo = `in anticipo di ${libri(Math.floor(scarto))}`;
  else if (scarto <= -1) passo = `indietro di ${libri(Math.floor(-scarto))}`;
  else passo = "in pari col passo";
  return { finiti, obiettivo, frazione: Math.min(1, finiti / obiettivo), passo };
}

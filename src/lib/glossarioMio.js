// IL GLOSSARIO NON PUO' ESSERE SOLO DEL MONDO DISCO.
//
// `glossaryOf` risponde «discworld» o niente: per Malazan, la Ruota del
// Tempo, la Prima Legge non c'era modo di segnare un termine. E le voci
// scritte a mano da noi non copriranno mai un mondo intero — figurarsi
// tutti i mondi. Ma il lettore quel mondo lo sta attraversando, e quando
// tocca un nome e l'Oracolo glielo spiega, quella spiegazione la butta via.
//
// Qui le voci sue si tengono. Sono POCHE e SUE: nessuna cura di scala,
// nessun indice grosso — un elenco in localStorage, come i segnalibri.

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

// LA CHIAVE E' LA SAGA, NON IL LIBRO. Un termine imparato nel primo volume
// serve soprattutto nel quinto: legarlo al singolo file vorrebbe dire
// riscriverlo a ogni tomo. Chi una saga non ce l'ha dichiarata resta legato
// al suo libro — meglio un glossario che vale per un volume solo che
// nessun glossario.
export function chiaveGlossario(book) {
  const saga = norm(book?.saga);
  if (saga) return `saga:${saga}`;
  return book?.id ? `libro:${book.id}` : null;
}

const CHIAVE = (c) => `bc_gloss_${c}`;

export function vociDi(chiave) {
  if (!chiave) return [];
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE(chiave)));
    return Array.isArray(v) ? v.filter((e) => e?.t) : [];
  } catch {
    return [];
  }
}

export function salvaVoci(chiave, voci) {
  if (!chiave) return;
  localStorage.setItem(CHIAVE(chiave), JSON.stringify(voci));
  // le voci viaggiano nelle preferenze come tutto il resto di locale
  localStorage.setItem("bc_prefs_upd", String(Date.now()));
}

// Aggiungere lo STESSO termine due volte non fa due voci: riscrive quella
// che c'e'. Correggere una spiegazione e' l'uso normale — te ne accorgi
// rileggendola — e cancellare-poi-riscrivere sarebbe due gesti per uno.
export function aggiungi(voci = [], termine, spiegazione, ora = Date.now()) {
  const t = String(termine || "").trim();
  const d = String(spiegazione || "").trim();
  if (!t || !d) return voci;
  const n = norm(t);
  const gia = voci.find((e) => norm(e.t) === n);
  const resto = voci.filter((e) => norm(e.t) !== n);
  // Riscrivendo una voce si cambia la SPIEGAZIONE, non il nome: il termine
  // arriva dal testo com'e' scritto in quel punto, e toccare «warren» in
  // fondo a una frase non deve degradare la «Warren» che avevi salvato.
  return [...resto, { t: gia?.t || t, d, addedAt: ora }].sort((a, b) => a.t.localeCompare(b.t, "it"));
}

export function togli(voci = [], termine) {
  const n = norm(termine);
  return voci.filter((e) => norm(e.t) !== n);
}

export const cerca = (voci = [], termine) => {
  const n = norm(termine);
  return voci.find((e) => norm(e.t) === n) || null;
};

export const normalizza = norm;

const PREFISSO = "bc_gloss_";

// I TERMINI TUOI VANNO NELL'ARCHIVIO. Un glossario che si scrive a mano e
// che un backup non porta con se' e' una trappola: te ne accorgi solo il
// giorno che ripristini, cioe' il giorno peggiore.
export function tuttiIGlossari() {
  const out = {};
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(PREFISSO)) continue;
      const voci = vociDi(k.slice(PREFISSO.length));
      if (voci.length) out[k.slice(PREFISSO.length)] = voci;
    }
  } catch {
    /* niente localStorage: l'archivio esce senza glossari, non si ferma */
  }
  return out;
}

// La regola del ripristino, la stessa di sempre: quello che e' gia' qui
// resta com'e' — puo' essere una correzione fatta ieri — e dall'archivio si
// prende solo cio' che manca.
export function fondi(locali = {}, archivio = {}) {
  const out = { ...locali };
  let nuove = 0;
  for (const [chiave, voci] of Object.entries(archivio || {})) {
    if (!Array.isArray(voci)) continue;
    let agg = out[chiave] || [];
    for (const v of voci) {
      if (!v?.t || !v?.d || cerca(agg, v.t)) continue;
      agg = aggiungi(agg, v.t, v.d, v.addedAt);
      nuove += 1;
    }
    if (agg.length) out[chiave] = agg;
  }
  return { glossari: out, nuove };
}

export function scriviGlossari(glossari = {}) {
  for (const [chiave, voci] of Object.entries(glossari)) {
    if (voci?.length) salvaVoci(chiave, voci);
  }
}

export const quantiTermini = (glossari = {}) =>
  Object.values(glossari).reduce((n, v) => n + (v?.length || 0), 0);

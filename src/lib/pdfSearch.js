import { queryRegex } from "./wordForms.js";

// Cercare in un PDF vuol dire leggerne il testo pagina per pagina: non c'e'
// un indice, quindi si sfoglia davvero. Il testo gia' letto resta in una
// cache per la sessione, cosi' la seconda ricerca e' immediata.

// Normalizzare accorcerebbe il testo (una lettera accentata sono due
// caratteri in NFD) e i ritagli finirebbero fuori posto: si tiene una mappa
// verso le posizioni originali.
export function normalizeWithMap(text) {
  let out = "";
  const map = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (out.endsWith(" ")) continue;
      out += " ";
      map.push(i);
      continue;
    }
    const plain = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    for (const c of plain) {
      out += c;
      map.push(i);
    }
  }
  map.push(text.length);
  return { text: out, map };
}

function context(text, start, end, pad = 46) {
  const a = Math.max(0, start - pad);
  const b = Math.min(text.length, end + pad + 24);
  const tidy = (s) => s.replace(/\s+/g, " ");
  return {
    before: (a > 0 ? "…" : "") + tidy(text.slice(a, start)),
    hit: tidy(text.slice(start, end)),
    after: tidy(text.slice(end, b)) + (b < text.length ? "…" : ""),
  };
}

export function findMatches(text, query, max = 3) {
  // non alla lettera: «muscle in» deve trovare anche «muscling in», quindi
  // la domanda diventa l'espressione con tutte le forme flesse
  const needle = normalizeWithMap(query || "").text.trim();
  const re = queryRegex(needle);
  if (!re || !text) return [];
  const { text: hay, map } = normalizeWithMap(text);
  const out = [];
  for (const m of hay.matchAll(re)) {
    out.push(context(text, map[m.index], map[m.index + m[0].length] ?? text.length));
    if (out.length >= max) break;
  }
  return out;
}

export async function pageText(pdf, n, cache) {
  if (cache?.has(n)) return cache.get(n);
  const p = await pdf.getPage(n);
  const content = await p.getTextContent();
  const text = content.items.map((it) => (it.str || "") + (it.hasEOL ? "\n" : "")).join("");
  cache?.set(n, text);
  return text;
}

// Si parte dalla pagina aperta e si fa il giro completo: quello che si cerca
// mentre si legge sta quasi sempre poco piu' avanti.
export function scanOrder(total, from) {
  const start = Math.min(Math.max(1, from || 1), total);
  const out = [];
  for (let n = start; n <= total; n++) out.push(n);
  for (let n = 1; n < start; n++) out.push(n);
  return out;
}

export async function searchPdf(pdf, query, { cache, from = 1, limit = 80, onPage, alive } = {}) {
  const results = [];
  const order = scanOrder(pdf.numPages, from);
  let scanned = 0;
  for (const n of order) {
    if (alive && !alive()) return { results, scanned, done: false, full: false };
    scanned++;
    try {
      for (const m of findMatches(await pageText(pdf, n, cache), query)) {
        results.push({ page: n, ...m });
        if (results.length >= limit) {
          return { results, scanned, done: true, full: true };
        }
      }
    } catch {
      /* pagina illeggibile: si continua con le altre */
    }
    onPage?.(scanned, results);
  }
  return { results, scanned, done: true, full: false };
}

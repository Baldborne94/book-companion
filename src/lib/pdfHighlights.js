// Un PDF non ha CFI: le evidenziazioni si salvano come rettangoli in
// frazioni di pagina (0–1), cosi' restano al loro posto a ogni zoom, su ogni
// schermo e dopo ogni ridisegno. Il numero di pagina fa da "cfi", come per i
// segnalibri, cosi' il giardino delle citazioni ci arriva senza sapere nulla
// dei PDF.

const round = (n) => Math.round(n * 10000) / 10000;

export const pageOf = (h) => parseInt(h?.cfi, 10) || 0;

const sameLine = (a, b) => {
  const overlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return overlap > Math.min(a.h, b.h) * 0.5;
};

// Una selezione produce un rettangolo per ogni span del livello testo: sulla
// stessa riga vanno fusi in una fascia sola, altrimenti l'evidenziazione
// esce tratteggiata parola per parola.
export function mergeRects(rects, gap = 0.012) {
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && sameLine(last, r) && r.x <= last.x + last.w + gap) {
      const right = Math.max(last.x + last.w, r.x + r.w);
      const bottom = Math.max(last.y + last.h, r.y + r.h);
      last.x = Math.min(last.x, r.x);
      last.y = Math.min(last.y, r.y);
      last.w = round(right - last.x);
      last.h = round(bottom - last.y);
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

export function toPageRects(clientRects, box) {
  if (!box?.width || !box?.height) return [];
  const out = [];
  for (const r of clientRects || []) {
    // i rettangoli a filo di zero sono i separatori fra gli span, non testo
    if (r.width < 1 || r.height < 1) continue;
    out.push({
      x: round((r.left - box.left) / box.width),
      y: round((r.top - box.top) / box.height),
      w: round(r.width / box.width),
      h: round(r.height / box.height),
    });
  }
  return mergeRects(out);
}

export const rectStyle = (r) => ({
  left: `${r.x * 100}%`,
  top: `${r.y * 100}%`,
  width: `${r.w * 100}%`,
  height: `${r.h * 100}%`,
});

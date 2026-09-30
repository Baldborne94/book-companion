// I DOPPIONI DEI FUMETTI (segnalato dal lettore davanti alla raccolta di
// Walking Dead: «non mi pare giusto che si veda così» — il Vol. 01 tre
// volte, schede «CBR» senza copertina accanto alle stesse in CBZ). Sono
// nati prima che l'importazione da Drive saltasse i gemelli di Colab: la
// cartella entrava con il CBR e il suo CBZ, due schede per volume. Il
// riconoscimento per impronta («Riconosci i doppioni») non li vede: un CBR
// e il suo CBZ hanno byte diversi. Qui si riconoscono dal TITOLO, solo fra
// i fumetti, e di ogni gruppo si tiene la scheda che conta di piu'.

const EST = /\.(cbz|cbr|zip|rar)$/i;
export const chiaveVolume = (b) =>
  String(b?.title || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(EST, "")
    .trim()
    .toLowerCase();

const eFumetto = (b) => b?.fileType === "cbz" || b?.fileType === "cbr";

// Quale tenere, in quest'ordine: quella che stai leggendo (piu' avanti
// vince), quella coi segnalibri, il CBZ sul CBR (si legge a pezzi), quella
// con la copertina, e a parita' la piu' vecchia (la scheda di sempre).
function peso(b, { progresso, stato, segni, copertina }) {
  const p = Number(progresso(b.id)) || 0;
  const s = stato(b.id);
  return [s === "read" || s === "reading" || p > 0 ? 1 : 0, p, segni(b.id), b.fileType === "cbz" ? 1 : 0, copertina(b.id) ? 1 : 0, -(Number(b.addedAt) || 0)];
}
const prima = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
  return 0;
};

export function doppioniDiFumetti(libri, { progresso = () => 0, stato = () => "unread", segni = () => 0, copertina = () => false } = {}) {
  const gruppi = new Map();
  for (const b of libri || []) {
    if (!b?.id || !eFumetto(b)) continue;
    const k = chiaveVolume(b);
    if (!k) continue;
    if (!gruppi.has(k)) gruppi.set(k, []);
    gruppi.get(k).push(b);
  }
  const out = [];
  for (const g of gruppi.values()) {
    if (g.length < 2) continue;
    const pesati = g.map((b) => ({ b, p: peso(b, { progresso, stato, segni, copertina }) })).sort((x, y) => prima(x.p, y.p));
    out.push({ titolo: pesati[0].b.title, tieni: pesati[0].b.id, via: pesati.slice(1).map((x) => x.b.id) });
  }
  return out.sort((a, b) => a.titolo.localeCompare(b.titolo, "it", { numeric: true }));
}

// IL RESOCONTO DEL GIRO, LIBRO PER LIBRO (chiesto dal lettore: dopo undici
// saghe scritte sul PC e mai arrivate sul tablet, «Sincronizzato» non
// diceva niente). Il giro sa gia' cosa scende e cosa sale: qui si mette in
// parole la differenza fra la riga di prima e quella di dopo, «Cthulhu:
// saga «Miti di Cthulhu» n° 2 · al 60%». Righe, non libri: le stesse chiavi
// di `rowFromLocal`. Una riga letta a meta' (le colonne leggere del giro)
// non ha i campi, e un campo che manca da una parte non si racconta.
import { CAMPI_SCHEDA } from "./syncCore.js";

const STATI = { unread: "da leggere", reading: "in lettura", read: "letto", abandoned: "lasciato" };
const vivi = (l) => (Array.isArray(l) ? l.filter((x) => x && !x.deleted).length : 0);
const pct = (p) => Math.round((Number(p) || 0) * 100);
const quanti = (n, uno, tanti) => `${n} ${n === 1 ? uno : tanti}`;

export function coseCambiate(prima, dopo, { solo = null } = {}) {
  if (!dopo) return [];
  if (!prima) return ["nuovo"];
  const c = (k) => k in prima && k in dopo && (!solo || solo.includes(k));
  const diverso = (k) => c(k) && (prima[k] ?? null) !== (dopo[k] ?? null);
  const cose = [];
  if (diverso("title")) cose.push(`titolo «${dopo.title}»`);
  if (diverso("author")) cose.push(dopo.author ? `autore ${dopo.author}` : "autore tolto");
  if (diverso("saga")) cose.push(dopo.saga ? `saga «${dopo.saga}»${dopo.saga_order ? ` n° ${dopo.saga_order}` : ""}` : "fuori saga");
  else if (diverso("saga_order") && dopo.saga) cose.push(dopo.saga_order ? `n° ${dopo.saga_order} in «${dopo.saga}»` : `senza numero in «${dopo.saga}»`);
  if (diverso("status")) cose.push(STATI[dopo.status] || dopo.status);
  if (c("progress") && pct(prima.progress) !== pct(dopo.progress)) cose.push(`al ${pct(dopo.progress)}%`);
  if (c("marks")) {
    const d = vivi(dopo.marks) - vivi(prima.marks);
    if (d > 0) cose.push(quanti(d, "segnalibro nuovo", "segnalibri nuovi"));
    if (d < 0) cose.push(quanti(-d, "segnalibro tolto", "segnalibri tolti"));
  }
  if (c("highlights")) {
    const d = vivi(dopo.highlights) - vivi(prima.highlights);
    if (d > 0) cose.push(quanti(d, "evidenziazione nuova", "evidenziazioni nuove"));
    if (d < 0) cose.push(quanti(-d, "evidenziazione tolta", "evidenziazioni tolte"));
  }
  if (diverso("rating")) cose.push(dopo.rating ? `voto ${"★".repeat(dopo.rating)}` : "voto tolto");
  if (diverso("notes")) cose.push("note cambiate");
  if (c("fav") && !!prima.fav !== !!dopo.fav) cose.push(dopo.fav ? "fra i preferiti" : "tolto dai preferiti");
  if (diverso("tipo")) cose.push(dopo.tipo ? `segnato ${dopo.tipo}` : "non più manga");
  if (c("file_tolto") && !!prima.file_tolto !== !!dopo.file_tolto) cose.push(dopo.file_tolto ? "ebook tolto" : "ebook di nuovo al suo posto");
  return cose;
}

// `arrivati` e `partiti`: {prima, dopo} per riga; `schede`: le schede scese
// sopra una riga che sale (conta la sola scheda); `tolti` e `cancellati`:
// titoli; `copertine`: {titolo, verso}. Una riga che non ha niente da dire
// (il solo punto esatto, un timbro) non si racconta.
export function raccontaGiro({ arrivati = [], partiti = [], schede = [], tolti = [], cancellati = [], copertine = [] } = {}) {
  const voci = new Map();
  const metti = (titolo, verso, cose) => {
    if (!cose.length) return;
    const k = `${verso}|${titolo}`;
    const v = voci.get(k);
    if (v) v.cose.push(...cose);
    else voci.set(k, { titolo, verso, cose: [...cose] });
  };
  const titolo = ({ prima, dopo }) => dopo?.title || prima?.title || "senza titolo";
  for (const r of arrivati) metti(titolo(r), "qui", coseCambiate(r.prima, r.dopo));
  for (const r of schede) metti(titolo(r), "qui", coseCambiate(r.prima, r.dopo, { solo: CAMPI_SCHEDA }));
  for (const r of partiti) metti(titolo(r), "lassu", coseCambiate(r.prima, r.dopo));
  for (const t of tolti) metti(t, "qui", ["tolto: cancellato sull'altro dispositivo"]);
  for (const t of cancellati) metti(t, "lassu", ["cancellato anche nel cloud"]);
  for (const { titolo: t, verso } of copertine) metti(t, verso, ["copertina nuova"]);
  return [...voci.values()];
}

// la riga sopra l'elenco: quanti libri, per verso
export function fraseGiro(voci) {
  const qui = (voci || []).filter((v) => v.verso === "qui").length;
  const lassu = (voci || []).filter((v) => v.verso === "lassu").length;
  if (!qui && !lassu) return "Tutto già allineato";
  return [
    qui ? `${quanti(qui, "libro cambiato", "libri cambiati")} dall'altro dispositivo` : null,
    lassu ? `${quanti(lassu, "libro mandato", "libri mandati")} nel cloud` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// L'AVVISO DI QUEL CHE E' ARRIVATO (chiesto dal lettore): il giro parte da
// solo all'avvio e in silenzio, e il resoconto lo vedeva solo chi apriva la
// nuvola — la saga scritta sul PC arrivava, e il tablet non lo diceva.
// Adesso, se dall'altro dispositivo e' sceso qualcosa, una riga lo dice:
// il libro per nome se e' uno solo, i conti per specie se sono tanti. Quel
// che parte da qui non si avvisa: l'ha fatto il lettore, lo sa.
const SPECIE = [
  ["saga", (c) => /^(saga «|fuori saga|n° |senza numero)/.test(c), "saga", "saghe"],
  ["letto", (c) => c === "letto", "letto", "letti"],
  ["nuovo", (c) => c === "nuovo", "nuovo", "nuovi"],
  ["tolto", (c) => c.startsWith("tolto:"), "tolto", "tolti"],
  ["copertina", (c) => c === "copertina nuova", "copertina", "copertine"],
];
export function avvisoArrivi(voci) {
  const qui = (voci || []).filter((v) => v?.verso === "qui");
  if (!qui.length) return null;
  if (qui.length === 1) return `☁ Dall'altro dispositivo: «${qui[0].titolo}» — ${qui[0].cose.join(" · ")}`;
  const conti = SPECIE.map(([, e, uno, tanti]) => {
    const n = qui.filter((v) => v.cose.some(e)).length;
    return n ? quanti(n, uno, tanti) : null;
  }).filter(Boolean);
  return `☁ Dall'altro dispositivo: ${qui.length} libri${conti.length ? ` — ${conti.join(", ")}` : " aggiornati"}. I dettagli nella nuvola.`;
}

// l'ultimo resoconto resta: il giro parte da solo all'avvio, e il lettore
// apre il pannello dopo
const CHIAVE = "bc_sync_racconto";
export function ricordaGiro(voci, at = Date.now(), st = globalThis.localStorage) {
  try {
    st.setItem(CHIAVE, JSON.stringify({ at, voci: (voci || []).slice(0, 200) }));
  } catch {
    /* senza storage resta quello di questa pagina */
  }
}
export function ultimoGiro(st = globalThis.localStorage) {
  try {
    const g = JSON.parse(st.getItem(CHIAVE));
    return g && Array.isArray(g.voci) ? g : null;
  } catch {
    return null;
  }
}

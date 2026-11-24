// LIBERA SPAZIO SUL DISPOSITIVO (chiesto dal lettore, col tablet pieno: «su
// E ho tutto salvato quindi non si perde il file originale»). Si propongono i
// libri LETTI che hanno il file qui e una copia sul disco del computer, il
// piu' pesante per primo; il lettore guarda l'elenco e toglie gli ebook,
// tenendo la scheda.
//
// La copia che conta e' solo quella del disco. «Togli l'ebook» e' una scelta
// sul libro: arrivata sull'altro dispositivo toglie il file anche la'
// (`sync.js`), e una copia che sta sull'altro dispositivo sparirebbe con
// questa.

export function daLiberare(libri, { qui, sulDisco, pesi, stato } = {}) {
  if (!qui || !sulDisco) return [];
  return (libri || [])
    .filter((b) => b?.id && qui.has(b.id) && !b.fileTolto && sulDisco.has(b.id) && stato?.(b.id) === "read")
    .map((b) => ({ id: b.id, titolo: b.title || "", byte: Number(pesi?.get(b.id)) || 0 }))
    .sort((a, b) => b.byte - a.byte || (a.titolo < b.titolo ? -1 : a.titolo > b.titolo ? 1 : 0));
}

// i letti che hanno il file qui ma di cui il disco non dice niente: o non e'
// mai stato guardato, o non li ha
export function senzaCopiaNota(libri, { qui, sulDisco, stato } = {}) {
  return (libri || []).filter(
    (b) => b?.id && qui?.has(b.id) && !b.fileTolto && !sulDisco?.has(b.id) && stato?.(b.id) === "read"
  );
}

export const pesoTotale = (lista) => (lista || []).reduce((s, x) => s + (Number(x.byte) || 0), 0);

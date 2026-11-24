// CHIUDERE UN PDF. Da pdf.js 6 il documento aperto NON ha piu' `destroy()`:
// si chiude dal suo `loadingTask`. Il vecchio `pdf.destroy()` esplodeva — e
// nella miniatura stava in un `finally`, quindi la copertina appena disegnata
// si perdeva nell'errore e OGNI PDF entrava col dorso disegnato, dal giorno
// dell'aggiornamento di pdf.js, senza che niente lo dicesse (trovato provando
// «Aggiungi da Drive», non leggendo il codice). Una porta sola per tutti, e
// che non esplode mai: chiudere e' pulizia, non deve portarsi via il lavoro.
export function chiudiPdf(pdf) {
  try {
    const fatto = pdf?.loadingTask?.destroy ? pdf.loadingTask.destroy() : pdf?.destroy?.();
    fatto?.catch?.(() => {});
  } catch {
    /* gia' chiuso */
  }
}

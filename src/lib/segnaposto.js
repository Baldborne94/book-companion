// IL SEGNO DI UNA SCHEDA SENZA FILE (vedi `senzaFile.js`): sta in un modulo
// suo perche' lo chiedono il cammino, «Da prendere» e la copertina, e
// `senzaFile.js` dal cammino importa a sua volta.
export const SENZA = "nessuno";
export const segnaposto = (b) => !!b?.fileTolto && b?.fileType === SENZA;

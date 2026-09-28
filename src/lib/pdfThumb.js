import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export function loadPdf(arrayBuffer) {
  return pdfjs.getDocument({ data: arrayBuffer }).promise;
}

import { chiudiPdf } from "./pdfChiudi.js";

// chi apre un PDF da qui lo chiude da qui: i reader e le passate lunghe
// ricevono il modulo intero, e la porta per chiuderlo viaggia con lui
export { chiudiPdf };

// il livello di testo trasparente sopra il canvas: senza, un PDF non si
// puo' selezionare, quindi niente dizionario
export const makeTextLayer = (opts) => new pdfjs.TextLayer(opts);

export async function renderPdfThumb(arrayBuffer) {
  return disegnaPrima(pdfjs.getDocument({ data: arrayBuffer }).promise);
}

// LA PRIMA PAGINA DI UN PDF CHE STA ALTROVE (un file di Drive letto a
// pezzi): pdf.js sa chiedere solo i pezzi che gli servono — la tabella in
// fondo e gli oggetti della prima pagina — se gli si da' un trasporto a
// intervalli invece dei byte. `disableAutoFetch` e' quel che gli impedisce
// di scaricare il resto in sottofondo, che e' proprio quel che si evita.
export async function renderPdfThumbDa(blob) {
  return disegnaPrima(apriAIntervalli(blob).promise);
}

// Il documento lontano aperto per leggerlo. Un pezzo che non arriva (la
// chiave di Google scaduta a meta' lettura) lascerebbe pdf.js in attesa per
// sempre, con la pagina bianca: si tiene da parte, si dice a chi legge
// (`onGuasto`), e `riprova` lo richiede quando la chiave e' tornata.
export function loadPdfDa(blob, { onGuasto } = {}) {
  const t = apriAIntervalli(blob, onGuasto);
  return { promise: t.promise, riprova: t.riprova };
}

function apriAIntervalli(blob, onGuasto) {
  const trasporto = new pdfjs.PDFDataRangeTransport(blob.size, null);
  const falliti = [];
  const chiedi = (da, a) =>
    blob
      .slice(da, a)
      .arrayBuffer()
      .then((b) => trasporto.onDataRange(da, new Uint8Array(b)))
      .catch((e) => {
        falliti.push([da, a]);
        onGuasto?.(e);
      });
  trasporto.requestDataRange = chiedi;
  const promise = pdfjs.getDocument({
    range: trasporto,
    length: blob.size,
    disableAutoFetch: true,
    disableStream: true,
    rangeChunkSize: 64 * 1024,
  }).promise;
  return { promise, riprova: () => falliti.splice(0).forEach(([da, a]) => chiedi(da, a)) };
}

async function disegnaPrima(aperto) {
  const pdf = await aperto;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 320 / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const canvasContext = canvas.getContext("2d");
    await page.render({ canvas, canvasContext, viewport }).promise;
    return await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.82));
  } finally {
    chiudiPdf(pdf);
  }
}

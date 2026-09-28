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
  const trasporto = new pdfjs.PDFDataRangeTransport(blob.size, null);
  trasporto.requestDataRange = (da, a) => {
    blob
      .slice(da, a)
      .arrayBuffer()
      .then((b) => trasporto.onDataRange(da, new Uint8Array(b)))
      .catch(() => {
        /* pdf.js resta in attesa e scade da se': la copertina manca e basta */
      });
  };
  return disegnaPrima(
    pdfjs.getDocument({
      range: trasporto,
      length: blob.size,
      disableAutoFetch: true,
      disableStream: true,
      rangeChunkSize: 256 * 1024,
    }).promise
  );
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

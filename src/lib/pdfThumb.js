import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function renderPdfThumb(arrayBuffer) {
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
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
    pdf.destroy();
  }
}

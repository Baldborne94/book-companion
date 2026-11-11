// UNA COPERTINA SI RIDUCE CON LA QUALITA' ALTA (`pennelloFine` in
// `copertina.js`). Segnalato: «alcune copertine sono sgranate». Il filtro
// di serie del canvas spezza a scalini le linee sottili (misurato in
// Chromium: 23 dB contro 27 sulla copertina da 800). Qui una tela finta
// annota con che filtro si disegna, per ogni strada che rimpicciolisce una
// copertina: quella salvata, la scheda della musica, la schermata di blocco.
import { preparaCopertina } from "../src/lib/copertina.js";
import { copertinaQuadrata } from "../src/lib/schedaMusica.js";
import { copertinaPerSchermo } from "../src/lib/sfondo.js";

export default async (t) => {
  const prima = { document: globalThis.document, createImageBitmap: globalThis.createImageBitmap };
  const disegni = [];
  globalThis.createImageBitmap = async () => ({ width: 1600, height: 2400, close() {} });
  globalThis.document = {
    createElement: () => {
      const g = {
        imageSmoothingQuality: "low",
        fillRect() {},
        drawImage() {
          disegni.push(g.imageSmoothingQuality);
        },
      };
      return {
        width: 0,
        height: 0,
        getContext: () => g,
        toBlob: (ok) => ok({ size: 1, type: "image/jpeg" }),
        toDataURL: () => "data:image/jpeg;base64,AAAA",
      };
    },
  };
  try {
    await preparaCopertina({ type: "image/jpeg", size: 900000 });
    t.eq("la copertina salvata si riduce con la qualita' alta", disegni.pop(), "high");
    await copertinaQuadrata({ type: "image/jpeg" });
    t.eq("la scheda della musica pure", disegni.pop(), "high");
    await copertinaPerSchermo({ type: "image/jpeg" }, { w: 1080, h: 2340 });
    t.eq("e la schermata di blocco", disegni.pop(), "high");
  } finally {
    globalThis.document = prima.document;
    globalThis.createImageBitmap = prima.createImageBitmap;
  }
};

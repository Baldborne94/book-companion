// CHIUDERE UN PDF DOPO PDF.JS 6. Il documento aperto non ha piu' `destroy()`,
// e `pdf.destroy()` in un `finally` si portava via la miniatura appena
// disegnata: ogni PDF entrava col dorso disegnato, in silenzio, dal giorno
// dell'aggiornamento. Qui la porta nuova, e il guardiano che nessuno torni
// a chiamare quella vecchia.
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { chiudiPdf } from "../src/lib/pdfChiudi.js";

export default async function (t) {
  let chiuso = 0;
  chiudiPdf({ loadingTask: { destroy: async () => (chiuso += 1) } });
  t.eq("si chiude dal loadingTask", chiuso, 1);
  let vecchio = 0;
  chiudiPdf({ destroy: () => (vecchio += 1) });
  t.eq("un documento alla vecchia maniera si chiude lo stesso", vecchio, 1);
  let ok = true;
  try {
    chiudiPdf(null);
    chiudiPdf({});
    chiudiPdf({ loadingTask: { destroy: () => { throw new Error("gia' chiuso"); } } });
    chiudiPdf({ loadingTask: { destroy: () => Promise.reject(new Error("tardi")) } });
  } catch {
    ok = false;
  }
  t.c("chiudere non esplode mai: e' pulizia, non deve portarsi via il lavoro", ok);
  await new Promise((r) => setTimeout(r, 10));

  // il guardiano: nessun `.destroy()` su un documento PDF fuori da `chiudiPdf`
  const file = [];
  const giro = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) giro(p);
      else if (/\.(js|jsx)$/.test(n) && !n.startsWith("pdfChiudi")) file.push(p);
    }
  };
  giro(new URL("../src", import.meta.url).pathname);
  const colpevoli = file.filter((p) => /\b(pdf|pdfRef\.current\??)\.destroy\(/.test(readFileSync(p, "utf8")));
  t.eq("nessuno chiama ancora pdf.destroy()", colpevoli.join(", "), "");
}

// LEGGERE DA DRIVE SENZA SCARICARE: un fumetto o un PDF grossi si aprono
// chiedendo a Drive solo le pagine che guardi (chiesto dal lettore: un
// fumetto da un giga voleva dire aspettarlo intero). La regola che decide
// sbaglia in silenzio: detta troppo larga, un ePub si aprirebbe «a pezzi»
// e epub.js resterebbe senza archivio; troppo stretta, e il giga si scarica
// come prima.
import { leggereDaLontano, LEGGI_DA_LONTANO } from "../src/lib/driveCore.js";
import { fileRemoto } from "../src/lib/drive.js";

export default async function (t) {
  const grosso = { id: "f", byte: 1_100_000_000 };
  t.c("un CBZ grosso su Drive si legge da li'", leggereDaLontano({ fileType: "cbz" }, grosso));
  t.c("un PDF grosso anche", leggereDaLontano({ fileType: "pdf" }, grosso));
  t.c("un ePub no: epub.js vuole l'archivio intero", !leggereDaLontano({ fileType: "epub" }, grosso));
  t.c("un CBR no: a fette cammina per tutto l'archivio", !leggereDaLontano({ fileType: "cbr" }, grosso));
  t.c("un file piccolo scende intero, e poi si legge anche senza rete", !leggereDaLontano({ fileType: "cbz" }, { id: "f", byte: LEGGI_DA_LONTANO }));
  t.c("appena sopra la soglia si legge da lontano", leggereDaLontano({ fileType: "cbz" }, { id: "f", byte: LEGGI_DA_LONTANO + 1 }));
  t.c("senza file su Drive non c'e' niente da leggere da lontano", !leggereDaLontano({ fileType: "cbz" }, null));
  t.c("una misura che non si sa non basta", !leggereDaLontano({ fileType: "pdf" }, { id: "f", byte: 0 }));
  t.c("la soglia si puo' passare", leggereDaLontano({ fileType: "pdf" }, { id: "f", byte: 10 }, 5));

  // il pezzo minimo di un PDF: pdf.js attraversa l'albero delle pagine un
  // oggetto per volta, e con 256 KB per oggetto scaricava mezzo file per
  // aprirne la prima pagina
  const giri = [];
  const byte = new Uint8Array(1_000_000);
  const f = fileRemoto("x", byte.length, { minimo: 64 * 1024, prendi: async (da, a) => (giri.push(a - da), { da, buf: byte.slice(da, a) }) });
  await f.slice(500_000, 500_100).arrayBuffer();
  t.eq("un PDF chiede pezzi da 64 KB", giri[0], 64 * 1024);
  await f.slice(500_100, 560_000).arrayBuffer();
  t.eq("e il pezzo accanto arriva con la stessa richiesta", giri.length, 1);
  const g = [];
  await fileRemoto("y", byte.length, { prendi: async (da, a) => (g.push(a - da), { da, buf: byte.slice(da, a) }) }).slice(0, 10).arrayBuffer();
  t.eq("senza dire niente il pezzo resta di 256 KB", g[0], 256 * 1024);
}

// L'IMPORT SUL TABLET ERA LENTO, E IL TEMPO ANDAVA IN UN CONTROLLO.
//
// Segnalato dal lettore: «quando importi i file dal tablet e' veramente
// lento». Misurato col processore strozzato sei volte, su un romanzo SANO
// da settanta capitoli: 1064 ms a libro, e 774 se ne andavano a chiedersi
// se fosse spezzato — sciogliendo ogni capitolo con JSZip, che lavora in
// JavaScript, e costruendone l'albero con DOMParser per leggerne l'inizio
// e la fine. Adesso 405 ms: i capitoli si sciolgono col decompressore del
// browser, dalla memoria, e il testo si toglie dal markup a stringa.
//
// Sono due scorciatoie, e tutt'e due sbagliano in silenzio: un testo letto
// storto non da' errori, fa credere spezzato un libro sano (e lo si ricuce
// senza motivo) o sano uno spezzato (e restano le pagine tagliate a meta'
// frase). Per questo si provano sulle stesse risposte che dava il DOM.
import { createRequire } from "module";
import { testoDelCorpo, capiDelCorpo, CAPO } from "../src/lib/unisciEpub.js";
import { apriZipInMemoria, voceInMemoria, voci } from "../src/lib/zipAFette.js";
import { tagliaAMetaFrase } from "../src/lib/visita.js";
import { importFiles } from "../src/lib/importBook.js";
import { zip64 } from "./zip-a-fette.test.mjs";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");
const X = '<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>T &amp; x</title></head>';

export default async function (t) {
  // ---- il testo del corpo, come `body.textContent` --------------------------
  // (le risposte attese sono quelle del DOM di Chromium sugli stessi documenti)
  t.eq("i tag se ne vanno, gli a capo diventano spazi",
    testoDelCorpo(X + "<body><p>Ciao <b>mondo</b></p>\n<p>due</p></body></html>"), "Ciao mondo due");
  t.eq("l'intestazione non e' corpo", testoDelCorpo(X + "<body><p>x</p></body></html>"), "x");
  t.eq("le entita' si sciolgono: la virgoletta chiusa resta una virgoletta",
    testoDelCorpo(X + "<body><p>“fine&rdquo;</p></body></html>"), "“fine”");
  t.eq("anche quelle numeriche",
    testoDelCorpo(X + "<body><p>a &gt; b &#8220;q&#x201D;</p></body></html>"), "a > b “q”");
  t.eq("un'entita' sconosciuta resta com'e'", testoDelCorpo(X + "<body><p>&boh; x</p></body></html>"), "&boh; x");
  t.eq("un commento non e' testo", testoDelCorpo(X + "<body><!-- nascosto --><p>x</p></body></html>"), "x");
  t.eq("nemmeno quando dentro ha un >", testoDelCorpo(X + "<body><!-- a > b --><p>x</p></body></html>"), "x");
  t.eq("un > dentro un attributo non chiude il tag",
    testoDelCorpo(X + '<body><img alt="a > b" src="x.png"/><p>dopo</p></body></html>'), "dopo");
  t.eq("il body coi suoi attributi", testoDelCorpo(X + "<body class='a'><p>x</p></body></html>"), "x");
  t.eq("il CDATA e' testo, i suoi segni no",
    testoDelCorpo(X + "<body><![CDATA[dentro]]><p>x</p></body></html>"), "dentrox");
  t.eq("un body mai chiuso arriva in fondo", testoDelCorpo(X + "<body><p>senza chiusura"), "senza chiusura");
  t.eq("senza body non c'e' testo", testoDelCorpo(X + "</html>"), "");
  t.eq("un body vuoto", testoDelCorpo(X + "<body/></html>"), "");
  t.eq("un <body> dentro un commento dell'intestazione non apre il corpo",
    testoDelCorpo('<html><head><!-- <body>finto --></head><body><p>vero</p></body></html>'), "vero");

  // ---- e dei capitoli lunghi si tengono i due capi --------------------------
  const riga = "The old man walked slowly along the road toward the city and thought of home. ";
  const corto = X + `<body><p>${riga.repeat(3)}</p></body></html>`;
  t.eq("un capitolo corto si legge tutto", capiDelCorpo(corto), testoDelCorpo(corto));
  const lungo = (fine) => X + `<body><p>Once ${riga.repeat(600)}${fine}</p></body></html>`;
  const aperto = lungo("and he said that the");
  const chiuso = lungo("and he slept.");
  const capi = capiDelCorpo(aperto);
  t.c("di un capitolo lungo si legge meno", capi.length < testoDelCorpo(aperto).length / 2, `${capi.length}`);
  t.c("comincia come il capitolo", capi.startsWith("Once The old man"), capi.slice(0, 30));
  t.c("e finisce come il capitolo", capi.endsWith("and he said that the"), capi.slice(-30));
  const seguito = X + `<body><p>rain came ${riga.repeat(600)}</p></body></html>`;
  t.eq("il taglio a meta' frase si vede lo stesso",
    tagliaAMetaFrase(capiDelCorpo(aperto), capiDelCorpo(seguito)),
    tagliaAMetaFrase(testoDelCorpo(aperto), testoDelCorpo(seguito)));
  t.c("…ed e' un taglio", tagliaAMetaFrase(capiDelCorpo(aperto), capiDelCorpo(seguito)));
  t.c("un capitolo che chiude la frase resta chiuso", !tagliaAMetaFrase(capiDelCorpo(chiuso), capiDelCorpo(seguito)));
  // la coda tagliata dentro un tag o un'entita': il residuo non e' testo
  const inTag = X + `<body><p>${"x".repeat(CAPO * 2)}</p><p class="${"a".repeat(CAPO - 40)}">fine vera</p></body></html>`;
  t.c("una coda che comincia dentro un tag butta il residuo",
    !capiDelCorpo(inTag).includes('">'), capiDelCorpo(inTag).slice(-60));
  const conEntita = (n) => X + `<body><p>Inizio ${"y ".repeat(CAPO * 2)}${"&amp;".repeat(n)} la fine</p></body></html>`;
  t.c("una coda che comincia a meta' entita' la butta",
    [...Array(6).keys()].every((n) => !/ … (?:amp|mp|p);/.test(capiDelCorpo(conEntita(CAPO / 5 + n)))));
  // una tavola enorme in fondo: la coda non ha testo, e allora si legge tutto
  const tavola = X + `<body><p>${riga.repeat(300)} e poi</p><svg>${'<path d="M0 0"/>'.repeat(2000)}</svg></body></html>`;
  t.eq("un capo senza testo fa leggere tutto il capitolo", capiDelCorpo(tavola), testoDelCorpo(tavola));

  // ---- lo zip letto dalla memoria -------------------------------------------
  const z = new JSZip();
  z.file("mimetype", "application/epub+zip", { compression: "STORE" });
  z.file("OEBPS/c1.xhtml", corto, { compression: "DEFLATE" });
  z.file("OEBPS/img.bin", new Uint8Array([1, 2, 3, 250]), { compression: "STORE" });
  const blob = new Blob([await z.generateAsync({ type: "uint8array" })]);
  const a = await apriZipInMemoria(blob);
  t.c("dice le sue voci", a.nomi.includes("OEBPS/c1.xhtml") && a.nomi.includes("mimetype"));
  t.eq("scioglie una voce compressa", new TextDecoder().decode(await a.leggi("OEBPS/c1.xhtml")), corto);
  t.eq("legge una voce memorizzata", [...(await a.leggi("OEBPS/img.bin"))].join(","), "1,2,3,250");
  let assente = null;
  await a.leggi("nessuna").catch((e) => (assente = e));
  t.c("una voce assente e' un errore, non un vuoto", !!assente);
  // la testata LOCALE comanda: qui ha un extra di sette byte che la centrale non ha
  const z64 = zip64("p.jpg", new Uint8Array([9, 8, 7, 6]));
  const b64 = await apriZipInMemoria(z64);
  t.eq("l'inizio dei dati si legge dalla testata locale", [...(await b64.leggi("p.jpg"))].join(","), "9,8,7,6");
  // uno zip troncato: la voce promette byte che non ci sono
  const tutto = new Uint8Array(await blob.arrayBuffer());
  const [voce] = (await voci(blob)).filter((v) => v.nome === "OEBPS/img.bin");
  let tronca = null;
  try {
    await voceInMemoria(tutto.subarray(0, voce.posizione + 31), voce);
  } catch (e) {
    tronca = e;
  }
  t.c("una voce tronca e' un errore", !!tronca);
  let rotta = null;
  try {
    const guasto = tutto.slice();
    guasto[voce.posizione] ^= 0xff;
    await voceInMemoria(guasto, voce);
  } catch (e) {
    rotta = e;
  }
  t.c("una testata che non e' una testata e' un errore", !!rotta);

  // ---- e l'import dice a che punto e' ----------------------------------------
  const passi = [];
  const f = (n) => new File([new Uint8Array([1])], n);
  await importFiles([f("a.txt"), f("b.doc"), f("c.mobi")], [], { onProgress: (p) => passi.push(p) });
  t.eq("un passo per file", passi.length, 3);
  t.eq("contati da zero", passi.map((p) => p.fatti).join(","), "0,1,2");
  t.c("col totale e il nome", passi.every((p) => p.totale === 3) && passi[1].nome === "b.doc");
}

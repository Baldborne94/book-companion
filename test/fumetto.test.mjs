// I FUMETTI: CBZ e CBR. Un archivio di immagini letto nell'ordine
// sbagliato non alza nessun errore — il decimo capitolo si legge per
// secondo e basta — e un «.cbr» che dentro e' uno zip risponderebbe
// «archivio non leggibile» su un volume sano. Qui si prova il giro intero,
// dai byte all'ultima pagina, su tutt'e due i formati: lo zip con JSZip, il
// RAR con la build Node di node-unrar-js — la stessa libreria e lo stesso
// wasm che girano nel browser — su un archivio scritto qui a mano.
import { createRequire } from "node:module";
import zlib from "node:zlib";
import {
  formatoDaByte,
  pagineDa,
  eImmagine,
  tipoImmagine,
  eComicInfo,
  leggiComicInfo,
  paginaDaAprire,
  tocco,
  leggiVerso,
  scriviVerso,
  leggiAdatta,
  scriviAdatta,
  apriArchivio,
  eFumetto,
  ESTENSIONI,
  FORMATI,
} from "../src/lib/fumetto.js";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");
const unrar = require("node-unrar-js");

// ---- UN RAR SCRITTO A MANO ------------------------------------------------
// RAR 4 col solo metodo «storing»: marker, testata dell'archivio, una
// testata per file coi byte dietro, chiusura. Basta a provare che l'elenco
// e l'estrazione passano dalla libreria vera.
const crc16 = (b) => zlib.crc32(b) & 0xffff;
function blocco(tipo, flags, corpo) {
  const testa = Buffer.alloc(5);
  testa.writeUInt8(tipo, 0);
  testa.writeUInt16LE(flags, 1);
  testa.writeUInt16LE(7 + corpo.length, 3);
  const dentro = Buffer.concat([testa, corpo]);
  const crc = Buffer.alloc(2);
  crc.writeUInt16LE(crc16(dentro), 0);
  return Buffer.concat([crc, dentro]);
}
function rar(voci) {
  const pezzi = [Buffer.from("Rar!\x1a\x07\x00", "binary"), blocco(0x73, 0, Buffer.alloc(6))];
  for (const [nome, dati] of voci) {
    const n = Buffer.from(nome, "utf8");
    const corpo = Buffer.alloc(25 + n.length);
    corpo.writeUInt32LE(dati.length, 0); // PACK_SIZE
    corpo.writeUInt32LE(dati.length, 4); // UNP_SIZE
    corpo.writeUInt8(2, 8); // HOST_OS
    corpo.writeUInt32LE(zlib.crc32(dati) >>> 0, 9); // FILE_CRC
    corpo.writeUInt32LE(0, 13); // FTIME
    corpo.writeUInt8(20, 17); // UNP_VER
    corpo.writeUInt8(0x30, 18); // METHOD: storing
    corpo.writeUInt16LE(n.length, 19); // NAME_SIZE
    corpo.writeUInt32LE(0x20, 21); // ATTR
    n.copy(corpo, 25);
    pezzi.push(blocco(0x74, 0x8000, corpo), Buffer.from(dati));
  }
  pezzi.push(blocco(0x7b, 0x4000, Buffer.alloc(0)));
  return Buffer.concat(pezzi);
}

// un PNG 2×2 di un colore solo: un'immagine vera, riconoscibile dai byte
function png(r, g, b) {
  const chunk = (t, d) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(d.length, 0);
    const td = Buffer.concat([Buffer.from(t), d]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td) >>> 0, 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  const riga = Buffer.from([0, r, g, b, r, g, b]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat([riga, riga]))), chunk("IEND", Buffer.alloc(0))]);
}

const INFO = `<?xml version="1.0"?><ComicInfo><Title>Il tomo &amp; l&apos;altro</Title><Series>Prova</Series><Number>3</Number><Writer>Tizia Caia</Writer><Summary><![CDATA[Una storia <breve>.]]></Summary><Manga>YesAndRightToLeft</Manga></ComicInfo>`;
// l'ordine in archivio e' storto apposta: e' quel che si trova davvero
const VOCI = [
  ["vol/p10.png", png(0, 0, 255)],
  ["vol/p2.png", png(0, 255, 0)],
  ["__MACOSX/vol/._p1.png", Buffer.from("xx")],
  ["vol/Thumbs.db", Buffer.from("yy")],
  ["vol/p1.png", png(255, 0, 0)],
  ["ComicInfo.xml", Buffer.from(INFO)],
  ["note.txt", Buffer.from("non e' una pagina")],
];

async function cbz(voci) {
  const z = new JSZip();
  for (const [n, d] of voci) z.file(n, d);
  return z.generateAsync({ type: "arraybuffer" });
}
const aBuffer = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const lettori = { zip: async () => JSZip, rar: async () => unrar };

export default async (t) => {
  // ---- il formato dai byte ---------------------------------------------------
  t.eq("uno zip si riconosce dai byte", formatoDaByte(new Uint8Array([0x50, 0x4b, 3, 4, 0])), "cbz");
  t.eq("un RAR si riconosce dai byte", formatoDaByte(new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 7])), "cbr");
  t.eq("altro non e' un fumetto", formatoDaByte(new Uint8Array([0x25, 0x50, 0x44, 0x46])), null);
  t.eq("troppo corto: niente", formatoDaByte(new Uint8Array([0x50, 0x4b])), null);
  t.eq("vuoto: niente", formatoDaByte(null), null);
  t.eq("i formati sono due", FORMATI.join(","), "cbz,cbr");
  t.eq("… con le loro estensioni", ESTENSIONI.join(","), ".cbz,.cbr");
  t.c("eFumetto guarda il fileType", eFumetto({ fileType: "cbr" }) && eFumetto({ fileType: "cbz" }) && !eFumetto({ fileType: "epub" }) && !eFumetto(null));

  // ---- le pagine: quali e in che ordine ------------------------------------
  t.eq("10 dopo 9, non dopo 1", pagineDa(["p10.jpg", "p9.jpg", "p1.jpg", "p2.jpg"]).join(","), "p1.jpg,p2.jpg,p9.jpg,p10.jpg");
  t.eq("gli zeri davanti non cambiano l'ordine", pagineDa(["p010.jpg", "p2.jpg"]).join(","), "p2.jpg,p010.jpg");
  t.eq("cartella per cartella, e i numeri anche li'", pagineDa(["cap10/p1.jpg", "cap2/p1.jpg", "cap2/p10.jpg", "cap2/p2.jpg"]).join(","), "cap2/p1.jpg,cap2/p2.jpg,cap2/p10.jpg,cap10/p1.jpg");
  t.eq("i file in radice prima delle cartelle", pagineDa(["b/p1.jpg", "cover.jpg"]).join(","), "cover.jpg,b/p1.jpg");
  t.eq("maiuscole e minuscole non contano", pagineDa(["B.JPG", "a.jpg"]).join(","), "a.jpg,B.JPG");
  t.eq("via il rumore e quel che non e' immagine", pagineDa(["__MACOSX/._p1.jpg", "p1.jpg", ".hidden.jpg", "Thumbs.db", "ComicInfo.xml", "note.txt", "desktop.ini"]).join(","), "p1.jpg");
  t.eq("nessuna immagine: elenco vuoto", pagineDa(["a.txt", null, 3]).length, 0);
  t.c("le estensioni delle immagini", ["a.jpg", "a.JPEG", "a.png", "a.gif", "a.webp", "a.avif", "a.bmp"].every(eImmagine));
  t.c("… e non le altre", !["a.txt", "a.xml", "a.pdf", "a", ""].some(eImmagine));
  t.eq("il tipo dall'estensione", tipoImmagine("x/Y.JpG"), "image/jpeg");
  t.eq("… nessuno per il resto", tipoImmagine("a.txt"), null);
  t.c("ComicInfo si riconosce anche in una cartella e in minuscolo", eComicInfo("vol/comicinfo.XML") && !eComicInfo("comicinfo.xml.bak"));

  // ---- la scheda dentro l'archivio -------------------------------------------
  const info = leggiComicInfo(INFO);
  t.eq("il titolo, con le entita' sciolte", info.titolo, "Il tomo & l'altro");
  t.eq("la serie", info.serie, "Prova");
  t.eq("il numero", info.numero, 3);
  t.eq("l'autore", info.autore, "Tizia Caia");
  t.eq("la sinossi, anche dentro CDATA", info.sinossi, "Una storia <breve>.");
  t.eq("il verso dei manga", info.verso, "rtl");
  t.eq("«Manga: Yes» da solo non dice il verso", leggiComicInfo("<ComicInfo><Manga>Yes</Manga></ComicInfo>").verso, null);
  t.eq("un numero storto vale niente", leggiComicInfo("<ComicInfo><Number>abc</Number></ComicInfo>").numero, null);
  t.eq("… lo zero anche", leggiComicInfo("<ComicInfo><Number>0</Number></ComicInfo>").numero, null);
  t.eq("… il decimale resta", leggiComicInfo("<ComicInfo><Number>2,5</Number></ComicInfo>").numero, 2.5);
  t.eq("un XML che non e' ComicInfo: null", leggiComicInfo("<Book><Title>x</Title></Book>"), null);
  t.eq("niente: null", leggiComicInfo(""), null);

  // ---- da dove si riparte ---------------------------------------------------
  t.eq("il punto chiesto vince sul salvato", paginaDaAprire("7", "3", 20), 7);
  t.eq("senza il chiesto vale il salvato", paginaDaAprire(null, "3", 20), 3);
  t.eq("senza niente si parte da uno", paginaDaAprire(null, null, 20), 1);
  t.eq("oltre l'ultima pagina si resta sull'ultima", paginaDaAprire("99", null, 20), 20);
  t.eq("roba storta: uno", paginaDaAprire("abc", "-4", 20), 1);
  t.eq("un fumetto senza pagine: uno, non zero", paginaDaAprire("5", null, 0), 1);

  // ---- il tocco, specchiato dal verso -------------------------------------
  t.eq("a sinistra si torna indietro", tocco(0.1, "ltr"), "prev");
  t.eq("a destra si va avanti", tocco(0.9, "ltr"), "next");
  t.eq("al centro le barre", tocco(0.5, "ltr"), "barre");
  t.eq("in un manga a sinistra si va AVANTI", tocco(0.1, "rtl"), "next");
  t.eq("… e a destra indietro", tocco(0.9, "rtl"), "prev");
  t.eq("col mouse (nessuna fascia) le barre", tocco(null, "ltr"), "barre");
  t.eq("un NaN non e' un lato", tocco(NaN, "rtl"), "barre");

  // ---- il verso sta sul dispositivo, per libro -----------------------------
  const memoria = {};
  globalThis.localStorage = { getItem: (k) => memoria[k] ?? null, setItem: (k, v) => { memoria[k] = String(v); }, removeItem: (k) => { delete memoria[k]; } };
  t.eq("mai scelto, senza scheda: da sinistra", leggiVerso("a"), "ltr");
  t.eq("mai scelto, la scheda dice manga: da destra", leggiVerso("a", "rtl"), "rtl");
  scriviVerso("a", "rtl");
  t.eq("scelto resta scelto", leggiVerso("a"), "rtl");
  scriviVerso("a", "ltr");
  t.eq("… anche tornando indietro, sopra la scheda", leggiVerso("a", "rtl"), "ltr");
  scriviVerso("b", "boh");
  t.eq("un valore storto non si scrive come tale", leggiVerso("b"), "ltr");
  memoria.bc_verso_c = "strano";
  t.eq("… e uno storto in memoria vale il ripiego", leggiVerso("c", "rtl"), "rtl");
  t.eq("l'adattamento parte da «intera»", leggiAdatta(), "intera");
  scriviAdatta("larghezza");
  t.eq("… e si ricorda", leggiAdatta(), "larghezza");
  scriviAdatta("boh");
  t.eq("… un valore storto torna a «intera»", leggiAdatta(), "intera");
  delete globalThis.localStorage;
  t.eq("senza storage non esplode", leggiVerso("a", "rtl"), "rtl");
  t.eq("… nemmeno l'adattamento", leggiAdatta(), "intera");

  // ---- l'archivio intero, nei due formati ----------------------------------
  for (const [nome, bytes] of [
    ["cbz", await cbz(VOCI)],
    ["cbr", aBuffer(rar(VOCI))],
  ]) {
    const a = await apriArchivio(bytes, lettori);
    t.eq(`${nome}: il formato letto dai byte`, a.formato, nome);
    t.eq(`${nome}: le pagine, in ordine e senza rumore`, a.pagine.join(","), "vol/p1.png,vol/p2.png,vol/p10.png");
    t.eq(`${nome}: la scheda si legge`, a.info?.serie, "Prova");
    const p1 = await a.leggi(0);
    t.c(`${nome}: la prima pagina e' un PNG`, p1[0] === 0x89 && p1[1] === 0x50 && p1[2] === 0x4e && p1[3] === 0x47);
    t.eq(`${nome}: … quello giusto (rosso)`, Buffer.from(p1).equals(png(255, 0, 0)), true);
    t.eq(`${nome}: la terza pagina e' p10 (blu)`, Buffer.from(await a.leggi(2)).equals(png(0, 0, 255)), true);
  }
  // un «.cbr» che dentro e' uno zip si apre come zip: il nome non conta
  const finto = await apriArchivio(await cbz(VOCI), lettori);
  t.eq("uno zip chiamato cbr e' un cbz", finto.formato, "cbz");
  t.eq("senza scheda: info null", (await apriArchivio(await cbz([["p1.png", png(1, 2, 3)]]), lettori)).info, null);
  t.eq("un archivio senza immagini ha zero pagine", (await apriArchivio(await cbz([["a.txt", Buffer.from("x")]]), lettori)).pagine.length, 0);
  t.eq("un Uint8Array va bene quanto un ArrayBuffer", (await apriArchivio(new Uint8Array(await cbz(VOCI)), lettori)).pagine.length, 3);
  let errore = "";
  try {
    await apriArchivio(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer, lettori);
  } catch (e) {
    errore = e.message;
  }
  t.eq("un file che non e' un archivio lo dice", errore, "archivio non leggibile");
  errore = "";
  try {
    await apriArchivio(aBuffer(rar(VOCI)), { zip: lettori.zip });
  } catch (e) {
    errore = e.message;
  }
  t.eq("senza il lettore rar si dice quale manca", errore, "manca il lettore rar");
};

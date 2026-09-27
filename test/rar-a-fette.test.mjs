// UN CBR MEMORIZZATO SI LEGGE A FETTE. Qui si prova la parte che sbaglia in
// silenzio: una testata letta storta non da' un errore, sposta la pagina di
// qualche byte e la fa uscire come un'immagine rotta — o peggio, porta la
// pagina sbagliata. Per questo ogni archivio scritto a mano passa ANCHE
// dalla libreria RAR vera (node-unrar-js, lo stesso unrar del browser): se
// la libreria lo accetta, l'archivio e' valido, e le pagine lette a fette
// devono essere IDENTICHE a quelle che estrae lei.
import zlib from "zlib";
import { createRequire } from "module";
import { vociRar, apriRar } from "../src/lib/rarAFette.js";
import { apriArchivio, cbrApribile, CBR_MAX, PERCHE_CBR_GRANDE } from "../src/lib/fumetto.js";

const require = createRequire(import.meta.url);
const unrar = require("node-unrar-js");

// ---- RAR 4 -------------------------------------------------------------------
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
// ogni voce: [nome, dati, {metodo, flags, grande, unicode}]
function rar4(voci, { principale = 0 } = {}) {
  const pezzi = [Buffer.from("Rar!\x1a\x07\x00", "binary"), blocco(0x73, principale, Buffer.alloc(6))];
  for (const [nome, dati, o = {}] of voci) {
    let n = Buffer.from(nome, "utf8");
    // il nome unicode: la forma leggibile, uno zero, e poi la versione
    // compressa — che qui e' spazzatura apposta, non si deve leggere
    if (o.unicode) n = Buffer.concat([n, Buffer.from([0, 0xff, 0x01, 0x42])]);
    const grande = !!o.grande;
    const corpo = Buffer.alloc(25 + (grande ? 8 : 0) + n.length);
    corpo.writeUInt32LE(dati.length, 0);
    corpo.writeUInt32LE(dati.length, 4);
    corpo.writeUInt8(2, 8);
    corpo.writeUInt32LE(zlib.crc32(dati) >>> 0, 9);
    corpo.writeUInt32LE(0, 13);
    corpo.writeUInt8(20, 17);
    corpo.writeUInt8(o.metodo ?? 0x30, 18);
    corpo.writeUInt16LE(n.length, 19);
    corpo.writeUInt32LE(0x20, 21);
    if (grande) {
      corpo.writeUInt32LE(0, 25);
      corpo.writeUInt32LE(0, 29);
    }
    n.copy(corpo, 25 + (grande ? 8 : 0));
    const flags = 0x8000 | (grande ? 0x0100 : 0) | (o.unicode ? 0x0200 : 0) | (o.flags || 0);
    pezzi.push(blocco(0x74, flags, corpo), Buffer.from(dati));
  }
  pezzi.push(blocco(0x7b, 0x4000, Buffer.alloc(0)));
  return Buffer.concat(pezzi);
}

// ---- RAR 5 -------------------------------------------------------------------
function vint(n) {
  const out = [];
  do {
    let b = n % 128;
    n = Math.floor(n / 128);
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return Buffer.from(out);
}
function testa5(campi) {
  const dentro = Buffer.concat([vint(campi.length), campi]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32LE(zlib.crc32(dentro) >>> 0, 0);
  return Buffer.concat([crc, dentro]);
}
function rar5(voci, { volume = false } = {}) {
  const pezzi = [
    Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00]),
    testa5(Buffer.concat([vint(1), vint(0), vint(volume ? 1 : 0)])),
  ];
  for (const [nome, dati, o = {}] of voci) {
    const n = Buffer.from(nome, "utf8");
    const extra = o.cifrato ? Buffer.concat([vint(2), vint(1), vint(0)]) : null;
    const crc = Buffer.alloc(4);
    crc.writeUInt32LE(zlib.crc32(dati) >>> 0, 0);
    const campi = Buffer.concat([
      vint(2),
      vint(0x0002 | (extra ? 0x0001 : 0) | (o.spezzato ? 0x0010 : 0)),
      ...(extra ? [vint(extra.length)] : []),
      vint(dati.length),
      vint(0x0004 | (o.cartella ? 0x0001 : 0)),
      vint(dati.length),
      vint(0x20),
      crc,
      // il bit 6 e' «solido»: un file memorizzato in un archivio solido lo ha
      // acceso, e resta memorizzato — il metodo sta nei bit 7-9
      vint(((o.metodo ?? 0) << 7) | (o.solido ? 0x40 : 0)),
      vint(0),
      vint(n.length),
      n,
      ...(extra ? [extra] : []),
    ]);
    pezzi.push(testa5(campi), Buffer.from(dati));
  }
  pezzi.push(testa5(Buffer.concat([vint(5), vint(0), vint(0)])));
  return Buffer.concat(pezzi);
}

const pagina = (seme, lunga = 300) => Buffer.from(Array.from({ length: lunga }, (_, i) => (i * 31 + seme) % 256));
// una testata di PNG davanti, cosi' una pagina spostata di un byte non
// torna identica per caso
const png = (seme, lunga) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), pagina(seme, lunga)]);
const INFO = Buffer.from("<ComicInfo><Series>Kill Six Billion Demons</Series><Number>2</Number></ComicInfo>");
const VOCI = [
  ["KSBD/p10.png", png(3)],
  ["KSBD/p2.png", png(2, 70000)], // piu' lunga del pezzo che si legge per le testate
  ["KSBD/p1.png", png(1)],
  ["ComicInfo.xml", INFO],
];

const blob = (b) => new Blob([b]);
const buf = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

// quel che estrae la libreria vera, voce per voce
async function vero(bytes) {
  const nuovo = () => unrar.createExtractorFromData({ data: buf(bytes) });
  const nomi = [...(await nuovo()).getFileList().fileHeaders].filter((h) => !h.flags?.directory).map((h) => h.name);
  const out = new Map();
  for (const n of nomi) for (const f of (await nuovo()).extract({ files: [n] }).files) out.set(n.replace(/\\/g, "/"), Buffer.from(f.extraction));
  return out;
}

export default async (t) => {
  for (const [famiglia, costruisci] of [
    ["RAR 4", rar4],
    ["RAR 5", rar5],
  ]) {
    const bytes = costruisci(VOCI);
    const atteso = await vero(bytes);
    t.eq(`${famiglia}: la libreria vera accetta l'archivio`, atteso.size, 4);
    const a = await apriRar(blob(bytes));
    t.c(`${famiglia}: si apre a fette`, !!a);
    t.eq(`${famiglia}: gli stessi nomi`, [...a.nomi].sort().join(","), [...atteso.keys()].sort().join(","));
    for (const [nome, dati] of atteso) {
      t.c(`${famiglia}: «${nome}» identico byte per byte`, Buffer.from(await a.leggi(nome)).equals(dati));
    }
    // dal lettore dei fumetti: niente wasm, e le pagine nell'ordine giusto
    const arch = await apriArchivio(blob(bytes));
    t.eq(`${famiglia}: le pagine in ordine senza il lettore rar`, arch.pagine.join(","), "KSBD/p1.png,KSBD/p2.png,KSBD/p10.png");
    t.eq(`${famiglia}: la scheda si legge`, arch.info?.serie, "Kill Six Billion Demons");
    t.c(`${famiglia}: la seconda pagina e' la p2`, Buffer.from(await arch.leggi(1)).equals(png(2, 70000)));
  }

  // ---- RAR 4: le forme che cambiano dove stanno i byte --------------------
  {
    const bytes = rar4([
      ["a\\p1.png", png(7), { grande: true }],
      ["a\\p2.png", png(8), { unicode: true }],
      ["a", Buffer.alloc(0), { flags: 0x00e0 }],
    ]);
    const a = await apriRar(blob(bytes));
    // le barre di Windows diventano barre, e la cartella non e' una voce
    t.eq("le barre di Windows e niente cartelle", [...a.nomi].join(","), "a/p1.png,a/p2.png");
    // con la misura «grande» il nome sta otto byte piu' in la'
    t.c("la testata dei file grandi", Buffer.from(await a.leggi("a/p1.png")).equals(png(7)));
    // del nome unicode vale la parte prima dello zero
    t.c("il nome unicode", Buffer.from(await a.leggi("a/p2.png")).equals(png(8)));
  }

  // ---- quel che a fette NON si legge ---------------------------------------
  const soloPagine = (n) => /\.png$/.test(n);
  t.eq("RAR 4: una pagina compressa → l'altra strada", await apriRar(blob(rar4([["p1.png", png(1), { metodo: 0x33 }]])), { eImmagine: soloPagine }), null);
  t.eq("RAR 4: una pagina cifrata → l'altra strada", await apriRar(blob(rar4([["p1.png", png(1), { flags: 0x0004 }]])), { eImmagine: soloPagine }), null);
  t.eq("RAR 4: una pagina spezzata fra volumi", await apriRar(blob(rar4([["p1.png", png(1), { flags: 0x0002 }]])), { eImmagine: soloPagine }), null);
  t.eq("RAR 4: un archivio a volumi", await apriRar(blob(rar4([["p1.png", png(1)]], { principale: 0x0001 }))), null);
  t.eq("RAR 4: le testate cifrate", await apriRar(blob(rar4([["p1.png", png(1)]], { principale: 0x0080 }))), null);
  t.eq("RAR 5: una pagina compressa", await apriRar(blob(rar5([["p1.png", png(1), { metodo: 3 }]])), { eImmagine: soloPagine }), null);
  t.eq("RAR 5: una pagina cifrata", await apriRar(blob(rar5([["p1.png", png(1), { cifrato: true }]])), { eImmagine: soloPagine }), null);
  t.eq("RAR 5: una pagina spezzata", await apriRar(blob(rar5([["p1.png", png(1), { spezzato: true }]])), { eImmagine: soloPagine }), null);
  t.eq("RAR 5: un archivio a volumi", await apriRar(blob(rar5([["p1.png", png(1)]], { volume: true }))), null);
  {
    const solido = rar5([["p1.png", png(1), { solido: true }]]);
    t.eq("RAR 5 solido: la libreria vera lo accetta", (await vero(solido)).size, 1);
    const a = await apriRar(blob(solido));
    t.c("RAR 5 solido: il file memorizzato resta a fette", !!a && Buffer.from(await a.leggi("p1.png")).equals(png(1)));
  }
  {
    const r5 = await apriRar(blob(rar5([["d", Buffer.alloc(0), { cartella: true }], ["d/p1.png", png(1)]])));
    t.eq("RAR 5: la cartella non e' una voce", r5.nomi.join(","), "d/p1.png");
  }
  // la scheda compressa non ferma il volume: manca e basta
  {
    const a = await apriRar(blob(rar4([["p1.png", png(1)], ["ComicInfo.xml", INFO, { metodo: 0x33 }]])), { eImmagine: soloPagine });
    t.c("la scheda compressa non ferma le pagine", !!a);
    t.eq("… e semplicemente manca", a.nomi.join(","), "p1.png");
  }
  // il rumore compresso non conta: conta solo quel che e' una pagina
  {
    const a = await apriRar(blob(rar4([["p1.png", png(1)], ["Thumbs.db", Buffer.from("xx"), { metodo: 0x33 }]])), { eImmagine: soloPagine });
    t.c("un file di rumore compresso non ferma il volume", !!a);
  }
  t.eq("uno zip non e' un rar", await vociRar(blob(Buffer.from("PK\x03\x04xxxxxxxx", "binary"))), null);
  t.eq("un voce inesistente si dice", await (await apriRar(blob(rar4(VOCI)))).leggi("nulla").catch((e) => e.message), "voce non trovata: nulla");

  // ---- IL TETTO VALE SOLO PER I COMPRESSI ----------------------------------
  // un CBR «da un giga»: la misura finta e le fette vere, senza allocare un
  // giga nel test — le testate stanno in cima, e la fine dell'archivio
  // ferma la lettura prima della coda
  class Grosso extends Blob {
    get size() {
      return CBR_MAX + 1;
    }
  }
  const grosso = (bytes) => new Grosso([bytes]);
  t.c("un CBR grande memorizzato si apre", await cbrApribile(grosso(rar4(VOCI))));
  t.c("… anche RAR 5", await cbrApribile(grosso(rar5(VOCI))));
  t.c("un CBR grande compresso no", !(await cbrApribile(grosso(rar4([["p1.png", png(1), { metodo: 0x33 }]])))));
  t.c("un CBR piccolo compresso si': ci pensa la libreria", await cbrApribile(blob(rar4([["p1.png", png(1), { metodo: 0x33 }]]))));
  // e il lettore, davanti a un grande compresso, dice perche'
  let perche = "";
  try {
    await apriArchivio(grosso(rar4([["p1.png", png(1), { metodo: 0x33 }]])), { rar: async () => unrar });
  } catch (e) {
    perche = e.message;
  }
  t.eq("il grande compresso si rifiuta con la ragione", perche, PERCHE_CBR_GRANDE);
};

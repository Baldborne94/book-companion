// UN FUMETTO DA UN GIGA SI LEGGE A FETTE (segnalato dal lettore: «il volume
// 3 di hellboy e' piu' di un gb e non riesco a caricarlo»). L'import e il
// lettore caricavano l'archivio INTERO in memoria — due o tre volte — e la
// scheda del tablet moriva muta. Qui si prova che:
// - lo zip si legge dall'indice in fondo e una voce per volta, in memorizzato
//   e in deflate, e anche nella forma ZIP64 degli archivi oltre i 4 GB;
// - `apriArchivio` NON chiede mai i byte dell'intero volume;
// - un CBR troppo grande si rifiuta PRIMA di leggerlo, con la strada scritta;
// - l'impronta di un file enorme si prende a campioni, senza leggerlo tutto.
import { createRequire } from "module";
import { deflateRawSync } from "zlib";
import { voci, apriZip } from "../src/lib/zipAFette.js";
import { apriArchivio, cbrTroppoGrande, CBR_MAX, PERCHE_CBR_GRANDE } from "../src/lib/fumetto.js";
import { improntaDi, impronta, IMPRONTA_INTERA, importFiles } from "../src/lib/importBook.js";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");

const testo = (s) => new TextEncoder().encode(s);
const uguali = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

async function zipDi(voci, opzioni = {}) {
  const z = new JSZip();
  for (const [n, d, o] of voci) z.file(n, d, o);
  return new Blob([await z.generateAsync({ type: "uint8array", ...opzioni })]);
}

// Uno ZIP64 scritto a mano: una voce memorizzata, coi campi a «tutti uno»
// nella directory centrale e i numeri veri nel campo extra, poi il record
// ZIP64 di chiusura, il suo localizzatore e la chiusura classica coi campi
// pieni. JSZip non ne scrive, e quelli veri pesano quattro giga.
export function zip64(nome, dati) {
  const n = testo(nome);
  const parti = [];
  let pos = 0;
  const metti = (u8) => {
    parti.push(u8);
    pos += u8.length;
  };
  const buf = (len, scrivi) => {
    const u = new Uint8Array(len);
    scrivi(new DataView(u.buffer));
    return u;
  };
  const u64 = (dv, o, v) => {
    dv.setUint32(o, v % 2 ** 32, true);
    dv.setUint32(o + 4, Math.floor(v / 2 ** 32), true);
  };
  const locale = pos;
  metti(
    buf(30, (dv) => {
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 45, true);
      dv.setUint32(18, dati.length, true);
      dv.setUint32(22, dati.length, true);
      dv.setUint16(26, n.length, true);
      // un extra locale di 7 byte, piu' lungo di quello centrale che non
      // ha niente del genere: fidarsi della directory centrale sposterebbe
      // l'inizio della pagina
      dv.setUint16(28, 7, true);
    })
  );
  metti(n);
  metti(new Uint8Array(7));
  metti(dati);
  const centrale = pos;
  const extra = buf(4 + 24, (dv) => {
    dv.setUint16(0, 0x0001, true);
    dv.setUint16(2, 24, true);
    u64(dv, 4, dati.length);
    u64(dv, 12, dati.length);
    u64(dv, 20, locale);
  });
  metti(
    buf(46, (dv) => {
      dv.setUint32(0, 0x02014b50, true);
      dv.setUint16(6, 45, true);
      dv.setUint32(20, 0xffffffff, true);
      dv.setUint32(24, 0xffffffff, true);
      dv.setUint16(28, n.length, true);
      dv.setUint16(30, extra.length, true);
      dv.setUint32(42, 0xffffffff, true);
    })
  );
  metti(n);
  metti(extra);
  const lung = pos - centrale;
  const record = pos;
  metti(
    buf(56, (dv) => {
      dv.setUint32(0, 0x06064b50, true);
      u64(dv, 4, 44);
      u64(dv, 24, 1);
      u64(dv, 32, 1);
      u64(dv, 40, lung);
      u64(dv, 48, centrale);
    })
  );
  metti(
    buf(20, (dv) => {
      dv.setUint32(0, 0x07064b50, true);
      u64(dv, 8, record);
      dv.setUint32(16, 1, true);
    })
  );
  metti(
    buf(22, (dv) => {
      dv.setUint32(0, 0x06054b50, true);
      dv.setUint16(8, 0xffff, true);
      dv.setUint16(10, 0xffff, true);
      dv.setUint32(12, 0xffffffff, true);
      dv.setUint32(16, 0xffffffff, true);
    })
  );
  return new Blob(parti);
}

// La spia: conta quante volte si chiedono i byte dell'INTERO archivio. Le
// fette sono Blob nuovi e non passano di qui — ed e' proprio il punto.
class Spia extends Blob {
  constructor(parti, finta) {
    super(parti);
    this.intere = 0;
    this.finta = finta;
  }
  get size() {
    return this.finta ?? super.size;
  }
  arrayBuffer() {
    this.intere++;
    return super.arrayBuffer();
  }
}

export default async (t) => {
  // ---- memorizzato e deflate -------------------------------------------------
  const pagina = new Uint8Array(4000).map((_, i) => (i * 7) % 251);
  const misto = await zipDi([
    ["vol/p1.jpg", pagina, { compression: "STORE" }],
    ["vol/p2.jpg", pagina, { compression: "DEFLATE" }],
    ["vol/", null, { dir: true }],
  ]);
  const z = await apriZip(misto);
  t.eq("le cartelle non sono voci", z.nomi.join(","), "vol/p1.jpg,vol/p2.jpg");
  t.c("una pagina memorizzata esce uguale", uguali(await z.leggi("vol/p1.jpg"), pagina));
  t.c("una pagina deflate esce uguale", uguali(await z.leggi("vol/p2.jpg"), pagina));
  const elenco = await voci(misto);
  t.eq("la deflate e' davvero compressa", elenco.find((v) => v.nome === "vol/p2.jpg").metodo, 8);
  t.c("una voce che non c'e' si rifiuta", /assente/.test(await z.leggi("nessuna").then(() => "", (e) => e.message)));

  // ---- un commento in coda allo zip ------------------------------------------
  // la chiusura va cercata dal fondo e SCAVALCANDO il commento: con la sola
  // posizione fissa (fine meno 22) non si troverebbe
  const commentato = await zipDi([["p1.png", pagina]], { comment: "scansione di prova ".repeat(40) });
  t.c("uno zip col commento si apre", uguali(await (await apriZip(commentato)).leggi("p1.png"), pagina));

  // ---- lo ZIP64 ---------------------------------------------------------------
  const grosso = zip64("p001.jpg", pagina);
  const z64 = await apriZip(grosso);
  t.eq("lo zip64 dice la sua voce", z64.nomi.join(","), "p001.jpg");
  t.c("e la legge dalla testata LOCALE, non dalla centrale", uguali(await z64.leggi("p001.jpg"), pagina));

  // ---- un file che non e' uno zip ---------------------------------------------
  t.c("un file qualunque non e' uno zip", /non e' uno zip/.test(await apriZip(new Blob([testo("ciao, non sono uno zip")])).then(() => "", (e) => e.message)));

  // ---- apriArchivio non chiede mai il volume intero ---------------------------
  const INFO = "<ComicInfo><Series>Hellboy</Series><Number>3</Number></ComicInfo>";
  const cbzBytes = await (await zipDi([
    ["p10.jpg", testo("dieci")],
    ["p2.jpg", testo("due")],
    ["p1.jpg", testo("uno")],
    ["ComicInfo.xml", testo(INFO)],
  ])).arrayBuffer();
  const spia = new Spia([cbzBytes]);
  const a = await apriArchivio(spia, { rar: async () => ({}) });
  t.eq("le pagine in ordine naturale", a.pagine.join(","), "p1.jpg,p2.jpg,p10.jpg");
  t.eq("la scheda si legge", a.info?.serie, "Hellboy");
  t.eq("una pagina si legge", new TextDecoder().decode(await a.leggi(2)), "dieci");
  t.eq("e il volume intero non si e' mai chiesto", spia.intere, 0);
  // i byte gia' in mano (i test di prima, e chi li ha) continuano a valere
  t.eq("un ArrayBuffer si apre ancora", (await apriArchivio(cbzBytes, {})).pagine.length, 3);

  // ---- il CBR troppo grande ---------------------------------------------------
  t.c("un CBR sopra il tetto e' troppo grande", cbrTroppoGrande("cbr", CBR_MAX + 1));
  t.c("uno al tetto no", !cbrTroppoGrande("cbr", CBR_MAX));
  t.c("un CBZ grande quanto vuoi no: si legge a fette", !cbrTroppoGrande("cbz", 5 * 1024 ** 3));
  t.c("la frase dice la strada", /CBZ/.test(PERCHE_CBR_GRANDE) && /\.cbz/.test(PERCHE_CBR_GRANDE));
  // un RAR da «un giga» (la misura e' finta, la firma vera): si rifiuta
  // prima di chiedere i byte e prima ancora di scaricare il wasm
  const rarGrande = new Spia([new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 7, 0, 0])], 1.2 * 1024 ** 3);
  let wasm = 0;
  const rifiuto = await apriArchivio(rarGrande, { rar: async () => (wasm++, {}) }).then(() => "", (e) => e.message);
  t.eq("il CBR da un giga si rifiuta con la frase", rifiuto, PERCHE_CBR_GRANDE);
  t.eq("senza leggerlo", rarGrande.intere, 0);
  t.eq("e senza scaricare il wasm", wasm, 0);

  // ---- e l'import lo rifiuta prima di leggerlo ----------------------------------
  // il caso del lettore, alla lettera: un «.cbr» da piu' di un giga. Senza
  // la guardia l'import chiederebbe subito i byte interi per l'impronta
  class FileGrande extends File {
    constructor(nome, misura, testa) {
      super([testa], nome);
      this.misura = misura;
      this.intere = 0;
    }
    get size() {
      return this.misura;
    }
    arrayBuffer() {
      this.intere++;
      return super.arrayBuffer();
    }
  }
  const hellboy = new FileGrande("Hellboy v03.cbr", 1.2 * 1024 ** 3, new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 7, 1, 0]));
  const esito = await importFiles([hellboy], []);
  t.eq("l'import non lo fa entrare", esito.added.length, 0);
  t.eq("e dice perche'", esito.errors[0]?.reason, PERCHE_CBR_GRANDE);
  t.eq("senza averlo letto", hellboy.intere, 0);

  // ---- l'impronta a campioni ----------------------------------------------------
  const piccolo = new Blob([testo("un fumetto piccolo")]);
  t.eq("sotto la soglia e' l'impronta di sempre", await improntaDi(piccolo), await impronta(await piccolo.arrayBuffer()));
  // un file «enorme»: la misura finta, le fette che dicono da dove vengono
  class Enorme extends Spia {
    constructor(misura, diverso = -1) {
      super([], misura);
      this.diverso = diverso;
    }
    slice(a, b) {
      return new Blob([testo(`${a}-${b}${a === this.diverso ? "!" : ""}`)]);
    }
  }
  const e1 = new Enorme(IMPRONTA_INTERA + 10);
  const imp1 = await improntaDi(e1);
  t.c("sopra la soglia porta il suo prefisso", /^c:[0-9a-f]{64}$/.test(imp1 || ""), imp1);
  t.eq("senza chiedere il file intero", e1.intere, 0);
  t.eq("e' la stessa a ogni giro", await improntaDi(new Enorme(IMPRONTA_INTERA + 10)), imp1);
  t.c("una misura diversa e' un'altra impronta", (await improntaDi(new Enorme(IMPRONTA_INTERA + 11))) !== imp1);
  const mezzo = Math.floor((4 * (IMPRONTA_INTERA + 10)) / 9);
  t.c("una fetta di mezzo diversa e' un'altra impronta", (await improntaDi(new Enorme(IMPRONTA_INTERA + 10, mezzo))) !== imp1);
  t.eq("niente file, niente impronta", await improntaDi(null), null);
};

// UN CBR MEMORIZZATO SI LEGGE A FETTE. Qui si prova la parte che sbaglia in
// silenzio: una testata letta storta non da' un errore, sposta la pagina di
// qualche byte e la fa uscire come un'immagine rotta — o peggio, porta la
// pagina sbagliata. Per questo ogni archivio scritto a mano passa ANCHE
// dalla libreria RAR vera (node-unrar-js, lo stesso unrar del browser): se
// la libreria lo accetta, l'archivio e' valido, e le pagine lette a fette
// devono essere IDENTICHE a quelle che estrae lei.
import { createRequire } from "module";
import { rar4, rar5 } from "./rar-finto.mjs";
import { vociRar, apriRar } from "../src/lib/rarAFette.js";
import { fileRemoto } from "../src/lib/drive.js";
import { apriArchivio, cbrApribile, CBR_MAX, PERCHE_CBR_GRANDE, primaPaginaRar, cbrLontanoApribile } from "../src/lib/fumetto.js";

const require = createRequire(import.meta.url);
const unrar = require("node-unrar-js");

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

  // ---- LA PRIMA PAGINA DI UN CBR LONTANO ---------------------------------------
  // (i Lobster Johnson su Drive: dorso disegnato e minuti di attesa) — da Drive
  // ogni fetta e' una richiesta, quindi si contano
  const contato = (bytes, finta = null) => {
    const b = new Blob([bytes]);
    const conta = { n: 0 };
    const pezzo = (da, a) => ({
      arrayBuffer: async () => {
        conta.n += 1;
        return b.slice(da, a).arrayBuffer();
      },
    });
    return { conta, blob: { size: finta ?? b.size, slice: (da, a) => pezzo(da, a) } };
  };
  const molte = [["ComicInfo.xml", INFO], ...Array.from({ length: 40 }, (_, i) => [`p${String(i + 1).padStart(2, "0")}.png`, png(i + 1, 90000)])];
  for (const [famiglia, costruisci] of [
    ["RAR 4", rar4],
    ["RAR 5", rar5],
  ]) {
    const lontano = contato(costruisci(molte));
    const p = await primaPaginaRar(lontano.blob);
    t.eq(`${famiglia}: la prima pagina, saltata la scheda`, p?.nome, "p01.png");
    t.c(`${famiglia}: …coi suoi byte giusti`, Buffer.from(p?.bytes || []).equals(png(1, 90000)));
    // col lettore vero di Drive (`fileRemoto`, pezzi da 256 KB tenuti in
    // memoria) i viaggi in rete sono quelli che contano
    const byte = costruisci(molte);
    let viaggi = 0;
    const remoto = fileRemoto("f", byte.length, {
      prendi: async (da, a) => {
        viaggi += 1;
        return { da, buf: new Uint8Array(byte.subarray(da, a)) };
      },
    });
    t.eq(`${famiglia}: da Drive la prima pagina e' la stessa`, (await primaPaginaRar(remoto))?.nome, "p01.png");
    t.c(`${famiglia}: …con uno o due viaggi in rete, non uno per pagina`, viaggi <= 2, `viaggi: ${viaggi}`);
    const tutto = contato(costruisci(molte));
    await apriRar(tutto.blob, { eImmagine: soloPagine });
    t.c(`${famiglia}: (camminare tutto l'archivio ne costa una per pagina)`, tutto.conta.n > 40, `richieste: ${tutto.conta.n}`);
  }
  const compresso = await primaPaginaRar(blob(rar4([["p1.png", png(1), { metodo: 0x33 }], ["p2.png", png(2)]])));
  t.eq("una prima pagina compressa si dice, senza byte", `${compresso?.compressa}:${!!compresso?.bytes}`, "true:false");
  t.eq("uno zip non ha una prima pagina RAR", await primaPaginaRar(blob(Buffer.from("PK\x03\x04xxxxxxxx", "binary"))), null);

  // ---- APRIBILE, PRIMA DI SCARICARLO ----------------------------------------------
  t.c("lontano, grande e memorizzato: si apre", await cbrLontanoApribile(contato(rar4(VOCI), CBR_MAX + 1).blob));
  t.c("lontano, grande e compresso: no, e lo si sa subito", !(await cbrLontanoApribile(contato(rar5([["p1.png", png(1), { metodo: 3 }]]), CBR_MAX + 1).blob)));
  const piccolo = contato(rar4([["p1.png", png(1), { metodo: 0x33 }]]));
  t.c("piccolo e compresso: si apre, ci pensa la libreria", await cbrLontanoApribile(piccolo.blob));
  t.eq("…e non si chiede niente a Drive", piccolo.conta.n, 0);
  t.c("se non si sa, si prova", await cbrLontanoApribile(contato(Buffer.from("PK\x03\x04xxxxxxxx", "binary"), CBR_MAX + 1).blob));
};

// UN CBR COMPRESSO SI CONVERTE IN CBZ A FETTE (`lib/rarInCbz.js`,
// `lib/zipScritto.js`). Sbaglia in silenzio in tre modi: una pagina che
// esce storta (lo zip si apre, l'immagine no), un ordine cambiato (il segno
// di lettura punterebbe a un'altra pagina), e l'archivio letto piu' di una
// volta o tutto insieme (la memoria che la conversione deve risparmiare).
//
// GLI ARCHIVI QUI SOTTO SONO RAR COMPRESSI VERI, fatti col programma RAR
// (`rar a -m5`, e `-s` per il solido): la compressione di RAR non si
// scrive a mano come le testate di `rar-finto.mjs`. Dentro: Tomo/p1.png,
// p2.png, p10.png (una testata PNG e «pagina N» ripetuto), Tomo/Thumbs.db
// e ComicInfo.xml (Series Tomo, Number 3).
import { createRequire } from "module";
import JSZip from "jszip";
import { rarInCbz, aFinestre, estrattore } from "../src/lib/rarInCbz.js";
import { nuovoZip, crc32 } from "../src/lib/zipScritto.js";
import { apriArchivio, pagineDa } from "../src/lib/fumetto.js";

const require = createRequire(import.meta.url);
const { Extractor } = require("node-unrar-js");
const { getUnrar } = require("node-unrar-js/dist/js/unrar.singleton.js");

const NORMALE = "UmFyIRoHAQDz4YLrCwEFBwAGAQGAgIAAVwRVzykCAwuoAASUFaSDAsOQTZKABQELVG9tby9wMS5wbmcKAxOKD71qVfS9JMW6JTQEL7InmxARRBSFCzEFFGEmIaX+GevldavmHMkLqvNpWUG8CRDFi55jKgIDC6gABJQVpIMCrPmA+4AFAQxUb21vL3AxMC5wbmcKAxOKD71qz8m+JMW6JTQEL7InmxARRByECzEFFGEmIaX+GevldavmHMkLqvNpWUG8CRDdmTXgLAIDC5YABKwCpIMCmMdkTIAFAQ5Ub21vL1RodW1icy5kYgoDE4oPvWo7CL8kxI0TIzP8Mm1vMYKGf6XqEnEdh7iMmG0lfAApAgMLqAAElBWkgwI7zt4igAUBC1RvbW8vcDIucG5nCgMTig+9avJ/viTFuiU0BC+yJ5sQEUQYhIsxBRRhJiGl/hnr5XWr5hzJC6rzaVlBvAkQohU1ySsCAwu8AAS+AKSDAma924qABQENQ29taWNJbmZvLnhtbAoDE4oPvWpWjr8kwKM5JVQy+jPJGhthKWppaVwJRQlEeBR3+uUwHHvdwfynx7LikFTE96BlXPEz07BQUHwVPLdkcW5csPqAcxsgHhwCAwsAAQDtgwGAAAEEVG9tbwoDE4oPvWrPyb4kHXdWUQMFBAA=";
const SOLIDO = "UmFyIRoHAQAJ78hvCwEFBwQGAQGAgIAAi0sdcysCAwvOAAS+AKSDAma924qAHQENQ29taWNJbmZvLnhtbAoDE4oPvWpWjr8kwtNLJmVDL5M74DgLVMDRZbxKWhGmCC4DFIpKJOSJMIdx6mAkwZt6/j7uO9f7IP/q/8mDEYP4zjyKw1dJ7vF7DAQupoDJw3JLUXGhIfJAgsMIAiwCAwuJAASsAqSDApjHZEzAHQEOVG9tby9UaHVtYnMuZGIKAxOKD71qOwi/JEYaBpTL+Tv5Mqo+vIApAgMLkwAElBWkgwLDkE2SwB0BC1RvbW8vcDEucG5nCgMTig+9alX0vSRCCBD3RmViLUdt6fFqb0mbg0gAah85xCoCAwuKAASUFaSDAqz5gPvAHQEMVG9tby9wMTAucG5nCgMTig+9as/JviRHGgeq0lJM3BpAaxZGTSkCAwuLAASUFaSDAjvO3iLAHQELVG9tby9wMi5wbmcKAxOKD71q8n++JEASCKrSwSZuDSAAW/coUxwCAwsAAQDtgwHAAAEEVG9tbwoDE4oPvWrPyb4kHXdWUQMFBAA=";

const pagina = (i) => Buffer.concat([Buffer.from("\x89PNG\r\n\x1a\n", "binary"), Buffer.from(`pagina ${i} `.repeat(300))]);
const tieni = (nome) => pagineDa([nome]).length > 0 || /comicinfo\.xml$/i.test(nome);

export default async (t) => {
  const unrar = await getUnrar();
  for (const [nome, b64] of [
    ["normale", NORMALE],
    ["solido", SOLIDO],
  ]) {
    const rar = Buffer.from(b64, "base64");
    let chiesti = 0;
    let viaggi = 0;
    const leggi = aFinestre((da, a) => {
      viaggi += 1;
      chiesti += a - da;
      return rar.subarray(da, a);
    }, rar.length, 64);
    const passi = [];
    const cbz = rarInCbz({ unrar, Extractor, leggi, misura: rar.length, tieni, onProgress: (p) => passi.push(p) });
    const a = await apriArchivio(cbz);
    t.eq(`${nome}: esce un CBZ`, a.formato, "cbz");
    t.eq(`${nome}: le pagine nello stesso ordine, coi nomi di prima`, a.pagine.join(), "Tomo/p1.png,Tomo/p2.png,Tomo/p10.png");
    // p10 e' la terza pagina, e dentro dice «pagina 3»
    for (const i of [0, 1, 2]) t.c(`${nome}: pagina ${i + 1} identica`, Buffer.from(await a.leggi(i)).equals(pagina(i + 1)));
    t.eq(`${nome}: la scheda ComicInfo passa`, a.info?.numero, 3);
    const z = await JSZip.loadAsync(Buffer.from(await cbz.arrayBuffer()), { checkCRC32: true });
    t.c(`${nome}: il rumore resta fuori`, !Object.keys(z.files).some((k) => /Thumbs/.test(k)), Object.keys(z.files).join());
    t.eq(`${nome}: lo zip e' valido anche per JSZip, CRC compresi`, Object.keys(z.files).length, 4);
    // la libreria rilegge le testate all'apertura: le finestre qui sono da
    // 64 byte, e il conto resta sotto due volte l'archivio
    t.c(`${nome}: l'archivio non si rilegge da capo`, chiesti < 2 * rar.length, `${chiesti} byte chiesti su ${rar.length}`);
    t.c(`${nome}: a finestre, non tutto insieme`, viaggi > 3, `${viaggi} letture`);
    t.eq(`${nome}: l'avanzamento conta le pagine, non la scheda`, passi.at(-1)?.pagine, 3);
    t.c(`${nome}: …e i byte letti`, passi.at(-1)?.letti > 0 && passi.at(-1)?.letti <= rar.length && passi.at(-1)?.misura === rar.length);
  }

  // ---- un RAR troncato (lo scaricamento interrotto, il file copiato a meta'):
  // la libreria legge oltre la fine e deve sentirsi dire -1, come dalla sua
  // lettura in memoria, non un'eccezione che porta via la conversione
  const intero = Buffer.from(NORMALE, "base64");
  const troncato = intero.subarray(0, intero.length - 8);
  const daTroncato = rarInCbz({ unrar, Extractor, leggi: aFinestre((da, a) => troncato.subarray(da, a), troncato.length, 64), misura: troncato.length, tieni });
  t.eq("un RAR senza la coda si converte lo stesso", (await apriArchivio(daTroncato)).pagine.length, 3);

  // ---- l'estrattore, a mano: il contratto della lettura in memoria ----------------
  const finto = { HEAPU8: new Uint8Array(64) };
  const dieci = Uint8Array.from({ length: 10 }, (_, i) => i + 1);
  const ex = estrattore(class { constructor(u) { this.unrar = u; } }, finto, (pos, n) => dieci.subarray(pos, pos + n), 10);
  t.eq("l'archivio e' il file 1", ex.open("_bc_.rar"), 1);
  t.eq("oltre la fine: -1", ex.read(1, 0, 11), -1);
  t.eq("dentro: i byte al loro posto", ex.read(1, 0, 4) + ":" + Array.from(finto.HEAPU8.subarray(0, 4)).join(), "4:1,2,3,4");
  t.eq("tell dice dove si e'", ex.tell(1), 4);
  ex.seek(1, 2, "CUR");
  t.eq("seek dal punto", ex.tell(1), 6);
  ex.seek(1, 3, "END");
  t.eq("seek dalla fine", ex.tell(1), 7);
  ex.seek(1, 1, "SET");
  t.eq("seek dall'inizio", ex.tell(1), 1);
  t.eq("seek oltre la fine: no, e si resta dove si era", String(ex.seek(1, 11, "SET")) + ex.tell(1), "false1");
  ex.closeFile(1);
  t.eq("chiuso, l'archivio torna all'inizio", ex.tell(1), 0);

  // ---- le finestre -------------------------------------------------------------
  const dati = Uint8Array.from({ length: 1000 }, (_, i) => i % 251);
  let prese = 0;
  const f = aFinestre((da, a) => {
    prese += 1;
    return dati.subarray(da, a);
  }, dati.length, 100);
  t.eq("una lettura prende una finestra", Array.from(f(10, 5)).join(), "10,11,12,13,14");
  f(20, 30);
  t.eq("…e quelle dentro la finestra non tornano al disco", prese, 1);
  t.eq("fuori dalla finestra se ne prende un'altra", f(200, 3)[0], 200 % 251);
  t.eq("…una sola", prese, 2);
  t.eq("una lettura piu' larga della finestra si prende intera", f(500, 300).length, 300);
  let rotta = null;
  try {
    aFinestre(() => new Uint8Array(2), 1000, 100)(0, 10);
  } catch (e) {
    rotta = e;
  }
  t.c("un archivio che da' meno byte non passa in silenzio", !!rotta);

  // ---- lo zip scritto ------------------------------------------------------------
  t.eq("CRC32 come quello di tutti", crc32([new TextEncoder().encode("123456789")]), 0xcbf43926);
  t.eq("…anche a pezzi", crc32([new TextEncoder().encode("1234"), new TextEncoder().encode("56789")]), 0xcbf43926);
  const zz = nuovoZip();
  zz.aggiungi("città/à.txt", [new TextEncoder().encode("ciao "), new TextEncoder().encode("mondo")]);
  const j = await JSZip.loadAsync(Buffer.from(await zz.chiudi().arrayBuffer()), { checkCRC32: true });
  t.eq("i nomi con gli accenti restano", Object.keys(j.files)[0], "città/à.txt");
  t.eq("i pezzi diventano una voce", await j.file("città/à.txt").async("string"), "ciao mondo");
  // i byte, come li legge chi non e' JSZip (Esplora risorse, 7-Zip): il CRC
  // nella testata locale e il nome dichiarato UTF-8, qui e nella directory
  const zb = new Uint8Array(await (() => {
    const z2 = nuovoZip();
    z2.aggiungi("città.txt", [new TextEncoder().encode("ciao")]);
    return z2.chiudi();
  })().arrayBuffer());
  const dv = new DataView(zb.buffer);
  t.eq("la testata locale porta il CRC", dv.getUint32(14, true), crc32([new TextEncoder().encode("ciao")]));
  t.c("…e dice che il nome e' UTF-8", (dv.getUint16(6, true) & 0x0800) !== 0);
  const dir = dv.getUint32(zb.length - 6, true);
  t.c("la directory centrale dice UTF-8 anche lei", dv.getUint32(dir, true) === 0x02014b50 && (dv.getUint16(dir + 8, true) & 0x0800) !== 0);
  let vuoto = null;
  try {
    rarInCbz({ unrar, Extractor, leggi: aFinestre((da, a) => Buffer.from(NORMALE, "base64").subarray(da, a), Buffer.from(NORMALE, "base64").length), misura: Buffer.from(NORMALE, "base64").length, tieni: () => false });
  } catch (e) {
    vuoto = e;
  }
  t.c("un CBR senza pagine non diventa un CBZ vuoto", /non ci sono pagine/.test(vuoto?.message || ""));
};

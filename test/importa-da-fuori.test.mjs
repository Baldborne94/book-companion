// LE SCHEDE DA FILE CHE RESTANO DOVE SONO (il disco del computer,
// `importaDaFuori`): del file si legge solo quel che serve — l'OPF e la
// copertina, la prima pagina di un fumetto — e i byte non entrano nel
// browser. Quel che sbaglia in silenzio, e che qui si prova:
//   - la LETTURA A PEZZI: un pezzo letto storto e' una copertina sbagliata o
//     un titolo mozzato, e un pezzo in piu' e' una lettura in piu';
//   - la SCHEDA: il titolo, la saga, il tipo, l'impronta del tomo grosso,
//     il file che torna nella scheda che l'aveva perso.
import { createRequire } from "module";
import { apriEpubAFette, leggiOpf } from "../src/lib/epubAFette.js";
import { trovaCopertina } from "../src/lib/copertina.js";
import { importaDaFuori, IMPRONTA_INTERA } from "../src/lib/importBook.js";
import { apriArchivio } from "../src/lib/fumetto.js";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");

// un file letto a pezzi, col conto delle letture
function remoto(byte) {
  const giri = [];
  const blob = new Blob([byte]);
  const pezzo = (a = 0, b = byte.length) => {
    const sub = blob.slice(a, b);
    return {
      size: sub.size,
      type: "",
      slice: (x, y) => pezzo(a + (x || 0), y == null ? b : a + y),
      arrayBuffer: async () => {
        giri.push([a, Math.min(b, byte.length)]);
        return sub.arrayBuffer();
      },
    };
  };
  const f = pezzo();
  return { f, giri, scese: () => giri.reduce((n, [da, a]) => n + (a - da), 0) };
}

async function epub({ copertina = "v3", conCollana = true, pesante = 0 } = {}) {
  const z = new JSZip();
  z.file("mimetype", "application/epub+zip", { compression: "STORE" });
  z.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
  );
  const img = new Uint8Array(3000).map((_, i) => (i * 31) % 251);
  z.file("OEBPS/Images/copertina vera.jpg", img, { compression: "STORE" });
  z.file("OEBPS/Images/altra.jpg", new Uint8Array([1, 2, 3]), { compression: "STORE" });
  const riga = "Una riga di romanzo che si ripete. ".repeat(40);
  for (let i = 1; i <= 30; i++) z.file(`OEBPS/c${i}.xhtml`, `<html><body><p>${riga}${i}</p></body></html>`);
  if (pesante) z.file("OEBPS/zavorra.bin", new Uint8Array(pesante).map((_, i) => (i * 7919) % 253), { compression: "STORE" });
  z.file("OEBPS/cover.xhtml", `<html><body><svg><image xlink:href="Images/altra.jpg"/></svg></body></html>`);
  const manifest =
    `<item id="cv" href="cover.xhtml" media-type="application/xhtml+xml"/>` +
    `<item id="img" href="Images/copertina%20vera.jpg" media-type="image/jpeg"${copertina === "v3" ? ' properties="cover-image"' : ""}/>` +
    `<item id="img2" href="Images/altra.jpg" media-type="image/jpeg"/>` +
    Array.from({ length: 30 }, (_, i) => `<item id="c${i + 1}" href="c${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join("");
  const meta =
    `<dc:title>La Torre &amp; il Pozzo</dc:title><dc:creator opf:role="aut">Autrice Prova</dc:creator>` +
    `<dc:description>&lt;p&gt;Un retro vero, scritto dall'editore, che racconta la premessa del romanzo senza svelare niente del finale.&lt;/p&gt;</dc:description>` +
    (copertina === "v2" ? `<meta name="cover" content="img"/>` : "") +
    (conCollana ? `<meta name="calibre:series" content="Le Torri"/><meta name="calibre:series_index" content="2"/>` : "");
  z.file(
    "OEBPS/content.opf",
    `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">${meta}</metadata><manifest>${manifest}</manifest><spine><itemref idref="cv"/>${Array.from({ length: 30 }, (_, i) => `<itemref idref="c${i + 1}"/>`).join("")}</spine></package>`
  );
  return { byte: await z.generateAsync({ type: "uint8array", compression: "DEFLATE" }), img };
}

export default async (t) => {
  // ---- l'OPF ----------------------------------------------------------------------
  {
    const o = leggiOpf(
      `<package><opf:metadata><dcterms:title>Titolo &#8220;uno&#x201D;</dcterms:title><dc:creator>A</dc:creator><dc:creator>B</dc:creator><meta content="i2" name="cover"/></opf:metadata>` +
        `<manifest><opf:item id="i1" href="../img/a.png" properties="nav cover-image"/><item href="b.png" id="i2"/><item id="t" href="testo.xhtml"/></manifest><spine><itemref idref="t"/><itemref idref="manca"/></spine></package>`,
      "OPS/pkg/content.opf"
    );
    t.eq("il titolo con qualunque prefisso, entita' sciolte", o.title, "Titolo “uno”");
    t.eq("l'autore e' il primo", o.creator, "A");
    t.eq("la copertina EPUB 3 vince sul meta di EPUB 2, come in epub.js", o.copertina, "OPS/img/a.png");
    t.eq("la spina coi percorsi dell'archivio, senza voci che non esistono", o.spina.join(","), "OPS/pkg/testo.xhtml");
    t.eq("senza copertina dichiarata, niente", leggiOpf("<package><metadata/></package>").copertina, null);
  }

  // ---- un ePub letto da lontano --------------------------------------------------
  {
    const { byte, img } = await epub({ pesante: 2_000_000 });
    const r = remoto(byte);
    const e = await apriEpubAFette(r.f);
    t.eq("il titolo", e.info.title, "La Torre & il Pozzo");
    t.eq("l'autore", e.info.creator, "Autrice Prova");
    t.c("il retro, ancora da ripulire come all'import", e.info.description.startsWith("<p>Un retro vero"));
    t.c("l'OPF com'e' scritto, per la collana", e.opf.includes("calibre:series"));
    const cover = await trovaCopertina(e.libro);
    const giu = new Uint8Array(await cover.arrayBuffer());
    t.c("la copertina dichiarata, col nome che nell'href ha lo spazio scappato", giu.length === img.length && giu.every((x, i) => x === img[i]));
    t.eq("col suo tipo", cover.type, "image/jpeg");
    t.c(`e scende meno di un terzo del file (${r.scese()} di ${byte.length})`, r.scese() < byte.length / 3);
    // copertina alla EPUB 2
    const e2 = await apriEpubAFette(remoto((await epub({ copertina: "v2" })).byte).f);
    t.c("la copertina del meta EPUB 2", (await trovaCopertina(e2.libro))?.size === 3000);
    // nessuna copertina dichiarata: la pagina di copertina, dentro un SVG
    const e3 = await apriEpubAFette(remoto((await epub({ copertina: "no" })).byte).f);
    t.eq("senza dichiarazione, la prima immagine della pagina di copertina", (await trovaCopertina(e3.libro))?.size, 3);
    // non un ePub
    const z = new JSZip();
    z.file("a.txt", "x");
    t.eq("uno zip senza container non e' un ePub", await apriEpubAFette(remoto(await z.generateAsync({ type: "uint8array" })).f), null);
  }

  // ---- un fumetto letto da lontano ------------------------------------------------
  {
    const z = new JSZip();
    z.file("p10.jpg", new Uint8Array([10]));
    z.file("p2.jpg", new Uint8Array([2]));
    z.file("p1.jpg", new Uint8Array([1, 1, 1]));
    const a = await apriArchivio(remoto(await z.generateAsync({ type: "uint8array" })).f);
    t.eq("un fumetto lontano si apre a fette, come uno del tablet", a.pagine.join(","), "p1.jpg,p2.jpg,p10.jpg");
    t.eq("e la prima pagina e' la prima", [...(await a.leggi(0))].join(","), "1,1,1");
  }

  // ---- la seconda porta: le schede --------------------------------------------------
  {
    const zip = new JSZip();
    zip.file("p1.jpg", new Uint8Array([1]));
    const cbz = await zip.generateAsync({ type: "uint8array" });
    // un file oltre la soglia, letto a pezzi: si contano i pezzi chiesti,
    // perche' la cura e' proprio non scaricarlo intero
    const pezziGrosso = [];
    const grosso = {
      size: IMPRONTA_INTERA + 1,
      slice: (a, b) => ({
        arrayBuffer: async () => {
          pezziGrosso.push([a, b]);
          // pochi byte e non un mega: il test guarda QUALI pezzi si chiedono,
          // e digerire dieci mega vere dentro il tetto di 50 ms del giro
          // (`attesa`) sotto carico non ci stava — l'impronta si perdeva e
          // il test cadeva una volta su due senza che il codice c'entrasse
          return new Uint8Array(16).fill(a % 251).buffer;
        },
      }),
    };
    const apri = (v) => (v.id === "v3" ? grosso : remoto(v.byte || new Uint8Array(0)).f);
    const ordine = [];
    const leggi = async (meta, blob, tipo) => {
      ordine.push(`leggi:${meta.title}`);
      if (meta.title === "Lento") return new Promise(() => {});
      if (tipo === "epub") meta.title = meta.title === "Vero" ? "Il Titolo Vero" : meta.title;
      return { titolo: tipo !== "epub" || meta.title !== "Muto", copertina: tipo === "cbz" };
    };
    const voci = [
      { id: "v1", name: "Vero.epub", size: 100 },
      { id: "v2", name: "Berserk v01.cbr", size: 100, byte: cbz, tipo: "manga" }, // un «cbr» che e' uno zip
      { id: "v3", name: "Muto.epub", size: IMPRONTA_INTERA + 1 },
      { id: "v4", name: "rotto.cbz", size: 10, byte: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) },
      { id: "v6", name: "Lento.pdf", size: 10 },
      { id: "v7", name: "Mort.epub", size: 10 },
    ];
    const passi = [];
    // un corridore fermo si legge come un corridore lento: il giro ha un
    // tetto suo, o togliendo quello del codice il test resterebbe appeso
    const e = await Promise.race([
      importaDaFuori(voci, [{ id: "m", title: "Mort", author: "" }], {
        apri,
        leggi,
        attesa: 50,
        onProgress: (p) => passi.push(p.fatti),
      }),
      new Promise((ok) => setTimeout(() => ok({ appeso: true, added: [], errors: [], sospetti: [] }), 3000)),
    ]);
    t.c("una lettura che non torna non tiene appeso il giro", !e.appeso);
    const per = (n) => e.added.find((b) => b.title === n);
    t.eq("il titolo letto dal file", !!per("Il Titolo Vero"), true);
    // il tomo grosso entrava senza impronta, e il tasto dei doppioni lo
    // contava per sempre senza poterlo servire: si prende a campioni
    t.c("oltre la soglia l'impronta si prende a campioni dal file lontano", /^c:[0-9a-f]{64}$/.test(per("Muto")?.impronta || ""), per("Muto")?.impronta);
    t.c("…senza scaricarlo intero: dieci pezzi da un mega", pezziGrosso.length === 10 && pezziGrosso.every(([a, b]) => b - a <= 1024 * 1024));
    const berserk = per("Berserk v01");
    t.eq("un «cbr» che e' uno zip entra come cbz", berserk?.fileType, "cbz");
    t.eq("col tipo della cartella", berserk?.tipo, "manga");
    t.eq("e la saga dal nome del file, come all'import", `${berserk?.saga} ${berserk?.sagaOrder}`, "Berserk 1");
    t.c("un archivio che non si riconosce non entra", !per("rotto") && e.errors.some((x) => x.name === "rotto.cbz"));
    t.c("una lettura che non torna non ferma niente: entra col nome del file", !!per("Lento"));
    t.eq("e si contano fra i titoli presi dal nome solo le schede entrate", e.senzaMetadati, 2);
    t.c("un titolo gia' in biblioteca entra, ma si dice", !!per("Mort") && e.sospetti.some((x) => x.title === "Mort"));
    t.eq("l'avanzamento, file per file", passi.join(","), "0,1,2,3,4,5");
    // «Mort» lo riconosce la tavola del Mondo Disco: la stessa porta dell'import
    t.eq("le saghe riconosciute sono quelle delle schede entrate", e.added.filter((b) => b.saga).map((b) => b.title).join(","), "Berserk v01,Mort");
    // la parte di JoJo entra come ciclo, dal nome del file
    const jojo = await importaDaFuori([{ id: "jj", name: "JoJo's_Bizarre_Adventure_Part_5_v16_The_Requiem.cbz", size: 100, byte: cbz }], [], { apri, leggi });
    t.eq("la parte del nome del file diventa il ciclo", `${jojo.added[0]?.saga}|${jojo.added[0]?.series}|${jojo.added[0]?.sagaOrder}`, "JoJo's Bizarre Adventure|Parte 5|16");
    t.eq("e si contano", e.riconosciuti, 2);
    const fermo = await importaDaFuori(voci, [], { apri, leggi, vivo: () => false });
    t.c("fermato prima di cominciare: niente dentro, e si dice", fermo.fermato && !fermo.added.length);

    // IL FILE TORNA NELLA SCHEDA CHE L'AVEVA PERSO (i Dragonriders del
    // lettore: ogni volume due volte, una scheda col file e una senza)
    const persa = [{ id: "pern", title: "Dragonflight", author: "Anne McCaffrey" }];
    const leggiPern = async (meta) => {
      meta.title = "Dragonflight";
      meta.author = "Anne McCaffrey";
      return { titolo: true, copertina: true };
    };
    const voce = [{ id: "dr", name: "Anne McCaffrey - Dragonflight.epub", size: 10 }];
    const torna = await importaDaFuori(voce, persa, { apri, leggi: leggiPern, senzaFile: (id) => id === "pern", segnato: () => false });
    t.eq("il file della scheda rimasta senza torna dentro di lei", torna.ritrovati.map((r) => r.id).join(), "pern");
    t.eq("…senza fare una scheda nuova", torna.added.length, 0);
    const conSegni = await importaDaFuori(voce, persa, { apri, leggi: leggiPern, senzaFile: () => true, segnato: () => true });
    t.c("una scheda con segni ancorati ad altri byte non lo adotta: entra nuovo, e si dice", conSegni.added.length === 1 && !conSegni.ritrovati.length && conSegni.sospetti.length === 1);
    const colFile = await importaDaFuori(voce, persa, { apri, leggi: leggiPern, senzaFile: () => false, segnato: () => false });
    t.c("una scheda che il suo file ce l'ha non si tocca: e' un'altra copia, e si dice", colFile.added.length === 1 && !colFile.ritrovati.length && colFile.sospetti.length === 1);
    const due = await importaDaFuori([...voce, { id: "dr2", name: "Dragonflight (1).epub", size: 10 }], persa, { apri, leggi: leggiPern, senzaFile: (id) => id === "pern", segnato: () => false });
    t.eq("due file per la stessa scheda: il primo torna a casa, il secondo entra", `${due.ritrovati.length}/${due.added.length}`, "1/1");
  }
}

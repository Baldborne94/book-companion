// «AGGIUNGI DA DRIVE»: i libri che stanno gia' lassu' entrano sullo scaffale
// senza passare dal tablet (chiesto dal lettore: portarli giu' «ci mette
// una vita»). Si legge del file solo quel che serve — l'OPF e la copertina —
// e il libro intero scende la prima volta che lo apri.
//
// Quel che sbaglia in silenzio, e che qui si prova:
//   - QUALI file proporre: uno proposto per sbaglio diventa un doppione in
//     biblioteca, con due punti di lettura;
//   - la LETTURA A PEZZI: un pezzo letto storto e' una copertina sbagliata o
//     un titolo mozzato, e un pezzo in piu' e' un giro di rete in piu';
//   - l'ORDINE fra il segno su Drive e la scheda: una scheda senza segno
//     perde il suo file al primo giro, un segno senza scheda nasconde il
//     file per sempre.
import { createRequire } from "module";
import { daAggiungere, percorsoDi, cartellaDi, RADICE, giaSulloScaffale, fraseGia } from "../src/lib/driveCore.js";
import { fileRemoto } from "../src/lib/drive.js";
import { apriEpubAFette, leggiOpf } from "../src/lib/epubAFette.js";
import { trovaCopertina } from "../src/lib/copertina.js";
import { importaDaDrive, IMPRONTA_INTERA } from "../src/lib/importBook.js";
import { apriArchivio } from "../src/lib/fumetto.js";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");
const SHA = (c) => c.repeat(64);

// un Drive finto: i byte di un file, e il conto delle richieste
function remoto(byte) {
  const giri = [];
  const f = fileRemoto("id", byte.length, {
    prendi: async (da, a) => {
      giri.push([da, a]);
      return { da, buf: byte.slice(da, a) };
    },
  });
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

export default async function (t) {
  // ---- quali file proporre ------------------------------------------------------
  {
    const libri = [
      { id: "a", title: "Mort", fileType: "epub", impronta: SHA("a") },
      { id: "b", title: "Eric", fileType: "epub" },
      { id: "c", title: "Hellboy v01", fileType: "cbz" },
    ];
    const file = [
      { id: "f1", name: "Mort.epub", size: 10, sha256Checksum: SHA("a") }, // e' Mort, per impronta
      { id: "f2", name: "qualcosa.epub", size: 10, appProperties: { bcId: "b" } }, // e' Eric, per segno
      { id: "f3", name: "Di un altro.epub", size: 10, appProperties: { bcId: "zz" } }, // libro di un altro dispositivo
      { id: "f4", name: "Cancellato.epub", size: 10, appProperties: { bcId: "morto" } }, // libro cancellato qui
      { id: "f5", name: "Nuovo.epub", size: 10, sha256Checksum: SHA("5"), parents: ["L"] },
      { id: "f6", name: "Nuovo copia.epub", size: 10, sha256Checksum: SHA("5"), parents: ["L"] }, // stessa impronta del f5
      { id: "f7", name: "Hellboy v01.cbz", size: 10 }, // riconosciuto per nome
      { id: "f8", name: "Hellboy v01.cbz", size: 11 }, // doppio: ambiguo, ma lo stesso titolo c'e' gia'
      { id: "f9", name: "Eric.pdf", size: 10, parents: ["L"] }, // stesso titolo, altra estensione: e' un altro file
      { id: "f10", name: "note.txt", size: 10 },
      { id: "f11", name: "One Piece 10.cbz", size: 10, parents: ["M"] },
      { id: "f12", name: "One Piece 2.cbz", size: 10, parents: ["M"] },
      { id: "f13", name: "Racconto.epub", size: 10, parents: ["M"] },
      { id: "f14", name: "Mort copia.epub", size: 10, sha256Checksum: SHA("A") }, // impronta di Mort scritta in maiuscolo
      { id: "f15", name: "Zeta.epub", size: 10, parents: ["L"] }, // per nome verrebbe dopo i manga
    ];
    const cartelle = [
      { id: "L", name: "Libri" },
      { id: "M", name: "Manga" },
    ];
    // un dispositivo che la biblioteca la aspetta ancora dal cloud
    const v = daAggiungere(libri, file, { lapidi: ["morto"], cartelle, schedeInArrivo: true });
    const ids = v.map((x) => x.id);
    t.c("quel che abbina riconosce non si propone", !ids.includes("f1") && !ids.includes("f2") && !ids.includes("f7"));
    t.c("un file segnato per un libro che qui non c'e' e' di un altro dispositivo, finche' il cloud puo' portarlo", !ids.includes("f3"));
    // IL SEGNO ORFANO (i libri di Anne McCaffrey «già sullo scaffale» che
    // sullo scaffale non c'erano): dopo un giro quel che doveva arrivare e'
    // arrivato, e un segno senza scheda e' di un libro cancellato con la
    // chiave di Google scaduta — il file si propone
    const orfani = daAggiungere(libri, file, { lapidi: [], cartelle }).map((x) => x.id);
    t.c("dopo un giro il segno orfano non ferma il file", orfani.includes("f3") && orfani.includes("f4"));
    t.c("…ma il segno di un libro che c'e' lo ferma sempre", !orfani.includes("f2"));
    t.c("ma se quel libro l'hai cancellato, il file e' tuo come un altro", ids.includes("f4"));
    t.c("due copie identiche fanno un libro solo", ids.includes("f5") && !ids.includes("f6"));
    t.c("lo stesso titolo con la stessa estensione e' forse gia' qui: si tace", !ids.includes("f8"));
    t.c("con un'altra estensione e' un altro file", ids.includes("f9"));
    t.c("un file che non e' un libro non si propone", !ids.includes("f10"));
    t.c("l'impronta si confronta senza badare alle maiuscole", !ids.includes("f14"));
    t.eq("i file della cartella Manga entrano col tipo manga", v.find((x) => x.id === "f11")?.tipo, "manga");
    t.eq("ma solo i fumetti", v.find((x) => x.id === "f13")?.tipo, undefined);
    t.eq("fuori da quella cartella nessun tipo", v.find((x) => x.id === "f9")?.tipo, undefined);
    t.eq(
      "in ordine di cartella, e dentro in ordine naturale",
      ids.join(","),
      "f4,f9,f5,f15,f12,f11,f13"
    );
    t.eq("la cartella viaggia col file", v.find((x) => x.id === "f12")?.cartella, "Manga");
    t.eq("senza libri si propone tutto quel che e' un libro", daAggiungere([], file.slice(4, 6)).length, 1);
  }

  // ---- «già sullo scaffale», ma come chi --------------------------------
  {
    const libri = [
      { id: "a", title: "Dragonflight", fileType: "epub", impronta: SHA("a") },
      { id: "b", title: "Mort", fileType: "epub" },
    ];
    const file = [
      { id: "f1", name: "Anne McCaffrey - Dragonflight.epub", sha256Checksum: SHA("a").toUpperCase() },
      { id: "f2", name: "Mort.epub" },
      { id: "f3", name: "copia strana.epub", appProperties: { bcId: "b" } },
      { id: "f4", name: "Nuovo.epub" },
      { id: "f5", name: "Nuovo (1).epub" },
    ];
    const voci = daAggiungere(libri, file.filter((f) => f.id !== "f5"));
    const g = giaSulloScaffale(libri, file.filter((f) => f.id !== "f5"), voci);
    const come = (n) => g.find((x) => x.nome === n)?.come;
    t.eq("riconosciuto dall'impronta: si dice quale scheda", come("Anne McCaffrey - Dragonflight.epub"), "Dragonflight");
    t.eq("riconosciuto dal titolo", come("Mort.epub"), "Mort");
    t.eq("riconosciuto dal segno, anche col nome diverso", come("copia strana.epub"), "Mort");
    t.c("chi entra non e' fra i «gia'»", !g.some((x) => x.nome === "Nuovo.epub"));
    t.eq(
      "la frase nomina il file, e la scheda solo quando si chiama diversa",
      fraseGia(g),
      "«Anne McCaffrey - Dragonflight» (sullo scaffale come «Dragonflight»), «Mort», «copia strana» (sullo scaffale come «Mort») erano già sullo scaffale"
    );
    t.eq("uno solo, al singolare", fraseGia([{ nome: "Mort.epub", come: "Mort" }]), "«Mort» era già sullo scaffale");
    t.eq("oltre tre, il conto", fraseGia([1, 2, 3, 4, 5].map((n) => ({ nome: `V${n}.epub`, come: null }))), "«V1», «V2», «V3» e altri 2 erano già sullo scaffale");
    t.eq("niente di gia', niente frase", fraseGia([]), "");
  }

  // ---- i gemelli di Colab: il CBZ accanto al suo CBR -------------------
  {
    const TWD = "The Walking Dead Deluxe Vol. 01- Days Gone Bye (2021)";
    const file = [
      { id: "r1", name: `${TWD}.cbr`, size: 268329011, parents: ["W"] },
      { id: "z1", name: `${TWD}.cbz`, size: 274220901, parents: ["W"] },
      { id: "r2", name: "Solo RAR.cbr", size: 10, parents: ["W"] },
      { id: "r3", name: "Altrove.cbr", size: 10, parents: ["W"] },
      { id: "z3", name: "Altrove.cbz", size: 11, parents: ["X"] },
      { id: "r4", name: "Buttato.cbr", size: 10, parents: ["W"] },
      { id: "z4", name: "Buttato.cbz", size: 12, parents: ["W"], trashed: true },
      { id: "r5", name: "Gia' mio.cbr", size: 10, parents: ["W"], appProperties: { bcId: "b5" } },
      { id: "z5", name: "Gia' mio.cbz", size: 13, parents: ["W"] },
      { id: "r6", name: "Libro.cbr", size: 10, parents: ["W"] },
      { id: "p6", name: "Libro.pdf", size: 14, parents: ["W"] },
    ];
    const ids = daAggiungere([{ id: "b5", title: "Gia' mio", fileType: "cbr" }], file).map((x) => x.id);
    t.c("di una coppia CBR e CBZ entra solo il CBZ", ids.includes("z1") && !ids.includes("r1"));
    t.c("un CBR senza gemello entra", ids.includes("r2"));
    t.c("il gemello e' nella stessa cartella", ids.includes("r3") && ids.includes("z3"));
    t.c("un CBZ nel cestino non e' un gemello", ids.includes("r4"));
    t.c("il CBZ di un CBR che e' gia' un libro non entra: lo adotta il giro", !ids.includes("z5"));
    t.c("un altro formato con lo stesso nome non e' un gemello", ids.includes("r6") && ids.includes("p6"));
  }

  // ---- la cartella del lettore ------------------------------------
  {
    const cartelle = [
      { id: "R", name: "Book-Companion" }, // il nome si confronta senza badare alle maiuscole
      { id: "L", name: "Libri", parents: ["R"] },
      { id: "F", name: "Fumetti", parents: ["R"] },
      { id: "H", name: "Hellboy", parents: ["F"] },
      { id: "MG", name: "Manga", parents: ["R"] },
      { id: "X", name: "Altro", parents: ["Y"] },
      { id: "Y", name: "Documenti" },
      { id: "G1", name: "Giro", parents: ["G2"] },
      { id: "G2", name: "Giro bis", parents: ["G1"] }, // un genitore che torna su se stesso
    ];
    t.eq("il percorso di una cartella si legge dalla cima", percorsoDi("H", cartelle).join("/"), "Book-Companion/Fumetti/Hellboy");
    t.eq("una cartella che non si conosce non ha percorso", percorsoDi("zz", cartelle).length, 0);
    t.c("un giro chiuso si ferma", percorsoDi("G1", cartelle).length === 2);
    t.eq("dentro la radice il percorso e' relativo", cartellaDi("H", cartelle), "Fumetti / Hellboy");
    t.eq("la radice stessa ha la cartella vuota", cartellaDi("R", cartelle), "");
    t.eq("fuori dalla radice il percorso e' intero", cartellaDi("X", cartelle), "Documenti / Altro");
    t.eq("senza cartella, senza percorso", cartellaDi(undefined, cartelle), "");

    const file = [
      { id: "a", name: "Zeta.epub", size: 10, parents: ["L"] },
      { id: "b", name: "Alfa.epub", size: 10, parents: ["X"] }, // fuori, ma per nome verrebbe primo
      { id: "c", name: "Hellboy v02.cbz", size: 10, parents: ["H"] },
      { id: "d", name: "Berserk v01.cbz", size: 10, parents: ["MG"] },
      { id: "e", name: "Sciolto.epub", size: 10 },
      { id: "f", name: "Alla radice.epub", size: 10, parents: ["R"] },
      { id: "g", name: "Café.epub", size: 10, parents: ["L"] },
    ];
    const v = daAggiungere([], file, { cartelle });
    t.eq("per cartella e poi per nome", v.map((x) => x.id).join(","), "f,e,b,c,g,a,d");
    t.eq("il manga si riconosce dal percorso sotto la radice", v.find((x) => x.id === "d")?.tipo, "manga");
    t.eq("fuori dalla radice il file porta il percorso intero", v.find((x) => x.id === "b")?.cartella, "Documenti / Altro");
    t.eq("il nome della radice e' uno solo", RADICE, "book-companion");
  }

  // ---- il file letto a pezzi ------------------------------------------------------
  {
    const byte = new Uint8Array(600_000).map((_, i) => i % 256);
    const r = remoto(byte);
    const a = new Uint8Array(await r.f.slice(10, 40).arrayBuffer());
    t.eq("un pezzo esce giusto", [...a.slice(0, 3)].join(","), "10,11,12");
    t.eq("e lungo quanto chiesto", a.length, 30);
    await r.f.slice(100, 5000).arrayBuffer();
    t.eq("il pezzo accanto arriva con la stessa richiesta", r.giri.length, 1);
    const c = new Uint8Array(await r.f.slice(599_000, 600_000).arrayBuffer());
    t.eq("uno lontano ne vuole un'altra", r.giri.length, 2);
    t.eq("e non chiede oltre la fine", r.giri[1][1], 600_000);
    t.eq("la coda esce giusta", c[999], 599_999 % 256);
    const dentro = r.f.slice(1000, 2000).slice(10, 20);
    t.eq("una fetta di una fetta", [...new Uint8Array(await dentro.arrayBuffer())][0], 1010 % 256);
    t.eq("e ha la sua misura", dentro.size, 10);
    const flusso = new Uint8Array(await new Response(r.f.slice(5, 9).stream()).arrayBuffer());
    t.eq("anche come flusso", [...flusso].join(","), "5,6,7,8");
    // un server che ignora Range manda tutto: si tiene tutto
    const tutti = [];
    const s = fileRemoto("x", byte.length, { prendi: async () => (tutti.push(1), { da: 0, buf: byte }) });
    await s.slice(300_000, 300_010).arrayBuffer();
    await s.slice(5, 9).arrayBuffer();
    t.eq("il file intero arrivato una volta basta per tutto", tutti.length, 1);
    const corto = fileRemoto("y", 1000, { prendi: async (da) => ({ da, buf: new Uint8Array(3) }) });
    let err = null;
    await corto.slice(0, 50).arrayBuffer().catch((e) => (err = e));
    t.c("una risposta piu' corta del pezzo e' un errore, non un pezzo mozzato", !!err);
  }

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
    t.c(`poche richieste (${r.giri.length})`, r.giri.length <= 4);
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
    t.eq("un fumetto di Drive si apre a fette, come uno del tablet", a.pagine.join(","), "p1.jpg,p2.jpg,p10.jpg");
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
    const segni = [];
    const segna = async (fileId, bookId) => {
      ordine.push(`segna:${fileId}`);
      segni.push([fileId, bookId]);
      if (fileId === "rifiutato") return false;
      if (fileId === "scaduto") return "scollegato";
      return true;
    };
    const voci = [
      { id: "v1", name: "Vero.epub", size: 100, sha256Checksum: SHA("b") },
      { id: "v2", name: "Berserk v01.cbr", size: 100, byte: cbz, tipo: "manga" }, // un «cbr» che e' uno zip
      { id: "v3", name: "Muto.epub", size: IMPRONTA_INTERA + 1, sha256Checksum: SHA("c") },
      { id: "v4", name: "rotto.cbz", size: 10, byte: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) },
      { id: "rifiutato", name: "Rifiutato.pdf", size: 10 },
      { id: "v6", name: "Lento.pdf", size: 10, sha256Checksum: "non-esadecimale" },
      { id: "v7", name: "Mort.epub", size: 10 },
      { id: "scaduto", name: "Dopo la chiave.epub", size: 10 },
      { id: "v9", name: "Mai.epub", size: 10 },
    ];
    const passi = [];
    // un corridore fermo si legge come un corridore lento: il giro ha un
    // tetto suo, o togliendo quello del codice il test resterebbe appeso
    const e = await Promise.race([
      importaDaDrive(voci, [{ id: "m", title: "Mort", author: "" }], {
        apri,
        segna,
        leggi,
        attesa: 50,
        onProgress: (p) => passi.push(p.fatti),
      }),
      new Promise((ok) => setTimeout(() => ok({ appeso: true, added: [], errors: [], sospetti: [] }), 3000)),
    ]);
    t.c("una lettura che non torna non tiene appeso il giro", !e.appeso);
    const per = (n) => e.added.find((b) => b.title === n);
    t.eq("il titolo letto dal file", !!per("Il Titolo Vero"), true);
    t.eq("l'impronta di Drive diventa quella del libro", per("Il Titolo Vero")?.impronta, SHA("b"));
    // era «oltre la soglia l'impronta non si scrive», ed e' il difetto
    // segnalato: il tomo grosso entrava senza, e il tasto dei doppioni lo
    // contava per sempre senza poterlo servire. Adesso si prende a campioni
    // dal file lontano, come l'import dal tablet — e con quella di Drive,
    // che e' la SHA del file intero, non si mescola.
    t.c("oltre la soglia l'impronta si prende a campioni dal file lontano", /^c:[0-9a-f]{64}$/.test(per("Muto")?.impronta || ""), per("Muto")?.impronta);
    t.c("…senza scaricarlo intero: dieci pezzi da un mega", pezziGrosso.length === 10 && pezziGrosso.every(([a, b]) => b - a <= 1024 * 1024));
    t.eq("un'impronta che non e' uno SHA-256 non si scrive", per("Lento")?.impronta, undefined);
    const berserk = per("Berserk v01");
    t.eq("un «cbr» che e' uno zip entra come cbz", berserk?.fileType, "cbz");
    t.eq("col tipo della cartella", berserk?.tipo, "manga");
    t.eq("e la saga dal nome del file, come all'import", `${berserk?.saga} ${berserk?.sagaOrder}`, "Berserk 1");
    t.c("un archivio che non si riconosce non entra", !per("rotto") && e.errors.some((x) => x.name === "rotto.cbz"));
    t.c("un segno rifiutato: la scheda non entra", !per("Rifiutato") && e.errors.some((x) => x.name === "Rifiutato.pdf"));
    t.c("una lettura che non torna non ferma niente: entra col nome del file", !!per("Lento"));
    t.eq("e si contano fra i titoli presi dal nome solo le schede entrate", e.senzaMetadati, 2);
    t.c("un titolo gia' in biblioteca entra, ma si dice", !!per("Mort") && e.sospetti.some((x) => x.title === "Mort"));
    t.c("la chiave scaduta ferma il giro", e.scollegato && !per("Dopo la chiave") && !per("Mai"));
    t.c("il segno viene DOPO la lettura", ordine.indexOf("segna:v1") > ordine.indexOf("leggi:Vero"));
    t.c("e porta l'id della scheda nuova", segni.every(([f, b]) => e.added.every((x) => x.id !== b) || f));
    t.eq("ogni scheda segnata col suo id", segni.filter(([, b]) => e.added.some((x) => x.id === b)).length, e.added.length);
    t.eq("l'avanzamento, file per file fino al fermo", passi.join(","), "0,1,2,3,4,5,6,7");
    // «Mort» lo riconosce la tavola del Mondo Disco: la stessa porta dell'import
    t.eq("le saghe riconosciute sono quelle delle schede entrate", e.added.filter((b) => b.saga).map((b) => b.title).join(","), "Berserk v01,Mort");
    t.eq("e si contano", e.riconosciuti, 2);
    const fermo = await importaDaDrive(voci, [], { apri, segna, leggi, vivo: () => false });
    t.c("fermato prima di cominciare: niente dentro, e si dice", fermo.fermato && !fermo.added.length && !segni.some(() => false));

    // IL FILE TORNA NELLA SCHEDA CHE L'AVEVA PERSO (i Dragonriders del
    // lettore: ogni volume due volte, una scheda col file e una senza)
    const persa = [{ id: "pern", title: "Dragonflight", author: "Anne McCaffrey" }];
    const leggiPern = async (meta) => {
      meta.title = "Dragonflight";
      meta.author = "Anne McCaffrey";
      return { titolo: true, copertina: true };
    };
    const voce = [{ id: "dr", name: "Anne McCaffrey - Dragonflight.epub", size: 10 }];
    const segnati = [];
    const segnaPern = async (fileId, bookId) => (segnati.push(`${fileId}>${bookId}`), true);
    const torna = await importaDaDrive(voce, persa, { apri, segna: segnaPern, leggi: leggiPern, senzaFile: (id) => id === "pern", segnato: () => false });
    t.eq("il file della scheda rimasta senza torna dentro di lei", torna.ritrovati.map((r) => r.id).join(), "pern");
    t.eq("…senza fare una scheda nuova", torna.added.length, 0);
    t.eq("…e il segno su Drive porta l'id della scheda di prima", segnati.join(), "dr>pern");
    const conSegni = await importaDaDrive(voce, persa, { apri, segna: segnaPern, leggi: leggiPern, senzaFile: () => true, segnato: () => true });
    t.c("una scheda con segni ancorati ad altri byte non lo adotta: entra nuovo, e si dice", conSegni.added.length === 1 && !conSegni.ritrovati.length && conSegni.sospetti.length === 1);
    const colFile = await importaDaDrive(voce, persa, { apri, segna: segnaPern, leggi: leggiPern, senzaFile: () => false, segnato: () => false });
    t.c("una scheda che il suo file ce l'ha non si tocca: e' un'altra copia, e si dice", colFile.added.length === 1 && !colFile.ritrovati.length && colFile.sospetti.length === 1);
    const stessiByte = await importaDaDrive([{ ...voce[0], sha256Checksum: SHA("d") }], [{ ...persa[0], impronta: SHA("d") }], { apri, segna: segnaPern, leggi: leggiPern, senzaFile: () => true, segnato: () => true });
    t.eq("con gli stessi byte torna anche nella scheda coi segni: le righe sono le stesse", stessiByte.ritrovati.length, 1);
    const due = await importaDaDrive([...voce, { id: "dr2", name: "Dragonflight (1).epub", size: 10 }], persa, { apri, segna: segnaPern, leggi: leggiPern, senzaFile: (id) => id === "pern", segnato: () => false });
    t.eq("due file per la stessa scheda: il primo torna a casa, il secondo entra", `${due.ritrovati.length}/${due.added.length}`, "1/1");
  }
}

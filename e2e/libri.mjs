// I LIBRI DELLE PROVE, costruiti al volo: niente binari nel repository, e
// un libro che si legge a occhio in questo file.
import { deflateSync } from "node:zlib";
import JSZip from "jszip";

// Un PNG vero di un colore solo: il fumetto deve avere pagine che il
// browser sa disegnare, o la copertina e le misure cadono per altro.
function pngDa(larghezza, altezza, grezzo) {
  const crc = (buf) => {
    let c = ~0;
    for (const x of buf) {
      c ^= x;
      for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
    return ~c >>> 0;
  };
  const pezzo = (tipo, dati) => {
    const t = Buffer.from(tipo);
    const out = Buffer.alloc(12 + dati.length);
    out.writeUInt32BE(dati.length, 0);
    t.copy(out, 4);
    dati.copy(out, 8);
    out.writeUInt32BE(crc(Buffer.concat([t, dati])), 8 + dati.length);
    return out;
  };
  const testa = Buffer.alloc(13);
  testa.writeUInt32BE(larghezza, 0);
  testa.writeUInt32BE(altezza, 4);
  testa[8] = 8;
  testa[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pezzo("IHDR", testa),
    pezzo("IDAT", deflateSync(grezzo, { level: 1 })),
    pezzo("IEND", Buffer.alloc(0)),
  ]);
}
function png(larghezza, altezza, [r, g, b]) {
  const riga = Buffer.alloc(1 + larghezza * 3);
  for (let x = 0; x < larghezza; x++) riga.set([r, g, b], 1 + x * 3);
  return pngDa(larghezza, altezza, Buffer.concat(Array.from({ length: altezza }, () => riga)));
}

// UN FUMETTO CHE DA DRIVE SI LEGGE A PEZZI: oltre i 20 MB, con pagine di
// rumore da un mega l'una (il rumore non si comprime: ogni pagina e' una
// richiesta a Drive, e le richieste si possono contare)
export async function fumettoGrosso(pagine = 24) {
  const zip = new JSZip();
  const L = 600;
  const A = 580;
  const passo = 1 + L * 3;
  let x = 7;
  for (let i = 0; i < pagine; i++) {
    const righe = Buffer.alloc(A * passo);
    for (let k = 0; k < righe.length; k++) {
      x = (Math.imul(x, 1103515245) + 12345) & 0x7fffffff;
      righe[k] = k % passo === 0 ? 0 : (x >> 16) & 255;
    }
    zip.file(`pagina ${String(i + 1).padStart(2, "0")}.png`, pngDa(L, A, righe), { compression: "STORE" });
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

export async function fumetto() {
  const zip = new JSZip();
  const colori = [[180, 40, 40], [40, 120, 180], [60, 160, 80]];
  colori.forEach((c, i) => zip.file(`pagina ${String(i + 1).padStart(2, "0")}.png`, png(60, 90, c)));
  return zip.generateAsync({ type: "nodebuffer" });
}

export const FRASE = "La nebbia saliva dal fiume e copriva le strade di Ankh-Morpork.";

export async function epub({ titolo = "La nebbia", autore = "Autore di Prova" } = {}) {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
  );
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:uuid:prova-nebbia</dc:identifier><dc:title>${titolo}</dc:title><dc:creator>${autore}</dc:creator><dc:language>it</dc:language><meta property="dcterms:modified">2026-01-01T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>`
  );
  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Indice</title></head><body><nav epub:type="toc"><ol><li><a href="c1.xhtml">Uno</a></li></ol></nav></body></html>`
  );
  const paragrafi = Array.from({ length: 12 }, (_, i) => `<p>${i === 0 ? FRASE : `Paragrafo ${i + 1} della prova, con abbastanza parole da fare una riga intera sulla pagina.`}</p>`).join("");
  zip.file(
    "OEBPS/c1.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Uno</title></head><body><h1>Capitolo uno</h1>${paragrafi}</body></html>`
  );
  return zip.generateAsync({ type: "nodebuffer", mimeType: "application/epub+zip" });
}

// un PDF di poche pagine scritto a mano: Helvetica, una riga per pagina
export function pdf(pagine = 3) {
  const ogg = ["<< /Type /Catalog /Pages 2 0 R >>"];
  const kids = Array.from({ length: pagine }, (_, i) => `${3 + i * 2} 0 R`).join(" ");
  ogg.push(`<< /Type /Pages /Kids [${kids}] /Count ${pagine} >>`);
  const font = 3 + pagine * 2;
  for (let i = 0; i < pagine; i++) {
    ogg.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${4 + i * 2} 0 R >>`);
    const testo = `BT /F1 18 Tf 72 760 Td (Pagina ${i + 1} della prova) Tj ET`;
    ogg.push(`<< /Length ${testo.length} >>\nstream\n${testo}\nendstream`);
  }
  ogg.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let s = "%PDF-1.4\n";
  const off = [];
  ogg.forEach((o, i) => {
    off.push(s.length);
    s += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = s.length;
  s += `xref\n0 ${ogg.length + 1}\n0000000000 65535 f \n` + off.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  s += `trailer\n<< /Size ${ogg.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(s, "latin1");
}

// una biblioteca del Mondo Disco coi primi nove letti e «Moving Pictures»
// rimesso «Da leggere» dopo averlo aperto: il caso dell'Ingresso
export function mondoDisco() {
  if (localStorage.getItem("bc_books")) return;
  const D = (id, n, title, series) => ({ id, title, author: "Terry Pratchett", saga: "Discworld", sagaOrder: n, series, fileType: "epub", addedAt: n });
  const libri = [
    D("cm", 1, "The Colour of Magic", "Rincewind"),
    D("lf", 2, "The Light Fantastic", "Rincewind"),
    D("er", 3, "Equal Rites", "The Witches"),
    D("mo", 4, "Mort", "Death"),
    D("so", 5, "Sourcery", "Rincewind"),
    D("ws", 6, "Wyrd Sisters", "The Witches"),
    D("py", 7, "Pyramids", "Ancient Civilizations"),
    D("gg", 8, "Guards! Guards!", "City Watch"),
    D("ec", 9, "Eric", "Rincewind"),
    D("mp", 10, "Moving Pictures", "Industrial Revolution"),
    D("rm", 11, "Reaper Man", "Death"),
    D("ma", 15, "Men at Arms", "City Watch"),
    // il libro in mano, in cima all'Ingresso: senza, «Continua» prenderebbe
    // Moving Pictures (e' aperto al 12%) e fra i seguiti giustamente non ci sarebbe
    { id: "mech", title: "Mechanicum", author: "Graham McNeill", fileType: "epub", addedAt: 50 },
  ];
  localStorage.setItem("bc_books", JSON.stringify(libri));
  for (const id of ["cm", "lf", "er", "mo", "so", "ws", "py", "gg", "ec"]) localStorage.setItem(`bc_status_${id}`, "read");
  localStorage.setItem("bc_status_mp", "unread");
  localStorage.setItem("bc_prog_mp", "0.12");
  // e il seguito di una storia cominciata (Mort letto), aperto e rimesso li'
  localStorage.setItem("bc_status_rm", "unread");
  localStorage.setItem("bc_prog_rm", "0.3");
  localStorage.setItem("bc_status_mech", "reading");
  localStorage.setItem("bc_prog_mech", "0.12");
  localStorage.setItem("bc_lastopen", "mech");
}

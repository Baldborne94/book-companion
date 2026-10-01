// I DOPPIONI (`doppioniInBiblioteca`: fumetti e libri) e il gemello CBZ su Drive
// (`gemelloCbzDi`). Sbagliano in silenzio in due modi che costano: tenere
// la copia sbagliata (quella senza il segno di lettura, o il CBR che scende
// intero invece del CBZ), o prendere per doppioni due libri diversi.
import { doppioniInBiblioteca, chiaveVolume } from "../src/lib/doppioni.js";
import { gemelloCbzDi } from "../src/lib/driveCore.js";

const TWD = (n, extra = "") => `The Walking Dead Deluxe Vol. 0${n}${extra}`;

export default async (t) => {
  t.eq("il titolo senza estensione, spazi e maiuscole", chiaveVolume({ title: " The Walking  Dead Deluxe Vol. 01.CBR " }), "the walking dead deluxe vol. 01");

  const libri = [
    { id: "a", title: TWD(1), fileType: "cbz", addedAt: 3 },
    { id: "b", title: TWD(1), fileType: "cbr", addedAt: 1 },
    { id: "c", title: TWD(1), fileType: "cbz", addedAt: 2 },
    { id: "d", title: TWD(2), fileType: "cbr", addedAt: 1 },
    { id: "e", title: TWD(2), fileType: "cbz", addedAt: 5 },
    { id: "f", title: TWD(3), fileType: "cbz", addedAt: 1 },
    { id: "g", title: TWD(4), fileType: "cbr", addedAt: 1 },
    { id: "h", title: TWD(4), fileType: "cbr", addedAt: 2 },
    { id: "r1", title: "Racconti", fileType: "epub", addedAt: 1 },
    { id: "r2", title: "Racconti", fileType: "epub", addedAt: 2 },
    { id: "m", title: TWD(2), fileType: "pdf", addedAt: 1 },
  ];
  const letti = { a: 0.12 };
  const segnati = { h: 2 };
  const conCopertina = new Set(["a", "c", "e"]);
  const g = doppioniInBiblioteca(libri, {
    progresso: (id) => letti[id] || 0,
    segni: (id) => segnati[id] || 0,
    copertina: (id) => conCopertina.has(id),
  });
  const di = (n) => g.find((x) => x.titolo === TWD(n));
  t.eq("tre gruppi: i volumi 1, 2 e 4", g.map((x) => x.titolo).join(" | "), [TWD(1), TWD(2), TWD(4)].join(" | "));
  t.eq("il volume che stai leggendo tiene la sua scheda", di(1).tieni, "a");
  t.eq("…e le altre due se ne vanno", di(1).via.sort().join(), "b,c");
  t.eq("fra un CBR e un CBZ non letti, il CBZ", di(2).tieni, "e");
  t.eq("i segnalibri contano piu' dell'eta'", di(4).tieni, "h");
  t.c("un volume solo non e' un doppione", !di(3));
  t.c("i libri non sono fumetti: lo stesso titolo in ePub non si tocca qui", !g.some((x) => x.titolo === "Racconti"));
  t.c("…e un PDF con lo stesso titolo di un fumetto nemmeno", !di(2).via.includes("m"));
  t.eq("letto e finito vale come in lettura", doppioniInBiblioteca([{ id: "x", title: "V", fileType: "cbr" }, { id: "y", title: "V", fileType: "cbz" }], { stato: (id) => (id === "x" ? "read" : "unread") })[0].tieni, "x");
  t.eq("piu' avanti vince", doppioniInBiblioteca([{ id: "x", title: "V", fileType: "cbz" }, { id: "y", title: "V", fileType: "cbz" }], { progresso: (id) => (id === "x" ? 0.2 : 0.6) })[0].tieni, "y");
  t.eq("a parita' di tutto, la scheda piu' vecchia", doppioniInBiblioteca([{ id: "x", title: "V", fileType: "cbz", addedAt: 9 }, { id: "y", title: "V", fileType: "cbz", addedAt: 4 }])[0].tieni, "y");
  t.eq("la copertina conta piu' dell'eta'", doppioniInBiblioteca([{ id: "x", title: "V", fileType: "cbz", addedAt: 9 }, { id: "y", title: "V", fileType: "cbz", addedAt: 4 }], { copertina: (id) => id === "x" })[0].tieni, "x");
  t.eq("il CBZ vince sul CBR anche senza copertine, anche se il CBR e' piu' vecchio", doppioniInBiblioteca([{ id: "r", title: "V", fileType: "cbr", addedAt: 1 }, { id: "z", title: "V", fileType: "cbz", addedAt: 9 }])[0].tieni, "z");
  t.eq("due fumetti senza titolo non sono lo stesso volume", doppioniInBiblioteca([{ id: "x", title: "", fileType: "cbz" }, { id: "y", title: "  ", fileType: "cbz" }]).length, 0);
  t.eq("niente doppioni, niente gruppi", doppioniInBiblioteca([{ id: "x", title: "V", fileType: "cbz" }]).length, 0);

  // ---- i libri: stesso titolo, stesso autore, stesso formato --------------
  // i Dragonriders del lettore: una scheda col file su Drive, una senza
  const pern = [
    { id: "senza", title: "Dragonflight", author: "Anne McCaffrey", fileType: "epub", addedAt: 1 },
    { id: "col", title: "Dragonflight", author: "Anne McCaffrey", fileType: "epub", addedAt: 9 },
  ];
  const conFile = (id) => id !== "senza";
  const pg = doppioniInBiblioteca(pern, { conFile, copertina: () => true });
  t.eq("due ePub con titolo e autore uguali sono lo stesso libro", pg.length, 1);
  t.eq("…e resta la scheda col file, anche se e' la piu' nuova", pg[0]?.tieni, "col");
  t.eq("…anche contro la scheda senza file che stai leggendo", doppioniInBiblioteca(pern, { conFile, progresso: (id) => (id === "senza" ? 0.4 : 0) })[0]?.tieni, "col");
  t.eq("l'autore si confronta senza accenti, maiuscole e punti", doppioniInBiblioteca([{ id: "a", title: "Le Città", author: "Calvino, Italo", fileType: "epub" }, { id: "b", title: "le città", author: "calvino italo", fileType: "epub" }]).length, 1);
  t.eq("stesso titolo, autori diversi: due libri", doppioniInBiblioteca([{ id: "a", title: "Racconti", author: "Moravia", fileType: "epub" }, { id: "b", title: "Racconti", author: "Calvino", fileType: "epub" }]).length, 0);
  t.eq("lo stesso libro in ePub e in PDF non si unisce: sono due file diversi", doppioniInBiblioteca([{ id: "a", title: "Mort", author: "Pratchett", fileType: "epub" }, { id: "b", title: "Mort", author: "Pratchett", fileType: "pdf" }]).length, 0);
  t.eq("un ePub senza autore non si unisce a un altro col suo titolo", doppioniInBiblioteca([{ id: "a", title: "Mort", author: "Pratchett", fileType: "epub" }, { id: "b", title: "Mort", author: "", fileType: "epub" }]).length, 0);
  t.eq("un fumetto senza file perde contro quello col file, anche se e' il CBZ", doppioniInBiblioteca([{ id: "z", title: "V", fileType: "cbz" }, { id: "r", title: "V", fileType: "cbr" }], { conFile: (id) => id === "r" })[0].tieni, "r");

  // ---- il gemello su Drive --------------------------------------------------
  const file = [
    { id: "r1", name: `${TWD(1)}.cbr`, parents: ["W"] },
    { id: "z1", name: `${TWD(1)}.CBZ`, parents: ["W"], appProperties: { bcId: "altro" } },
    { id: "r2", name: `${TWD(2)}.cbr`, parents: ["W"] },
    { id: "z2", name: `${TWD(2)}.cbz`, parents: ["ALTROVE"] },
    { id: "r3", name: `${TWD(3)}.cbr`, parents: ["W"] },
    { id: "z3", name: `${TWD(3)}.cbz`, parents: ["W"], trashed: true },
  ];
  t.eq("il CBZ accanto, di chiunque sia", gemelloCbzDi("r1", file)?.id, "z1");
  t.eq("in un'altra cartella non e' il gemello", gemelloCbzDi("r2", file), null);
  t.eq("nel cestino nemmeno", gemelloCbzDi("r3", file), null);
  t.eq("un file che non c'e' non ha gemelli", gemelloCbzDi("zz", file), null);
  t.eq("un CBZ non e' il gemello di se stesso", gemelloCbzDi("z1", file), null);
};

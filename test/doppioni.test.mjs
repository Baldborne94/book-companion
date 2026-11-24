// I DOPPIONI (`doppioniInBiblioteca`: fumetti e libri). Sbagliano in silenzio in due modi che costano: tenere
// la copia sbagliata (quella senza il segno di lettura, o il CBR che scende
// intero invece del CBZ), o prendere per doppioni due libri diversi.
import { doppioniInBiblioteca, chiaveVolume, titoloVero } from "../src/lib/doppioni.js";

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

  // LO STESSO VOLUME SCRITTO IN DUE MODI (segnalato coi due «Breaker of
  // Infinities»): stessa saga, stesso numero, stesso titolo vero
  const K = "Kill Six Billion Demons";
  const ksbd = [
    { id: "file", title: "Kill Six Billion Demons - Book 05 - Breaker of Infinities (2026) (digital) (Son of Ultron-Empire)", saga: K, sagaOrder: 5, fileType: "cbz", addedAt: 9 },
    { id: "drive", title: "Kill Six Billion Demons v05 - Breaker of Infinities-0021", saga: K, sagaOrder: 5, fileType: "cbz", addedAt: 1 },
    { id: "tre", title: "Kill Six Billion Demons - Book Three (2019) (Digital) (phillywilly-Empire)", saga: K, sagaOrder: 3, fileType: "cbz" },
  ];
  t.eq("il titolo vero: senza saga, numeri, etichette e copia di Drive", [titoloVero(ksbd[0]), titoloVero(ksbd[1])].join(" | "), "breaker of infinities | breaker of infinities");
  t.eq("«Book Three» non ha titolo vero", titoloVero(ksbd[2]), "");
  const kg = doppioniInBiblioteca(ksbd, { conFile: (id) => id === "file" });
  t.c("«v05 - Breaker of Infinities-0021» e «Book 05 - Breaker of Infinities (2026)…» sono un volume", kg.length === 1 && kg[0].via.join() === "drive", JSON.stringify(kg));
  t.eq("…e resta la scheda col file", kg[0]?.tieni, "file");
  const omni = [
    { id: "v1", title: "v01 - Seed of Destruction", saga: "Hellboy", sagaOrder: 1, fileType: "cbz" },
    { id: "om", title: "Hellboy Omnibus v01 - Seed of Destruction (2018) (digital)", saga: "Hellboy", sagaOrder: 1, fileType: "cbz" },
  ];
  t.eq("l'Omnibus non e' il volume che contiene", doppioniInBiblioteca(omni).length, 0);
  t.eq("un numero diverso e' un altro volume", doppioniInBiblioteca([ksbd[0], { ...ksbd[1], sagaOrder: 4 }]).length, 0);
  t.eq("una saga diversa e' un altro fumetto, anche col titolo vero uguale", doppioniInBiblioteca([{ id: "a", title: "Alpha v01 - The Beginning", saga: "Alpha", sagaOrder: 1, fileType: "cbz" }, { id: "b", title: "Beta v01 - The Beginning", saga: "Beta", sagaOrder: 1, fileType: "cbz" }]).length, 0);
  t.eq("senza titolo vero, nel dubbio niente", doppioniInBiblioteca([{ id: "a", title: "Kingdom v04 [TurnipFarmers]", saga: "Kingdom", sagaOrder: 4, fileType: "cbz" }, { id: "b", title: "Kingdom Vol. 4", saga: "Kingdom", sagaOrder: 4, fileType: "cbz" }]).length, 0);
  t.eq("e i libri restano col loro titolo e autore", doppioniInBiblioteca([{ ...ksbd[0], fileType: "epub", author: "A" }, { ...ksbd[1], fileType: "epub", author: "A" }]).length, 0);

  // ── LE SCHEDE SENZA EBOOK NELLO STESSO POSTO (la copia della biblioteca del
  // lettore, 12 novembre): i nomi, i numeri e gli autori sono i suoi
  const drizzt = (id, title, author, n, extra = {}) => ({ id, title, author, saga: "The Legend of Drizzt", sagaOrder: n, fileType: "nessuno", fileTolto: true, addedAt: extra.addedAt ?? 1, ...extra });
  const scaffale = [
    drizzt("cs-elmore", "The Crystal Shard", "Larry Elmore", 4, { addedAt: 1 }),
    drizzt("cs", "The Crystal Shard", "R. A. Salvatore", 4, { addedAt: 2 }),
    drizzt("hs", "Homeland", "R. A. Salvatore", 1),
    drizzt("ex", "Exile", "R. A. Salvatore", 2),
    drizzt("am", "Archmage", "R. A. Salvatore", 31, { addedAt: 1 }),
    drizzt("am2", "Archmage: The Legend of Drizzt", "R. A. Salvatore", 31, { addedAt: 2 }),
    drizzt("gk", "The Ghost King", "R. A. Salvatore", 22),
    drizzt("es", "El Rey Fantasma", "R. A. Salvatore", 22),
    { id: "kg1", title: "Kagurabachi v01", saga: "Kagurabachi", sagaOrder: 1, fileType: "cbz", tipo: "manga", addedAt: 9 },
    { id: "kg1s", title: "Kagurabachi, Vol. 1", author: "Takeru Hokazono", saga: "Kagurabachi", sagaOrder: 1, fileType: "nessuno", fileTolto: true, addedAt: 1 },
    { id: "wn", title: "White Night", author: "Jim Butcher", saga: "Dresden Files", sagaOrder: 9, fileType: "epub", fileTolto: true, addedAt: 5 },
    { id: "wn2", title: "White Night", author: "Chris McGrath", saga: "The Dresden Files", sagaOrder: 9, fileType: "nessuno", fileTolto: true, addedAt: 1 },
    { id: "sg", title: "Skin Game: A Novel of the Dresden Files", author: "Jim Butcher", saga: "Dresden Files", sagaOrder: 15, fileType: "epub", fileTolto: true, addedAt: 5 },
    { id: "sg2", title: "Skin Game", author: "Jim Butcher", saga: "The Dresden Files", sagaOrder: 15, fileType: "nessuno", fileTolto: true, addedAt: 1 },
    { id: "pg", title: "Proven Guilty", author: "Jim Butcher", saga: "Dresden Files", sagaOrder: 19, fileType: "epub", fileTolto: true, addedAt: 5 },
    { id: "mm", title: "Mirror Mirror", author: "Jim Butcher", saga: "Dresden Files", sagaOrder: 19, fileType: "nessuno", fileTolto: true, addedAt: 6 },
    { id: "ah", title: "Ashes of Man", author: "Christopher Ruocchio", saga: "The Sun Eater", sagaOrder: 5, fileType: "epub", addedAt: 1 },
    { id: "kd", title: "Kingdoms of Death", author: "Christopher Ruocchio", saga: "The Sun Eater", sagaOrder: 5, fileType: "epub", addedAt: 2 },
  ];
  const sp = doppioniInBiblioteca(scaffale, { conFile: () => false });
  const coppie = sp.map((x) => `${x.tieni}<${x.via.join("+")}`).sort().join(", ");
  t.eq("le schede senza ebook nello stesso posto di un'altra: col titolo uguale o un sottotitolo in più", coppie, "am<am2, cs<cs-elmore, kg1<kg1s, sg<sg2, wn<wn2");
  t.c("resta l'autore della raccolta, non l'illustratore (anche se la sua scheda è più vecchia)", sp.some((x) => x.tieni === "cs"));
  t.c("…e la scheda di un libro vero, non il segnaposto, anche senza il file qui", sp.some((x) => x.tieni === "wn") && sp.some((x) => x.tieni === "kg1"));
  t.c("una traduzione non si riconosce dal titolo: resta", !sp.some((x) => [x.tieni, ...x.via].includes("es")));
  t.c("un altro libro allo stesso numero (un numero sbagliato) non è un doppione", !sp.some((x) => [x.tieni, ...x.via].includes("mm")));
  t.c("due libri veri allo stesso numero nemmeno: sono un numero da sistemare", !sp.some((x) => [x.tieni, ...x.via].includes("kd")));
  const jojo = (id, title, series, fileType) => ({ id, title, saga: "JoJo's Bizarre Adventure", series, sagaOrder: 1, fileType, tipo: "manga", addedAt: 1 });
  t.eq("lo stesso numero in un'altra serie della raccolta è un altro posto", doppioniInBiblioteca([jojo("p7", "JoJo's Bizarre Adventure v01", "Parte 7", "cbz"), jojo("p8", "JoJo's Bizarre Adventure Vol. 1", "Parte 8", "nessuno")]).length, 0);
  // la copia di Drive col titolo vero vuoto (la biblioteca del lettore)
  const spawn = (id, title, n, addedAt = 1) => ({ id, title, saga: "Spawn Origins Collection", sagaOrder: n, fileType: "cbz", addedAt });
  const sp2 = doppioniInBiblioteca([spawn("s2", "Spawn Origins Collection v02", 2), spawn("s2d", "Spawn Origins Collection Vol. 02-017", 2, 2), spawn("s8", "Spawn Origins Collection v08", 8), spawn("s8d", "Spawn Origins Collection v8-015", 8, 2), spawn("s3", "Spawn Origins Collection v03", 3)]);
  t.eq("«Vol. 02-017» e «v8-015» sono le copie di Drive del 2 e dell'8", sp2.map((x) => `${x.tieni}<${x.via.join("+")}`).sort().join(", "), "s2<s2d, s8<s8d");
  t.eq("due originali col titolo vuoto e una copia: nel dubbio niente", doppioniInBiblioteca([spawn("a", "Kingdom v04 [TurnipFarmers]", 4), spawn("b", "Kingdom Vol. 4", 4), spawn("c", "Kingdom v04-017", 4)].map((x) => ({ ...x, saga: "Kingdom" }))).length, 0);
  t.eq("un intervallo non è una copia: «131-140» e «v131» restano due", doppioniInBiblioteca([spawn("p", "Solo Leveling 131-140", 131), spawn("q", "Solo Leveling v131", 131)].map((x) => ({ ...x, saga: "Solo Leveling" }))).length, 0);
  t.eq("senza numero non c'è posto", doppioniInBiblioteca([{ ...scaffale[9], sagaOrder: null }, { ...scaffale[8], sagaOrder: null }]).length, 0);
};

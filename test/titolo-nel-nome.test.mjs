// IL TITOLO DENTRO IL NOME (`abbina`, quinto modo): segnalato dal lettore,
// dieci Discworld «né qui né nel cloud» con gli ePub su Drive nella vecchia
// cartella «Books», e «se ci sono mi aspetto che li veda». I nomi sono
// quelli veri dei suoi file.
import { abbina } from "../src/lib/driveCore.js";

const f = (id, name, extra = {}) => ({ id, name, size: "400000", parents: ["BOOKS"], ...extra });
const ids = (r) => [...r.mappa].map(([b, x]) => `${b}=${x.id}`).sort().join();

export default async (t) => {
  const file = [
    f("H", "Pratchett, Terry - [Discworld 20] - Hogfather (1998, Harper).epub"),
    f("I", "Pratchett, Terry - [Discworld 17] - Interesting Times (1994, HarperTorch).epub"),
    f("M", "Pratchett, Terry - [Discworld 31] - Monstrous Regiment (2003, HarperTorch).epub"),
    f("MO", "Hogfather - Terry Pratchett.mobi"),
  ];
  const libri = [
    { id: "hog", title: "Hogfather", author: "Terry Pratchett", fileType: "epub" },
    { id: "int", title: "Interesting Times", author: "Terry Pratchett", fileType: "epub" },
    { id: "mon", title: "Monstrous Regiment", author: "Pratchett, Terry", fileType: "epub" },
  ];
  const r = abbina(libri, file);
  t.eq("i Discworld del lettore si ritrovano", ids(r), "hog=H,int=I,mon=M");
  t.eq("e si segnano su Drive", r.daSegnare.length, 3);

  // le guardie: ognuna da sola tiene fuori il file
  const uno = (b, ff = file, op) => ids(abbina([b], ff, op));
  t.eq("senza l'autore nel nome no", uno({ id: "x", title: "Hogfather", author: "Neil Gaiman", fileType: "epub" }), "");
  t.eq("un titolo dentro una parola non vale", uno({ id: "x", title: "Hogfat", author: "Terry Pratchett", fileType: "epub" }), "");
  t.eq("un titolo troppo corto non decide", uno({ id: "x", title: "Hog", author: "Terry Pratchett", fileType: "epub" }, [f("Z", "Pratchett, Terry - Hog farm.epub")]), "");
  t.eq("un libro coi byte qui non si ripesca per nome", uno(libri[0], file, { misure: new Map([["hog", 123]]) }), "");
  t.eq("un libro spostato sull'HDD non si ripesca da una copia rimasta", uno({ ...libri[0], fileTolto: true }), "");
  t.eq("un file col segno di un altro libro non si prende", uno(libri[0], [f("H", file[0].name, { appProperties: { bc: "1", bcId: "altro" } })]), "");
  t.eq("un'impronta diversa e' un altro file", uno({ ...libri[0], impronta: "aaa" }, [f("H", file[0].name, { sha256Checksum: "BBB" })]), "");
  t.eq("un'impronta uguale va", uno({ ...libri[0], impronta: "bbb" }, [f("H", file[0].name, { sha256Checksum: "BBB" })]), "hog=H");
  t.eq("due file candidati: si tace", uno(libri[0], [file[0], f("H2", "Terry Pratchett - Hogfather (2).epub")]), "");
  t.eq("un file per due schede: si tace", ids(abbina([libri[0], { ...libri[0], id: "hog2" }], file)), "");
  t.eq("basta il cognome, la parola piu' lunga dell'autore", uno(libri[0], [f("P", "Pratchett - Hogfather.epub")]), "hog=P");
  // il volume unico non e' il file di un volume solo (il caso vero del
  // lettore: Xenocide senza file, gli altri quattro spostati sull'HDD)
  const quintet = f("Q", "The Ender Quintet (Enders Game Speaker for the Dead Xenocide Children of the Mind Ender in Exile) by Card, Orson Scott (z-lib.org).epub");
  const ender = [
    { id: "xen", title: "Xenocide", author: "Orson Scott Card", fileType: "epub" },
    { id: "chi", title: "Children of the Mind", author: "Orson Scott Card", fileType: "epub", fileTolto: true },
    { id: "spe", title: "Ender 02 - Speaker for the Dead", author: "Orson Scott Card", fileType: "epub", fileTolto: true },
  ];
  t.eq("un volume unico con dentro i titoli di altri libri dell'autore non si prende", ids(abbina(ender, [quintet])), "");
  t.eq("il titolo di un libro d'altri dentro il nome non conta", ids(abbina([libri[0], { id: "z", title: "Harper", author: "Altro Scrittore", fileType: "epub" }], [file[0]])), "hog=H");
  t.eq("senza autore sulla scheda si tace", uno({ id: "x", title: "Hogfather", fileType: "epub" }), "");
};

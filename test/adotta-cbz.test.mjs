// I CBZ CONVERTITI SU COLAB (`cbzDaAdottare` in `lib/driveCore.js`): il CBZ
// nasce accanto al suo CBR, stesso nome, senza segno. Sbaglia in silenzio in
// due modi opposti: non riconosce il gemello (il libro resta CBR e il CBZ
// entra come un doppione nuovo), o ne riconosce uno che non e' suo (un
// altro fumetto al posto di questo, e il CBR nel cestino).
import { cbzDaAdottare } from "../src/lib/driveCore.js";

export default async (t) => {
  const libri = [
    { id: "b1", title: "I Hate Fairyland v02", fileType: "cbr" },
    { id: "b2", title: "Omnibus", fileType: "cbr" },
    { id: "b3", title: "Gia' CBZ", fileType: "cbz" },
    { id: "b4", title: "Senza gemello", fileType: "cbr" },
    { id: "b5", title: "Il gemello e' di un altro", fileType: "cbr" },
    { id: "b6", title: "Altra cartella", fileType: "cbr" },
  ];
  const mappa = { b1: { id: "r1" }, b2: { id: "r2" }, b3: { id: "z3" }, b4: { id: "r4" }, b5: { id: "r5" }, b6: { id: "r6" } };
  const file = [
    { id: "r1", name: "I Hate Fairyland v02 - Fluff My Life (2016).cbr", parents: ["F"] },
    { id: "z1", name: "I Hate Fairyland v02 - Fluff My Life (2016).cbz", parents: ["F"], size: "73308678", sha256Checksum: "aa" },
    { id: "r2", name: "Omnibus.CBR", parents: ["F"] },
    { id: "z2", name: "omnibus.cbz", parents: ["F"], size: "400000000" },
    { id: "z3", name: "Gia' CBZ.cbz", parents: ["F"] },
    { id: "r4", name: "Senza gemello.cbr", parents: ["F"] },
    { id: "r5", name: "Conteso.cbr", parents: ["F"] },
    { id: "z5", name: "Conteso.cbz", parents: ["F"], appProperties: { bcId: "altro-libro" } },
    { id: "r6", name: "Sparso.cbr", parents: ["F"] },
    { id: "z6", name: "Sparso.cbz", parents: ["ALTROVE"] },
    { id: "zc", name: "Nel cestino.cbz", parents: ["F"], trashed: true },
  ];
  const a = cbzDaAdottare(libri, mappa, file);
  t.eq("si adottano i gemelli esatti, e solo quelli", a.map((x) => `${x.bookId}:${x.vecchio}>${x.nuovo}`).join(), "b1:r1>z1,b2:r2>z2");
  t.eq("…con la misura e l'impronta del CBZ", `${a[0].byte}/${a[0].sha}`, "73308678/aa");
  t.c("le maiuscole dell'estensione e del nome non contano", a.some((x) => x.bookId === "b2"));
  t.c("un CBZ col segno di un ALTRO libro non si prende", !a.some((x) => x.bookId === "b5"));
  t.c("…ma col segno di QUESTO si' (un giro interrotto a meta')", cbzDaAdottare([libri[4]], mappa, [file[6], { ...file[7], appProperties: { bcId: "b5" } }]).length === 1);
  t.c("un gemello in un'altra cartella non e' il gemello", !a.some((x) => x.bookId === "b6"));
  t.c("un CBZ nel cestino non si adotta", cbzDaAdottare([{ id: "bc", fileType: "cbr" }], { bc: { id: "rc" } }, [{ id: "rc", name: "Nel cestino.cbr", parents: ["F"] }, file[10]]).length === 0);
  t.eq("un libro gia' CBZ o senza file su Drive non si tocca", cbzDaAdottare([libri[2], { id: "x", fileType: "cbr" }], mappa, file).length, 0);
  // uno zip col nome .cbr (l'app lo sa CBZ dai byte): accanto un .cbz con lo
  // stesso nome e' un altro file, e adottarlo butterebbe il suo nel cestino
  t.eq("un CBZ col nome .cbr non adotta il vicino", cbzDaAdottare([{ id: "rz", fileType: "cbz" }], { rz: { id: "f1" } }, [{ id: "f1", name: "Rinominato.cbr", parents: ["F"] }, { id: "f2", name: "Rinominato.cbz", parents: ["F"] }]).length, 0);
  t.eq("un'immagine con lo stesso nome non e' il gemello", cbzDaAdottare([libri[3]], mappa, [file[5], { id: "j4", name: "Senza gemello.jpg", parents: ["F"] }]).length, 0);
  // un RAR col nome .cbz: senza guardia sarebbe il gemello di se stesso, e
  // finirebbe nel cestino col suo libro attaccato
  t.eq("un RAR col nome .cbz non e' il gemello di se stesso", cbzDaAdottare([{ id: "rr", fileType: "cbr" }], { rr: { id: "f9" } }, [{ id: "f9", name: "Finto.cbz", parents: ["F"] }]).length, 0);
};

// I CBR GIA' CONVERTITI: si buttano solo quelli di cui nessuno si serve,
// accanto a un CBZ gemello che un libro legge (chiesto dal lettore facendo
// pulizia su Drive: 29 CBR, 14,6 GB, col loro CBZ accanto).
import { cbrGiaConvertiti } from "../src/lib/driveCore.js";

const f = (id, name, cartella = "HB", extra = {}) => ({ id, name, size: "100", parents: [cartella], ...extra });

export default async (t) => {
  const libri = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const mappa = { a: { id: "z1" }, b: { id: "r2" }, c: { id: "z4" } };
  const file = [
    f("r1", "Hellboy v01.cbr"),
    f("z1", "Hellboy v01.cbz"),
    // il CBR che un libro legge ancora: resta
    f("r2", "Hellboy v02.cbr"),
    f("z2", "Hellboy v02.cbz"),
    // il CBZ gemello non lo legge nessuno: il CBR e' l'unica copia letta
    f("r3", "Hellboy v03.cbr"),
    f("z3", "Hellboy v03.cbz"),
    // stesso nome ma in un'altra cartella: non e' il gemello
    f("r4", "Spawn v04.cbr", "ALTRA"),
    f("z4", "Spawn v04.cbz"),
    // gia' nel cestino
    f("r5", "Hellboy v05.cbr", "HB", { trashed: true }),
    f("z5", "Hellboy v05.cbz"),
  ];
  const via = cbrGiaConvertiti([...libri, { id: "e" }], { ...mappa, e: { id: "z5" } }, file).map((x) => x.id);
  t.eq("si butta il CBR di nessuno, accanto al CBZ letto", cbrGiaConvertiti(libri, mappa, file).map((x) => x.id).join(), "r1");
  t.c("il CBR che un libro legge resta", !via.includes("r2"));
  t.c("se il CBZ non lo legge nessuno, il CBR resta", !via.includes("r3"));
  t.c("un gemello in un'altra cartella non conta", !via.includes("r4"));
  t.c("quel che e' gia' nel cestino non si ributta", !via.includes("r5"));
  // due schede, una per file (doppioni non ancora uniti): il CBR lo legge
  // qualcuno, e resta anche se il suo CBZ e' letto da un'altra
  const doppi = cbrGiaConvertiti([{ id: "d" }, { id: "g" }], { d: { id: "r6" }, g: { id: "z6" } }, [f("r6", "Spawn v06.cbr"), f("z6", "Spawn v06.cbz")]);
  t.eq("un CBR letto resta anche col gemello letto da un'altra scheda", doppi.length, 0);
  const r = cbrGiaConvertiti(libri, mappa, file)[0];
  t.eq("dice nome, peso e gemello", `${r.nome} ${r.byte} ${r.cbz}`, "Hellboy v01.cbr 100 z1");
  t.eq("un CBZ letto da una scheda che non c'e' piu' non conta", cbrGiaConvertiti([{ id: "b" }], mappa, file).length, 0);

  // I SEGNI: il CBR col segno di un libro vivo resta, a meno che quel libro
  // non legga gia' il gemello (un'adozione rimasta a meta')
  const segnato = (bcId) => [f("r1", "Hellboy v01.cbr", "HB", { appProperties: { bcId } }), f("z1", "Hellboy v01.cbz")];
  t.eq("col segno del libro che legge il gemello: si butta", cbrGiaConvertiti(libri, mappa, segnato("a")).length, 1);
  t.eq("col segno di un altro libro vivo: resta", cbrGiaConvertiti(libri, mappa, segnato("b")).length, 0);
  t.eq("col segno di una scheda che non c'e' piu': si butta", cbrGiaConvertiti(libri, mappa, segnato("morta")).length, 1);
  t.eq("…ma non finche' la biblioteca puo' ancora arrivare dal cloud", cbrGiaConvertiti(libri, mappa, segnato("morta"), { schedeInArrivo: true }).length, 0);
  t.eq("solo i CBR, mai i CBZ o gli ePub", cbrGiaConvertiti(libri, { a: { id: "z1" } }, [f("x", "Hellboy v01.epub"), f("z1", "Hellboy v01.cbz")]).length, 0);
  t.eq("niente di niente", cbrGiaConvertiti(null, null, null).length, 0);
};

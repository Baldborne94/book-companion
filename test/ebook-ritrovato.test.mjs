// «SCHEDA SENZA EBOOK» CON IL FILE SU DRIVE: il segno e' vecchio e va spento.
// Sbaglia in silenzio da tutt'e due i lati — un segno lasciato e' un libro
// che non si apre pur avendo il file, uno spento a torto e' una scheda che
// promette un file che non c'e'.
import { ebookRitrovati } from "../src/lib/driveCore.js";

export default async function (t) {
  const libri = [
    { id: "a", fileTolto: true },
    { id: "b", fileTolto: true },
    { id: "c", fileTolto: false },
    { id: "d" },
    { id: "e", fileTolto: true },
  ];
  const mappa = { a: { id: "FA", byte: 10 }, c: { id: "FC" }, d: { id: "FD" }, e: { byte: 5 } };
  const r = ebookRitrovati(libri, mappa);
  t.eq("il tolto col file su Drive si ritrova", r.join(","), "a");
  t.c("il tolto SENZA file su Drive resta tolto", !r.includes("b"));
  t.c("chi il segno non ce l'ha non si tocca", !r.includes("c") && !r.includes("d"));
  t.c("una voce di mappa senza l'id del file non e' un file", !r.includes("e"));
  t.eq("senza mappa niente", ebookRitrovati(libri, null).length, 0);
  t.eq("senza libri niente", ebookRitrovati(null, mappa).length, 0);
  t.eq("un libro senza id non entra", ebookRitrovati([{ fileTolto: true }], { undefined: { id: "x" } }).length, 0);
}

// I LIBRI IN LETTURA RESTANO SUL TABLET (`daTenereInLettura` in
// `lib/anticipo.js`). Sbaglia in silenzio: uno di troppo e' spazio e rete
// presi di nascosto, uno di meno e' un treno senza il libro che stai leggendo.
import { daTenereInLettura, IN_LETTURA_MAX, ANTICIPO_MAX } from "../src/lib/anticipo.js";

export default async function (t) {
  const libri = [
    { id: "a", title: "A" },
    { id: "b", title: "B" },
    { id: "c", title: "C" },
    { id: "d", title: "D", fileTolto: true },
    { id: "e", title: "E" },
    { id: "f", title: "F" },
  ];
  const stati = { a: "reading", b: "reading", c: "read", d: "reading", e: "reading", f: "unread" };
  const tocchi = { a: 10, b: 30, c: 99, d: 50, e: 20, f: 99 };
  const base = {
    statusOf: (id) => stati[id],
    tocco: (id) => tocchi[id],
    qui: () => false,
    lassu: () => ({ byte: 1000 }),
  };
  const ids = (xs) => xs.map((b) => b.id).join(",");

  t.eq("solo gli «in lettura», dal toccato piu' di recente", ids(daTenereInLettura(libri, base)), "b,e,a");
  t.c("un letto non scende", !daTenereInLettura(libri, base).some((b) => b.id === "c"));
  t.c("un mai aperto nemmeno", !daTenereInLettura(libri, base).some((b) => b.id === "f"));
  t.c("un ebook tolto a mano non scende mai", !daTenereInLettura(libri, base).some((b) => b.id === "d"));

  t.eq("quello gia' qui non si riscarica", ids(daTenereInLettura(libri, { ...base, qui: (id) => id === "b" })), "e,a");
  t.eq("quello che non sta da nessuna parte lassu' non si chiede", ids(daTenereInLettura(libri, { ...base, lassu: (id) => (id === "e" ? null : { byte: 1 }) })), "b,a");
  t.eq(
    "oltre il tetto non scende",
    ids(daTenereInLettura(libri, { ...base, lassu: (id) => ({ byte: id === "b" ? ANTICIPO_MAX + 1 : 10 }) })),
    "e,a"
  );
  t.eq("un file al tetto esatto scende", ids(daTenereInLettura(libri, { ...base, lassu: () => ({ byte: ANTICIPO_MAX }) })), "b,e,a");
  t.eq("lassu' senza misura (il secchio) va bene", ids(daTenereInLettura(libri, { ...base, lassu: () => true })), "b,e,a");

  // IL TETTO CONTA ANCHE QUELLI GIA' QUI: cinque libri in tasca, non cinque in
  // piu' a ogni giro
  const tanti = Array.from({ length: 8 }, (_, i) => ({ id: `x${i}` }));
  const tutti = {
    statusOf: () => "reading",
    tocco: (id) => 100 - Number(id.slice(1)),
    qui: (id) => id === "x0" || id === "x1",
    lassu: () => ({ byte: 1 }),
  };
  t.eq(`al massimo ${IN_LETTURA_MAX}, contando quelli gia' qui`, ids(daTenereInLettura(tanti, tutti)), "x2,x3,x4");
  t.eq("il tetto si passa da fuori", ids(daTenereInLettura(tanti, { ...tutti, max: 3 })), "x2");
  t.eq("niente libri, niente da fare", daTenereInLettura(null, tutti).length, 0);
}

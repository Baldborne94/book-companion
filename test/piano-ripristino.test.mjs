// IL PIANO DEL RIPRISTINO: cosa entra da un archivio e cosa resta com'è.
// `restoreLibrary` era provata da capo a fondo su archivi finti, ma la
// decisione che la governa — `planRestore` — non aveva un controllo suo, e
// un errore qui non alza niente: sovrascrive una biblioteca.
import { planRestore, planMelodie } from "../src/lib/restoreLibrary.js";

const libro = (id, extra = {}) => ({ id, title: `Titolo ${id}`, ...extra });
const ids = (l) => l.map((b) => b.id).join(",");

export default async function (t) {
  // ---- LE TRE PILE ---------------------------------------------------------
  const archivio = [libro("a"), libro("b"), libro("c")];
  const piano = planRestore({
    archiveBooks: archivio,
    localBooks: [libro("b", { title: "Il mio titolo corretto" }), libro("c")],
    localFileIds: new Set(["b"]),
  });
  t.eq("chi non c'è entra", ids(piano.add), "a");
  t.eq("chi c'è resta", ids(piano.kept), "b,c");
  t.eq("chi c'è ma senza i byte prende solo il file", ids(piano.fill), "c");
  // RIPRISTINARE NON È SOVRASCRIVERE: la scheda locale è più fresca
  // dell'archivio, e `kept` non la tocca — l'unico uso è contare
  t.c("un libro tenuto non finisce fra quelli da aggiungere", !piano.add.some((b) => b.id === "b"));

  // ---- I CASI VUOTI --------------------------------------------------------
  const vuoto = planRestore({ archiveBooks: [], localBooks: [libro("a")], localFileIds: new Set() });
  t.eq("archivio vuoto: niente entra", vuoto.add.length + vuoto.fill.length + vuoto.kept.length, 0);
  const primaVolta = planRestore({ archiveBooks: archivio, localBooks: [], localFileIds: new Set() });
  t.eq("biblioteca vuota: entra tutto", ids(primaVolta.add), "a,b,c");
  t.eq("e non c'è niente da riempire", primaVolta.fill.length, 0);
  const senzaArgomenti = planRestore({});
  t.eq("senza argomenti non esplode", senzaArgomenti.add.length, 0);

  // ---- UNA VOCE SENZA ID NON È UN LIBRO -----------------------------------
  const storti = planRestore({ archiveBooks: [null, {}, { title: "senza id" }, libro("a")], localBooks: [], localFileIds: new Set() });
  t.eq("le voci storte si saltano", ids(storti.add), "a");

  // ---- UN ID DUE VOLTE NELL'ARCHIVIO ENTRA UNA VOLTA SOLA -----------------
  // un archivio ricostruito a mano, o un vecchio giro andato storto, può
  // portare lo stesso libro due volte: prima entravano tutt'e due, cioè due
  // schede con lo stesso id nella biblioteca (preso dal test, non dalla
  // lettura)
  const doppio = planRestore({ archiveBooks: [libro("a"), libro("a", { title: "copia" })], localBooks: [], localFileIds: new Set() });
  t.eq("il doppione non entra due volte", ids(doppio.add), "a");
  t.eq("e resta il primo", doppio.add[0].title, "Titolo a");

  // ---- IL FILE SI RIEMPIE SOLO SE MANCA ------------------------------------
  const pieno = planRestore({ archiveBooks: [libro("a")], localBooks: [libro("a")], localFileIds: new Set(["a"]) });
  t.eq("chi ha già i byte non li riprende", pieno.fill.length, 0);
  t.eq("ma è tenuto", ids(pieno.kept), "a");

  // ---- LE MELODIE: stessa regola, per id ----------------------------------
  const mel = planMelodie([{ id: "m1" }, { id: "m2" }, { name: "senza id" }], [{ id: "m2" }]);
  t.eq("entra solo quella che manca", mel.map((m) => m.id).join(","), "m1");
}

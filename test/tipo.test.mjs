// LIBRI E FUMETTI NON SI MESCOLANO QUANDO LI CERCHI.
//
// Chiesto dal lettore («fai in modo che l'applicazione mi differenzi tra
// questi due generi quando li voglio cercare così non ci confondiamo»).
// Due cose sbagliano in silenzio: un tipo letto storto mette un manga fra
// i libri senza che nessun errore lo dica, e i due chip mostrati a chi ha
// soli libri sono uno scaffale vuoto garantito dietro un tasto.
import { TIPI, tipoDi, delTipo, serveFiltroTipo } from "../src/lib/library.js";

export default async function (t) {
  const epub = { id: "a", fileType: "epub" };
  const pdf = { id: "b", fileType: "pdf" };
  const cbz = { id: "c", fileType: "cbz" };
  const cbr = { id: "d", fileType: "cbr" };

  t.eq("i tipi sono tre e «tutti» sta per primo", TIPI.map((x) => x.id).join(","), "tutti,libri,fumetti");
  for (const x of TIPI) t.c(`«${x.id}» ha un'etichetta`, typeof x.label === "string" && x.label.length > 0);

  t.eq("un ePub e' un libro", tipoDi(epub), "libri");
  t.eq("un PDF e' un libro", tipoDi(pdf), "libri");
  t.eq("un CBZ e' un fumetto", tipoDi(cbz), "fumetti");
  t.eq("un CBR e' un fumetto", tipoDi(cbr), "fumetti");
  t.eq("senza tipo di file e' un libro (i tomi di prima del fumetto)", tipoDi({ id: "e" }), "libri");

  t.c("«tutti» lascia passare tutt'e due", delTipo(epub, "tutti") && delTipo(cbz, "tutti"));
  t.c("… e anche nessun filtro", delTipo(cbz, undefined) && delTipo(epub, ""));
  t.c("«libri» tiene il libro e scarta il fumetto", delTipo(epub, "libri") && !delTipo(cbz, "libri"));
  t.c("«fumetti» tiene il fumetto e scarta il libro", delTipo(cbr, "fumetti") && !delTipo(pdf, "fumetti"));

  t.eq("i chip servono solo con tutt'e due i tipi in casa", serveFiltroTipo([epub, pdf, cbz]), true);
  t.eq("… con soli libri no", serveFiltroTipo([epub, pdf]), false);
  t.eq("… con soli fumetti no", serveFiltroTipo([cbz, cbr]), false);
  t.eq("… senza libri no", serveFiltroTipo([]), false);
  t.eq("… e senza elenco no", serveFiltroTipo(undefined), false);
}

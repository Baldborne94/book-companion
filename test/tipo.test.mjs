// LIBRI E FUMETTI NON SI MESCOLANO QUANDO LI CERCHI.
//
// Chiesto dal lettore («fai in modo che l'applicazione mi differenzi tra
// questi due generi quando li voglio cercare così non ci confondiamo»).
// Due cose sbagliano in silenzio: un tipo letto storto mette un manga fra
// i libri senza che nessun errore lo dica, e i due chip mostrati a chi ha
// soli libri sono uno scaffale vuoto garantito dietro un tasto.
import { TIPI, tipoDi, delTipo, serveFiltroTipo, tipiDi, tipiPresenti, eManga } from "../src/lib/library.js";
import { leggiComicInfo } from "../src/lib/fumetto.js";

export default async function (t) {
  const epub = { id: "a", fileType: "epub" };
  const pdf = { id: "b", fileType: "pdf" };
  const cbz = { id: "c", fileType: "cbz" };
  const cbr = { id: "d", fileType: "cbr" };

  t.eq("i tipi sono quattro e «tutti» sta per primo", TIPI.map((x) => x.id).join(","), "tutti,libri,fumetti,manga");
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

  // ---- e i manga dai fumetti ----------------------------------------------
  // un manga e un fumetto sono tutt'e due CBZ: a dirli diversi sono il verso
  // dichiarato dalla scheda e il genere
  const rtl = { id: "m1", fileType: "cbz", verso: "rtl" };
  const genere = { id: "m2", fileType: "cbr", genre: "Fumetti · Manga" };
  const aMano = { id: "m3", fileType: "cbz", genre: "manga shonen" };
  const pdfManga = { id: "m4", fileType: "pdf", genre: "Manga" };
  const parola = { id: "m5", fileType: "cbz", genre: "Mangaverse" };
  t.c("il verso da destra dice manga", eManga(rtl));
  t.c("il genere del selettore dice manga", eManga(genere));
  t.c("anche scritto a mano e in minuscolo", eManga(aMano));
  t.eq("un PDF col genere Manga e' un manga (una scansione resta un manga)", tipoDi(pdfManga), "manga");
  t.eq("la parola dentro un'altra non conta", tipoDi(parola), "fumetti");
  t.eq("un fumetto senza segni resta un fumetto", tipoDi(cbz), "fumetti");
  t.c("«fumetti» scarta il manga", !delTipo(genere, "fumetti") && delTipo(cbz, "fumetti"));
  t.c("«manga» tiene il manga e scarta il fumetto", delTipo(genere, "manga") && !delTipo(cbz, "manga"));

  // la saga si porta dietro i suoi volumi: segnato uno, seguono gli altri
  const bib = [
    { id: "op1", fileType: "cbz", saga: "One Piece", genre: "Fumetti · Manga" },
    { id: "op2", fileType: "cbz", saga: "One Piece" },
    { id: "op3", fileType: "cbr", saga: " one piece " },
    { id: "opN", fileType: "epub", saga: "One Piece" },
    { id: "hb", fileType: "cbz", saga: "Hellboy" },
    { id: "sn", fileType: "cbz" },
    { id: "rom", fileType: "epub" },
  ];
  const mappa = tipiDi(bib);
  t.eq("i volumi della stessa saga seguono il segnato", [mappa.get("op2"), mappa.get("op3")].join(","), "manga,manga");
  t.eq("… ma un romanzo della stessa saga resta un libro", mappa.get("opN"), "libri");
  t.eq("… e un'altra saga non si contagia", mappa.get("hb"), "fumetti");
  t.eq("… ne' un fumetto senza saga", mappa.get("sn"), "fumetti");
  t.c("delTipo legge la mappa", delTipo(bib[1], "manga", mappa) && !delTipo(bib[1], "fumetti", mappa));
  // l'eredita' non si eredita: due volumi senza segno in una saga senza
  // nessun volume segnato restano fumetti
  t.eq("una saga senza segni resta di fumetti", tipiDi([{ id: "x", fileType: "cbz", saga: "S" }, { id: "y", fileType: "cbz", saga: "S" }]).get("y"), "fumetti");

  // i chip: solo i tipi che ci sono, e solo da due in su
  const ids = (l) => l.map((x) => x.id).join(",");
  t.eq("libri e manga: niente chip «Fumetti»", ids(tipiPresenti([epub, genere])), "tutti,libri,manga");
  t.eq("tutti e tre", ids(tipiPresenti([epub, cbz, genere])), "tutti,libri,fumetti,manga");
  t.eq("fumetti e manga senza libri: i chip servono", ids(tipiPresenti([cbz, genere])), "tutti,fumetti,manga");
  t.eq("un tipo solo: niente chip", ids(tipiPresenti([genere, rtl])), "");

  // la scheda del CBZ: «Yes» dice manga anche senza verso
  const ci = (m) => leggiComicInfo(`<ComicInfo><Series>X</Series><Manga>${m}</Manga></ComicInfo>`);
  t.c("«Yes» e' un manga", ci("Yes").manga === true && ci("Yes").verso === null);
  t.c("«YesAndRightToLeft» e' un manga col verso", ci("YesAndRightToLeft").manga === true && ci("YesAndRightToLeft").verso === "rtl");
  t.eq("«No» non lo e'", ci("No").manga, false);
}

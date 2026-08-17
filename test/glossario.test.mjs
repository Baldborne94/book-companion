// IL GLOSSARIO NON PUO' ESSERE SOLO DEL MONDO DISCO. Le voci scritte da noi
// coprono un mondo solo; queste sono quelle del lettore, per qualunque saga.
// Qui si prova la parte senza DOM — e soprattutto la fusione all'ingresso
// dall'archivio, che e' dove una correzione fatta ieri puo' sparire.
import {
  chiaveGlossario,
  aggiungi,
  togli,
  cerca,
  fondi,
  quantiTermini,
} from "../src/lib/glossarioMio.js";

export default async function (t) {
  // ---- LA CHIAVE E' LA SAGA, NON IL LIBRO -------------------------------
  // un termine imparato nel primo volume serve soprattutto nel quinto
  const uno = chiaveGlossario({ id: "a", saga: "Malazan Book of the Fallen" });
  const due = chiaveGlossario({ id: "b", saga: "Malazan Book of the Fallen" });
  t.eq("due volumi della stessa saga condividono il glossario", uno, due);
  t.c(
    "e maiuscole e spazi non fanno due glossari",
    chiaveGlossario({ id: "c", saga: "  malazan   book of the fallen " }) === uno
  );
  t.c(
    "saghe diverse restano separate",
    chiaveGlossario({ id: "d", saga: "The First Law" }) !== uno
  );
  // chi una saga non ce l'ha resta legato al suo libro: meglio un glossario
  // che vale per un volume solo che nessun glossario
  t.eq("senza saga si ripiega sul libro", chiaveGlossario({ id: "solo" }), "libro:solo");
  t.eq("senza niente, nessuna chiave", chiaveGlossario({}), null);
  t.eq("nemmeno da un libro che non c'e'", chiaveGlossario(), null);

  // ---- scrivere una voce -------------------------------------------------
  let voci = aggiungi([], "Warren", "I sentieri magici da cui i maghi traggono potere");
  t.eq("una voce", voci.length, 1);
  t.c("con il termine com'è scritto", voci[0].t === "Warren");

  // LO STESSO TERMINE DUE VOLTE NON FA DUE VOCI: correggere una spiegazione
  // e' l'uso normale — te ne accorgi rileggendola
  voci = aggiungi(voci, "warren", "I sentieri magici, e ognuno ha il suo dio");
  t.eq("resta una sola voce", voci.length, 1);
  t.c("ma la spiegazione e' la nuova", /ognuno ha il suo dio/.test(voci[0].d));
  // riscrivendo si cambia la SPIEGAZIONE, non il nome: il termine arriva dal
  // testo com'è scritto lì, e toccare «warren» in fondo a una frase non deve
  // degradare la «Warren» che avevi salvato
  t.eq("e il nome resta com'era", voci[0].t, "Warren");

  voci = aggiungi(voci, "Ascendant", "Chi ha superato la soglia del potere");
  t.eq("adesso due", voci.length, 2);
  t.eq("e stanno in ordine alfabetico", voci[0].t, "Ascendant");

  // una voce senza spiegazione non e' una voce
  t.eq("niente spiegazione, niente voce", aggiungi(voci, "Tiste", "").length, 2);
  t.eq("niente termine nemmeno", aggiungi(voci, "  ", "qualcosa").length, 2);

  t.c("si ritrova senza badare alle maiuscole", cerca(voci, "WARREN")?.t === "Warren");
  t.eq("e quello che non c'e' non si trova", cerca(voci, "Draconus"), null);
  t.eq("togliere ne leva una", togli(voci, "warren").length, 1);
  t.eq("togliere quello che non c'e' non fa danni", togli(voci, "Draconus").length, 2);

  // ---- LA FUSIONE ALL'INGRESSO -------------------------------------------
  // La regola di sempre: quello che e' gia' qui resta com'e', dall'archivio
  // si prende solo cio' che manca. Qui e' importante piu' che altrove: una
  // spiegazione corretta ieri non deve tornare quella sbagliata di marzo.
  const locali = {
    "saga:malazan": [{ t: "Warren", d: "la MIA spiegazione, corretta ieri", addedAt: 2 }],
  };
  const archivio = {
    "saga:malazan": [
      { t: "warren", d: "la vecchia spiegazione dell'archivio", addedAt: 1 },
      { t: "Ascendant", d: "chi ha superato la soglia", addedAt: 1 },
    ],
    "saga:first law": [{ t: "Bayaz", d: "il primo dei Magi", addedAt: 1 }],
  };
  const esito = fondi(locali, archivio);
  t.eq("due termini nuovi entrano", esito.nuove, 2);
  t.c(
    "ma la MIA spiegazione resta la mia",
    /corretta ieri/.test(cerca(esito.glossari["saga:malazan"], "Warren").d),
    cerca(esito.glossari["saga:malazan"], "Warren").d
  );
  t.eq("il termine che mancava e' entrato", esito.glossari["saga:malazan"].length, 2);
  t.eq("e una saga che qui non c'era arriva intera", esito.glossari["saga:first law"].length, 1);

  // ripetere il ripristino non deve aggiungere niente una seconda volta
  t.eq("il secondo giro non aggiunge nulla", fondi(esito.glossari, archivio).nuove, 0);

  // ---- quello che non e' un glossario ------------------------------------
  t.eq("un archivio senza glossari", fondi(locali, {}).nuove, 0);
  t.eq("un archivio con dentro spazzatura", fondi({}, { "saga:x": "non un elenco" }).nuove, 0);
  t.eq("voci monche si saltano", fondi({}, { "saga:x": [{ t: "solo il nome" }] }).nuove, 0);
  t.eq("niente del tutto", fondi().nuove, 0);

  // ---- il conto che si mostra prima di ripristinare ----------------------
  t.eq("quanti termini in tutto", quantiTermini(archivio), 3);
  t.eq("un archivio senza glossari non ne ha", quantiTermini(), 0);
  t.eq("e nemmeno uno vuoto", quantiTermini({}), 0);
}

// LA RICERCA SULLO SCAFFALE.
//
// Cercava su titolo, autore e saga. Il genere, il ciclo e le note che
// scrivi tu nella scheda del libro restavano fuori — e le note sono
// l'unico campo che nessun altro posto dell'app sa cercare, perche' il
// giardino delle citazioni cerca le note SULLE CITAZIONI, che sono
// un'altra cosa.
import { combacia, CAMPI_RICERCA } from "../src/lib/library.js";

const LIBRO = {
  title: "Best Served Cold",
  author: "Joe Abercrombie",
  saga: "First Law",
  series: "Vendette",
  genre: "Fantasy · Grimdark",
  notes: "quello col finale che non mi torna",
};

export default async function (t) {
  // ---- i campi che c'erano gia' ------------------------------------------
  t.c("il titolo", combacia(LIBRO, "served"));
  t.c("l'autore", combacia(LIBRO, "abercrombie"));
  t.c("la saga", combacia(LIBRO, "first law"));

  // ---- E QUELLI CHE MANCAVANO --------------------------------------------
  t.c("il genere", combacia(LIBRO, "grimdark"));
  // la famiglia da sola deve bastare: sullo scaffale i gruppi sono quelli
  t.c("la famiglia del genere", combacia(LIBRO, "fantasy"));
  t.c("il ciclo", combacia(LIBRO, "vendette"));
  // IL CAMPO CHE NESSUNO SAPEVA CERCARE: potevi scrivere una nota e poi
  // non ritrovare mai piu' il libro
  t.c("le note che hai scritto tu", combacia(LIBRO, "non mi torna"));

  // ---- quello che non c'entra non deve combaciare ------------------------
  t.c("una parola che non c'è da nessuna parte", !combacia(LIBRO, "malazan"));
  // se bastasse un campo qualunque a caso, il test sopra non varrebbe:
  // qui si controlla che la ricerca non prenda TUTTO
  t.c("nemmeno mezza parola inventata", !combacia(LIBRO, "grimdarkness"));

  // ---- la casella vuota mostra tutto -------------------------------------
  // e' lo stato normale della Libreria: senza questo lo scaffale sarebbe
  // vuoto finche' non scrivi qualcosa
  t.c("nessuna ricerca, tutti i libri", combacia(LIBRO, ""));
  t.c("solo spazi è come niente", combacia(LIBRO, "   "));
  t.c("e niente del tutto", combacia(LIBRO, undefined));

  // ---- i campi vuoti non fanno esplodere niente --------------------------
  // un libro entrato senza metadati ha quasi tutto vuoto
  const nudo = { title: "senzanome.epub" };
  t.c("un libro coi campi vuoti si cerca lo stesso", combacia(nudo, "senzanome"));
  t.c("e non combacia per i campi che non ha", !combacia(nudo, "fantasy"));
  t.c("niente libro, niente risultato", !combacia(null, "mort"));

  // ---- GLI ACCENTI SI APPIANANO DA TUTT'E DUE I LATI ---------------------
  // sul tablet la tastiera l'accento te lo scrive, ma nessuno cerca
  // accentato: un titolo perso per una dieresi è un titolo perso
  t.c("cerco senza accento, il titolo ce l'ha", combacia({ title: "Perché no" }, "perche"));
  t.c("e al contrario", combacia({ title: "Perche no" }, "perché"));
  t.c("vale anche sull'autore", combacia({ author: "Émile Zola" }, "emile"));

  // ---- maiuscole indifferenti -------------------------------------------
  t.c("scrivo tutto maiuscolo", combacia(LIBRO, "ABERCROMBIE"));
  t.c("e il libro è maiuscolo e io no", combacia({ title: "MORT" }, "mort"));

  // ---- l'elenco dei campi è quello che dice di essere -------------------
  // se qualcuno aggiunge un campo alla ricerca senza pensarci, qui si vede
  for (const c of ["title", "author", "saga", "series", "genre", "notes"])
    t.c(`«${c}» è fra i campi cercati`, CAMPI_RICERCA.includes(c));
  t.c("e non se ne cercano altri per sbaglio", CAMPI_RICERCA.length === 6, CAMPI_RICERCA.join(","));
}

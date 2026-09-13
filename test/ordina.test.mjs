// Il piano che ordina una cartella per saga. E' la parte che sbaglia in
// silenzio: un libro finito nella cartella sbagliata non alza nessun
// errore, e lo script lo sposta davvero. Si prova con record finti e col
// path di Node, senza toccare il disco.
import path from "node:path";
import { assegnaSaghe, pianifica, nomeCartella, CARTELLA_MAX } from "../src/lib/ordinaCartella.js";

const libro = (nome, extra = {}) => ({
  id: nome,
  path: path.join("/libri", nome),
  fileName: nome,
  title: nome.replace(/\.epub$/, ""),
  author: "",
  collana: null,
  ...extra,
});

export default async function (t) {
  // ---- IL NOME DELLA CARTELLA ------------------------------------------
  t.eq("un nome pulito resta", nomeCartella("Malazan"), "Malazan");
  t.eq("i due punti diventano un trattino", nomeCartella("Malazan: Book of the Fallen"), "Malazan - Book of the Fallen");
  t.eq("i caratteri vietati da Windows spariscono", nomeCartella('A/B\\C<D>E"F|G?H*I'), "A B C D E F G H I");
  t.eq("niente punto in coda, che Windows tronca", nomeCartella("Vol. "), "Vol");
  t.eq("vuoto è null", nomeCartella("   "), null);
  t.c("e non passa il tetto", nomeCartella("x".repeat(200)).length <= CARTELLA_MAX);

  // ---- LA CATENA: tavola, collana, titolo, fratelli ----------------------
  const libri = [
    libro("Guards! Guards!.epub", { author: "Terry Pratchett" }),
    libro("Empire in Black and Gold.epub", {
      author: "Adrian Tchaikovsky",
      collana: { serie: "Shadows of the Apt", numero: 1 },
    }),
    libro("Malice.epub", { title: "Malice: The Faithful and the Fallen Series Book 1", author: "John Gwynne" }),
    libro("Valour.epub", { title: "02 Valour", author: "John Gwynne" }),
    libro("Piranesi.epub", { author: "Susanna Clarke" }),
    // la stessa saga scritta senza l'articolo: una cartella sola
    libro("Dragonfly Falling.epub", {
      author: "Adrian Tchaikovsky",
      collana: { serie: "The Shadows of the Apt", numero: 2 },
    }),
  ];
  const a = assegnaSaghe(libri);
  const di = (nome) => a.find((b) => b.id === nome);
  t.eq("la tavola riconosce Pratchett", di("Guards! Guards!.epub").saga, "Discworld");
  t.eq("e dice da dove", di("Guards! Guards!.epub").fonte, "tavola");
  t.eq("la collana del file", di("Empire in Black and Gold.epub").saga, "Shadows of the Apt");
  t.eq("col suo numero", di("Empire in Black and Gold.epub").sagaOrder, 1);
  t.eq("il titolo", di("Malice.epub").saga, "The Faithful and the Fallen");
  t.eq("il fratello la eredita", di("Valour.epub").saga, "The Faithful and the Fallen");
  t.eq("e col numero in testa prende il posto", di("Valour.epub").sagaOrder, 2);
  t.eq("dai fratelli, detto", di("Valour.epub").fonte, "fratelli");
  t.eq("un romanzo a sé resta senza", di("Piranesi.epub").saga, "");
  t.eq(
    "due grafie della stessa saga fanno una cartella",
    di("Dragonfly Falling.epub").saga,
    di("Empire in Black and Gold.epub").saga
  );

  // E LA GRAFIA DI CASA NON BASTA quando la tavola arriva DOPO un file:
  // «Horus Heresy» letta dalla collana di un autore sconosciuto, poi la
  // tavola che scrive «The Horus Heresy» — senza l'unificazione finale
  // sarebbero due cartelle per la stessa saga (mutazione provata)
  const grafie = assegnaSaghe([
    libro("Un romanzo.epub", { author: "Nessuno", collana: { serie: "Horus Heresy", numero: 40 } }),
    libro("Horus Rising (Horus Heresy 1).pdf", { title: "Horus Rising (Horus Heresy 1)" }),
  ]);
  t.eq("tavola e file scrivono la stessa cartella", grafie[0].saga, grafie[1].saga);
  t.eq("e vince la forma piena", grafie[1].saga, "The Horus Heresy");

  // ---- IL PIANO ----------------------------------------------------------
  const piano = pianifica(a, "/libri", path);
  t.eq("chi non ha saga non si muove", piano.senza.length, 1);
  t.eq("gli altri si spostano", piano.mosse.length, 5);
  const m = piano.mosse.find((x) => x.id === "Malice.epub");
  t.eq("nella cartella della saga", m.a, path.join("/libri", "The Faithful and the Fallen", "Malice.epub"));
  t.eq("la cartella si conta", piano.saghe.get("The Faithful and the Fallen"), 2);

  // già a posto: un file che sta GIA' nella cartella della sua saga
  const fermo = assegnaSaghe([
    libro("Guards! Guards!.epub", { author: "Terry Pratchett", path: path.join("/libri", "Discworld", "Guards! Guards!.epub") }),
  ]);
  const p2 = pianifica(fermo, "/libri", path);
  t.eq("resta fermo", p2.ferme.length, 1);
  t.eq("e non è una mossa", p2.mosse.length, 0);

  // LE CARTELLE CHE CI SONO GIA' NON DICONO NIENTE: un romanzo a sé dentro
  // «Susanna Clarke» resta lì, non prende la cartella per saga
  const inAutore = assegnaSaghe([
    libro("Piranesi.epub", { author: "Susanna Clarke", path: path.join("/libri", "Susanna Clarke", "Piranesi.epub") }),
  ]);
  t.eq("la cartella dell'autore non è una saga", inAutore[0].saga, "");

  // ---- MAI SOVRASCRIVERE -----------------------------------------------
  const due = assegnaSaghe([
    libro("Mort.epub", { author: "Terry Pratchett", path: "/libri/a/Mort.epub" }),
    libro("Mort.epub", { id: "b", author: "Terry Pratchett", path: "/libri/b/Mort.epub" }),
  ]);
  const p3 = pianifica(due, "/libri", path);
  t.eq("il primo si sposta", p3.mosse.length, 1);
  t.eq("il secondo si ferma e si dichiara", p3.doppioni.length, 1);
  // e vale anche contro un file che nella cartella c'è già
  const tre = assegnaSaghe([
    libro("Mort.epub", { author: "Terry Pratchett", path: "/libri/Discworld/Mort.epub" }),
    libro("Mort.epub", { id: "b", author: "Terry Pratchett", path: "/libri/b/Mort.epub" }),
  ]);
  const p4 = pianifica(tre, "/libri", path);
  t.eq("chi è già lì tiene il posto", p4.ferme.length, 1);
  t.eq("e l'omonimo non gli va sopra", p4.doppioni.length, 1);
}

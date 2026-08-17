// Il giardino non aveva una porta d'uscita: le citazioni si vedevano e si
// cancellavano, non si copiavano ne' si cercavano. Qui si prova la parte
// che non ha bisogno di un DOM — e in particolare le due regole che a
// leggere il diff sembrano dettagli e non lo sono: a riposo i segnalibri
// restano fuori, e il titolo del libro non li tira dentro.
import { raccogli, filtra, conta, testoCitazione, esporta } from "../src/lib/citazioni.js";

const LIBRI = [
  { id: "gg", title: "Guards! Guards!", author: "Terry Pratchett" },
  { id: "bsc", title: "Best Served Cold", author: "Joe Abercrombie" },
  { id: "vuoto", title: "Un libro mai segnato", author: "Nessuno" },
];

const ANNOT = {
  gg: {
    highlights: [
      { id: "h1", text: "Il drago è tornato", color: "#d9a94e", createdAt: 1700000000000 },
      { id: "h2", text: "Un milione di dollari", note: "la battuta sulla ricompensa", createdAt: 1700100000000 },
    ],
    marks: [
      { id: "m1", cfi: "x", label: "Capitolo dei nani · 34%" },
      { id: "m2", cfi: "y", label: "Capitolo 12 · 78%" },
    ],
  },
  bsc: {
    highlights: [{ id: "h3", text: "La vendetta è un piatto freddo", createdAt: 1700200000000 }],
    marks: [],
  },
  vuoto: { highlights: [], marks: [] },
};

const leggi = (id) => ANNOT[id];

export default async function (t) {
  const tutti = raccogli(LIBRI, leggi);
  t.eq("un libro senza niente non fa gruppo", tutti.length, 2);
  t.eq("le citazioni ci sono", conta(tutti).citazioni, 3);
  t.eq("e i segnalibri anche", conta(tutti).segni, 2);
  t.eq("un lettore muto non esplode", raccogli(LIBRI, () => null).length, 0);
  t.eq("niente libri, niente gruppi", raccogli().length, 0);

  // ---- A RIPOSO IL GIARDINO E' UN GIARDINO ------------------------------
  // i segnalibri hanno etichette scritte dall'app: mostrarli sempre
  // seppellirebbe le citazioni sotto righe che non hai scritto tu
  const fermo = filtra(tutti, "");
  t.eq("senza ricerca le citazioni ci sono tutte", conta(fermo).citazioni, 3);
  t.eq("ma i segnalibri restano fuori", conta(fermo).segni, 0);
  t.eq("e gli spazi non sono una ricerca", conta(filtra(tutti, "   ")).segni, 0);

  // ---- cercando ----------------------------------------------------------
  const drago = filtra(tutti, "drago");
  t.eq("un solo libro risponde", drago.length, 1);
  t.eq("e una sola citazione", conta(drago).citazioni, 1);

  t.eq("si cerca anche nelle TUE note", conta(filtra(tutti, "ricompensa")).citazioni, 1);
  t.eq("e nelle etichette dei segnalibri", conta(filtra(tutti, "nani")).segni, 1);
  t.c(
    "il segnalibro trovato non si porta dietro le citazioni",
    conta(filtra(tutti, "nani")).citazioni === 0
  );

  // maiuscole e accenti non devono decidere niente
  t.eq("le maiuscole non contano", conta(filtra(tutti, "DRAGO")).citazioni, 1);
  t.eq("gli accenti nemmeno", conta(filtra(tutti, "e tornato")).citazioni, 1);

  // ---- il titolo del libro tira dentro le citazioni, NON i segnalibri ----
  // cercare «Pratchett» deve dare quello che hai segnato di Pratchett; se
  // tirasse dentro anche i segnalibri, su un romanzo pieno di segni le
  // citazioni sparirebbero sotto quaranta righe automatiche
  const perAutore = filtra(tutti, "Pratchett");
  t.eq("l'autore vale per le citazioni", conta(perAutore).citazioni, 2);
  t.eq("ma non chiama i segnalibri", conta(perAutore).segni, 0);
  t.eq("e il titolo funziona uguale", conta(filtra(tutti, "Guards")).citazioni, 2);

  t.eq("una ricerca senza risposta non da' gruppi", filtra(tutti, "zzzz").length, 0);

  // ---- la citazione copiata deve reggersi in piedi da sola --------------
  const uno = testoCitazione(ANNOT.gg.highlights[1], LIBRI[0]);
  t.c("c'e' il testo fra virgolette", /«Un milione di dollari»/.test(uno));
  t.c("c'e' da dove viene", /Guards! Guards! — Terry Pratchett/.test(uno), uno);
  t.c("e c'e' la tua nota", /✎ la battuta sulla ricompensa/.test(uno));
  const nudo = testoCitazione({ text: "Solo questo" }, {});
  t.eq("senza libro resta la sola frase", nudo, "«Solo questo»");

  // ---- l'esportazione ----------------------------------------------------
  const md = esporta(filtra(tutti, ""), 1700300000000);
  t.c("c'e' un titolo", /^# Il giardino delle citazioni/.test(md));
  t.c("il sommario conta i passaggi", /3 passaggi/.test(md), md.split("\n")[2]);
  t.c("i libri sono intestazioni", /## Guards! Guards!/.test(md) && /## Best Served Cold/.test(md));
  t.c("le citazioni sono citazioni markdown", /> Il drago è tornato/.test(md));
  t.c("la nota resta attaccata alla sua", /> ✎ la battuta sulla ricompensa/.test(md));
  t.c("e non ci sono voragini di righe vuote", !/\n{3,}/.test(md));
  t.c("finisce con un a capo solo", md.endsWith("\n") && !md.endsWith("\n\n"));

  // SI ESPORTA QUELLO CHE STAI GUARDANDO: cercare e poi ricevere tutto
  // sarebbe una sorpresa sgradita
  const soloDrago = esporta(filtra(tutti, "drago"));
  t.c("l'export segue la ricerca", /Il drago/.test(soloDrago) && !/vendetta/.test(soloDrago));
  t.c("e il sommario dice un passaggio, non tre", /1 passaggio/.test(soloDrago), soloDrago.split("\n")[2]);

  // il segnalibro trovato finisce nell'export con la sua faccia
  const conSegno = esporta(filtra(tutti, "nani"));
  t.c("il segnalibro esportato si riconosce", /- 🔖 Capitolo dei nani/.test(conSegno));

  t.c("un giardino vuoto non esplode", esporta([]).length > 0);
}

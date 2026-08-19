// ABBANDONARE NON E' FINIRE. Senza questo stato, un romanzo mollato restava
// «in lettura» per sempre — in cima all'Ingresso, a fingere che tu lo stessi
// leggendo — e l'unico modo di toglierlo di lì era dichiararlo letto, cioè
// una bugia che poi ti ritrovavi nel diario dell'anno.
//
// Qui si prova la parte che conta: cosa succede alle DATE, e cosa il diario
// decide di contare.

const memoria = {};
for (const [nome, fn] of Object.entries({
  getItem: (k) => (k in memoria ? memoria[k] : null),
  setItem: (k, v) => {
    memoria[k] = String(v);
  },
  removeItem: (k) => {
    delete memoria[k];
  },
})) {
  Object.defineProperty(memoria, nome, { value: fn, enumerable: false });
}
globalThis.localStorage = memoria;

const { setStatus, getStatus, getStarted, getFinished } = await import("../src/lib/library.js");
const { buildDiary } = await import("../src/lib/diary.js");

const pulisci = () => {
  for (const k of Object.keys(memoria)) delete memoria[k];
};

export default async function (t) {
  // ---- le date, che sono il punto ---------------------------------------
  pulisci();
  setStatus("a", "reading");
  const inizio = getStarted("a");
  t.c("cominciare segna la data d'inizio", inizio > 0);

  setStatus("a", "abandoned");
  t.eq("lo stato è quello", getStatus("a"), "abandoned");
  // LA DATA D'INIZIO RESTA: quel libro l'hai davvero cominciato, ed è un
  // pezzo della tua storia di lettore
  t.eq("l'inizio resta com'era", getStarted("a"), inizio);
  t.eq("e non c'è nessuna fine", getFinished("a"), 0);

  // ---- il caso che sporca i conti ---------------------------------------
  // un libro prima dichiarato letto e poi mollato: senza togliere la data
  // di fine resterebbe fra i finiti, e il conto dell'anno direbbe una cosa
  // che non è successa
  pulisci();
  setStatus("b", "reading");
  setStatus("b", "read");
  t.c("finito ha la sua data", getFinished("b") > 0);
  setStatus("b", "abandoned");
  t.eq("mollandolo la fine se ne va", getFinished("b"), 0);
  t.c("ma l'inizio no", getStarted("b") > 0);

  // abbandonare un libro mai aperto: l'inizio si segna adesso, perché
  // mollarlo è comunque un momento della tua lettura
  pulisci();
  setStatus("c", "abandoned");
  t.c("un abbandono a freddo segna comunque l'inizio", getStarted("c") > 0);
  t.eq("e nessuna fine", getFinished("c"), 0);

  // ---- ripensarci --------------------------------------------------------
  pulisci();
  setStatus("d", "abandoned");
  setStatus("d", "reading");
  t.eq("riprenderlo è tornare in lettura", getStatus("d"), "reading");
  setStatus("d", "read");
  t.c("e finirlo davvero rimette la fine", getFinished("d") > 0);
  // «da leggere» resta l'azzeramento esplicito di sempre
  setStatus("d", "unread");
  t.eq("azzerare azzera l'inizio", getStarted("d"), 0);
  t.eq("e la fine", getFinished("d"), 0);

  // ---- IL DIARIO NON CONTA GLI ABBANDONATI ------------------------------
  const libri = [{ id: "x", title: "Finito" }, { id: "y", title: "Mollato" }, { id: "z", title: "In corso" }];
  const stati = {
    x: { started: 1000, finished: 2000, status: "read" },
    // il caso sporco: ha ancora tutt'e due i segni, ma lo stato dice mollato
    y: { started: 1000, finished: 2000, status: "abandoned" },
    z: { started: 1500, finished: 0, status: "reading" },
  };
  const d = buildDiary(libri, (id) => stati[id]);
  t.eq("un solo libro finito", d.total, 1);
  t.c("ed è quello giusto", d.years[0].entries[0].book.id === "x");
  t.eq("uno solo in lettura", d.reading.length, 1);
  t.c("e non è il mollato", d.reading[0].book.id === "z");
  // NEL DUBBIO COMANDA LO STATO: `setStatus` la data di fine la toglie già,
  // ma un archivio vecchio o un dispositivo rimasto indietro possono avere
  // tutt'e due i segni, e lì il diario non deve fidarsi della sola data
  t.c(
    "un abbandonato con la data di fine addosso resta fuori",
    !d.years.some((a) => a.entries.some((e) => e.book.id === "y"))
  );

  pulisci();
}

// LA SALA DELLA MUSICA COME UN LETTORE MUSICALE (`src/lib/salaMusica.js`):
// la ricerca, l'ordine dei brani, le lettere dell'indice, la vista che si
// apre. Chiesto dal lettore con 87 brani in fila: «non sia una sfilza
// lunghissima di brani uno sotto l'altro».
import {
  normale,
  corrisponde,
  braniInVista,
  letteraDi,
  perLettera,
  raccolteInVista,
  inQuante,
  vistaIniziale,
  ordineSalvato,
  salvaOrdine,
} from "../src/lib/salaMusica.js";

const b = (id, name, addedAt = 0, extra = {}) => ({ id, name, addedAt, ...extra });

export default async function (t) {
  // ---- LA RICERCA ---------------------------------------------------------
  t.eq("senza accenti e senza maiuscole", normale("Città ETERNA"), "citta eterna");
  t.c("ogni parola cercata, in qualunque ordine e anche a metà", corrisponde("templ black", "Black Templars (Warhammer 40,000)"));
  t.c("la punteggiatura è uno spazio", corrisponde("40 000", "Black Templars (Warhammer 40,000)"));
  t.c("una parola che manca non trova", !corrisponde("black orks", "Black Templars"));
  t.c("gli accenti non contano", corrisponde("citta", "La Città Eterna"));
  t.c("una ricerca vuota trova tutto", corrisponde("   ", "Acolyte"));

  // ---- L'ORDINE -----------------------------------------------------------
  const brani = [
    b("1", "10 - Siege of Terra", 3),
    b("2", "atonement", 1),
    b("3", "2 - Cadia Stands", 5),
    b("4", "Ave Dominus Nox", 2),
    b("5", "Bionic Gods", 4, { deleted: true }),
    b("6", "Échoes", 6),
  ];
  t.eq(
    "A–Z: i numeri contati da numeri, le maiuscole non contano, i tolti fuori",
    braniInVista(brani).map((x) => x.id).join(","),
    "3,1,2,4,6"
  );
  t.eq("gli ultimi arrivati in cima", braniInVista(brani, { ordine: "recenti" }).map((x) => x.id).join(","), "6,3,1,4,2");
  t.eq("la ricerca restringe la lista", braniInVista(brani, { cerca: "terra" }).map((x) => x.id).join(","), "1");
  t.c("la lista non tocca l'elenco salvato", brani[0].id === "1");

  // ---- LE LETTERE ---------------------------------------------------------
  t.eq("le cifre stanno sotto «#»", letteraDi("10 - Siege"), "#");
  t.eq("la lettera senza accento e maiuscola", letteraDi("échoes"), "E");
  t.eq("le virgolette davanti non contano", letteraDi("«Ave Maria»"), "A");
  const gruppi = perLettera(braniInVista(brani));
  t.eq("un gruppo per lettera, nell'ordine della lista", gruppi.map((g) => g.lettera).join(""), "#AE");
  t.eq("ogni brano tiene il suo posto nella lista intera", gruppi[1].brani.map((x) => x.i).join(","), "2,3");

  // ---- RACCOLTE -----------------------------------------------------------
  const raccolte = [
    { id: "r1", name: "WARHAMMER 40k", brani: ["1", "3"] },
    { id: "r2", name: "Horror playlist", brani: ["1"] },
    { id: "r3", name: "Vecchia", brani: ["1"], deleted: true },
    { id: "r4", name: "Appena fatta" },
  ];
  t.eq("le raccolte che la ricerca trova, vive", raccolteInVista(raccolte, "warham").map((r) => r.id).join(","), "r1");
  t.eq("senza ricerca tutte le vive, nel loro ordine", raccolteInVista(raccolte).map((r) => r.id).join(","), "r1,r2,r4");
  t.eq("in quante raccolte sta un brano, le tolte no", inQuante(brani[0], raccolte), 2);

  // ---- LA VISTA -----------------------------------------------------------
  t.eq("si riapre la vista lasciata", vistaIniziale("brani", 3), "brani");
  t.eq("la prima volta le raccolte, se ci sono", vistaIniziale(null, 2), "raccolte");
  t.eq("e senza raccolte i brani", vistaIniziale(null, 0), "brani");
  t.eq("una vista sconosciuta non vale", vistaIniziale("boh", 0), "brani");

  // ---- L'ORDINE SI RICORDA ------------------------------------------------
  const prima = globalThis.localStorage;
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
  try {
    t.eq("senza scelta, A–Z", ordineSalvato(), "nome");
    salvaOrdine("recenti");
    t.eq("l'ordine scelto si ricorda", ordineSalvato(), "recenti");
    salvaOrdine("strano");
    t.eq("un ordine sconosciuto torna A–Z", ordineSalvato(), "nome");
  } finally {
    globalThis.localStorage = prima;
  }
}

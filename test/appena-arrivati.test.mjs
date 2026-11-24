// GLI APPENA ARRIVATI SULL'INGRESSO (`appenaArrivati`/`quandoArrivato` in
// `lib/library.js`). Sbagliano in silenzio: un libro di due mesi fa fra i
// nuovi, o uno nuovo che manca, non alzano nessun errore.
import { appenaArrivati, quandoArrivato, ARRIVATI_GIORNI, ARRIVATI_MAX } from "../src/lib/library.js";

export default async function (t) {
  const ora = new Date(2026, 8, 28, 20).getTime();
  const G = 24 * 60 * 60 * 1000;
  const libri = [
    { id: "vecchio", addedAt: ora - (ARRIVATI_GIORNI + 1) * G },
    { id: "ieri", addedAt: ora - G },
    { id: "oggi", addedAt: ora - 1000 },
    { id: "letto", addedAt: ora - 2000 },
    { id: "lasciato", addedAt: ora - 3000 },
    { id: "futuro", addedAt: ora + G },
    { id: "senza" },
    { id: "limite", addedAt: ora - ARRIVATI_GIORNI * G + 1 },
  ];
  const stati = { letto: "read", lasciato: "abandoned" };
  const statusOf = (id) => stati[id] || "unread";
  const ids = (xs) => xs.map((b) => b.id).join(",");

  t.eq("dal piu' nuovo, entro la finestra", ids(appenaArrivati(libri, { ora, statusOf })), "oggi,ieri,limite");
  t.c("un libro fuori dalla finestra non e' nuovo", !appenaArrivati(libri, { ora, statusOf }).some((b) => b.id === "vecchio"));
  t.c("un letto e un lasciato non sono novita'", !appenaArrivati(libri, { ora, statusOf }).some((b) => b.id === "letto" || b.id === "lasciato"));
  t.c("un orologio sballato in avanti non fa un nuovo arrivato", !appenaArrivati(libri, { ora, statusOf }).some((b) => b.id === "futuro"));
  t.c("senza data d'ingresso non e' nuovo", !appenaArrivati(libri, { ora, statusOf }).some((b) => b.id === "senza"));
  t.eq("chi e' gia' in vista altrove non si ripete", ids(appenaArrivati(libri, { ora, statusOf, escludi: new Set(["oggi"]) })), "ieri,limite");

  const tanti = Array.from({ length: ARRIVATI_MAX + 5 }, (_, i) => ({ id: `x${i}`, addedAt: ora - i * 1000 }));
  t.eq(`al massimo ${ARRIVATI_MAX}`, appenaArrivati(tanti, { ora, statusOf }).length, ARRIVATI_MAX);
  t.eq("…i piu' nuovi", appenaArrivati(tanti, { ora, statusOf })[0].id, "x0");
  t.eq("niente libri, niente fila", appenaArrivati(null, { ora, statusOf }).length, 0);

  // i giorni del calendario, non le ore
  t.eq("stamattina e' oggi", quandoArrivato(new Date(2026, 8, 28, 1).getTime(), ora), "arrivato oggi");
  t.eq("ieri sera tardi e' ieri, anche a meno di 24 ore", quandoArrivato(new Date(2026, 8, 27, 23).getTime(), ora), "arrivato ieri");
  t.eq("tre giorni fa", quandoArrivato(new Date(2026, 8, 25, 22).getTime(), ora), "arrivato 3 giorni fa");
}

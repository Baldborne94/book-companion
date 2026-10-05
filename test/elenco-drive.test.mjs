// L'ELENCO DI DRIVE SI TIENE E SI AGGIORNA COI CAMBIAMENTI (`driveCore.js`).
// Le decisioni che sbagliano in silenzio: cosa si tiene, cosa se ne va,
// quando l'elenco tenuto non vale piu' e si rifa' da capo.
import {
  daTenereNellElenco,
  applicaCambiamenti,
  elencoBuono,
  segnoScaduto,
  RIFAI_ELENCO,
  VERSIONE_ELENCO,
  fileDellElenco,
  cartelleDellElenco,
  audioDellElenco,
  potaElenco,
} from "../src/lib/driveCore.js";
import { letturaUnica } from "../src/lib/library.js";

const CARTELLA = "application/vnd.google-apps.folder";

export default async function (t) {
  // ---- cosa si tiene: quel che le tre domande di prima prendevano ----
  t.c("un libro si tiene", daTenereNellElenco({ id: "a", name: "Mort.epub" }));
  t.c("una cartella si tiene", daTenereNellElenco({ id: "a", name: "Libri", mimeType: CARTELLA }));
  t.c("un file audio si tiene anche senza estensione", daTenereNellElenco({ id: "a", name: "brano", mimeType: "audio/mpeg" }));
  t.c("un documento di Google no", !daTenereNellElenco({ id: "a", name: "Appunti", mimeType: "application/vnd.google-apps.document" }));
  t.c("un file cestinato no", !daTenereNellElenco({ id: "a", name: "Mort.epub", trashed: true }));
  t.c("un file senza id no", !daTenereNellElenco({ name: "Mort.epub" }));
  // SOLO QUEL CHE L'APP GUARDA (segnalato dal lettore: il giro fermo su
  // «Guardo i libri»; il suo Drive ha 1,5 TB di altro)
  t.c("una foto no", !daTenereNellElenco({ id: "a", name: "IMG_2041.jpg", mimeType: "image/jpeg" }));
  t.c("un documento con estensione no", !daTenereNellElenco({ id: "a", name: "bollette.xlsx" }));
  t.c("ogni formato di libro si'", ["a.pdf", "b.cbz", "c.cbr", "d.EPUB"].every((name) => daTenereNellElenco({ id: "x", name })));
  t.c("un brano dal nome, anche col tipo sbagliato", daTenereNellElenco({ id: "a", name: "Pioggia.mp3", mimeType: "application/octet-stream" }));
  const vecchio = { a: { id: "a", name: "Mort.epub" }, b: { id: "b", name: "IMG.jpg" }, c: { id: "c", name: "Libri", mimeType: CARTELLA }, d: { id: "d", name: "Arpa.flac" } };
  t.eq("un elenco salvato con la regola di prima si sfoltisce", Object.keys(potaElenco(vecchio)).join(), "a,c,d");
  t.eq("e l'elenco di prima non si tocca", Object.keys(vecchio).length, 4);
  t.eq("e si sfoltisce al primo giro dei cambiamenti, anche senza cambiamenti", Object.keys(applicaCambiamenti(vecchio, [])).join(), "a,c,d");

  // ---- i cambiamenti ----
  const prima = { a: { id: "a", name: "Mort.epub" }, b: { id: "b", name: "Eric.epub" }, c: { id: "c", name: "Sourcery.epub" } };
  const dopo = applicaCambiamenti(prima, [
    { fileId: "a", removed: true },
    { fileId: "b", file: { id: "b", name: "Eric.epub", trashed: true } },
    { fileId: "d", file: { id: "d", name: "Guards.epub", size: "5" } },
    { fileId: "c", file: { id: "c", name: "Sourcery (nuovo).epub" } },
    { changeType: "drive", driveId: "X" },
    { fileId: "e", file: { id: "e", name: "Appunti", mimeType: "application/vnd.google-apps.document" } },
  ]);
  t.eq("tolto e cestinato se ne vanno, il nuovo entra", Object.keys(dopo).sort().join(), "c,d");
  t.eq("il cambiato prende il posto di prima", dopo.c.name, "Sourcery (nuovo).epub");
  t.c("il campo del cestino non resta sul file", !("trashed" in dopo.d));
  t.eq("l'elenco di prima non si tocca", Object.keys(prima).sort().join(), "a,b,c");
  const irrilevante = applicaCambiamenti({ f: { id: "f", name: "x.epub" } }, [{ fileId: "f", file: { id: "f", name: "senza estensione" } }]);
  t.eq("un file che non si tiene piu' se ne va", Object.keys(irrilevante).length, 0);
  t.eq("un elenco mancante parte vuoto", Object.keys(applicaCambiamenti(null, [{ fileId: "z", file: { id: "z", name: "z.pdf" } }])).join(), "z");

  // ---- quando l'elenco tenuto vale ----
  const ora = 1_000_000_000_000;
  const buono = { v: VERSIONE_ELENCO, segno: "S", quando: ora - 1000, file: {} };
  t.c("un elenco di ieri vale", elencoBuono(buono, ora));
  t.c("uno di una settimana fa si rifa'", !elencoBuono({ ...buono, quando: ora - RIFAI_ELENCO }, ora));
  t.c("…uno di un momento prima vale ancora", elencoBuono({ ...buono, quando: ora - RIFAI_ELENCO + 1 }, ora));
  t.c("uno dal futuro non vale", !elencoBuono({ ...buono, quando: ora + 1 }, ora));
  t.c("uno di un'altra versione no", !elencoBuono({ ...buono, v: VERSIONE_ELENCO + 1 }, ora));
  t.c("uno senza segno no", !elencoBuono({ ...buono, segno: "" }, ora));
  t.c("uno senza file no", !elencoBuono({ ...buono, file: null }, ora));
  t.c("uno senza data no", !elencoBuono({ ...buono, quando: undefined }, ora));
  t.c("niente non vale", !elencoBuono(null, ora));

  t.c("un 410 e' un segno scaduto", segnoScaduto({ status: 410 }));
  t.c("…anche un 404 e un 400", segnoScaduto({ status: 404 }) && segnoScaduto({ status: 400 }));
  t.c("un 500 no: e' un guasto, e si alza", !segnoScaduto({ status: 500 }));
  t.c("una rete caduta no", !segnoScaduto(new TypeError("Failed to fetch")));

  // ---- le tre domande di prima, sull'elenco ----
  const tutti = [
    { id: "1", name: "Mort.epub" },
    { id: "2", name: "Libri", mimeType: CARTELLA },
    { id: "3", name: "brano.mp3", mimeType: "audio/mpeg" },
    { id: "4", name: "brano", mimeType: "audio/ogg" },
    { id: "5", name: "Libri.v2", mimeType: CARTELLA },
  ];
  t.eq("i file: con un'estensione, cartelle escluse", fileDellElenco(tutti).map((f) => f.id).join(), "1,3");
  t.eq("le cartelle", cartelleDellElenco(tutti).map((f) => f.id).join(), "2,5");
  t.eq("l'audio, per tipo", audioDellElenco(tutti).map((f) => f.id).join(), "3,4");

  // ---- una lettura per chiave (l'Ingresso) ----
  let letture = 0;
  const stato = letturaUnica((id) => {
    letture++;
    return id === "a" ? "read" : undefined;
  });
  stato("a");
  stato("a");
  stato("b");
  stato("b");
  t.eq("ogni chiave si legge una volta, anche quando la risposta e' vuota", letture, 2);
  t.eq("e la risposta e' quella letta", `${stato("a")}|${stato("b")}`, "read|undefined");
  const altra = letturaUnica(() => ++letture);
  t.eq("una memoria nuova rilegge", altra("a"), 3);
}

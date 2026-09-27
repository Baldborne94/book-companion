// IL MANGA E' UN TIPO, NON UN GENERE.
//
// Detto dal lettore davanti al consiglio di scriverlo nel genere: «non
// dovrebbe essere un genere il manga». Il genere dice di cosa parla una
// storia, il tipo che oggetto hai in mano: un manga fantasy e' fantasy nel
// genere e manga nel tipo. La scelta si fa nella scheda e COMANDA; senza
// una scelta restano i segni di prima (verso della scheda del CBZ, genere
// scritto a mano), perche' chi li ha gia' non deve perdere i manga.
//
// Due cose sbagliano in silenzio: una scelta che non viaggia (l'altro
// dispositivo rimette il volume fra i fumetti al primo giro) e una scelta
// «fumetto» che la saga si rimangia.
import { tipiDi, tipoDi, eManga } from "../src/lib/library.js";
import { rowFromLocal, localFromRow, normalizeRow, DEGRADE } from "../src/lib/syncCore.js";
import { FAMIGLIE } from "../src/data/generi.js";

const STATO = { status: "unread", started: 0, finished: 0, progress: 0, cfi: null, marks: [], highlights: [], music: null };

export default async (t) => {
  // ── LA SCELTA COMANDA ────────────────────────────────────────────────
  {
    t.c("«manga» scelto e' un manga", eManga({ fileType: "cbz", tipo: "manga" }));
    t.c("«fumetti» scelto batte il verso da destra", !eManga({ fileType: "cbz", tipo: "fumetti", verso: "rtl" }));
    t.c("…e batte un genere che dice manga", !eManga({ fileType: "cbz", tipo: "fumetti", genre: "Fumetti · Manga" }));
    t.c("senza scelta il genere di prima vale ancora", eManga({ fileType: "cbz", genre: "Fumetti · Manga" }));
    t.c("senza scelta il verso vale ancora", eManga({ fileType: "cbz", verso: "rtl" }));
    t.c("un tipo che non conosciamo non e' una scelta", eManga({ fileType: "cbz", tipo: "boh", verso: "rtl" }));
  }

  // ── LA SAGA SEGUE LA SCELTA, MA NON SE LA RIMANGIA ──────────────────
  {
    const bib = [
      { id: "h2", fileType: "cbz", saga: "Hokuto no Ken", tipo: "manga" },
      { id: "h3", fileType: "cbz", saga: "Hokuto no Ken" },
      { id: "h4", fileType: "cbz", saga: "Hokuto no Ken", tipo: "fumetti" },
      { id: "e1", fileType: "epub", saga: "Hokuto no Ken" },
      { id: "x1", fileType: "cbz", saga: "Hellboy" },
    ];
    const m = tipiDi(bib);
    t.eq("il segnato e' manga", m.get("h2"), "manga");
    t.eq("il fratello senza scelta segue", m.get("h3"), "manga");
    t.eq("il fratello scelto «fumetto» resta fumetto", m.get("h4"), "fumetti");
    t.eq("un romanzo della stessa saga resta un libro", m.get("e1"), "libri");
    t.eq("un'altra saga non si contagia", m.get("x1"), "fumetti");
    t.eq("tipoDi legge la stessa mappa", tipoDi(bib[1], m), "manga");
  }

  // ── E NON E' PIU' UN GENERE ─────────────────────────────────────────
  {
    const fumetti = FAMIGLIE.find((f) => f.nome === "Fumetti");
    t.c("«Manga» non e' piu' fra i generi dei fumetti", !fumetti.sotto.includes("Manga"));
  }

  // ── LA SCELTA VIAGGIA ───────────────────────────────────────────────
  {
    const libro = (extra) => ({ id: "a", title: "V", fileType: "cbz", addedAt: 1, ...extra });
    t.eq("«manga» sale", rowFromLocal(libro({ tipo: "manga" }), STATO, 1).tipo, "manga");
    t.eq("«fumetti» sale", rowFromLocal(libro({ tipo: "fumetti" }), STATO, 1).tipo, "fumetti");
    t.eq("nessuna scelta sale vuota, non muta", rowFromLocal(libro({}), STATO, 1).tipo, null);
    t.eq("un valore storto non sale", rowFromLocal(libro({ tipo: "boh" }), STATO, 1).tipo, null);
    t.c("la colonna c'e' anche su una lapide", "tipo" in normalizeRow({ id: "z", deleted: true }));

    t.eq("scende «manga»", localFromRow({ id: "a", tipo: "manga" }).book.tipo, "manga");
    // una scelta tolta sull'altro dispositivo deve spegnersi anche qui: la
    // ricezione fonde `{...vecchio, ...nuovo}` e una chiave assente
    // lascerebbe la scelta di prima
    t.c("scende vuota, per spegnere", "tipo" in localFromRow({ id: "a", tipo: null }).book);
    t.eq("…e vale «nessuna scelta»", localFromRow({ id: "a", tipo: null }).book.tipo, null);
    // uno schema non migrato non ha la colonna: un `null` inventato
    // cancellerebbe a ogni giro la scelta fatta qui
    t.c("senza la colonna non scende niente", !("tipo" in localFromRow({ id: "a" }).book));
  }

  // ── UNO SCHEMA NON MIGRATO RINUNCIA ALLA SOLA COLONNA ───────────────
  {
    const righe = [{ id: "x", file_type: "cbz", genre: "Fantasy", saga: "S", tipo: "manga" }];
    for (const msg of [
      "Could not find the 'tipo' column of 'books' in the schema cache",
      'column "tipo" of relation "books" does not exist',
    ]) {
      const g = DEGRADE.find((d) => d.test(msg, righe));
      t.eq(`«${msg.slice(0, 32)}…» sceglie il gradino del tipo`, g?.label, "fumetto o manga");
      const dopo = g.apply(righe);
      t.c("…che toglie solo lei", !("tipo" in dopo[0]) && dopo[0].saga === "S" && dopo[0].file_type === "cbz");
    }
    const altro = DEGRADE.find((d) => d.test("Could not find the 'file_type' column of 'books'", righe));
    t.c("«file_type» non e' il tipo", altro?.label !== "fumetto o manga");
  }
};

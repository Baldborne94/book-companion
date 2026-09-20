// TOGLIERE L'EBOOK NON È ELIMINARE IL LIBRO.
//
// Chiesto dal lettore: «quando questo libro è segnato come letto, se
// decidessi di togliere l'ebook vorrei che comunque rimanesse la copertina
// per tenerlo nella libreria, semplicemente non potrei aprirlo per
// leggerlo».
//
// I byte se ne vanno — di qui e dal secchio — e resta tutto il resto. La
// parte che sbaglia in SILENZIO non è la cancellazione: è quello che l'app
// pensa di quel libro il giorno dopo. Un libro senza byte perché il lettore
// li ha buttati e uno senza byte perché sono andati persi sono lo STESSO
// record, e tre funzioni guardano proprio quello — chi risale nel secchio,
// chi accusa i tomi perduti, chi offre di riportarli a casa. Senza il segno
// scritto, l'app disfa la scelta appena fatta e non lo dice a nessuno.
//
// È la lezione della saga tolta a mano, sullo stesso campo vuoto che non si
// vede.
import { banco } from "./aiuto.mjs";
import {
  rowFromLocal,
  localFromRow,
  normalizeRow,
  DEGRADE,
  daCaricare,
  senzaCopia,
  daPortare,
} from "../src/lib/syncCore.js";

const STATO = { status: "read", started: 0, finished: 0, progress: 0, cfi: null, marks: [], highlights: [], music: null };
const libro = (id, extra = {}) => ({ id, title: `Tomo ${id}`, fileType: "epub", addedAt: 1, ...extra });

export default async (t) => {
  // ── IL SEGNO VIAGGIA ──────────────────────────────────────────────────
  {
    const acceso = rowFromLocal(libro("a", { fileTolto: true }), STATO, 5);
    const spento = rowFromLocal(libro("b"), STATO, 5);
    t.eq("l'ebook tolto sale acceso", acceso.file_tolto, true);
    // COME IL CUORE DEI PREFERITI: `false` si manda, non si omette, o non
    // potrebbe mai spegnere un `true` gia' scritto lassu'.
    t.eq("e chi l'ebook ce l'ha sale spento, non muto", spento.file_tolto, false);
    t.c("la colonna c'e' anche su una lapide", "file_tolto" in normalizeRow({ id: "z", deleted: true }));
    t.eq("e nella lapide vale «no»", normalizeRow({ id: "z", deleted: true }).file_tolto, false);
  }

  // ── E SCENDE ANCHE DA SPENTO ──────────────────────────────────────────
  //
  // Questa e' la meta' che si dimentica: la ricezione fonde `{...vecchio,
  // ...nuovo}`, quindi una chiave assente lascia in piedi quella di prima.
  // Reimportato il file altrove, il segno deve potersi SPEGNERE, o il libro
  // resterebbe chiuso per sempre su questo dispositivo.
  {
    t.eq("dal cloud acceso arriva acceso", localFromRow({ id: "a", file_tolto: true }).book.fileTolto, true);
    t.eq("dal cloud spento arriva spento", localFromRow({ id: "a", file_tolto: false }).book.fileTolto, false);
    t.eq("e una colonna che non c'e' vale «no»", localFromRow({ id: "a" }).book.fileTolto, false);
  }

  // ── UNO SCHEMA NON MIGRATO RINUNCIA ALLA SOLA COLONNA ─────────────────
  {
    const msg = "Could not find the 'file_tolto' column of 'books' in the schema cache";
    const righe = [{ id: "x", genre: "Fantasy", saga: "Malazan", saga_order: 1, saga_tolta: false, file_tolto: true }];
    const primo = DEGRADE.find((d) => d.test(msg, righe));
    t.eq("una colonna «file_tolto» sceglie il suo gradino", primo.label, "ebook tolto a mano");
    const dopo = primo.apply(righe);
    t.c("…che toglie solo lei", !("file_tolto" in dopo[0]));
    t.eq("…e lascia in piedi la saga tolta", dopo[0].saga_tolta, false);
    t.eq("…e la saga", dopo[0].saga, "Malazan");
  }

  // ── NON RISALE NEL SECCHIO ────────────────────────────────────────────
  //
  // Il caso che conta e' l'ALTRO dispositivo, dove i byte ci sono ancora:
  // lassu' la copia non c'e' piu', quindi senza questa regola quel libro ha
  // la forma esatta di un file scoperto e ripartirebbe verso il secchio —
  // e il lettore si ritroverebbe la nuvoletta addosso al libro che aveva
  // appena svuotato.
  {
    const libri = [libro("tolto", { fileTolto: true }), libro("normale")];
    const su = daCaricare(libri, { qui: new Set(["tolto", "normale"]), lassu: new Set() });
    t.eq("sale solo quello che l'ebook ce l'ha", su.length, 1);
    t.eq("e non e' quello svuotato", su[0].id, "normale");
    // nemmeno un «rimando» lo riporta su: quello dice «il file qui e'
    // cambiato», e qui il file non c'e' piu' per scelta
    const forzato = daCaricare(libri, {
      qui: new Set(["tolto"]),
      lassu: new Set(),
      rimandi: new Set(["tolto"]),
    });
    t.eq("nemmeno segnato come «da rimandare»", forzato.length, 0);
  }

  // ── NON È UN TOMO PERDUTO ─────────────────────────────────────────────
  {
    const soloNelCloud = [libro("tolto", { fileTolto: true }), libro("perso")];
    const perduti = senzaCopia(soloNelCloud, new Set());
    t.eq("si accusa solo il tomo perduto davvero", perduti.length, 1);
    t.eq("e non quello svuotato apposta", perduti[0].id, "perso");
    t.eq("senza l'elenco del secchio non si accusa nessuno", senzaCopia(soloNelCloud, null).length, 0);
  }

  // ── E NESSUN TASTO SI OFFRE DI RIPORTARLO GIÙ ─────────────────────────
  {
    const soloNelCloud = [libro("tolto", { fileTolto: true }), libro("lassu")];
    const giu = daPortare(soloNelCloud, new Set(["tolto", "lassu"]));
    t.eq("si porta giu' solo l'altro", giu.length, 1);
    t.eq("e il tasto non disfa la scelta", giu[0].id, "lassu");
    // E NEMMENO NEL RAMO SENZA ELENCO, che e' quello generoso: li' si
    // offrono tutti perche' l'unico modo di sapere e' provare — ma su
    // questo non c'e' niente da provare, la risposta la sappiamo gia'.
    const alBuio = daPortare(soloNelCloud, null);
    t.eq("senza l'elenco si offrono gli altri", alBuio.length, 1);
    t.eq("mai quello svuotato", alBuio[0].id, "lassu");
  }
};

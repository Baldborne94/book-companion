// LE EVIDENZIAZIONI NON SONO UN CAMPO DELLA RIGA: SONO UN INSIEME.
//
// Il difetto curato è una perdita di dati silenziosa: segnalibri ed
// evidenziazioni viaggiavano dentro la riga del libro, che si fonde con
// «vince chi ha scritto per ultimo», e in ricezione venivano SOSTITUITI in
// blocco. Evidenziando un passaggio sul tablet e un altro sul telefono
// prima che i due si parlassero, il dispositivo con l'orologio più vecchio
// perdeva tutte le sue — e te ne accorgevi settimane dopo, cercando una
// citazione che non c'era più.
import { fondiAnnotazioni } from "../src/lib/syncCore.js";

const evid = (id, quando, extra = {}) => ({ id, cfi: `cfi-${id}`, text: `passo ${id}`, createdAt: quando, ...extra });
const lapide = (id, quando) => ({ id, cfi: `cfi-${id}`, deleted: quando });
const ids = (r) => r.lista.filter((x) => !x.deleted).map((x) => x.id).join(",");

export default async function (t) {
  // ---- IL DIFETTO: due dispositivi, due evidenziazioni ----------------
  {
    const qui = [evid("a", 100)];
    const lassu = [evid("b", 200)];
    const r = fondiAnnotazioni(qui, lassu);
    t.eq("sopravvivono tutt'e due", ids(r), "a,b");
    t.c("e quella di qui va rimandata su", r.daMandare === 1);
  }

  // ---- la cancellazione batte la copia viva dell'altro ---------------
  {
    // cancellata qui alle 300, lassù è ancora viva com'era nata
    const r = fondiAnnotazioni([lapide("a", 300)], [evid("a", 100)]);
    t.eq("quello che hai cancellato non torna indietro", ids(r), "");
    t.eq("la lapide resta nell'elenco", r.lista.length, 1);
    t.c("e va detta al cloud", r.daMandare === 1);
  }
  {
    // e nell'altro verso: cancellata sull'altro dispositivo
    const r = fondiAnnotazioni([evid("a", 100)], [lapide("a", 300)]);
    t.eq("una cancellazione fatta altrove arriva anche qui", ids(r), "");
    t.c("e non c'è niente da rimandare su", r.daMandare === 0);
  }

  // ---- una nota riscritta vince sulla copia vecchia -------------------
  {
    const vecchia = evid("a", 100);
    const riscritta = { ...vecchia, note: "la nota buona", updatedAt: 500 };
    let r = fondiAnnotazioni([riscritta], [vecchia]);
    t.eq("la versione modificata qui vince", r.lista[0].note, "la nota buona");
    t.c("e risale", r.daMandare === 1);
    r = fondiAnnotazioni([vecchia], [riscritta]);
    t.eq("e quella modificata altrove scende", r.lista[0].note, "la nota buona");
    t.c("senza niente da rimandare", r.daMandare === 0);
  }

  // ---- due dispositivi fermi non si rimbalzano la stessa riga ---------
  {
    // è la stessa identica annotazione: a parità di orologio vince quella
    // che c'è già, e soprattutto NON si dichiara niente da mandare — o due
    // dispositivi in pari si scriverebbero addosso a ogni sincronizzazione
    const stessa = evid("a", 100);
    const r = fondiAnnotazioni([stessa], [{ ...stessa }]);
    t.eq("una sola copia", r.lista.length, 1);
    t.eq("e nessun viaggio di ritorno", r.daMandare, 0);
  }

  // ---- il cloud che non ha ancora niente ------------------------------
  {
    const r = fondiAnnotazioni([evid("a", 100), evid("b", 200)], []);
    t.eq("tutto quello che è solo qui va su", r.daMandare, 2);
    t.eq("e resta qui", ids(r), "a,b");
  }
  {
    const r = fondiAnnotazioni([], [evid("a", 100)]);
    t.eq("e quello che è solo lassù scende", ids(r), "a");
    t.eq("senza rimandare niente", r.daMandare, 0);
  }

  // ---- l'ordine: i vivi in ordine di nascita, le lapidi in coda -------
  {
    const r = fondiAnnotazioni([evid("c", 300), lapide("x", 50)], [evid("a", 100), evid("b", 200)]);
    t.eq("i vivi in ordine di nascita", ids(r), "a,b,c");
    t.c("e la lapide chiude la fila", !!r.lista[r.lista.length - 1].deleted);
  }

  // ---- quello che non ha un id non si perde e non si sdoppia ----------
  {
    // roba entrata prima che gli id esistessero: la chiave di ripiego è il
    // CFI, che i due dispositivi calcolano uguale
    const senzaId = { cfi: "cfi-vecchio", text: "un passo antico", createdAt: 10 };
    const r = fondiAnnotazioni([senzaId], [{ ...senzaId }]);
    t.eq("una copia sola, non due", r.lista.length, 1);
  }
  {
    // e quello che non ha nemmeno il CFI non ha una chiave: si scarta
    // invece di fondersi con chissà cosa
    const r = fondiAnnotazioni([{ text: "senza appigli" }], []);
    t.eq("quello che non si sa nominare resta fuori", r.lista.length, 0);
  }

  // ---- niente da fondere ---------------------------------------------
  {
    const r = fondiAnnotazioni();
    t.eq("senza niente non esplode", r.lista.length, 0);
    t.eq("e non c'è niente da mandare", r.daMandare, 0);
  }

  // ---- LA SCENA VERA, GIOCATA A MANO ----------------------------------
  //
  // Due dispositivi e un cloud, con le due regole di `sync.js` giocate qui
  // sopra: si fonde in PARTENZA (chi spinge non cancella lassù quello che
  // non ha mai visto) e si fonde in RICEZIONE (chi riceve non si fa
  // scrivere addosso). Non è il codice di `sync.js` — quello importa
  // Supabase e in Node non si carica — ma è la scena che il lettore vive:
  // il tablet in salotto e il telefono in metropolitana.
  {
    let cloud = { marks: [], quando: 0 };
    const spingi = (mie, quando) => {
      const f = fondiAnnotazioni(mie, cloud.marks);
      cloud = { marks: f.lista, quando };
      return f.lista;
    };
    const ricevi = (mie) => {
      const f = fondiAnnotazioni(mie, cloud.marks);
      if (f.daMandare) cloud = { ...cloud, marks: f.lista };
      return f.lista;
    };

    // il telefono, in metropolitana, evidenzia alle 9:50 e sincronizza
    let telefono = [evid("tel", 950)];
    telefono = spingi(telefono, 950);
    // il tablet aveva evidenziato alle 10:00 senza aver mai visto il
    // telefono: la sua riga è più recente, quindi PARTE
    let tablet = spingi([evid("tab", 1000)], 1000);
    t.eq("chi spinge non cancella lassù quello che non ha mai visto", cloud.marks.length, 2);
    t.eq("e se le porta a casa tutt'e due", tablet.map((x) => x.id).sort().join(","), "tab,tel");

    // il telefono riceve: non si fa scrivere addosso
    telefono = ricevi(telefono);
    t.eq("e anche il telefono le ha tutt'e due", telefono.length, 2);

    // adesso il telefono ne cancella una e sincronizza
    telefono = [...telefono.filter((x) => x.id !== "tel"), lapide("tel", 1100)];
    telefono = spingi(telefono, 1100);
    tablet = ricevi(tablet);
    t.eq(
      "una cancellazione fatta di là arriva di qua",
      tablet.filter((x) => !x.deleted).map((x) => x.id).join(","),
      "tab"
    );
    // e non torna indietro al giro dopo: è la trappola di ogni fusione
    // per id fatta senza lapidi
    telefono = ricevi(telefono);
    t.eq(
      "e non risorge al giro dopo",
      telefono.filter((x) => !x.deleted).map((x) => x.id).join(","),
      "tab"
    );
  }
}

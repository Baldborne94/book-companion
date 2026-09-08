// CHI SALE, CHI SCENDE, E CHI SPARISCE DA QUI.
//
// `planSync` decide tutto quello che una sincronizzazione fa: quali libri
// vanno spinti nel cloud, quali vanno tirati giù, e quali vanno CANCELLATI
// da questo dispositivo. È completamente pura — tre `Map` e dei confronti
// fra numeri — e non aveva un solo controllo, mentre tutto quello che le sta
// attorno (`mergePrefs`, `rowFromLocal`, `fondiAnnotazioni`, `upsertBooks`)
// ce l'aveva.
//
// Un errore qui NON somiglia a un errore. Somiglia a un libro che
// riappare dopo che l'avevi buttato, o a una sera di lettura che non è mai
// arrivata sull'altro dispositivo. Nessun messaggio, nessuna riga rossa: i
// dati semplicemente non sono quelli che ti aspettavi, e te ne accorgi
// giorni dopo senza poter risalire a quando è successo.
//
// I confronti sono di due specie e vanno tenuti distinti: `>` dove vince
// «più recente», `>=` dove a parità deve vincere la CANCELLAZIONE. Sono
// esattamente i punti dove un carattere in meno non fa fallire niente.
import { planSync } from "../src/lib/syncCore.js";

const riga = (id, updated_at, extra = {}) => ({ id, updated_at, ...extra });
const piano = (locali, lapidi, remoti) =>
  planSync({ localRows: locali, tombstones: lapidi, remoteRows: remoti });
const ids = (v) => v.map((x) => x.id ?? x).sort().join(",");

export default async function (t) {
  // ---- il caso normale: niente da fare ---------------------------------
  //
  // È il primo controllo perché è quello che gira NOVANTANOVE volte su
  // cento: due dispositivi già in pari. Se a parità di orologio qualcosa si
  // muovesse, ogni sincronizzazione rispedirebbe l'intera biblioteca su e
  // giù — non un errore, solo traffico e batteria per niente.
  {
    const p = piano([riga("a", 100), riga("b", 200)], {}, [riga("a", 100), riga("b", 200)]);
    t.eq("in pari non si spinge niente", p.push.length, 0);
    t.eq("in pari non si tira giù niente", p.pull.length, 0);
    t.eq("e non si cancella niente", p.removeLocal.length, 0);
  }

  // ---- le due direzioni ------------------------------------------------
  {
    const p = piano([riga("a", 300)], {}, [riga("a", 100)]);
    t.eq("più recente qui: sale", ids(p.push), "a");
    t.eq("e non scende", p.pull.length, 0);
  }
  {
    const p = piano([riga("a", 100)], {}, [riga("a", 300)]);
    t.eq("più recente lassù: scende", ids(p.pull), "a");
    t.eq("e non sale", p.push.length, 0);
  }
  {
    const p = piano([riga("nuovo", 50)], {}, []);
    t.eq("un libro che il cloud non ha sale", ids(p.push), "nuovo");
  }
  {
    const p = piano([], {}, [riga("altrove", 50)]);
    t.eq("un libro che qui non c'è scende", ids(p.pull), "altrove");
  }

  // ---- LE CANCELLAZIONI, che è dove si perde roba ----------------------
  //
  // Una riga cancellata nel cloud deve portarsi via la copia locale. A
  // PARITÀ DI ORARIO vince la cancellazione (`>=`): col `>` il libro
  // resterebbe qui per sempre, perché nessun giro successivo cambierebbe i
  // due numeri — sarebbero uguali anche domani.
  {
    const p = piano([riga("a", 100)], {}, [riga("a", 100, { deleted: true })]);
    t.eq("cancellato lassù allo stesso orario: sparisce da qui", ids(p.removeLocal), "a");
    t.eq("e non lo si tira giù", p.pull.length, 0);
    t.eq("né lo si rispedisce su", p.push.length, 0);
  }
  {
    const p = piano([riga("a", 100)], {}, [riga("a", 300, { deleted: true })]);
    t.eq("cancellato lassù più tardi: sparisce da qui", ids(p.removeLocal), "a");
  }
  // MA una cancellazione VECCHIA non batte una modifica nuova: se l'ho
  // ripreso in mano dopo averlo cancellato altrove, quello che vale è
  // l'ultima cosa che ho fatto — e sale.
  {
    const p = piano([riga("a", 500)], {}, [riga("a", 100, { deleted: true })]);
    t.eq("una cancellazione più vecchia non porta via niente", p.removeLocal.length, 0);
    t.eq("e la modifica più recente sale", ids(p.push), "a");
  }
  // una riga cancellata che qui non c'è non è niente da fare: non si
  // scarica una lapide per poi ricancellarla
  {
    const p = piano([], {}, [riga("via", 100, { deleted: true })]);
    t.eq("una lapide remota di un libro che non ho non scende", p.pull.length, 0);
    t.eq("e non fa cancellare niente", p.removeLocal.length, 0);
  }

  // ---- LE LAPIDI LOCALI: quello che ho buttato io ----------------------
  {
    const p = piano([], { a: 300 }, [riga("a", 100)]);
    t.eq("la mia cancellazione sale come lapide", ids(p.push), "a");
    t.c("e porta il segno di cancellata", p.push[0].deleted === true);
    t.eq("e la riga vecchia non me la riprendo", p.pull.length, 0);
  }
  // E QUESTA È LA TRAPPOLA CHE RESUSCITA I LIBRI. Ho cancellato un libro,
  // ma il cloud ha una riga PIÙ RECENTE della mia lapide: vuol dire che
  // sull'altro dispositivo l'ho ripreso dopo. Lì la lapide non sale, e la
  // riga scende — è l'ultima cosa fatta che comanda.
  {
    const p = piano([], { a: 100 }, [riga("a", 500)]);
    t.eq("una lapide più vecchia della riga remota non sale", p.push.length, 0);
    t.eq("e il libro ripreso altrove torna qui", ids(p.pull), "a");
  }
  // a parità, la lapide vince e il libro NON torna: col `>` al posto del
  // `>=` ogni cancellazione tornerebbe indietro al primo giro
  {
    const p = piano([], { a: 300 }, [riga("a", 300)]);
    t.eq("a parità la mia cancellazione tiene: non torna", p.pull.length, 0);
  }
  {
    const p = piano([], { a: 300 }, []);
    t.eq("una lapide che il cloud non conosce sale", ids(p.push), "a");
  }

  // ---- niente si fa due volte ------------------------------------------
  // Una riga non deve finire in due elenchi: spinta E tirata, o cancellata
  // E scaricata. Sarebbero due ordini opposti sullo stesso libro, e a
  // vincere sarebbe quello che gira per ultimo — cioè il caso.
  {
    const p = piano(
      [riga("a", 300), riga("b", 100), riga("c", 100)],
      { d: 400 },
      [riga("a", 100), riga("b", 300), riga("c", 100, { deleted: true }), riga("e", 200)]
    );
    const tutti = [...p.push.map((r) => r.id), ...p.pull.map((r) => r.id), ...p.removeLocal];
    t.eq("nessun libro in due elenchi", new Set(tutti).size, tutti.length, tutti.join(" "));
    t.eq("sale quello nuovo qui, più la lapide", ids(p.push), "a,d");
    t.eq("scende quello nuovo lassù, più quello che non ho", ids(p.pull), "b,e");
    t.eq("e sparisce quello cancellato lassù", ids(p.removeLocal), "c");
  }

  // ---- e non esplode sul vuoto -----------------------------------------
  {
    const p = piano([], {}, []);
    t.eq("biblioteca vuota da tutt'e due le parti", p.push.length + p.pull.length + p.removeLocal.length, 0);
  }
}

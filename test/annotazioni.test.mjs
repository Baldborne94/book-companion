// IL CIMITERO STA DENTRO L'ELENCO.
//
// Segnalibri ed evidenziazioni si fondono fra dispositivi per id, e una
// fusione per id non sa distinguere «questa l'ho cancellata» da «questa
// l'altro dispositivo non ce l'ha ancora»: senza una lapide, ogni
// cancellazione tornerebbe indietro alla prima sincronizzazione.
//
// Il conto delle lapidi lo tiene il salvataggio, non chi chiama — i punti
// che salvano sono cinque, fra i due reader e il giardino delle citazioni,
// e uno che se ne dimenticasse riaprirebbe il difetto in silenzio.

// La memoria del browser ridotta all'osso: `annotations.js` la legge solo
// dentro le funzioni, quindi basta averla in piedi prima dell'import.
function memoriaFinta() {
  const dati = new Map();
  globalThis.localStorage = {
    getItem: (k) => (dati.has(k) ? dati.get(k) : null),
    setItem: (k, v) => dati.set(k, String(v)),
    removeItem: (k) => dati.delete(k),
  };
  return dati;
}

// il tempo si comanda: due salvataggi nello stesso millisecondo farebbero
// passare per buone anche le regole che non valgono
const alle = (t, fn) => {
  const vero = Date.now;
  Date.now = () => t;
  try {
    return fn();
  } finally {
    Date.now = vero;
  }
};

export default async function (t) {
  const dati = memoriaFinta();
  const A = await import("../src/lib/annotations.js");
  const LIBRO = "libro-1";

  const uno = { id: "a", cfi: "cfi-a", text: "il primo", color: "oro", createdAt: 100 };
  const due = { id: "b", cfi: "cfi-b", text: "il secondo", color: "oro", createdAt: 200 };

  // ---- quello che si salva si rilegge --------------------------------
  alle(1000, () => A.saveHighlights(LIBRO, [uno, due]));
  t.eq("due evidenziazioni salvate, due rilette", A.getHighlights(LIBRO).length, 2);
  t.eq("e nessuna lapide da nessuna parte", A.evidenziazioniIntere(LIBRO).length, 2);
  t.c("il salvataggio segna il libro come cambiato", !!dati.get(`bc_upd_${LIBRO}`));

  // ---- cancellare lascia una lapide ----------------------------------
  alle(2000, () => A.saveHighlights(LIBRO, [due]));
  t.eq("il lettore ne vede una sola", A.getHighlights(LIBRO).length, 1);
  t.eq("ma nell'elenco intero ce ne sono due", A.evidenziazioniIntere(LIBRO).length, 2);
  const lapide = A.evidenziazioniIntere(LIBRO).find((x) => x.deleted);
  t.eq("la lapide porta l'id di quella cancellata", lapide.id, "a");
  t.eq("e l'ora in cui è stata cancellata", lapide.deleted, 2000);
  t.c("la lapide non si porta dietro il testo", !("text" in lapide));

  // ---- una lapide non si ri-data -------------------------------------
  alle(3000, () => A.saveHighlights(LIBRO, [due]));
  t.eq(
    "salvando ancora, l'ora della cancellazione resta quella vera",
    A.evidenziazioniIntere(LIBRO).find((x) => x.deleted).deleted,
    2000
  );

  // ---- una modifica si timbra ----------------------------------------
  alle(4000, () => A.saveHighlights(LIBRO, [{ ...due, note: "una nota scritta dopo" }]));
  const modificata = A.getHighlights(LIBRO)[0];
  t.eq("l'annotazione modificata porta l'ora della modifica", modificata.updatedAt, 4000);

  // ---- ma un salvataggio che non cambia niente NON si timbra ---------
  //
  // E' la trappola vera: il reader tiene in memoria l'annotazione senza il
  // nostro timbro e la ri-salva a ogni giro. Confrontando anche il timbro,
  // ogni salvataggio ri-timbrerebbe tutto quello che era stato toccato una
  // volta — e questo dispositivo vincerebbe SEMPRE sull'altro, che è
  // esattamente il difetto che stiamo curando.
  alle(5000, () => A.saveHighlights(LIBRO, [{ ...due, note: "una nota scritta dopo" }]));
  t.eq(
    "ri-salvare la stessa annotazione non sposta il timbro",
    A.getHighlights(LIBRO)[0].updatedAt,
    4000
  );

  // ---- i segnalibri seguono la stessa strada -------------------------
  const s1 = { id: "s1", cfi: "cfi-1", label: "Capitolo 1", createdAt: 10 };
  const s2 = { id: "s2", cfi: "cfi-2", label: "Capitolo 2", createdAt: 20 };
  alle(6000, () => A.saveMarks(LIBRO, [s1, s2]));
  alle(7000, () => A.saveMarks(LIBRO, [s1]));
  t.eq("un segnalibro cancellato sparisce dalla vista", A.getMarks(LIBRO).length, 1);
  t.eq("e lascia la sua lapide", A.segnalibriInteri(LIBRO).filter((x) => x.deleted).length, 1);

  // ---- la porta della sincronizzazione posa e basta -------------------
  const prima = dati.get(`bc_upd_${LIBRO}`);
  A.posaSegnalibri(LIBRO, [s1, s2, { id: "s3", cfi: "cfi-3", createdAt: 30 }]);
  t.eq("quel che si posa si rilegge tale e quale", A.segnalibriInteri(LIBRO).length, 3);
  // il segno del tempo lo mette il giro della sincronizzazione, che sa se
  // quella riga viene dal cloud o l'abbiamo arricchita noi: timbrarlo qui
  // farebbe sembrare nostra ogni riga scesa da lassù
  t.eq("ma non tocca l'ora del libro", dati.get(`bc_upd_${LIBRO}`), prima);

  // ---- un libro cancellato si porta via tutto ------------------------
  A.removeAnnotations(LIBRO);
  t.eq("cancellato il libro, non resta un'evidenziazione", A.evidenziazioniIntere(LIBRO).length, 0);
  t.eq("né un segnalibro", A.segnalibriInteri(LIBRO).length, 0);

  // ---- OGNI MODIFICA PARTE DA QUEL CHE C'E' SALVATO ADESSO ---------------
  // Il lettore: «mi cancella ancora l'ultimo segnalibro». A libro aperto la
  // sincronizzazione posa qui un segnalibro dell'altro dispositivo; il
  // lettore ha in mano l'elenco di quando si e' aperto, e salvandolo con uno
  // in piu' quello arrivato «non c'era piu'»: una lapide, e moriva ovunque.
  const ALTRO = "libro-2";
  const mio = { id: "mio", cfi: "cfi-1", label: "10%", createdAt: 10 };
  alle(5000, () => A.cambiaSegnalibri(ALTRO, A.aggiungi(mio)));
  t.eq("il primo segnalibro si salva", A.getMarks(ALTRO).map((m) => m.id).join(), "mio");
  // arriva quello del PC, posato com'e' dalla sincronizzazione
  A.posaSegnalibri(ALTRO, [...A.segnalibriInteri(ALTRO), { id: "dal-pc", cfi: "cfi-2", label: "40%", createdAt: 20, updatedAt: 5500 }]);
  const nuovo = { id: "nuovo", cfi: "cfi-3", label: "60%", createdAt: 30 };
  const dopo = alle(6000, () => A.cambiaSegnalibri(ALTRO, A.aggiungi(nuovo)));
  t.eq("aggiungendone uno, quello arrivato nel frattempo resta", A.segnalibriInteri(ALTRO).filter((m) => !m.deleted).map((m) => m.id).join(), "mio,dal-pc,nuovo");
  t.eq("e l'elenco che torna è quello da mostrare", dopo.map((m) => m.id).join(), "mio,dal-pc,nuovo");
  alle(7000, () => A.cambiaSegnalibri(ALTRO, A.togli(mio)));
  const lapidi = A.segnalibriInteri(ALTRO).filter((m) => m.deleted).map((m) => m.id).join();
  t.eq("togliendone uno, la lapide è la sua e basta", `${A.getMarks(ALTRO).map((m) => m.id).join()}|${lapidi}`, "dal-pc,nuovo|mio");

  // le note delle evidenziazioni: il pannello rimanda il suo elenco intero,
  // che puo' essere quello di prima
  const e1 = { id: "e1", cfi: "c1", text: "uno", color: "oro", createdAt: 1 };
  alle(8000, () => A.cambiaEvidenziazioni(ALTRO, A.aggiungi(e1)));
  A.posaEvidenziazioni(ALTRO, [...A.evidenziazioniIntere(ALTRO), { id: "e2", cfi: "c2", text: "dal pc", color: "oro", createdAt: 2, updatedAt: 8500 }]);
  alle(9000, () => A.cambiaEvidenziazioni(ALTRO, A.aggiorna([{ ...e1, note: "una nota" }])));
  const ev = A.evidenziazioniIntere(ALTRO);
  t.eq("la nota si scrive, e l'evidenziazione arrivata nel frattempo resta", ev.map((x) => `${x.id}${x.deleted ? "†" : ""}${x.note ? ":" + x.note : ""}`).join(), "e1:una nota,e2");
  // un elenco di prima puo' nominare una che nel frattempo e' stata tolta altrove
  A.posaEvidenziazioni(ALTRO, [{ id: "e2", cfi: "c2", text: "dal pc", color: "oro", createdAt: 2, updatedAt: 8500 }, { id: "e1", cfi: "c1", deleted: 9500 }]);
  alle(10000, () => A.cambiaEvidenziazioni(ALTRO, A.aggiorna([{ ...e1, note: "un'altra" }])));
  t.eq("una nota su un'evidenziazione tolta altrove non la riporta in vita", A.getHighlights(ALTRO).map((x) => x.id).join(), "e2");
  t.eq("aggiornare con niente non cambia niente", alle(11000, () => A.cambiaEvidenziazioni(ALTRO, A.aggiorna())).map((x) => x.id).join(), "e2");

  // e nessun componente salva piu' l'elenco che ha in mano
  const { readdirSync, readFileSync } = await import("node:fs");
  const colpevoli = readdirSync("src/components")
    .filter((f) => f.endsWith(".jsx"))
    .filter((f) => /\bsave(Marks|Highlights)\(/.test(readFileSync(`src/components/${f}`, "utf8")));
  t.eq("nei componenti nessuno salva l'elenco che ha in mano", colpevoli.join(" "), "");
}

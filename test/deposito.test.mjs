// DOVE SI POSA IL PUNTO DI LETTURA, E PERCHÉ DEVE SEGNARE L'ORA.
//
// Il RITORNO al segno è stato curato e provato (`segno.test.mjs`). Il
// DEPOSITO no: `setCfi`, `setProgress`, le marcature temporali di
// `library.js` e le lapidi non comparivano in nessun controllo — e sono
// proprio il materiale su cui `planSync` decide cosa sale e cosa scende.
//
// La cosa che conta più di tutte sta in una riga sola: salvare la posizione
// deve TOCCARE `bc_upd_<id>`. Senza, la riga locale resta vecchia, e alla
// prima sincronizzazione il cloud vince: la sera di lettura non arriva
// sull'altro dispositivo, e anzi torna indietro il segno di prima. Nessun
// errore, nessun avviso — solo un libro che sull'altro schermo è rimasto
// dov'era.
//
// Per questo l'ultimo blocco non prova una funzione sola: prova la CATENA,
// dal salvataggio fino a `planSync`. È l'unico modo di vedere il difetto
// per quello che è.
function memoriaFinta() {
  const dati = new Map();
  globalThis.localStorage = {
    getItem: (k) => (dati.has(k) ? dati.get(k) : null),
    setItem: (k, v) => dati.set(k, String(v)),
    removeItem: (k) => dati.delete(k),
  };
  return dati;
}
const dati = memoriaFinta();

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

const { getCfi, setCfi, setJump, getJump, clearJump, removeAnnotations } =
  await import("../src/lib/annotations.js");
const { touchBook, getUpdatedAt, setProgress, getProgress, addTombstone, getTombstones, clearTombstones } =
  await import("../src/lib/library.js");
const { planSync } = await import("../src/lib/syncCore.js");

export default async function (t) {
  // ---- il segno si posa e si rilegge -----------------------------------
  dati.clear();
  t.eq("un libro mai aperto non ha segno", getCfi("L1"), null);
  setCfi("L1", "epubcfi(/6/14!/4/2/1:0)");
  t.eq("posato, si rilegge", getCfi("L1"), "epubcfi(/6/14!/4/2/1:0)");
  setCfi("L1", "epubcfi(/6/20!/4/2/1:0)");
  t.eq("e l'ultimo copre il precedente", getCfi("L1"), "epubcfi(/6/20!/4/2/1:0)");

  // ---- IL SEGNO SEGNA L'ORA --------------------------------------------
  // È la riga da cui dipende tutto il resto del file.
  dati.clear();
  alle(1000, () => touchBook("L1"));
  t.eq("l'ora di partenza è quella", getUpdatedAt("L1"), 1000);
  alle(5000, () => setCfi("L1", "epubcfi(/6/30!/4/2/1:0)"));
  t.eq("salvare il segno sposta l'ora avanti", getUpdatedAt("L1"), 5000);
  alle(9000, () => setProgress("L1", 0.5));
  t.eq("e salvare il progresso pure", getUpdatedAt("L1"), 9000);

  // ---- il progresso è SEMPRE una frazione ------------------------------
  // Lezione 4: mai 0–100 nello stesso posto dove si tiene 0–1. Un 77
  // scritto lì diventerebbe un libro finito al 7700%, e il diario lo
  // conterebbe fra i letti.
  dati.clear();
  setProgress("L1", 0.42);
  t.vicino("una frazione si rilegge com'è", getProgress("L1"), 0.42, 0.0001);
  setProgress("L1", 3);
  t.eq("sopra uno si taglia a uno", getProgress("L1"), 1);
  setProgress("L1", -2);
  t.eq("sotto zero si taglia a zero", getProgress("L1"), 0);
  t.eq("e un libro senza progresso è a zero", getProgress("MAI"), 0);
  // LA GUARDIA CHE CONTA È QUELLA IN LETTURA, e va provata scrivendo nello
  // storage a mano: il taglio in scrittura è cintura e bretelle — tolto,
  // non falliva niente, perché `getProgress` taglia comunque (mutazione
  // provata). Ma nello storage un valore fuori scala ci arriva lo stesso,
  // da un archivio vecchio o da un dispositivo rimasto indietro, e lì è
  // solo la lettura a difendere.
  localStorage.setItem("bc_prog_L1", "77");
  t.eq("un 77 trovato nello storage vale uno, non 7700%", getProgress("L1"), 1);
  localStorage.setItem("bc_prog_L1", "-5");
  t.eq("e un negativo vale zero", getProgress("L1"), 0);
  localStorage.setItem("bc_prog_L1", "boh");
  t.eq("un valore illeggibile vale zero, non NaN", getProgress("L1"), 0);

  // ---- l'ora non torna mai indietro sotto il ripiego --------------------
  dati.clear();
  t.eq("senza marcatura vale il ripiego", getUpdatedAt("L1", 700), 700);
  alle(400, () => touchBook("L1"));
  t.eq("una marcatura più vecchia del ripiego non lo abbassa", getUpdatedAt("L1", 700), 700);
  alle(900, () => touchBook("L1"));
  t.eq("una più recente comanda", getUpdatedAt("L1", 700), 900);

  // ---- le lapidi dei libri ---------------------------------------------
  dati.clear();
  t.eq("all'inizio non c'è nessuna lapide", Object.keys(getTombstones()).length, 0);
  alle(2000, () => addTombstone("L1"));
  t.eq("una cancellazione si segna con la sua ora", getTombstones().L1, 2000);
  alle(3000, () => addTombstone("L2"));
  t.eq("e se ne tengono più d'una", Object.keys(getTombstones()).sort().join(","), "L1,L2");
  clearTombstones(["L1"]);
  t.eq("si ripuliscono solo quelle passate", Object.keys(getTombstones()).join(","), "L2");

  // ---- il salto fra dispositivi ----------------------------------------
  dati.clear();
  t.eq("senza salto non c'è niente", getJump("L1"), null);
  setJump("L1", { cfi: "epubcfi(/6/40!/4/2/1:0)", progress: 0.62 });
  t.eq("il salto si rilegge", getJump("L1").progress, 0.62);
  clearJump("L1");
  t.eq("e si toglie", getJump("L1"), null);
  // uno storage sporco non deve far esplodere l'apertura del libro
  localStorage.setItem("bc_jump_L1", "{rotto");
  t.eq("un salto illeggibile vale come nessun salto", getJump("L1"), null);

  // ---- e un libro cancellato non lascia in giro il suo segno ------------
  dati.clear();
  setCfi("L1", "epubcfi(/6/14!/4/2/1:0)");
  setJump("L1", { cfi: "x", progress: 0.1 });
  localStorage.setItem("bc_marks_L1", "[]");
  localStorage.setItem("bc_hl_L1", "[]");
  localStorage.setItem("bc_pdfcrop_L1", "{}");
  removeAnnotations("L1");
  for (const k of ["bc_cfi_L1", "bc_jump_L1", "bc_marks_L1", "bc_hl_L1", "bc_pdfcrop_L1"]) {
    t.c(`«${k}» se ne va col libro`, localStorage.getItem(k) === null, k);
  }

  // ---- LA CATENA: dalla sera di lettura all'altro dispositivo ----------
  //
  // Qui si mette insieme quello che nessuno dei due file provava da solo.
  // Il cloud ha una riga di ieri; io stasera leggo. Se il salvataggio non
  // segnasse l'ora, `planSync` vedrebbe la mia riga più vecchia e mi
  // riporterebbe indietro il segno di ieri — cancellando la sera appena
  // letta senza dire niente.
  dati.clear();
  const IERI = 1000;
  const STASERA = 9000;
  alle(IERI, () => {
    setCfi("L1", "epubcfi(/6/10!/4/2/1:0)");
    setProgress("L1", 0.2);
  });
  const remoto = [{ id: "L1", updated_at: IERI }];

  // prima di leggere: in pari, non si muove niente
  {
    const p = planSync({
      localRows: [{ id: "L1", updated_at: getUpdatedAt("L1") }],
      tombstones: {},
      remoteRows: remoto,
    });
    t.eq("prima di leggere non si muove niente", p.push.length + p.pull.length, 0);
  }

  // stasera leggo
  alle(STASERA, () => {
    setCfi("L1", "epubcfi(/6/60!/4/2/1:0)");
    setProgress("L1", 0.77);
  });
  {
    const p = planSync({
      localRows: [{ id: "L1", updated_at: getUpdatedAt("L1") }],
      tombstones: {},
      remoteRows: remoto,
    });
    t.eq("dopo aver letto, la mia riga sale", p.push.map((r) => r.id).join(","), "L1");
    t.eq("e NON mi torna indietro il segno di ieri", p.pull.length, 0);
  }
  t.eq("il segno di stasera è quello che parte", getCfi("L1"), "epubcfi(/6/60!/4/2/1:0)");
}

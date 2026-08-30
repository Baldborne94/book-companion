const leggiTutti = (key) => {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const touch = (id) => localStorage.setItem(`bc_upd_${id}`, String(Date.now()));

export const getCfi = (id) => localStorage.getItem(`bc_cfi_${id}`) || null;
export const setCfi = (id, cfi) => {
  localStorage.setItem(`bc_cfi_${id}`, cfi);
  touch(id);
};

// LE CANCELLAZIONI SI SEGNANO, O QUELLO CHE CANCELLI TORNA.
//
// Segnalibri ed evidenziazioni si fondono fra dispositivi per id (vedi
// `fondiAnnotazioni` in `syncCore.js`), e una fusione per id non sa
// distinguere «questa evidenziazione l'ho cancellata» da «questa
// evidenziazione l'altro dispositivo non ce l'ha ancora»: senza un segno,
// ogni cancellazione tornerebbe indietro alla prima sincronizzazione.
//
// Il segno e' una LAPIDE dentro lo stesso elenco — `{ id, cfi, deleted }` —
// e sta li' dentro apposta: viaggia da sola nella colonna che c'e' gia',
// senza una chiave nuova nello storage, senza una colonna nuova nel
// database e senza niente da ricordarsi altrove. E' la stessa scelta delle
// lapidi dei libri, che vivono nella riga del cloud.
//
// Il conto lo tiene il SALVATAGGIO, non chi chiama: `saveMarks` e
// `saveHighlights` ricevono l'elenco dei vivi — come hanno sempre fatto,
// da cinque punti diversi fra i due reader e il giardino — e quello che
// nell'elenco non c'e' piu' diventa una lapide qui dentro. Metterlo nei
// chiamanti vorrebbe dire che il prossimo se lo dimentica.
const vivo = (x) => x && !x.deleted;

// L'id c'e' sempre (`crypto.randomUUID` alla nascita); il CFI e' il
// ripiego per la roba entrata prima che gli id esistessero, ed e' una
// chiave che i due dispositivi calcolano uguale — un ripiego che
// duplicasse sarebbe peggio del difetto.
const chiave = (x) => x?.id || x?.cfi || "";

// il confronto ignora `updatedAt`: e' il nostro timbro, non contenuto, e
// confrontarlo ri-timbrerebbe a ogni salvataggio tutto quello che era
// gia' stato toccato una volta — con l'effetto che questo dispositivo
// vincerebbe sempre sull'altro
const contenuto = (x) => {
  const { updatedAt, ...resto } = x || {};
  return JSON.stringify(resto);
};

function scrivi(chiaveStore, id, lista) {
  const prima = leggiTutti(chiaveStore);
  const ora = Date.now();
  const vecchi = new Map(prima.map((x) => [chiave(x), x]));
  const vivi = (lista || []).filter(vivo).map((x) => {
    const k = chiave(x);
    const era = vecchi.get(k);
    // un'annotazione modificata (una nota riscritta, un colore cambiato)
    // deve poter vincere sull'altro dispositivo: il timbro dice quando
    const cambiato = !era || contenuto(era) !== contenuto(x);
    const quando = cambiato ? ora : era.updatedAt;
    return quando ? { ...x, updatedAt: quando } : x;
  });
  const restano = new Set(vivi.map(chiave));
  const lapidi = [];
  for (const x of prima) {
    const k = chiave(x);
    if (restano.has(k)) continue;
    // una lapide che c'era gia' non si ri-data: la sua ora e' quella in
    // cui hai cancellato davvero
    lapidi.push(x.deleted ? x : { id: x.id, cfi: x.cfi ?? null, deleted: ora });
  }
  localStorage.setItem(chiaveStore, JSON.stringify([...vivi, ...lapidi]));
  touch(id);
}

export const getMarks = (id) => leggiTutti(`bc_marks_${id}`).filter(vivo);
export const saveMarks = (id, list) => scrivi(`bc_marks_${id}`, id, list);

export const getHighlights = (id) => leggiTutti(`bc_hl_${id}`).filter(vivo);
export const saveHighlights = (id, list) => scrivi(`bc_hl_${id}`, id, list);

// Le due porte della sincronizzazione: lassu' devono viaggiare anche le
// lapidi, o l'altro dispositivo non saprebbe mai che hai cancellato — e in
// ricezione si posa il risultato della fusione COM'E', senza rifare il
// conto delle lapidi (sono gia' dentro) e senza timbrare l'ora: il segno
// del tempo lo mette il giro della sincronizzazione, che sa se quella
// riga e' arrivata dal cloud o l'abbiamo arricchita noi.
export const segnalibriInteri = (id) => leggiTutti(`bc_marks_${id}`);
export const evidenziazioniIntere = (id) => leggiTutti(`bc_hl_${id}`);
export const posaSegnalibri = (id, tutti) =>
  localStorage.setItem(`bc_marks_${id}`, JSON.stringify(tutti || []));
export const posaEvidenziazioni = (id, tutti) =>
  localStorage.setItem(`bc_hl_${id}`, JSON.stringify(tutti || []));

// Posizione piu' avanzata vista su un altro dispositivo, in attesa di conferma
export function getJump(id) {
  try {
    return JSON.parse(localStorage.getItem(`bc_jump_${id}`)) || null;
  } catch {
    return null;
  }
}

export const setJump = (id, jump) =>
  localStorage.setItem(`bc_jump_${id}`, JSON.stringify(jump));

export const clearJump = (id) => localStorage.removeItem(`bc_jump_${id}`);

export function removeAnnotations(id) {
  localStorage.removeItem(`bc_jump_${id}`);
  localStorage.removeItem(`bc_cfi_${id}`);
  localStorage.removeItem(`bc_marks_${id}`);
  localStorage.removeItem(`bc_hl_${id}`);
  // la misura dei margini del PDF: si rifa' da sola, ma non ha senso
  // lasciarla in giro per un libro che non c'e' piu'
  localStorage.removeItem(`bc_pdfcrop_${id}`);
}

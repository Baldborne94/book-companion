const BOOKS_KEY = "bc_books";
const LAST_KEY = "bc_lastopen";
const TOMBS_KEY = "bc_tombs";

export const touchBook = (id, ts = Date.now()) =>
  localStorage.setItem(`bc_upd_${id}`, String(ts));

export function getUpdatedAt(id, fallback = 0) {
  const v = parseInt(localStorage.getItem(`bc_upd_${id}`), 10);
  return Number.isFinite(v) ? Math.max(v, fallback) : fallback;
}

export function getTombstones() {
  try {
    const v = JSON.parse(localStorage.getItem(TOMBS_KEY));
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export function addTombstone(id, ts = Date.now()) {
  localStorage.setItem(TOMBS_KEY, JSON.stringify({ ...getTombstones(), [id]: ts }));
}

export function clearTombstones(ids) {
  const t = getTombstones();
  ids.forEach((id) => delete t[id]);
  localStorage.setItem(TOMBS_KEY, JSON.stringify(t));
}

export function loadBooks() {
  try {
    const raw = localStorage.getItem(BOOKS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveBooks(books) {
  localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
}

export function getProgress(id) {
  const v = parseFloat(localStorage.getItem(`bc_prog_${id}`));
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

export function setProgress(id, fraction) {
  localStorage.setItem(`bc_prog_${id}`, String(Math.min(1, Math.max(0, fraction))));
  touchBook(id);
}

export function getStatus(id) {
  return localStorage.getItem(`bc_status_${id}`) || "unread";
}

// Il diario nasce qui: setStatus e' l'unico passaggio comune a tutte le
// strade (reader, scheda del libro, apertura), quindi le date si scrivono
// una volta sola e nessun percorso puo' dimenticarsele.
export const getStarted = (id) => parseInt(localStorage.getItem(`bc_start_${id}`), 10) || 0;
export const getFinished = (id) => parseInt(localStorage.getItem(`bc_end_${id}`), 10) || 0;

export function setDates(id, { started, finished }) {
  if (started) localStorage.setItem(`bc_start_${id}`, String(started));
  else if (started === 0) localStorage.removeItem(`bc_start_${id}`);
  if (finished) localStorage.setItem(`bc_end_${id}`, String(finished));
  else if (finished === 0) localStorage.removeItem(`bc_end_${id}`);
}

export function setStatus(id, status) {
  const prev = getStatus(id);
  localStorage.setItem(`bc_status_${id}`, status);
  if (status !== prev) {
    const now = Date.now();
    if (status === "reading" && !getStarted(id)) setDates(id, { started: now });
    // un libro ripreso e finito di nuovo aggiorna la data di fine
    if (status === "read") {
      if (!getStarted(id)) setDates(id, { started: now });
      setDates(id, { finished: now });
    }
    // tornare a "da leggere" e' un azzeramento esplicito
    if (status === "unread") setDates(id, { started: 0, finished: 0 });
    // ABBANDONARE NON E' FINIRE. La data d'inizio resta — quel libro l'hai
    // davvero cominciato, ed e' un pezzo della tua storia di lettore — ma
    // quella di fine se ne va: senza toglierla, un romanzo prima dichiarato
    // letto e poi mollato resterebbe nel diario fra i finiti, e il conto
    // dell'anno direbbe una cosa che non e' successa.
    if (status === "abandoned") {
      if (!getStarted(id)) setDates(id, { started: now });
      setDates(id, { finished: 0 });
    }
  }
  touchBook(id);
}

export function getLastOpened() {
  return localStorage.getItem(LAST_KEY);
}

export function setLastOpened(id) {
  localStorage.setItem(LAST_KEY, id);
  localStorage.setItem("bc_prefs_upd", String(Date.now()));
}

export function removeBookMeta(id) {
  saveBooks(loadBooks().filter((b) => b.id !== id));
  addTombstone(id);
  localStorage.removeItem(`bc_upd_${id}`);
  localStorage.removeItem(`bc_music_${id}`);
  localStorage.removeItem(`bc_prog_${id}`);
  localStorage.removeItem(`bc_status_${id}`);
  localStorage.removeItem(`bc_cfi_${id}`);
  localStorage.removeItem(`bc_marks_${id}`);
  localStorage.removeItem(`bc_hl_${id}`);
  localStorage.removeItem(`bc_start_${id}`);
  localStorage.removeItem(`bc_end_${id}`);
  if (getLastOpened() === id) localStorage.removeItem(LAST_KEY);
}

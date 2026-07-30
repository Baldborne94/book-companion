const BOOKS_KEY = "bc_books";
const LAST_KEY = "bc_lastopen";

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
}

export function getStatus(id) {
  return localStorage.getItem(`bc_status_${id}`) || "unread";
}

export function setStatus(id, status) {
  localStorage.setItem(`bc_status_${id}`, status);
}

export function getLastOpened() {
  return localStorage.getItem(LAST_KEY);
}

export function setLastOpened(id) {
  localStorage.setItem(LAST_KEY, id);
}

export function removeBookMeta(id) {
  saveBooks(loadBooks().filter((b) => b.id !== id));
  localStorage.removeItem(`bc_prog_${id}`);
  localStorage.removeItem(`bc_status_${id}`);
  if (getLastOpened() === id) localStorage.removeItem(LAST_KEY);
}

const readJson = (key, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
};

const touch = (id) => localStorage.setItem(`bc_upd_${id}`, String(Date.now()));

export const getCfi = (id) => localStorage.getItem(`bc_cfi_${id}`) || null;
export const setCfi = (id, cfi) => {
  localStorage.setItem(`bc_cfi_${id}`, cfi);
  touch(id);
};

export const getMarks = (id) => readJson(`bc_marks_${id}`, []);
export const saveMarks = (id, list) => {
  localStorage.setItem(`bc_marks_${id}`, JSON.stringify(list));
  touch(id);
};

export const getHighlights = (id) => readJson(`bc_hl_${id}`, []);
export const saveHighlights = (id, list) => {
  localStorage.setItem(`bc_hl_${id}`, JSON.stringify(list));
  touch(id);
};

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

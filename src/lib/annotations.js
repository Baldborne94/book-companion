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

export function removeAnnotations(id) {
  localStorage.removeItem(`bc_cfi_${id}`);
  localStorage.removeItem(`bc_marks_${id}`);
  localStorage.removeItem(`bc_hl_${id}`);
}

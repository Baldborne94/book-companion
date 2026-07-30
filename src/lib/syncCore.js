const EMPTY_ROW = {
  title: "",
  author: "",
  series: "",
  file_type: "epub",
  added_at: 0,
  rating: 0,
  notes: "",
  status: "unread",
  progress: 0,
  cfi: null,
  marks: [],
  highlights: [],
  music: null,
  file_ext: null,
  deleted: false,
  updated_at: 0,
};

// PostgREST unisce le chiavi di un batch: una riga con meno colonne
// (le lapidi) le riceverebbe come null, non come default.
export const normalizeRow = (row) => ({ ...EMPTY_ROW, ...row });

export const rowFromLocal = (book, state, updatedAt) => ({
  id: book.id,
  title: book.title || "",
  author: book.author || "",
  series: book.series || "",
  file_type: book.fileType || "epub",
  added_at: book.addedAt || 0,
  rating: book.rating || 0,
  notes: book.notes || "",
  status: state.status || "unread",
  progress: state.progress || 0,
  cfi: state.cfi ?? null,
  marks: state.marks || [],
  highlights: state.highlights || [],
  music: state.music ?? null,
  file_ext: book.fileType || "epub",
  deleted: false,
  updated_at: updatedAt,
});

export const localFromRow = (row) => ({
  book: {
    id: row.id,
    title: row.title || "",
    author: row.author || "",
    series: row.series || "",
    fileType: row.file_type || "epub",
    addedAt: row.added_at || 0,
    rating: row.rating || 0,
    notes: row.notes || "",
  },
  state: {
    status: row.status || "unread",
    progress: row.progress || 0,
    cfi: row.cfi ?? null,
    marks: Array.isArray(row.marks) ? row.marks : [],
    highlights: Array.isArray(row.highlights) ? row.highlights : [],
    music: row.music ?? null,
  },
});

export function planSync({ localRows, tombstones, remoteRows }) {
  const remote = new Map(remoteRows.map((r) => [r.id, r]));
  const local = new Map(localRows.map((r) => [r.id, r]));
  const pull = [];
  const push = [];
  const removeLocal = [];

  for (const [id, row] of local) {
    const r = remote.get(id);
    if (!r || row.updated_at > r.updated_at) push.push(row);
    else if (r.deleted && r.updated_at >= row.updated_at) removeLocal.push(id);
    else if (r.updated_at > row.updated_at) pull.push(r);
  }

  for (const [id, ts] of Object.entries(tombstones)) {
    const r = remote.get(id);
    if (!r || ts > r.updated_at) push.push({ id, deleted: true, updated_at: ts });
  }

  for (const [id, r] of remote) {
    if (local.has(id) || tombstones[id] >= r.updated_at) continue;
    if (!r.deleted) pull.push(r);
  }

  return { pull, push, removeLocal };
}

export function mergePrefs(localPrefs, remotePrefs) {
  if (!remotePrefs) return { apply: null, push: localPrefs };
  if (!localPrefs || remotePrefs.updated_at > localPrefs.updated_at)
    return { apply: remotePrefs, push: null };
  if (localPrefs.updated_at > remotePrefs.updated_at)
    return { apply: null, push: localPrefs };
  return { apply: null, push: null };
}

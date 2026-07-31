const EMPTY_ROW = {
  title: "",
  author: "",
  series: "",
  file_type: "epub",
  genre: "",
  saga: "",
  saga_order: null,
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
  genre: book.genre || "",
  saga: book.saga || "",
  saga_order: book.sagaOrder ?? null,
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
    genre: row.genre || "",
    saga: row.saga || "",
    sagaOrder: row.saga_order ?? null,
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

const favStamp = (f) => f.updatedAt || f.addedAt || 0;

// Unione, non sostituzione: melodie salvate su dispositivi diversi
// devono sopravvivere entrambe. Vince la versione piu' recente per id.
export function mergeFavorites(localFavs = [], remoteFavs = []) {
  const byId = new Map();
  for (const f of [...(remoteFavs || []), ...(localFavs || [])]) {
    if (!f?.id) continue;
    const prev = byId.get(f.id);
    if (!prev || favStamp(f) >= favStamp(prev)) byId.set(f.id, f);
  }
  return [...byId.values()].sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
}

export function mergePrefs(local, remote) {
  const music_favs = mergeFavorites(local.music_favs, remote?.music_favs);
  const remoteNewer = !!remote && (remote.updated_at || 0) > (local.updated_at || 0);
  const merged = {
    reader: remoteNewer ? (remote.reader ?? local.reader) : (local.reader ?? remote?.reader ?? null),
    last_opened: remoteNewer
      ? remote.last_opened || local.last_opened || null
      : local.last_opened || remote?.last_opened || null,
    music_favs,
    updated_at: Math.max(local.updated_at || 0, remote?.updated_at || 0),
  };
  const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  return {
    merged,
    applyLocal:
      !eq(merged.music_favs, local.music_favs) ||
      !eq(merged.reader, local.reader) ||
      merged.last_opened !== (local.last_opened || null),
    pushRemote:
      !remote ||
      !eq(merged.music_favs, remote.music_favs) ||
      !eq(merged.reader, remote.reader) ||
      merged.last_opened !== (remote.last_opened || null),
  };
}

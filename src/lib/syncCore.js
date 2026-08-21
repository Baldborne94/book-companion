import { fondi } from "./glossarioMio.js";
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
  started_at: 0,
  finished_at: 0,
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
  // l'impronta dei byte: e' quella che riconosce lo stesso file importato
  // due volte, e senza di lei il doppione fra due dispositivi si puo' solo
  // segnalare per titolo e autore, non saltare
  impronta: book.impronta || null,
  status: state.status || "unread",
  started_at: state.started || 0,
  finished_at: state.finished || 0,
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
    ...(row.impronta ? { impronta: row.impronta } : {}),
  },
  state: {
    status: row.status || "unread",
    started: row.started_at || 0,
    finished: row.finished_at || 0,
    progress: row.progress || 0,
    cfi: row.cfi ?? null,
    marks: Array.isArray(row.marks) ? row.marks : [],
    highlights: Array.isArray(row.highlights) ? row.highlights : [],
    music: row.music ?? null,
  },
});

// UNO SCHEMA NON MIGRATO NON DEVE ROMPERE TUTTA LA SINCRONIZZAZIONE.
//
// PostgREST dice esattamente quale colonna non trova: «Could not find the
// 'music_lists' column of 'prefs' in the schema cache». Per i libri c'era
// gia' una scala di rinuncia; le preferenze invece morivano alla prima
// colonna mancante, e con loro moriva TUTTO il giro — compresa la riga
// «ultima sincronizzazione», che restava «mai» per sempre.
//
// Succede sul serio: `music_lists` esiste dalle raccolte musicali, e chi
// non aveva rilanciato lo schema se l'e' trovata addosso mesi dopo.
export function colonnaMancante(error) {
  const testo = `${error?.message || ""} ${error?.details || ""}`;
  const m = /'([a-z_]+)'\s+column/i.exec(testo);
  return m ? m[1] : null;
}

// Quello che identifica la riga non si toglie mai: senza `user_id` la
// scrittura non e' piu' nemmeno rivolta a qualcuno.
const INTOCCABILI = new Set(["user_id", "updated_at", "id"]);

export function senzaColonna(riga, nome) {
  if (!nome || INTOCCABILI.has(nome) || !(nome in riga)) return null;
  const { [nome]: _via, ...resto } = riga;
  return resto;
}

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

// Uno schema migrato DOPO un salvataggio degradato lascia nel cloud righe
// con lo stesso updated_at ma prive dei campi nuovi: non ripartirebbero
// mai da sole. Si rimanda tutto cio' di cui il locale resta padrone,
// lasciando stare le righe che il cloud sta per insegnarci.
export function withRepush({ push, pull, removeLocal, localRows }) {
  const already = new Set(push.map((r) => r.id));
  const held = new Set([...pull.map((r) => r.id), ...removeLocal]);
  return [...push, ...localRows.filter((r) => !already.has(r.id) && !held.has(r.id))];
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

// I TERMINI DEL GLOSSARIO viaggiano nelle preferenze, non coi libri: la
// chiave e' la saga, non il singolo volume. La fusione e' quella
// dell'archivio (`fondi`: quel che c'e' gia' resta, si prende solo cio' che
// manca), girata nel verso che dice l'orologio — chi ha scritto per ultimo
// vince, come per tutto il resto delle preferenze.
function fondiGlossari(local, remote, remoteNewer) {
  const a = remoteNewer ? remote : local;
  const b = remoteNewer ? local : remote;
  return fondi(a || {}, b || {}).glossari;
}

export function mergePrefs(local, remote) {
  const music_favs = mergeFavorites(local.music_favs, remote?.music_favs);
  // le raccolte hanno la stessa forma dei preferiti (id, addedAt,
  // updatedAt, deleted), quindi si fondono con la stessa regola
  const music_lists = mergeFavorites(local.music_lists, remote?.music_lists);
  const remoteNewer = !!remote && (remote.updated_at || 0) > (local.updated_at || 0);
  const merged = {
    reader: remoteNewer ? (remote.reader ?? local.reader) : (local.reader ?? remote?.reader ?? null),
    last_opened: remoteNewer
      ? remote.last_opened || local.last_opened || null
      : local.last_opened || remote?.last_opened || null,
    music_favs,
    music_lists,
    glossari: fondiGlossari(local.glossari, remote?.glossari, remoteNewer),
    updated_at: Math.max(local.updated_at || 0, remote?.updated_at || 0),
  };
  const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  return {
    merged,
    applyLocal:
      !eq(merged.music_favs, local.music_favs) ||
      !eq(merged.music_lists, local.music_lists) ||
      !eq(merged.reader, local.reader) ||
      !eq(merged.glossari, local.glossari) ||
      merged.last_opened !== (local.last_opened || null),
    pushRemote:
      !remote ||
      !eq(merged.music_favs, remote.music_favs) ||
      !eq(merged.music_lists, remote.music_lists) ||
      !eq(merged.reader, remote.reader) ||
      !eq(merged.glossari, remote.glossari) ||
      merged.last_opened !== (remote.last_opened || null),
  };
}

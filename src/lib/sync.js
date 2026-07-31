import { getClient, isSyncConfigured, BUCKET } from "./supabase.js";
import { putFile, getFile, putCover, getCover, removeBookData, listFileIds } from "./bookStore.js";
import {
  loadBooks, saveBooks, getProgress, setProgress, getStatus, setStatus,
  getUpdatedAt, touchBook, getTombstones, clearTombstones, getLastOpened,
} from "./library.js";
import {
  getCfi, setCfi, getMarks, saveMarks, getHighlights, saveHighlights, removeAnnotations, setJump,
} from "./annotations.js";
import { getBookMusic, setBookMusic, getFavoritesRaw, writeFavorites } from "./music.js";
import { planSync, mergePrefs, rowFromLocal, localFromRow, normalizeRow } from "./syncCore.js";

const LAST_SYNC_KEY = "bc_lastsync";
const UPLOADED_KEY = "bc_uploaded";
const PREFS_UPD_KEY = "bc_prefs_upd";

export const getLastSync = () => parseInt(localStorage.getItem(LAST_SYNC_KEY), 10) || 0;
export const touchPrefs = () => localStorage.setItem(PREFS_UPD_KEY, String(Date.now()));

const uploaded = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(UPLOADED_KEY)) || []);
  } catch {
    return new Set();
  }
};
const markUploaded = (id) =>
  localStorage.setItem(UPLOADED_KEY, JSON.stringify([...uploaded(), id]));

const filePath = (uid, book) => `${uid}/${book.id}.${book.fileType || "epub"}`;
const coverPath = (uid, id) => `${uid}/${id}.cover`;

export async function getSession() {
  const sb = await getClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session || null;
}

export async function signIn(email) {
  const sb = await getClient();
  if (!sb) throw new Error("sync non configurata");
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  const sb = await getClient();
  await sb?.auth.signOut();
}

function readLocalState(id) {
  return {
    status: getStatus(id),
    progress: getProgress(id),
    cfi: getCfi(id),
    marks: getMarks(id),
    highlights: getHighlights(id),
    music: getBookMusic(id),
  };
}

function writeLocalState(id, state) {
  setStatus(id, state.status);
  setProgress(id, state.progress);
  if (state.cfi) setCfi(id, state.cfi);
  saveMarks(id, state.marks);
  saveHighlights(id, state.highlights);
  if (state.music) setBookMusic(id, state.music);
}

function localPrefs() {
  let reader = null;
  try {
    reader = JSON.parse(localStorage.getItem("bc_reader") || "null");
  } catch {
    /* preferenze illeggibili: si riparte dai default */
  }
  return {
    reader,
    music_favs: getFavoritesRaw(),
    last_opened: getLastOpened(),
    updated_at: parseInt(localStorage.getItem(PREFS_UPD_KEY), 10) || 0,
  };
}

export async function syncNow({ onProgress } = {}) {
  if (!isSyncConfigured()) return { skipped: "non configurata" };
  const sb = await getClient();
  const session = await getSession();
  if (!session) return { skipped: "non connesso" };
  const uid = session.user.id;
  const say = (m) => onProgress?.(m);

  say("Leggo la biblioteca…");
  const books = loadBooks();
  const localRows = books.map((b) =>
    rowFromLocal(b, readLocalState(b.id), getUpdatedAt(b.id, b.addedAt || 1))
  );
  const tombstones = getTombstones();

  const { data: remoteRows, error } = await sb.from("books").select("*").eq("user_id", uid);
  if (error) throw error;

  const { pull, push, removeLocal } = planSync({
    localRows,
    tombstones,
    remoteRows: remoteRows || [],
  });

  // Se questo dispositivo e' piu' recente ma piu' indietro, la posizione
  // remota non va persa: la teniamo da parte e la proponiamo all'apertura.
  for (const row of push) {
    if (row.deleted) continue;
    const r = (remoteRows || []).find((x) => x.id === row.id);
    if (r && !r.deleted && r.cfi && (r.progress || 0) > (row.progress || 0) + 0.02) {
      setJump(row.id, { cfi: r.cfi, progress: r.progress });
    }
  }

  if (push.length) {
    say(`Invio ${push.length} ${push.length === 1 ? "libro" : "libri"}…`);
    const { error: upErr } = await sb
      .from("books")
      .upsert(push.map((r) => ({ ...normalizeRow(r), user_id: uid })));
    if (upErr) throw upErr;
    const deletedIds = push.filter((r) => r.deleted).map((r) => r.id);
    if (deletedIds.length) {
      const paths = deletedIds.flatMap((id) => [
        `${uid}/${id}.epub`,
        `${uid}/${id}.pdf`,
        coverPath(uid, id),
      ]);
      await sb.storage.from(BUCKET).remove(paths).catch(() => {});
      clearTombstones(deletedIds);
    }
  }

  const already = uploaded();
  const localFiles = new Set(await listFileIds());
  for (const row of push) {
    if (row.deleted || already.has(row.id)) continue;
    const book = books.find((b) => b.id === row.id);
    if (!book || !localFiles.has(row.id)) continue;
    const blob = await getFile(row.id);
    if (!blob) continue;
    say(`Carico «${book.title}»…`);
    const { error: sErr } = await sb.storage
      .from(BUCKET)
      .upload(filePath(uid, book), blob, { upsert: true, contentType: blob.type || undefined });
    if (sErr && sErr.statusCode !== "409") throw sErr;
    const cover = await getCover(row.id);
    if (cover) {
      await sb.storage.from(BUCKET).upload(coverPath(uid, row.id), cover, { upsert: true });
    }
    markUploaded(row.id);
  }

  if (pull.length || removeLocal.length) say("Ricevo le novità…");
  let next = loadBooks();
  for (const row of pull) {
    const { book, state } = localFromRow(row);
    const i = next.findIndex((b) => b.id === book.id);
    if (i >= 0) next[i] = { ...next[i], ...book };
    else next.push(book);
    writeLocalState(book.id, state);
    touchBook(book.id, row.updated_at);
    if (!(await getCover(book.id))) {
      const { data } = await sb.storage.from(BUCKET).download(coverPath(uid, book.id));
      if (data) await putCover(book.id, data);
    }
  }

  for (const id of removeLocal) {
    next = next.filter((b) => b.id !== id);
    removeAnnotations(id);
    await removeBookData(id).catch(() => {});
  }
  if (pull.length || removeLocal.length) saveBooks(next);

  const { data: remotePrefsRows } = await sb.from("prefs").select("*").eq("user_id", uid).limit(1);
  const { merged, applyLocal, pushRemote } = mergePrefs(localPrefs(), remotePrefsRows?.[0] || null);
  const stamp = pushRemote ? Date.now() : merged.updated_at;
  if (applyLocal) {
    if (merged.reader) localStorage.setItem("bc_reader", JSON.stringify(merged.reader));
    writeFavorites(merged.music_favs);
    if (merged.last_opened) localStorage.setItem("bc_lastopen", merged.last_opened);
  }
  if (pushRemote) {
    await sb.from("prefs").upsert({ ...merged, updated_at: stamp, user_id: uid });
  }
  localStorage.setItem(PREFS_UPD_KEY, String(stamp));

  localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  return {
    pushed: push.length,
    pulled: pull.length,
    removed: removeLocal.length,
    books: loadBooks(),
  };
}

export async function ensureLocalFile(book) {
  const local = await getFile(book.id);
  if (local) return local;
  if (!isSyncConfigured()) return null;
  const session = await getSession();
  if (!session) return null;
  const sb = await getClient();
  const { data, error } = await sb.storage.from(BUCKET).download(filePath(session.user.id, book));
  if (error || !data) return null;
  await putFile(book.id, data);
  return data;
}

export async function localFileIds() {
  try {
    return new Set(await listFileIds());
  } catch {
    return new Set();
  }
}

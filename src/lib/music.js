import { putTrack, getTrack, removeTrack } from "./bookStore.js";

const FAVS_KEY = "bc_music_favs";

// DUE SORGENTI, UN SOLO ELENCO DI MELODIE.
//
// YouTube suona solo a schermo acceso, e non e' un limite della PWA: e' il
// lettore dentro l'iframe: quando la pagina va in secondo piano, YouTube si
// mette in pausa da solo e il browser gli toglie il tempo. Non c'e' chiamata
// che lo impedisca, perche' quel lettore non e' nostro.
// Un file audio nostro invece suona da un <audio> in cima alla pagina, e
// quello i browser lo tengono vivo a schermo spento — e' lo stesso
// meccanismo delle radio e dei podcast sul web. Percio' le melodie che
// devono accompagnare il sonno sono FILE, non link.
//
// Un preferito e' YouTube se ha un `url`, un file se ha un `trackId`. I
// preferiti gia' salvati non hanno `trackId`, quindi restano YouTube senza
// bisogno di migrare niente.
export const isFile = (f) => !!f?.trackId;

const AUDIO_OK = /^audio\//;

export async function addTrackFile(file) {
  if (!AUDIO_OK.test(file.type || "")) return null;
  const trackId = crypto.randomUUID();
  await putTrack(trackId, file);
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: (file.name || "").replace(/\.[^.]+$/, "") || "Melodia senza nome",
    trackId,
    mime: file.type,
    size: file.size,
    addedAt: now,
    updatedAt: now,
  };
}

export const loadTrack = (trackId) => getTrack(trackId);
export const dropTrack = (trackId) => removeTrack(trackId).catch(() => {});

export function parseYouTube(input) {
  try {
    const u = new URL(input.trim());
    if (!/(^|\.)((youtube(-nocookie)?\.com)|(youtu\.be))$/.test(u.hostname)) return null;
    const list = u.searchParams.get("list");
    let video = u.searchParams.get("v");
    if (!video && u.hostname === "youtu.be") video = u.pathname.slice(1).split("/")[0] || null;
    if (!video) {
      const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{6,})/);
      if (m) video = m[2];
    }
    if (list) return { kind: "playlist", list, video: video || null };
    if (video) return { kind: "video", video };
    return null;
  } catch {
    return null;
  }
}

export function embedUrl(src) {
  const base = "https://www.youtube-nocookie.com/embed/";
  const params = "autoplay=1&enablejsapi=1&rel=0";
  if (src.kind === "playlist")
    return `${base}${src.video || "videoseries"}?list=${src.list}&${params}`;
  return `${base}${src.video}?${params}`;
}

// La lista grezza contiene anche le lapidi (deleted: true): servono a
// propagare le eliminazioni tra dispositivi senza toccare lo schema.
export function getFavoritesRaw() {
  try {
    const v = JSON.parse(localStorage.getItem(FAVS_KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export const getFavorites = () => getFavoritesRaw().filter((f) => !f.deleted);

export function writeFavorites(list) {
  localStorage.setItem(FAVS_KEY, JSON.stringify(list));
}

export function saveFavorites(list) {
  writeFavorites(list);
  localStorage.setItem("bc_prefs_upd", String(Date.now()));
}

export function getBookMusic(bookId) {
  try {
    return JSON.parse(localStorage.getItem(`bc_music_${bookId}`)) || null;
  } catch {
    return null;
  }
}

export function setBookMusic(bookId, pair) {
  localStorage.setItem(`bc_music_${bookId}`, JSON.stringify(pair));
  localStorage.setItem(`bc_upd_${bookId}`, String(Date.now()));
}

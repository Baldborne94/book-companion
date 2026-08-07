import { putTrack, getTrack, removeTrack } from "./bookStore.js";

const FAVS_KEY = "bc_music_favs";

// TRE SORGENTI, UN SOLO ELENCO DI MELODIE.
//
// La riga che divide tutto e' una sola: CHI SUONA. Se suona un <audio>
// nostro, in cima alla pagina, il browser tiene viva la scheda a schermo
// spento — e' lo stesso meccanismo con cui sul web suonano radio e podcast.
// Se suona il lettore di YouTube dentro un iframe, no: quando la pagina va
// in secondo piano YouTube si mette in pausa da solo e il browser gli
// toglie il tempo. Non c'e' chiamata che lo impedisca, perche' quel lettore
// non e' nostro — e non lo sarebbe nemmeno dentro un'app Android, dove a
// schermo spento la pagina e' in secondo piano lo stesso.
//
// Quindi:
// - `trackId`  → un file caricato dal lettore, byte nello store `tracks`;
// - `url` che NON e' YouTube → un flusso audio diretto (una radio, un
//   ambient senza fine): lo suona il nostro <audio>, niente da scaricare;
// - `url` di YouTube → l'iframe, e solo a schermo acceso.
//
// I preferiti gia' salvati hanno solo `url` di YouTube, quindi continuano a
// comportarsi come prima senza bisogno di migrare niente.
export const isFile = (f) => !!f?.trackId;

// un indirizzo che sappiamo suonare da soli. Solo https: la pagina sta su
// https e un flusso in chiaro verrebbe bloccato dal browser senza spiegare
// perche', lasciando il lettore davanti a una musica che non parte.
export function isFlusso(input) {
  const url = typeof input === "string" ? input : input?.url;
  if (!url || parseYouTube(url)) return false;
  try {
    return new URL(url.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

// tutto cio' che suona dal NOSTRO lettore, cioe' tutto cio' che regge lo
// schermo spento
export const reggeSchermoSpento = (f) => isFile(f) || isFlusso(f);

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

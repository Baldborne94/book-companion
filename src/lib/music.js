import { putTrack, getTrack, removeTrack } from "./bookStore.js";

const FAVS_KEY = "bc_music_favs";

// DUE SORGENTI, UN SOLO ELENCO DI MELODIE.
//
// La riga che divide tutto e' una sola: CHI SUONA. Un file caricato dal
// lettore lo suona un <audio> nostro, in cima alla pagina, e il browser
// tiene viva la scheda a schermo spento — e' lo stesso meccanismo con cui
// sul web suonano radio e podcast. YouTube no: quel lettore sta in un
// iframe, quando la pagina va in secondo piano si mette in pausa da solo e
// il browser gli toglie il tempo. Non c'e' chiamata che lo impedisca,
// perche' non e' nostro — e non lo sarebbe nemmeno dentro un'app Android,
// dove a schermo spento la pagina e' in secondo piano lo stesso.
//
// C'e' stata per poco anche una terza sorgente, l'indirizzo diretto di un
// flusso audio. Tolta: nessuno la usava, e portava con se' un pezzo di
// fragilita' tutto suo (riconnessioni, mixed content, indirizzi che non
// sono audio) per una funzione che non serviva.
//
// `trackId` → file dell'utente; `url` → YouTube.
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

// LE RACCOLTE. Una raccolta e' un nome e un ELENCO DI ID di melodie, mai
// le melodie stesse: rinominare o togliere una melodia non deve costringere
// a rincorrerla dentro ogni raccolta. Il rovescio e' che un id puo' non
// esistere piu', e allora si salta — `braniDi` lo fa da solo.
// Stessa forma dei preferiti (id, addedAt, updatedAt, deleted), cosi' la
// sincronizzazione le fonde con la stessa funzione senza casi speciali.
const LISTS_KEY = "bc_music_lists";

export function getListsRaw() {
  try {
    const v = JSON.parse(localStorage.getItem(LISTS_KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export const getLists = () => getListsRaw().filter((r) => !r.deleted);

export function writeLists(list) {
  localStorage.setItem(LISTS_KEY, JSON.stringify(list));
}

export function saveLists(list) {
  writeLists(list);
  localStorage.setItem("bc_prefs_upd", String(Date.now()));
}

export function nuovaRaccolta(name) {
  const now = Date.now();
  return { id: crypto.randomUUID(), name: name || "Raccolta senza nome", brani: [], addedAt: now, updatedAt: now };
}

// le melodie di una raccolta, nell'ordine in cui sono state messe, saltando
// quelle che nel frattempo sono sparite
export const braniDi = (raccolta, favs) =>
  (raccolta?.brani || []).map((id) => favs.find((f) => f.id === id && !f.deleted)).filter(Boolean);

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

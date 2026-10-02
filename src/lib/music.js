import { putTrack, getTrack, removeTrack } from "./bookStore.js";
import { melodiaDalDrive } from "./drive.js";

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

// UNA MELODIA CHE QUI NON C'E' SCENDE DA DRIVE QUANDO LA SUONI, e poi resta
// qui (chiesto dal lettore: «scaricali solo quando li suono»). `null` vuol
// dire che su Drive non c'e' — il brano e' salito solo dal dispositivo
// dove l'hai caricato, e non ancora; un guasto (rete, chiave rifiutata) si
// alza, perche' chi suona deve poter dire le due cose in modo diverso.
export async function portaQuiMelodia(voce, { prendi = melodiaDalDrive } = {}) {
  if (!voce?.trackId) return null;
  const blob = await prendi(voce.trackId);
  if (!blob) return null;
  await putTrack(voce.trackId, blob).catch(() => {});
  return blob;
}
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

export function embedUrl(src, { inizio = 0 } = {}) {
  const base = "https://www.youtube-nocookie.com/embed/";
  const params = `autoplay=1&enablejsapi=1&rel=0${inizio > 0 && src.kind === "video" ? `&start=${Math.floor(inizio)}` : ""}`;
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

// IL VOLUME IN APP. Serve a tenere la musica sotto la lettura senza
// abbassare tutto il tablet — le notifiche e la sveglia restano dove sono.
// E' una cosa del dispositivo, non della biblioteca (sul tablet a letto si
// tiene basso, altrove no): per questo sta fuori dalle preferenze che
// viaggiano nella sincronizzazione. Parte da 1: chi aggiorna non deve
// trovarsi la musica piu' bassa di ieri senza averla toccata.
const VOL_KEY = "bc_music_vol";

export function getVolume() {
  const v = parseFloat(localStorage.getItem(VOL_KEY));
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}

// Quanto manca allo spegnimento, in poche lettere: sta accanto ai comandi
// del player, dove lo spazio e' quello che e'. Sotto il minuto passa ai
// secondi — e' il tratto in cui la musica sta gia' sfumando, e vedere
// «1 min» fermo li' sembrerebbe un conto rotto.
export function restaDa(ms) {
  if (ms == null) return null;
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r}` : `${h} h`;
}

export function saveVolume(v) {
  localStorage.setItem(VOL_KEY, String(Math.min(1, Math.max(0, v))));
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

// IL PUNTO DI OGNI MELODIA (chiesto dal lettore: «quando si ferma la
// melodia ripartire dal punto in cui si è interrotta e non farla partire di
// nuovo dall'inizio»). Spenta a mano, addormentata dal timer o chiusa con
// l'app: rimessa, riparte da dov'era. Una melodia arrivata in fondo riparte
// dall'inizio, e i primi secondi non contano. E' una cosa del dispositivo,
// come il volume: non viaggia. Le playlist di YouTube non hanno un punto
// solo, e restano fuori.
const PUNTI_KEY = "bc_melodia_punti";
export const PUNTI_TENUTI = 60;
export const MARGINE = 5;

export function chiaveMelodia(voce) {
  if (voce?.trackId) return `f:${voce.trackId}`;
  const src = parseYouTube(voce?.url || "");
  return src?.kind === "video" ? `y:${src.video}` : null;
}

const leggiMappa = (st, k) => {
  try {
    const v = JSON.parse(st.getItem(k));
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
};
const scriviMappa = (st, k, m) => {
  try {
    st.setItem(k, JSON.stringify(m));
  } catch {
    /* un punto che non si scrive non deve fermare la musica */
  }
};

export function puntoDi(voce, st = globalThis.localStorage) {
  const k = chiaveMelodia(voce);
  return leggiMappa(st, PUNTI_KEY)[k]?.t || 0;
}

export function segnaPunto(voce, t, durata, { st = globalThis.localStorage, ora = Date.now() } = {}) {
  const k = chiaveMelodia(voce);
  if (!k || !Number.isFinite(t)) return;
  const m = leggiMappa(st, PUNTI_KEY);
  if (t < MARGINE || durata - t < MARGINE) delete m[k];
  else m[k] = { t: Math.floor(t), q: ora };
  const tenuti = Object.entries(m).sort((a, b) => b[1].q - a[1].q).slice(0, PUNTI_TENUTI);
  scriviMappa(st, PUNTI_KEY, Object.fromEntries(tenuti));
}

// arrivata in fondo: la prossima volta da capo
export function dimenticaPunto(voce, st = globalThis.localStorage) {
  const m = leggiMappa(st, PUNTI_KEY);
  delete m[chiaveMelodia(voce)];
  scriviMappa(st, PUNTI_KEY, m);
}

// dove riprendere una melodia appena si e' caricata: un punto oltre la
// fine (il file e' cambiato) non vale
export const daDoveRiprendere = (punto, durata) => (punto >= MARGINE && (!(durata > 0) || durata - punto >= MARGINE) ? punto : 0);

// la raccolta ricorda il brano a cui si era: «▶» riparte da lui
const DOVE_KEY = "bc_raccolta_dove";

export function segnaDove(raccoltaId, melodiaId, st = globalThis.localStorage) {
  scriviMappa(st, DOVE_KEY, { ...leggiMappa(st, DOVE_KEY), [raccoltaId]: melodiaId });
}

export function doveDi(raccolta, brani, st = globalThis.localStorage) {
  const id = leggiMappa(st, DOVE_KEY)[raccolta?.id];
  const i = brani.findIndex((b) => b.id === id);
  return i < 0 ? 0 : i;
}

// «2:13», «1:02:05»
export function minuti(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

// IL LETTORE COME QUELLI CHE SI CONOSCONO (chiesto dal lettore: «un mini
// player fatto come si deve, come se avessi YouTube o Spotify»).
//
// «⏮» come li': a brano avviato da piu' di tre secondi lo riavvolge, nei
// primi secondi torna al brano prima. Al primo brano riavvolge e basta,
// e fuori da una coda (sempre al primo) non c'e' un «prima».
export const RIAVVOLGE_DOPO = 3;
export function indietroDa({ i = 0, t = 0 } = {}) {
  if (t > RIAVVOLGE_DOPO || i <= 0) return { riavvolgi: true };
  return { i: i - 1 };
}

// i brani che vengono dopo quello che suona, nell'ordine in cui verranno:
// in fondo alla coda si ricomincia
export function prossimi(elenco = [], i = 0, quanti = 5) {
  const fuori = [];
  for (let k = 1; k <= Math.min(quanti, elenco.length - 1); k++) {
    const j = (i + k) % elenco.length;
    fuori.push({ ...elenco[j], indice: j });
  }
  return fuori;
}

// LA COPERTINA DI UNA MELODIA, che un file audio non ha: un riquadro coi
// colori del tema, girato e segnato in modo diverso per ogni nome, cosi'
// due brani si distinguono a colpo d'occhio e lo stesso brano ha sempre la
// stessa faccia
const GLIFI = ["♫", "♪", "☾", "✦", "♬", "✧", "❦", "☽"];
export function facciaDi(nome = "") {
  let h = 2166136261;
  for (const ch of String(nome)) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
  return { angolo: h % 360, glifo: GLIFI[(h >>> 9) % GLIFI.length], verso: (h >>> 13) % 2 === 0 };
}

// la posizione toccata sulla barra, in secondi: dentro il brano, sempre
export function tempoAl(frazione, durata) {
  if (!(durata > 0) || !Number.isFinite(durata)) return 0;
  return Math.min(durata, Math.max(0, frazione * durata));
}

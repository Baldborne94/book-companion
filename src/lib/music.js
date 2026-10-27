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
// un file letto da una cartella puo' arrivare senza tipo, o con quello
// generico di chi non sa: Android non sempre lo dice, e allora decide
// l'estensione. Un tipo vero che non e' audio resta un no («audio.mp3» che
// si dichiara testo non entra)
const AUDIO_EST = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg", flac: "audio/flac", wav: "audio/wav", weba: "audio/webm" };
const estensione = (nome) => (String(nome || "").match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
const SENZA_TIPO = new Set(["", "application/octet-stream"]);
export const tipoAudio = (file) =>
  AUDIO_OK.test(file?.type || "") ? file.type : SENZA_TIPO.has(file?.type || "") ? AUDIO_EST[estensione(file?.name)] || "" : "";
export const nomeMelodia = (nomeFile) => String(nomeFile || "").replace(/\.[^.]+$/, "") || "Melodia senza nome";

export async function addTrackFile(file) {
  const mime = tipoAudio(file);
  if (!mime) return null;
  const trackId = crypto.randomUUID();
  await putTrack(trackId, file);
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: nomeMelodia(file.name),
    trackId,
    mime,
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

// LA SALA SI RILEGGE QUANDO LA MUSICA CAMBIA SOTTO DI LEI (chiesto dal
// lettore: «se metto nuove raccolte o altro devo vederle anche sugli altri
// dispositivi»): la sincronizzazione scrive melodie e raccolte mentre la
// sala e' aperta, e la sala le aveva lette una volta sola, all'apertura
export const MUSICA_CAMBIATA = "bc:musica";
const avvisa = () => {
  try {
    globalThis.dispatchEvent?.(new Event(MUSICA_CAMBIATA));
  } catch {
    /* fuori dal browser nessuno ascolta */
  }
};

export function writeFavorites(list) {
  localStorage.setItem(FAVS_KEY, JSON.stringify(list));
  avvisa();
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
  avvisa();
}

export function saveLists(list) {
  writeLists(list);
  localStorage.setItem("bc_prefs_upd", String(Date.now()));
}

export function nuovaRaccolta(name) {
  const now = Date.now();
  return { id: crypto.randomUUID(), name: name || "Raccolta senza nome", brani: [], addedAt: now, updatedAt: now };
}

// UNA CARTELLA DIVENTA UNA RACCOLTA (chiesto dal lettore, con la foto della
// cartella «Music» del tablet: «Atmosfera - Fantasy epica», «Horror
// playlist», «WARHAMMER 40k»…: «mi permetti di caricare sul player
// direttamente una raccolta?»). Ogni sottocartella con della musica e' una
// raccolta col suo nome, e i brani sciolti della cartella scelta fanno una
// raccolta col nome di lei; una cartella sola e' una raccolta sola. Le
// cartelle nascoste («.thumbnails») non si guardano. Dentro una raccolta i
// brani stanno nell'ordine dei nomi, coi numeri contati da numeri («2 -» prima
// di «10 -»). E SI PUO' RIFARE: una raccolta col nome che c'e' gia' prende
// solo i brani che le mancano, e un brano gia' custodito (stesso nome, stesso
// peso) non si custodisce due volte, si rimette nella raccolta.
//
// `voci`: { file, percorso } con il percorso DENTRO la cartella scelta
// («WARHAMMER 40k/Battle.mp3» → ["WARHAMMER 40k", "Battle.mp3"]).
const nomeGiusto = (s) => String(s || "").trim().toLocaleLowerCase();
const ordineNaturale = new Intl.Collator("it", { numeric: true, sensitivity: "base" });

export function pianoDaCartella(radice, voci, { raccolte = [], favs = [] } = {}) {
  const gruppi = new Map();
  for (const v of voci || []) {
    const percorso = (v.percorso || []).filter(Boolean);
    if (!v.file || !percorso.length || percorso.some((p) => p.startsWith("."))) continue;
    if (!tipoAudio(v.file)) continue;
    const nome = percorso.length > 1 ? percorso[0] : radice || "Raccolta senza nome";
    if (!gruppi.has(nome)) gruppi.set(nome, []);
    gruppi.get(nome).push({ file: v.file, ordine: percorso.join("/") });
  }
  const vive = raccolte.filter((r) => !r.deleted);
  const custodite = favs.filter((f) => !f.deleted && f.trackId);
  const piano = [];
  for (const [nome, brani] of gruppi) {
    brani.sort((a, b) => ordineNaturale.compare(a.ordine, b.ordine));
    const esistente = vive.find((r) => nomeGiusto(r.name) === nomeGiusto(nome)) || null;
    const dentro = new Set(esistente?.brani || []);
    const nuovi = [];
    const rimessi = [];
    // `sequenza`: i brani da mettere nella raccolta, nell'ordine dei nomi,
    // ognuno o un file da custodire o una melodia che c'e' gia'
    const sequenza = [];
    for (const { file } of brani) {
      const gia = custodite.find((f) => f.name === nomeMelodia(file.name) && f.size === file.size);
      if (gia) {
        if (!dentro.has(gia.id) && !rimessi.includes(gia.id)) {
          rimessi.push(gia.id);
          sequenza.push({ id: gia.id });
        }
      } else {
        nuovi.push(file);
        sequenza.push({ file });
      }
    }
    piano.push({ nome, id: esistente?.id || null, nuovi, rimessi, sequenza, tutti: brani.length });
  }
  return piano.sort((a, b) => ordineNaturale.compare(a.nome, b.nome));
}

// i file di una cartella scelta con `showDirectoryPicker`, sottocartelle
// comprese (fino a tre livelli: una raccolta di raccolte, non un disco)
export async function vociDellaCartella(cartella, percorso = [], fuori = []) {
  if (percorso.length > 3) return fuori;
  for await (const [nome, voce] of cartella.entries()) {
    if (nome.startsWith(".")) continue;
    if (voce.kind === "file") fuori.push({ file: await voce.getFile(), percorso: [...percorso, nome] });
    else if (voce.kind === "directory") await vociDellaCartella(voce, [...percorso, nome], fuori);
  }
  return fuori;
}

// i brani di una raccolta che qui non sono ancora arrivati: un file sale su
// Drive dal dispositivo dove l'hai caricato, e solo da li' viaggia. Un brano
// tolto (lapide) non e' «in arrivo»: e' andato
export const nonArrivati = (raccolta, favsRaw = []) =>
  (raccolta?.brani || []).filter((id) => !favsRaw.some((f) => f.id === id)).length;

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

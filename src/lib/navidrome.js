// LA MUSICA DI BALDMUSIC, DAL NAS (chiesto dal lettore: «agganciare la mia
// applicazione baldmusic già presente sul nas al mio music player», «raccolte
// e playlist», «una volta date le credenziali non me le chieda ogni volta
// sullo stesso dispositivo»). BaldMusic e' Navidrome: l'API Subsonic, la
// stessa porta della sua app web e di quella Android. Le sue raccolte sono
// playlist di Navidrome col commento «Raccolta della cartella «…» · BaldMusic»
// (baldmusic-player, `web/src/lib/collections.ts`): qui si leggono le
// playlist e quel commento le divide in raccolte e playlist.
//
// La password non si salva: si tengono il sale e `md5(password + sale)`, il
// gettone di Subsonic, sul dispositivo come le chiavi (mai in viaggio). I
// brani suonano in streaming dall'<audio>: niente byte nel tablet.
//
// La rete si passa da fuori (`chiedi`), come in `nas.js`: qui si decide.
import { md5 } from "./md5.js";

export const CHIAVE_NAVIDROME = "bc_navidrome";
const VERSIONE = "1.16.1";
const CLIENTE = "bookcompanion";

const leggi = (st) => {
  try {
    const v = JSON.parse(st?.getItem(CHIAVE_NAVIDROME) || "null");
    return v?.base && v?.utente && v?.gettone && v?.sale ? v : null;
  } catch {
    return null;
  }
};

// l'indirizzo come lo scrive il lettore: senza schema e' https (Tailscale lo
// da' cosi'), senza «/» in fondo e senza «/rest» o la pagina dell'app
export function normalizzaServer(scritto) {
  let s = String(scritto || "").trim();
  if (!s) return null;
  if (!/^[a-z]+:\/\//i.test(s)) s = `https://${s}`;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const via = u.pathname.replace(/\/(?:rest|app)(?:\/.*)?$/, "").replace(/\/+$/, "");
  return `${u.origin}${via}`;
}

export function credenziali(base, utente, password, sale = Math.random().toString(36).slice(2, 12)) {
  return { base: normalizzaServer(base), utente: String(utente || "").trim(), sale, gettone: md5(String(password || "") + sale) };
}

export const collegato = (st = globalThis.localStorage) => leggi(st);
export function salvaCollegamento(cred, st = globalThis.localStorage) {
  try {
    if (cred) st?.setItem(CHIAVE_NAVIDROME, JSON.stringify({ base: cred.base, utente: cred.utente, sale: cred.sale, gettone: cred.gettone }));
    else st?.removeItem(CHIAVE_NAVIDROME);
  } catch {
    /* senza memoria vale per adesso */
  }
}

export function indirizzo(cred, metodo, extra = {}) {
  const q = new URLSearchParams({ u: cred.utente, t: cred.gettone, s: cred.sale, v: VERSIONE, c: CLIENTE, f: "json" });
  for (const [k, v] of Object.entries(extra)) if (v != null) q.set(k, String(v));
  return `${cred.base}/rest/${metodo}?${q}`;
}

const guasto = (motivo, dettaglio) => Object.assign(new Error(dettaglio || motivo), { motivo });

export async function chiama(cred, metodo, extra = {}, { chiedi = globalThis.fetch } = {}) {
  let r;
  try {
    r = await chiedi(indirizzo(cred, metodo, extra));
  } catch (e) {
    throw guasto("rete", e?.message);
  }
  if (!r.ok) throw guasto(r.status === 401 || r.status === 403 ? "credenziali" : "server", `HTTP ${r.status}`);
  let j;
  try {
    j = await r.json();
  } catch {
    throw guasto("formato");
  }
  const risp = j?.["subsonic-response"];
  if (!risp) throw guasto("formato");
  if (risp.status !== "ok") throw guasto(risp.error?.code === 40 || risp.error?.code === 41 ? "credenziali" : "server", risp.error?.message);
  return risp;
}

export async function provaServer(cred, opz) {
  await chiama(cred, "ping", {}, opz);
  return true;
}

const COMMENTO_RACCOLTA = /^Raccolta della cartella «(.+)»/;
const ordine = new Intl.Collator("it", { numeric: true, sensitivity: "base" });

// le raccolte (le cartelle di BaldMusic) prima, poi le playlist, ognuna per
// nome; la chiave e' `nd:<id>`, per non confondersi con quelle di qui
export function raccolteDalleCartelle(playlist = []) {
  const voci = (Array.isArray(playlist) ? playlist : playlist ? [playlist] : []).map((p) => {
    const cartella = COMMENTO_RACCOLTA.exec(p?.comment || "")?.[1] || null;
    return { id: `nd:${p.id}`, nd: String(p.id), name: p.name || cartella || "Senza nome", tipo: cartella ? "raccolta" : "playlist", brani: Number(p.songCount) || 0 };
  });
  return voci.sort((a, b) => (a.tipo === b.tipo ? ordine.compare(a.name, b.name) : a.tipo === "raccolta" ? -1 : 1));
}

export async function raccolteNavidrome(cred, opz) {
  const r = await chiama(cred, "getPlaylists", {}, opz);
  return raccolteDalleCartelle(r.playlists?.playlist);
}

// un brano come una voce della musica: `nd` e' il suo id su Navidrome, e
// l'indirizzo dello streaming si fa quando suona (`streamDi`), col gettone
export const voceDaBrano = (b) => ({
  id: `nd:${b.id}`,
  nd: String(b.id),
  name: [b.title || "Senza titolo", b.artist].filter(Boolean).join(" · "),
  durata: Number(b.duration) || 0,
});

export async function braniNavidrome(cred, idPlaylist, opz) {
  const r = await chiama(cred, "getPlaylist", { id: String(idPlaylist).replace(/^nd:/, "") }, opz);
  const e = r.playlist?.entry;
  return (Array.isArray(e) ? e : e ? [e] : []).map(voceDaBrano);
}

// `format=raw`: il file com'e', senza che Navidrome lo ricodifichi
export const streamDi = (cred, idBrano) => indirizzo(cred, "stream", { id: idBrano, format: "raw" });

export function fraseNavidrome(e) {
  switch (e?.motivo) {
    case "credenziali":
      return "Navidrome non riconosce utente e password: riscrivili come in BaldMusic.";
    case "rete":
      return "Navidrome non risponde: controlla che il NAS sia acceso e che Tailscale sia attivo su questo dispositivo, e l'indirizzo (lo stesso di BaldMusic).";
    case "formato":
      return "A quell'indirizzo risponde qualcosa che non è Navidrome: scrivi quello che usi in BaldMusic.";
    default:
      return `Navidrome ha risposto con un errore${e?.message ? ` (${e.message})` : ""}.`;
  }
}

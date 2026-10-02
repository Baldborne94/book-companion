// IL VOTO DI UNA RACCOLTA, E TUTTI I SUOI VOLUMI LETTI IN UN TOCCO (chiesto
// dal lettore davanti alle raccolte dei manga: «permettimi di mettere tutti i
// volumi all'interno di una raccolta come letti o meno e di valutare
// l'intera saga con un suo voto, oppure mi fai una media delle stelle dei
// volumi»).
//
// Il voto di una saga non sta su nessun libro: vive nelle preferenze, come
// il cuore delle raccolte (`raccoltePreferite.js`), con la stessa chiave del
// ripiano e la stessa fusione voce per voce, con la lapide quando lo togli.
// Viaggia nella colonna `raccolte_voti`. Se il voto suo non c'e', la
// raccolta mostra la MEDIA dei volumi votati, e dice che e' una media.
import { fondiPreferite, puoEssereFavorita } from "./raccoltePreferite.js";

const KEY = "bc_raccolte_voti";

export const puoEssereVotata = puoEssereFavorita;
export const fondiVoti = fondiPreferite;

export function leggiVoti(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === "string") : [];
  } catch {
    return [];
  }
}

export function scriviVoti(lista, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(lista || []));
  } catch {
    /* storage pieno: il voto dura quanto la sessione */
  }
}

// 0 toglie il voto (lapide): la raccolta torna a mostrare la media
export function segnaVoto(lista, id, voto, { nome = "", ora = Date.now() } = {}) {
  if (!puoEssereVotata(id)) return lista || [];
  const v = Math.round(Math.min(5, Math.max(0, Number(voto) || 0)) * 2) / 2;
  const prima = (lista || []).find((x) => x.id === id);
  const voce = { id, nome: nome || prima?.nome || "", voto: v, updatedAt: ora, ...(v ? {} : { deleted: true }) };
  return fondiVoti((lista || []).filter((x) => x.id !== id), [voce]);
}

// una voce tolta (lapide) ha voto zero: vale «nessun voto»
export const votoMio = (lista, id) => (lista || []).find((x) => x.id === id)?.voto || 0;

// la media delle stelle dei volumi votati, a un decimale; i non votati non
// contano (uno zero non e' un voto basso, e' un voto che manca)
export function mediaDeiVolumi(libri = []) {
  const voti = libri.map((b) => Number(b?.rating) || 0).filter((r) => r > 0);
  if (!voti.length) return null;
  return { media: Math.round((voti.reduce((a, b) => a + b, 0) / voti.length) * 10) / 10, votati: voti.length, di: libri.length };
}

// il voto da mostrare sulla raccolta: il tuo, o la media che lo dice
export function votoDaMostrare(lista, id, libri) {
  const mio = votoMio(lista, id);
  if (mio) return { voto: mio, mio: true };
  const m = mediaDeiVolumi(libri);
  return m ? { voto: m.media, media: true, votati: m.votati } : null;
}

export const dettoVoto = (v) => String(v).replace(".", ",");

// «Tutti letti» / «Tutti da leggere»: quali volumi cambiano davvero. Uno
// abbandonato resta abbandonato per «tutti letti» (non l'hai finito); «da
// leggere» azzera tutto, abbandonati compresi, come il tasto sulla scheda
export function daSegnare(libri, stato, statusOf) {
  return (libri || []).filter((b) => {
    const ora = statusOf(b.id);
    if (ora === stato) return false;
    if (stato === "read" && ora === "abandoned") return false;
    return true;
  });
}

// IN VIAGGIO NELLA COLONNA DEL CUORE. Una colonna nuova (`raccolte_voti`)
// avrebbe chiesto al lettore di rilanciare lo schema su Supabase, e finche'
// non lo faceva i voti restavano sul dispositivo senza dirlo. I voti
// viaggiano quindi in `raccolte_fav`, con la chiave che comincia per
// `voto|`: stessa forma (id, ora, lapide), stessa fusione. Un'app di prima
// li legge come cuori di raccolte che non esistono, e li rimanda su intatti.
const PREFISSO = "voto|";
export const inViaggio = (preferite = [], voti = []) => [...preferite, ...voti.map((v) => ({ ...v, id: PREFISSO + v.id }))];
export function dalViaggio(lista = []) {
  const preferite = [];
  const voti = [];
  for (const v of lista || []) {
    if (typeof v?.id !== "string") continue;
    if (v.id.startsWith(PREFISSO)) voti.push({ ...v, id: v.id.slice(PREFISSO.length) });
    else preferite.push(v);
  }
  return { preferite, voti };
}

// QUALI LIBRI STANNO SU QUALE DISPOSITIVO (chiesto dal lettore, dopo aver
// lasciato Drive: un libro aggiunto sul tablet compariva sul PC con «⚠ non
// è né qui né nel cloud», perche' il PC non sa cosa tiene il tablet). Ogni
// dispositivo scrive la SUA voce con gli id dei libri che ha in memoria, e
// la voce viaggia nella colonna del cuore delle raccolte (`inViaggio`, la
// chiave comincia per `qui|`), come i voti: niente colonne nuove. Fra le
// voci vince la piu' recente, come per i cuori; ognuno scrive solo la sua.

import { fondiPreferite } from "./raccoltePreferite.js";

export const PREFISSO_QUI = "qui|";
const KEY = "bc_dispositivi";

export function leggiDispositivi(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === "string" && x.id.startsWith(PREFISSO_QUI)) : [];
  } catch {
    return [];
  }
}

export function scriviDispositivi(lista, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(lista || []));
  } catch {
    /* storage pieno: il PC continuera' a non sapere, come prima */
  }
}

export const fondiDispositivi = (a, b) => fondiPreferite(a, b);

// La voce di questo dispositivo cambia solo quando cambiano i suoi libri: un
// orario nuovo a ogni giro rimanderebbe le preferenze ogni volta. Le chiavi
// nell'ordine in cui jsonb le rimanda (per lunghezza), o il confronto delle
// preferenze le vedrebbe sempre diverse.
export function aggiornaQui(lista, ids, { dispositivo, nome, ora = Date.now() } = {}) {
  if (!dispositivo || !ids) return lista || [];
  const id = PREFISSO_QUI + dispositivo;
  const libri = [...new Set(ids)].map(String).sort();
  const prima = (lista || []).find((v) => v.id === id);
  if (prima && prima.nome === nome && JSON.stringify(prima.libri) === JSON.stringify(libri)) return lista;
  return fondiDispositivi((lista || []).filter((v) => v.id !== id), [{ id, nome, libri, updatedAt: ora }]);
}

// I libri che stanno su un ALTRO dispositivo, col suo nome
export function altroveDa(lista, dispositivo) {
  const out = new Map();
  for (const v of lista || []) {
    if (v.deleted || v.id === PREFISSO_QUI + dispositivo || !Array.isArray(v.libri)) continue;
    for (const id of v.libri) if (!out.has(id)) out.set(id, v.nome || "");
  }
  return out;
}

// Aprire qui un libro che sta solo sull'altro dispositivo: niente byte qui.
// Il reader finirebbe sulla schermata del guasto, e
// il guasto non c'e': il libro e' sul tablet. Torna il nome di dove sta.
export function soloAltrove(id, { qui, altrove } = {}) {
  if (!qui || qui.has(id)) return null;
  return altrove?.has(id) ? sulDispositivo(altrove.get(id)) : null;
}

export const sulDispositivo = (nome) => (nome ? `sul ${nome}` : "sull'altro dispositivo");

export function nomeDispositivo(w = globalThis) {
  const n = w?.navigator || {};
  const ua = n.userAgent || "";
  return /Android|iPhone|iPad/i.test(ua) || (/Macintosh/.test(ua) && n.maxTouchPoints > 1) ? "tablet" : "computer";
}

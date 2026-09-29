// LE RACCOLTE PREFERITE (chiesto dal lettore: «permettimi di mettere anche
// una determinata raccolta come preferita»). Il cuore di un LIBRO sta sul
// libro (`fav`); quello di una raccolta non ha un libro dove stare — e'
// della saga, o dell'autore — quindi vive nelle preferenze, e viaggia fra
// i dispositivi nella colonna `raccolte_fav`.
//
// LA CHIAVE E' IL NOME, non un id nostro: «saga:20th century boys» resta la
// stessa raccolta quando arrivano volumi nuovi, e sul telefono si ritrova
// uguale. E' la chiave dei ripiani (`disponi`), quindi la stessa raccolta
// e' preferita sia a «Saga e autore» sia a «Saga».
//
// SOLO SAGHE E AUTORI si mettono fra i preferiti: sono le raccolte a cui si
// torna. Un genere, un voto o uno stato sono modi di guardare lo scaffale,
// e un cuore su «4 stelle» non direbbe niente.
//
// UNA VOCE PER RACCOLTA, CON LA SUA ORA, E LA LAPIDE: togliere il cuore sul
// telefono deve toglierlo anche sul tablet. Un insieme di sole chiavi,
// fuso per unione, lo farebbe risorgere a ogni sincronizzazione.
import { chiaveAutore } from "./sagaBooks.js";

const KEY = "bc_raccolte_fav";

export const puoEssereFavorita = (chiave) => /^(saga|autore):./.test(String(chiave || ""));

export function leggiPreferite(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === "string") : [];
  } catch {
    return [];
  }
}

export function scriviPreferite(lista, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(lista || []));
  } catch {
    /* storage pieno: il cuore dura quanto la sessione */
  }
}

// voce per voce, vince l'ora piu' recente; a parita', la lapide (un cuore
// tolto e uno messo nello stesso istante: meglio non riaccendere). In ordine
// di chiave, perche' la sincronizzazione confronta il JSON.
export function fondiPreferite(a = [], b = []) {
  const per = new Map();
  for (const v of [...(a || []), ...(b || [])]) {
    if (!v || typeof v.id !== "string") continue;
    const prima = per.get(v.id);
    const ora = Number(v.updatedAt) || 0;
    const oraPrima = Number(prima?.updatedAt) || 0;
    if (!prima || ora > oraPrima || (ora === oraPrima && v.deleted && !prima.deleted)) per.set(v.id, v);
  }
  return [...per.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

export const preferiteVive = (lista) => new Set((lista || []).filter((v) => !v.deleted).map((v) => v.id));

export function segnaPreferita(lista, id, si, { nome = "", ora = Date.now() } = {}) {
  if (!puoEssereFavorita(id)) return lista || [];
  const prima = (lista || []).find((v) => v.id === id);
  const voce = { id, nome: nome || prima?.nome || "", addedAt: prima?.addedAt || ora, updatedAt: ora, ...(si ? {} : { deleted: true }) };
  return fondiPreferite((lista || []).filter((v) => v.id !== id), [voce]);
}

const testo = (v) => String(v || "").trim();

// La chiave di un libro nella raccolta che la contiene, per ogni specie:
// la stessa regola di `chiaveDi` in `ripiani.js` (saga in minuscolo, autore
// a parole ordinate).
export function chiaviDelLibro(b) {
  const out = [];
  const saga = testo(b?.saga);
  if (saga) out.push(`saga:${saga.toLowerCase()}`);
  const k = testo(b?.author) ? chiaveAutore(b.author) : null;
  if (k) out.push(`autore:${k}`);
  return out;
}

export const libriDellaRaccolta = (books, chiave) => (books || []).filter((b) => chiaviDelLibro(b).includes(chiave));

// «Preferiti» in Libreria: i libri col cuore, e quelli che stanno in una
// raccolta col cuore
export const ePreferito = (b, vive) => !!b?.fav || chiaviDelLibro(b).some((k) => vive.has(k));

// APRIRE UNA RACCOLTA PREFERITA DALL'INGRESSO vuol dire portare la Libreria
// dove quella raccolta esiste: le saghe stanno sia in «Saga e autore» sia
// in «Saga», gli autori solo in «Autore» (in «Saga e autore» un autore ha
// il suo ripiano soltanto coi libri che una saga non ce l'hanno).
export function vistaPerRaccolta(chiave, vista) {
  const tipo = String(chiave || "").split(":")[0];
  const group = tipo === "saga" ? (["shelf", "saga"].includes(vista?.group) ? vista.group : "saga") : "autore";
  return { ...vista, group, aspetto: "raccolte" };
}

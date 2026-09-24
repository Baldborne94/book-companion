// I LIBRI DA PRENDERE (`components/DaPrendere.jsx`, la porta sull'Ingresso,
// la colonna `da_prendere` di `prefs`, `test/da-prendere.test.mjs`; scelto
// dal lettore fra le proposte dell'analisi «cosa manca»).
//
// L'app sapeva gia' quasi tutto quel che manca: il cammino dell'Eresia
// segna «non ce l'hai» su ogni tappa, le tavole conoscono il titolo del
// volume dopo, e l'Ingresso dice «e' l'ultimo volume che hai di questa
// storia» — ma ogni cosa stava nella sua stanza, e in libreria uno ci va
// con UNA lista in mano. Qui si mette insieme.
//
// DUE META', E NON SI MESCOLANO. La LISTA e' tua: la scrivi tu o ci metti
// dentro una proposta, e resta finche' non la togli. Le PROPOSTE non si
// scrivono da nessuna parte: si ricalcolano ogni volta dalla biblioteca,
// cosi' un volume importato stasera sparisce dalle proposte da solo, senza
// un registro da tenere in pari. Si salva solo il «no, grazie» (una LAPIDE
// con `scartata`), o la stessa proposta tornerebbe a ogni apertura.
//
// E UN LIBRO ARRIVATO NON SI TOGLIE DA SOLO dalla lista: si segna «è
// arrivato» e resta finche' non lo togli tu. Toglierlo in silenzio sarebbe
// comodo e sbagliato — un titolo che combacia per caso con un'altra
// edizione, o con un omonimo, farebbe sparire una voce che avevi scritto,
// e non te ne accorgeresti.

import { getStatus } from "./library.js";
import { riconosci, TAVOLE, contornoDiUnaGuida, chiaveSaga } from "./sagaBooks.js";
import { sembraGiaLetto } from "./importBook.js";
import { numeriMescolati, cicloDi } from "./saga.js";
import { fondiQuaderno } from "./quaderno.js";

const KEY = "bc_da_prendere";

// Le proposte di una saga in vista: il resto si conta. Una guida da
// settantun tappe ne proporrebbe venti, e una lista di venti non e' una
// lista della spesa, e' il catalogo.
export const IN_VISTA = 3;

const piano = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(the|a|an|il|lo|la|i|gli|le|un|uno|una)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const pianoAutore = (a) => piano(a).split(" ").filter(Boolean).sort().join(" ");

// L'id di una voce col titolo: titolo e autore ridotti, cosi' la stessa
// proposta tenuta due volte — o scritta a mano uguale — resta UNA voce.
export const idTitolo = (titolo, autore) => `t:${piano(titolo)}|${pianoAutore(autore)}`;
// L'id di un numero senza titolo: la saga ridotta, la serie e il numero.
export const idNumero = (saga, ciclo, numero) =>
  `n:${chiaveSaga(saga)}|${String(ciclo || "").trim().toLowerCase()}|${numero}`;

const letto = (s) => s === "read" || s === "reading";

// ---- le proposte ----------------------------------------------------------

// Le tavole che spediamo sanno il TITOLO del volume dopo: il filo si segue
// sulla guida, non sul campo saga scritto sul libro — sul tablet del lettore
// l'Eresia sta sotto «Warhammer 40K», che nessuna tavola conosce. Si
// propongono solo le TAPPE (`ordine` non nullo): prologo, antologie e
// letture di sfondo non sono un volume che ti serve per andare avanti, ed
// e' la stessa regola del prossimo passo.
function daTavole(books, statusOf, riconosce, tavole) {
  const out = [];
  for (const tav of tavole) {
    const tappe = tav.libri
      .map((v) => ({ v, o: tav.ordine(v) }))
      .filter((x) => x.o != null)
      .sort((a, b) => a.o - b.o);
    const tue = new Map();
    for (const b of books) {
      const r = riconosce(b);
      if (!r || r.saga !== tav.saga || !r.titolo) continue;
      if (!tue.has(r.titolo)) tue.set(r.titolo, b);
    }
    let rif = null;
    let ultimaTua = -Infinity;
    for (const { v, o } of tappe) {
      const b = tue.get(v.t);
      if (!b) continue;
      ultimaTua = Math.max(ultimaTua, o);
      if (letto(statusOf(b.id)) && (rif == null || o > rif.o)) rif = { o, b };
    }
    // una saga mai cominciata non chiede niente: e' un consiglio di
    // lettura, non un volume che ti manca per andare avanti
    if (!rif) continue;
    const voci = [];
    for (const { v, o } of tappe) {
      if (o <= rif.o || tue.has(v.t)) continue;
      voci.push({ id: idTitolo(v.t, v.a), titolo: v.t, autore: v.a || "", saga: tav.saga, numero: o });
      // i buchi fra le tappe che hai, piu' il primo volume DOPO l'ultima:
      // oltre, la lista diventerebbe la guida intera
      if (o > ultimaTua) break;
    }
    if (voci.length) out.push({ saga: tav.saga, nome: tav.saga, voci, dopo: rif.b });
  }
  return out;
}

// Le saghe che nessuna tavola conosce: i titoli non li sa nessuno, ma i
// NUMERI si'. Due cose si propongono, e sono due certezze diverse:
//   - il BUCO: il n° 3 fra il 2 che hai letto e il 4 che hai in casa —
//     quello esiste di sicuro, il tuo 4 lo dimostra;
//   - il SEGUITO: il numero dopo l'ultimo che hai, e solo quando l'ultimo
//     che hai e' anche quello a cui sei arrivato — se hai ancora volumi da
//     leggere il seguito non ti serve stasera. Questo NON e' sicuro (la
//     saga puo' essere finita), e la voce lo dice («se esiste»).
// Si guarda dopo il volume piu' avanti che hai letto: i buchi dietro di te
// sono libri che hai saltato apposta, o letto altrove.
function daNumeri(books, statusOf, riconosce, contorno) {
  const saghe = new Map();
  for (const b of books) {
    const saga = String(b?.saga || "").trim();
    if (!saga || contorno(b)) continue;
    // una saga che una tavola conosce la fa `daTavole`, coi titoli veri
    const r = riconosce(b);
    if (r?.titolo) continue;
    if (!saghe.has(saga)) saghe.set(saga, []);
    saghe.get(saga).push(b);
  }
  const out = [];
  for (const [saga, libri] of saghe) {
    // DOVE OGNI SERIE SI NUMERA DA SE' (due titoli diversi sullo stesso
    // numero) il filo e' la serie; dove la fila e' una sola, il numero e'
    // della saga e raggruppare per serie inventerebbe dei buchi — nel
    // Malazan del lettore il Path to Ascendancy va dal 7 all'8, e per
    // serie mancherebbero dall'1 al 6
    const perSerie = numeriMescolati(libri, saga);
    const fili = new Map();
    for (const b of libri) {
      const ciclo = perSerie ? cicloDi(b) : "";
      // numeri doppi e nessuna serie: il numero non dice niente
      if (perSerie && !ciclo) continue;
      const k = ciclo.toLowerCase();
      if (!fili.has(k)) fili.set(k, { ciclo, libri: [] });
      fili.get(k).libri.push(b);
    }
    for (const { ciclo, libri: suoi } of fili.values()) {
      const interi = suoi.filter((b) => Number.isInteger(b.sagaOrder) && b.sagaOrder > 0);
      const rif = interi
        .filter((b) => letto(statusOf(b.id)))
        .sort((a, b) => b.sagaOrder - a.sagaOrder)[0];
      if (!rif) continue;
      const ho = new Set(interi.map((b) => b.sagaOrder));
      const ultimo = Math.max(...ho);
      const nome = ciclo || saga;
      const voci = [];
      for (let k = rif.sagaOrder + 1; k < ultimo; k++) {
        if (!ho.has(k)) voci.push({ id: idNumero(saga, ciclo, k), titolo: null, saga, ciclo, nome, numero: k });
      }
      if (ultimo === rif.sagaOrder) {
        voci.push({ id: idNumero(saga, ciclo, ultimo + 1), titolo: null, saga, ciclo, nome, numero: ultimo + 1, forse: true });
      }
      if (voci.length) out.push({ saga, nome, voci, dopo: rif });
    }
  }
  return out;
}

// Le proposte, raggruppate per saga. Quel che sta gia' nella lista — tenuto
// o scartato — non si ripropone: tenuto e' gia' la', scartato hai detto di no.
export function proposte(
  books = [],
  lista = [],
  { statusOf = getStatus, riconosce = riconosci, tavole = TAVOLE, contorno = contornoDiUnaGuida } = {}
) {
  const noti = new Set((lista || []).filter((v) => v && v.id && !v.deleted).map((v) => v.id));
  const gruppi = [
    ...daTavole(books, statusOf, riconosce, tavole),
    ...daNumeri(books, statusOf, riconosce, contorno),
  ];
  return gruppi
    .map((g) => ({ ...g, voci: g.voci.filter((v) => !noti.has(v.id)) }))
    .filter((g) => g.voci.length)
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

// ---- la lista ----------------------------------------------------------------

export const vive = (lista) =>
  (Array.isArray(lista) ? lista : []).filter((v) => v && v.id && !v.deleted && !v.scartata);

// Una voce scritta a mano: senza titolo non e' una voce. L'id viene da
// titolo e autore, quindi scrivere due volte lo stesso libro lo aggiorna
// invece di raddoppiarlo — e se era stato scartato come proposta, scriverlo
// a mano vuol dire che adesso lo vuoi.
export function aggiungi(lista, { titolo, autore = "", saga = "", numero = null, nota = "" } = {}, ora = Date.now()) {
  const t = String(titolo || "").trim();
  if (!t) return lista || [];
  const id = idTitolo(t, autore);
  return tieni(lista, { id, titolo: t, autore: String(autore || "").trim(), saga, numero, nota: String(nota || "").trim() }, ora);
}

// Una proposta entra nella lista com'e', con il suo id: cosi' dalle proposte
// sparisce da sola, e una voce scritta a mano uguale non fa un doppione.
export function tieni(lista, voce, ora = Date.now()) {
  const elenco = Array.isArray(lista) ? lista : [];
  if (!voce?.id) return elenco;
  const vecchia = elenco.find((v) => v && v.id === voce.id && !v.deleted && !v.scartata);
  const nuova = {
    id: voce.id,
    titolo: voce.titolo || null,
    autore: voce.autore || "",
    saga: voce.saga || "",
    ciclo: voce.ciclo || "",
    numero: voce.numero ?? null,
    forse: !!voce.forse,
    nota: voce.nota || vecchia?.nota || "",
    aggiunta: vecchia?.aggiunta || ora,
    updatedAt: ora,
  };
  return [...elenco.filter((v) => !(v && v.id === voce.id)), nuova];
}

// Togliere dalla lista e scartare una proposta lasciano due segni diversi:
// la lapide (`deleted`) serve alla sincronizzazione, e se la proposta
// esiste ancora torna fra le proposte; lo scarto (`scartata`) dice «non me
// la riproporre».
export function togli(lista, id, ora = Date.now()) {
  return (lista || []).map((v) => (v && v.id === id ? { id, deleted: true, updatedAt: ora } : v));
}

export function scarta(lista, id, ora = Date.now()) {
  return [...(lista || []).filter((v) => !(v && v.id === id)), { id, scartata: true, updatedAt: ora }];
}

// E' arrivato? Per titolo e autore come i doppioni dell'import (un'altra
// edizione dello stesso romanzo e' lo stesso romanzo), e per le voci senza
// titolo sul numero: un volume della stessa saga, della stessa serie, con
// quel numero.
export function arrivato(voce, books = []) {
  if (!voce) return null;
  if (voce.titolo) return sembraGiaLetto({ title: voce.titolo, author: voce.autore }, books);
  if (voce.numero == null || !voce.saga) return null;
  const s = chiaveSaga(voce.saga);
  const c = String(voce.ciclo || "").trim().toLowerCase();
  return (
    books.find(
      (b) =>
        chiaveSaga(b?.saga || "") === s &&
        (!c || cicloDi(b).toLowerCase() === c) &&
        b.sagaOrder === voce.numero
    ) || null
  );
}

// Come si chiama una voce sullo schermo e sulla lista copiata.
export function nomeVoce(v) {
  if (v?.titolo) return v.titolo;
  const nome = v?.nome || v?.ciclo || v?.saga || "la saga";
  return `${nome} n° ${v?.numero}${v?.forse ? " (se esiste)" : ""}`;
}

// La lista da portare in libreria: una riga per libro, gli arrivati no.
export function testoLista(lista, books = []) {
  const righe = vive(lista)
    .filter((v) => !arrivato(v, books))
    .map((v) => {
      const dove = v.titolo && v.saga ? ` (${v.saga}${v.numero != null ? ` n° ${v.numero}` : ""})` : "";
      return `• ${nomeVoce(v)}${v.autore ? ` — ${v.autore}` : ""}${dove}${v.nota ? ` · ${v.nota}` : ""}`;
    });
  return righe.length ? ["Libri da prendere", ...righe].join("\n") : "";
}

// La porta sull'Ingresso dice un numero, e gli zeri non si dicono.
export function rigaDaPrendere(lista, books = [], quanteProposte = 0) {
  const mancano = vive(lista).filter((v) => !arrivato(v, books)).length;
  const pezzi = [];
  if (mancano) pezzi.push(`${mancano} ${mancano === 1 ? "libro" : "libri"} da prendere`);
  if (quanteProposte) pezzi.push(`${quanteProposte} ${quanteProposte === 1 ? "proposta" : "proposte"} dalle tue saghe`);
  return pezzi.length ? pezzi.join(" · ") : null;
}

// Fra due dispositivi la regola e' quella del quaderno — unione per id, e
// per ogni voce vince la versione toccata per ultima, lapidi e scarti
// compresi — e la forma e' la stessa, quindi la funzione e' la stessa.
export const fondiDaPrendere = (qui, lassu) => fondiQuaderno(qui, lassu);

export function leggiDaPrendere() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function scriviDaPrendere(lista) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lista || []));
  } catch {
    /* storage pieno: la voce non resta, e il libro lo cerchi a memoria */
  }
}

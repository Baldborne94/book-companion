// DI CHE SAGA E' QUESTO LIBRO, FRA LE RACCOLTE CHE HAI GIA'?
//
// Chiesto dal lettore: «se cerco un libro riesci a riconoscermi a quale saga
// appartiene di quelle che ho già creato?». Nel modulo «Un libro solo» di
// «📥 Senza file» il titolo (e l'autore) si scrivono a mano, e la saga
// restava al lettore. Ora si PROPONE, prima di scrivere la scheda:
//
// 1. senza rete, le strade del riconoscimento di sempre (`ripassa`): la
//    guida dell'app — ma la saga e' quella che il lettore usa per lo stesso
//    universo (`sagaPerLaGuida`: Malleus va in «Warhammer 40K» accanto a
//    Xenos, non in una raccolta «Eisenhorn» nuova), col posto del cammino
//    come numero, come quando si aggiunge la saga intera; poi il titolo che
//    dice la saga; poi gli altri libri dello stesso autore, se stanno tutti
//    in una raccolta sola;
// 2. su Wikidata, la serie del libro, e la raccolta del lettore che la
//    tiene: col nome della serie, o con la serie scritta come ciclo, o
//    perche' ci stanno gia' altri libri di quella serie («The Well of
//    Ascension» → Mistborn → i libri di Mistborn stanno in «Cosmoverse»).
//    Un universo (il Cosmere) vale solo per trovare la raccolta, mai come
//    raccolta nuova. Una serie che nessuna raccolta tiene si propone come
//    raccolta nuova, e lo si dice.
//
// Si propone e basta: il campo resta del lettore, che puo' cambiarlo.

import { TAVOLE, riconosci, ripassa, chiaveSaga } from "./sagaBooks.js";
import { sagaPerLaGuida } from "./senzaFile.js";
import { LIBRI, NON_VOLUMI, SERIE, UNIVERSO, piano, ids, indirizzo, etichetta, volumeDa, guidaDalNome, eLAutore, variantiDelNome } from "./sagaDaNome.js";

// ---- senza rete ----------------------------------------------------------------

export function sagaDaQui({ titolo, autore = "" } = {}, libri = []) {
  const libro = { title: String(titolo || "").trim(), author: String(autore || "").trim() };
  if (!libro.title) return null;
  const r = riconosci(libro);
  const tav = r?.saga && TAVOLE.find((t) => t.saga === r.saga);
  if (tav) return { fonte: "guida", guida: tav.saga, saga: sagaPerLaGuida(tav, libri), serie: r.ciclo || "", numero: r.sagaOrder ?? null };
  const p = ripassa(libro, libri);
  if (!p?.campi?.saga) return null;
  return { fonte: p.dedotta ? "autore" : "titolo", saga: p.campi.saga, serie: p.campi.series || "", numero: p.campi.sagaOrder ?? null };
}

// le raccolte che tengono i libri di quest'autore, per sceglierne una a mano
// quando sono piu' d'una (la deduzione, timida, in quel caso tace)
export function raccolteDellAutore(autore, libri = []) {
  if (!String(autore || "").trim()) return [];
  const conti = new Map();
  for (const b of libri) {
    const s = String(b?.saga || "").trim();
    if (!s || !eLAutore(autore, b?.author || "")) continue;
    const k = chiaveSaga(s);
    const c = conti.get(k) || { saga: s, quanti: 0 };
    c.quanti += 1;
    conti.set(k, c);
  }
  return [...conti.values()].sort((a, b) => b.quanti - a.quanti || a.saga.localeCompare(b.saga));
}

// ---- su Wikidata -----------------------------------------------------------------

// il libro e le sue serie: il primo candidato che e' un libro (non
// un'edizione ne' una novella), sta in una serie e, se l'autore e' scritto,
// e' suo
export async function serieDelLibro({ titolo, autore = "" } = {}, prendi) {
  const s = await prendi(indirizzo({ action: "wbsearchentities", search: String(titolo || "").trim(), language: "en", uselang: "it", type: "item", limit: "7" }));
  const candidati = (s?.search || []).map((x) => x.id).filter(Boolean);
  if (!candidati.length) return null;
  const e = await prendi(indirizzo({ action: "wbgetentities", ids: candidati.join("|"), props: "labels|claims", languages: "en|it" }));
  const entita = e?.entities || {};
  const libri = candidati.filter((q) => {
    const c = entita[q]?.claims;
    const tipi = [...ids(c, "P31"), ...ids(c, "P7937")];
    return tipi.some((t) => LIBRI.includes(t)) && !tipi.some((t) => NON_VOLUMI.includes(t)) && ids(c, "P179").length > 0;
  });
  if (!libri.length) return null;
  const serieDi = (q) => [...new Set(ids(entita[q]?.claims, "P179"))];
  const altri = [...new Set(libri.flatMap((q) => [...serieDi(q), ...(autore ? ids(entita[q]?.claims, "P50") : [])]))];
  const r = await prendi(indirizzo({ action: "wbgetentities", ids: altri.slice(0, 50).join("|"), props: "labels|claims", languages: "en|it" }));
  const nomi = r?.entities || {};
  const q = libri.find((x) => !autore || ids(entita[x]?.claims, "P50").some((a) => eLAutore(autore, etichetta(nomi[a]))));
  if (!q) return null;
  const serie = serieDi(q)
    .map((sq) => {
      const tipi = ids(nomi[sq]?.claims, "P31");
      return { q: sq, nome: etichetta(nomi[sq]), numero: volumeDa(entita[q], sq)?.numero ?? null, universo: tipi.includes(UNIVERSO), eSerie: tipi.some((t) => SERIE.includes(t)) };
    })
    .filter((x) => x.nome && (x.universo || x.eSerie))
    .sort((a, b) => a.universo - b.universo);
  return serie.length ? { libro: q, titolo: etichetta(entita[q]), serie } : null;
}

// i titoli dei libri della serie, tutti: anche quelli senza numero, che
// l'elenco da aggiungere lascia fuori ma che il lettore puo' avere
async function titoliDellaSerie(q, prendi) {
  const m = await prendi(indirizzo({ action: "query", list: "search", srsearch: `haswbstatement:P179=${q}`, srlimit: "200", srnamespace: "0" }));
  const membri = (m?.query?.search || []).map((x) => x.title).filter((x) => /^Q\d+$/.test(x));
  const titoli = [];
  for (let i = 0; i < membri.length; i += 50) {
    const r = await prendi(indirizzo({ action: "wbgetentities", ids: membri.slice(i, i + 50).join("|"), props: "labels|claims", languages: "en|it" }));
    for (const e of Object.values(r?.entities || {})) {
      const v = volumeDa(e, q);
      if (v) titoli.push(v.titolo);
    }
  }
  return titoli;
}

const piuFrequente = (valori) => {
  const conti = new Map();
  for (const v of valori) conti.set(v, (conti.get(v) || 0) + 1);
  return [...conti.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || null;
};

// la raccolta del lettore che tiene una serie, e come lo si sa
export async function raccoltaDellaSerie(s, libri = [], prendi) {
  // il nome com'e' e senza le parole generiche: su Wikidata «Skyward
  // series», sullo scaffale «Skyward»
  const chiavi = new Set(variantiDelNome(s.nome).map(chiaveSaga));
  const conSaga = libri.filter((b) => String(b?.saga || "").trim());
  // la raccolta E' la serie: anche il numero della serie e' il suo
  const stessa = conSaga.find((b) => chiavi.has(chiaveSaga(b.saga)));
  if (stessa) return { fonte: "nome", saga: stessa.saga, serie: "", numero: s.numero };
  // la serie e' un ciclo dentro una raccolta
  const cicli = conSaga.filter((b) => b.series && chiavi.has(chiaveSaga(b.series)));
  if (cicli.length) return { fonte: "ciclo", saga: piuFrequente(cicli.map((b) => b.saga)), serie: cicli[0].series, numero: null };
  // la serie ha una guida, e i libri di quella guida stanno in una raccolta
  const g = guidaDalNome(s.nome);
  const tav = g && TAVOLE.find((t) => t.saga === g.saga);
  if (tav) {
    const saga = sagaPerLaGuida(tav, libri);
    if (conSaga.some((b) => chiaveSaga(b.saga) === chiaveSaga(saga))) return { fonte: "guida", saga, serie: "", numero: null };
  }
  // altri libri della serie stanno gia' in una raccolta
  const titoli = new Set((await titoliDellaSerie(s.q, prendi)).map(piano));
  const dentro = conSaga.filter((b) => titoli.has(piano(b.title)));
  if (!dentro.length) return null;
  const saga = piuFrequente(dentro.map((b) => b.saga));
  const suoi = dentro.filter((b) => b.saga === saga);
  const ciclo = suoi.every((b) => (b.series || "") === (suoi[0].series || "")) ? suoi[0].series || "" : "";
  return { fonte: "fratelli", saga, serie: ciclo, numero: null, quanti: suoi.length };
}

export async function sagaDaWikidata({ titolo, autore = "" } = {}, libri = [], prendi) {
  const trovato = await serieDelLibro({ titolo, autore }, prendi);
  if (!trovato) return null;
  // le serie prima, l'universo per ultimo (`serieDelLibro` le mette cosi')
  for (const s of trovato.serie) {
    const r = await raccoltaDellaSerie(s, libri, prendi);
    if (r) return { ...r, fonte: "wikidata", come: r.fonte, serieWiki: s.nome };
  }
  const nuova = trovato.serie.find((s) => !s.universo);
  return nuova ? { fonte: "wikidata", come: "nuova", saga: nuova.nome, serie: "", numero: nuova.numero, serieWiki: nuova.nome, nuova: true } : null;
}

// la strada intera: prima qui, poi Wikidata (se c'e' chi la chiede)
export async function sagaDelLibro(voce = {}, libri = [], { prendi } = {}) {
  return sagaDaQui(voce, libri) || (prendi ? await sagaDaWikidata(voce, libri, prendi) : null);
}

// la riga che dice da dove viene la proposta
export function fraseSagaDelLibro(r, autore = "") {
  if (!r) return "Non l'ho riconosciuto: scegli tu la raccolta, o lasciala vuota.";
  const dove = `«${r.saga}»${r.serie && r.serie !== r.saga ? `, ${r.serie}` : ""}${r.numero != null ? `, n° ${r.numero}` : ""}`;
  if (r.fonte === "guida") return `📜 È nella guida di ${r.guida}: va in ${dove}.`;
  if (r.fonte === "titolo") return `Il titolo dice la saga: ${dove}.`;
  if (r.fonte === "autore") return `Gli altri libri di ${autore || "quest'autore"} che hai stanno in ${dove}.`;
  if (r.nuova) return `Su Wikidata è della serie «${r.serieWiki}», che fra le tue raccolte non c'è: la propongo come raccolta nuova${r.numero != null ? `, n° ${r.numero}` : ""}.`;
  if (r.come === "fratelli") return `Su Wikidata è della serie «${r.serieWiki}», e gli altri libri di quella serie li tieni in ${dove}.`;
  return `Su Wikidata è della serie «${r.serieWiki}»: la tieni in ${dove}.`;
}

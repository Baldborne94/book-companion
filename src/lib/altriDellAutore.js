// GLI ALTRI LIBRI DEGLI AUTORI CHE SEGUI (`components/AltriDellAutore.jsx`
// nella raccolta seguita, `test/altri-dell-autore.test.mjs`). Chiesto dal
// lettore: «una sezione dedicata ai libri o saghe che quell'autore che sto
// seguendo ha pubblicato, che non ho nella mia raccolta, così la metto nella
// lista dei libri da aggiungere». Non e' la sezione «dagli autori che leggi»
// tolta dal catalogo (quella guardava TUTTI gli autori della biblioteca): qui
// solo gli autori della raccolta che segui con 🔔, nella raccolta stessa.
//
// Le opere vengono da Open Library come per il catalogo (stesse domande,
// stesso filtro degli omonimi `soloDellAutore`, stesso riconoscimento di
// quel che hai gia'). Prima i piu' nuovi: e' una lista per tenere traccia,
// non per scoprire. Open Library sa poco delle uscite dell'ultimo anno, e
// lo si dice sotto la sezione.
import { idTitolo } from "./daPrendere.js";
import { chiaveAutore } from "./sagaBooks.js";
import { soloDellAutore, titoloDi, eRaccolta, copertinaDi } from "./consigliLiberi.js";
import { sembraGiaLetto, giaInCasa } from "./importBook.js";

export const OL = "https://openlibrary.org/search.json";
export const IN_VISTA = 5;
// le opere di un autore si chiedono una volta a settimana
export const SCADENZA = 7 * 24 * 60 * 60 * 1000;
const CHIAVE = "bc_altri_autore";
const TENUTI = 30;

export const domandaOpere = (autore) =>
  `${OL}?${new URLSearchParams({
    author: autore,
    sort: "editions",
    limit: "100",
    fields: "key,title,author_name,author_key,first_publish_year,edition_count,cover_i",
  })}`;

// cosa hai gia': lo stesso titolo ripulito, o lo stesso libro scritto come
// lo scrivi tu (`giaInCasa`)
const tuo = (titolo, autore, books) => {
  const puliti = books.map((b) => ({ ...b, title: titoloDi(b) }));
  return !!sembraGiaLetto({ title: titolo, author: autore }, puliti) || !!giaInCasa({ title: titolo, author: autore }, books);
};

// Le opere che non hai, una per titolo, dalla piu' nuova; i cofanetti e le
// raccolte no (non sono un libro da cercare). `lista` e' la lista «Da
// prendere»: quel che c'e' gia' resta, segnato.
export function altriLibri(autore, docs = [], books = [], lista = []) {
  const nella = new Set((lista || []).filter((v) => v && !v.deleted && !v.scartata).map((v) => v.id));
  const visti = new Set();
  const out = [];
  for (const d of soloDellAutore(docs, books, autore)) {
    const titolo = titoloDi(d);
    if (!titolo || eRaccolta(titolo)) continue;
    const id = idTitolo(titolo, autore);
    const k = idTitolo(titolo, "");
    if (visti.has(k)) continue;
    visti.add(k);
    if (tuo(titolo, autore, books)) continue;
    out.push({ id, titolo, autore, anno: Number(d.first_publish_year) || null, copertina: copertinaDi(d), gia: nella.has(id) });
  }
  return out.sort((a, b) => (b.anno || 0) - (a.anno || 0) || a.titolo.localeCompare(b.titolo));
}

// ---- la memoria delle risposte (del dispositivo) ------------------------------

const leggi = (st) => {
  try {
    const v = JSON.parse(st?.getItem(CHIAVE) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
};

export function opereRicordate(autore, { st = globalThis.localStorage, ora = Date.now() } = {}) {
  const v = leggi(st)[chiaveAutore(autore)];
  return v && ora - v.quando < SCADENZA ? v.docs : null;
}

export function ricordaOpere(autore, docs, { st = globalThis.localStorage, ora = Date.now() } = {}) {
  const m = leggi(st);
  // si tiene solo quel che serve a disegnare: il catalogo risponde con molto di piu'
  m[chiaveAutore(autore)] = {
    quando: ora,
    docs: (docs || []).map((d) => ({ title: d.title, author_key: d.author_key, first_publish_year: d.first_publish_year, cover_i: d.cover_i })),
  };
  const tenuti = Object.entries(m).sort((a, b) => b[1].quando - a[1].quando).slice(0, TENUTI);
  try {
    st?.setItem(CHIAVE, JSON.stringify(Object.fromEntries(tenuti)));
  } catch {
    /* senza memoria si richiede la prossima volta */
  }
}

// Le opere di un autore: dalla memoria se recenti, se no da Open Library.
// `prendi(url)` da' il JSON (la rete e' iniettata, cosi' si prova in Node).
export async function opereDi(autore, prendi, opzioni = {}) {
  const ricordate = opereRicordate(autore, opzioni);
  if (ricordate) return ricordate;
  const r = await prendi(domandaOpere(autore));
  const docs = Array.isArray(r?.docs) ? r.docs : [];
  ricordaOpere(autore, docs, opzioni);
  return docs;
}

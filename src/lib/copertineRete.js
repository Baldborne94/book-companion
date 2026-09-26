// LE COPERTINE DEI LIBRI CHE NON HAI (`CopertinaVoce` in
// `components/DaPrendere.jsx`, `test/copertine-rete.test.mjs`).
//
// Chiesto dal lettore: «le copertine non si vedono nei consigli, vorrei si
// vedessero anche quando le metto nella mia lista». Il numero della copertina
// arrivava solo coi giri del catalogo fatti DOPO la cura, e i giri si rifanno
// una volta a settimana: i consigli gia' salvati, quelli dell'Oracolo, le
// proposte delle guide e i titoli scritti a mano non l'avevano, e non
// l'avrebbero avuto mai. Quindi la copertina si chiede quando serve, per
// titolo e autore, alla stessa scelta d'opera del catalogo delle saghe.
//
// Tre regole che sbagliano in silenzio:
// - «Non ce l'ha» e' una RISPOSTA e si ricorda (zero), o ogni apertura della
//   pagina rifarebbe le stesse domande a vuoto; ma si riprova dopo
//   `RIPROVA`, perche' il catalogo le copertine le aggiunge.
// - Un buco di rete NON e' «non ce l'ha»: non si scrive niente, e la prossima
//   volta si richiede.
// - Poche domande alla volta (`INSIEME`) e mai due volte la stessa: una lista
//   da trenta voci aperta tutta insieme non deve diventare trenta richieste
//   parallele da un tablet.
//
// Qui escono titolo e autore del libro consigliato, come per la verifica dei
// consigli dell'Oracolo: e' dichiarato in PRIVACY.md.

import { idTitolo } from "./daPrendere.js";
import { scegliOpera } from "./sagaDalCatalogo.js";
import { autorePerIlCatalogo } from "./retroInRete.js";
import { copertinaDi } from "./consigliLiberi.js";

export const CHIAVE = "bc_copertine_rete";
export const RIPROVA = 30 * 86400000;
export const MAX_TENUTE = 400;
export const INSIEME = 3;

const memoriaVera = {
  leggi() {
    try {
      const v = JSON.parse(localStorage.getItem(CHIAVE) || "{}");
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch {
      return {};
    }
  },
  scrivi(m) {
    try {
      localStorage.setItem(CHIAVE, JSON.stringify(m));
    } catch {
      /* senza storage si richiede la prossima volta: nessun danno */
    }
  },
};

export const chiaveCopertina = (voce) => (voce?.titolo ? idTitolo(voce.titolo, voce.autore || "") : null);

// Quel che si sa gia', senza rete: un numero, 0 («guardato, non c'e'»),
// o undefined («da chiedere»).
export function copertinaNota(voce, { mem = memoriaVera, ora = Date.now() } = {}) {
  const propria = copertinaDi({ cover_i: voce?.copertina });
  if (propria) return propria;
  const k = chiaveCopertina(voce);
  if (!k) return 0;
  const r = mem.leggi()[k];
  if (!r) return undefined;
  const n = copertinaDi({ cover_i: r.c });
  if (n) return n;
  return ora - (Number(r.t) || 0) < RIPROVA ? 0 : undefined;
}

export function ricorda(k, c, { mem = memoriaVera, ora = Date.now() } = {}) {
  const m = mem.leggi();
  m[k] = { c: c || 0, t: ora };
  const chiavi = Object.keys(m);
  if (chiavi.length > MAX_TENUTE) {
    chiavi
      .sort((a, b) => (Number(m[a]?.t) || 0) - (Number(m[b]?.t) || 0))
      .slice(0, chiavi.length - MAX_TENUTE)
      .forEach((x) => delete m[x]);
  }
  mem.scrivi(m);
}

// Una domanda al catalogo. `null` = l'opera non c'e' o non ha copertina;
// un buco di rete ESPLODE.
export async function cercaCopertina({ titolo, autore }, fetcher = fetch) {
  if (!titolo) return null;
  const a = autorePerIlCatalogo(autore);
  const q = new URLSearchParams({ title: titolo, fields: "key,title,author_name,cover_i", limit: "8" });
  if (a) q.set("author", a);
  const r = await fetcher(`https://openlibrary.org/search.json?${q}`);
  if (!r?.ok) throw new Error(`catalogo ${r?.status || "?"}`);
  const docs = (await r.json())?.docs || [];
  const scelta = scegliOpera(docs, { title: titolo, author: autore, filtrata: !!a });
  if (!scelta) return null;
  const sua = copertinaDi(scelta);
  if (sua) return sua;
  // la scheda scelta puo' essere nuda mentre un'altra dello stesso titolo
  // la copertina ce l'ha: stesso libro, altra scheda del catalogo
  const gemella = docs.find((d) => d !== scelta && copertinaDi(d) && scegliOpera([d], { title: titolo, author: autore, filtrata: !!a }));
  return gemella ? copertinaDi(gemella) : null;
}

// Un limitatore per tutta la pagina, e le domande in volo condivise.
export function nuovoCercatore({ fetcher, mem = memoriaVera, insieme = INSIEME, adesso = () => Date.now() } = {}) {
  const inVolo = new Map();
  const coda = [];
  let attive = 0;
  const avanti = () => {
    while (attive < insieme && coda.length) {
      attive++;
      const lavoro = coda.shift();
      lavoro().finally(() => {
        attive--;
        avanti();
      });
    }
  };
  return function copertinaDiVoce(voce) {
    const nota = copertinaNota(voce, { mem, ora: adesso() });
    if (nota !== undefined) return Promise.resolve(nota || null);
    const k = chiaveCopertina(voce);
    if (inVolo.has(k)) return inVolo.get(k);
    const p = new Promise((fatto) => {
      coda.push(async () => {
        try {
          const c = await cercaCopertina(voce, fetcher || fetch);
          ricorda(k, c, { mem, ora: adesso() });
          fatto(c);
        } catch {
          fatto(null);
        } finally {
          inVolo.delete(k);
        }
      });
      avanti();
    });
    inVolo.set(k, p);
    return p;
  };
}

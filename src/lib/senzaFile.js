// LE SCHEDE SENZA FILE (`components/AggiungiSenzaFile.jsx`, il tasto «📥»
// nel cammino, `test/senza-file.test.mjs`). Chiesto dal lettore: «aggiungere
// libri o saghe senza dover per forza caricare il libro… mi aggiungi la
// copertina così da averla a vista nelle mie raccolte e poi ci carico dentro
// l'ebook», e poi «quando aggiungo il nome di una saga in automatico mi
// aggiungi nell'ordine corretto i libri con copertina di quella saga».
//
// Una scheda senza file e' una scheda che il file non l'ha MAI avuto: si
// apre come i libri «📗 senza ebook» (`fileTolto`, «📂 Scegli il file»), e il
// file scelto da li' entra in QUELLA scheda (`casa` in `importFiles`). Il
// segno e' nel formato (`SENZA`): la sincronizzazione scrive `epub` al posto
// di un formato vuoto, e una scheda senza file sull'altro dispositivo
// diventerebbe un ePub tolto — cioe' un libro che possiedi.
import { TAVOLE, riconosci } from "./sagaBooks.js";
import { volume } from "./cammino.js";
import { cercaCopertina } from "./copertineRete.js";
import { urlCopertina } from "./consigliLiberi.js";
import { SENZA } from "./segnaposto.js";

export { SENZA };

const numeroDi = (n) => {
  if (n == null || String(n).trim() === "") return null;
  const v = Number(String(n).trim().replace(",", "."));
  return Number.isFinite(v) ? v : null;
};

// una scheda nuova, col solo titolo e quel che il lettore sa di lei
export function schedaSenzaFile(
  { titolo, autore = "", saga = "", serie = "", numero = null } = {},
  { id = globalThis.crypto.randomUUID(), ora = Date.now() } = {}
) {
  const title = String(titolo || "").trim();
  if (!title) return null;
  return {
    id,
    title,
    author: String(autore || "").trim(),
    saga: String(saga || "").trim(),
    series: String(serie || "").trim(),
    sagaOrder: numeroDi(numero),
    fileType: SENZA,
    fileTolto: true,
    addedAt: ora,
    rating: 0,
    notes: "",
  };
}

// UNA SCHEDA CHE C'E' GIA' NON SI RADDOPPIA: stesso titolo (senza maiuscole
// e segni) e, se tutt'e due l'hanno, stesso autore
const piano = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
export const giaSulloScaffale = (voce, libri = []) =>
  libri.some((b) => piano(b?.title) === piano(voce?.titolo) && (!voce?.autore || !b?.author || piano(b.author) === piano(voce.autore)));

// LA SAGA IN CUI FINISCONO LE SCHEDE DI UNA GUIDA: quella che il lettore
// usa gia' per i libri dello stesso universo. Sul suo tablet i libri del 40K
// stanno sotto «Warhammer 40K», e i Gaunt's Ghosts senza file devono finire
// li', accanto all'Eresia, non in una raccolta nuova. Senza libri suoi, il
// nome dell'universo o della guida.
export function sagaPerLaGuida(tav, libri = [], { riconosce = (b) => riconosci({ title: b?.title, author: b?.author, saga: b?.saga }) } = {}) {
  const vicine = new Set(TAVOLE.filter((t) => t.saga === tav.saga || (tav.universo && t.universo === tav.universo)).map((t) => t.saga));
  const conti = new Map();
  for (const b of libri) {
    const s = String(b?.saga || "").trim();
    if (!s) continue;
    const r = riconosce(b);
    if (r?.saga && vicine.has(r.saga)) conti.set(s, (conti.get(s) || 0) + 1);
  }
  const scelta = [...conti.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return scelta ? scelta[0] : tav.universo || tav.saga;
}

// L'AUTORE DI UNA GUIDA SCRITTA DA UNO SOLO, per i volumi che non lo
// dicono (il Mondo Disco lo tiene sulla tavola, in minuscolo)
const AUTORI = { Discworld: "Terry Pratchett", Hellboy: "Mike Mignola" };

// I VOLUMI DI UN CAMMINO: le tappe che sono un volume (niente racconti,
// niente omnibus), nell'ordine della guida, col posto del cammino come
// numero, la serie che la guida scrive, e `gia` per quelli che hai (anche
// solo come scheda: due schede dello stesso libro sarebbero un doppione)
export function vociDallaGuida(cammino, libri = [], opzioni = {}) {
  const tav = TAVOLE.find((t) => t.saga === cammino?.saga);
  if (!tav) return [];
  const saga = sagaPerLaGuida(tav, libri, opzioni);
  return (cammino.tappe || [])
    .filter((t) => volume(t.voce) && !lettura(t.voce))
    .map((t) => ({
      titolo: t.voce.t,
      autore: t.voce.a || AUTORI[tav.saga] || "",
      saga,
      serie: tav.parti ? tav.saga : t.voce.c || "",
      numero: t.posto,
      capitolo: t.voce.c || "",
      gia: !!t.libro,
    }));
}
// il prologo e i titoli che la guida dichiara fuori dalla storia non sono
// volumi della saga da mettere sullo scaffale: la guida li nomina e basta
// (le antologie si': sono libri della storia, ci stai dentro un racconto
// alla volta ma il file e' quello)
const lettura = (voce) => voce?.tipo === "prologo" || voce?.tipo === "fuori";

// LA COPERTINA DAL CATALOGO: il numero di Open Library per titolo e autore
// (la stessa scelta d'opera delle copertine di «Da prendere»), poi
// l'immagine grande. `null` se non c'e' o non arriva: la scheda resta col
// dorso disegnato, che e' quel che aveva comunque.
export async function copertinaDalCatalogo({ titolo, autore }, { fetcher = fetch } = {}) {
  const n = await cercaCopertina({ titolo, autore }, fetcher).catch(() => null);
  if (!n) return null;
  const r = await fetcher(`${urlCopertina(n, "L")}?default=false`).catch(() => null);
  if (!r?.ok) return null;
  const blob = await r.blob().catch(() => null);
  return blob && /^image\//.test(blob.type || "image/jpeg") && blob.size > 1000 ? blob : null;
}

// la riga di fine giro
export function fraseAggiunte({ aggiunte = 0, gia = 0 } = {}) {
  const parti = [];
  if (aggiunte) parti.push(aggiunte === 1 ? "📥 Una scheda senza file sullo scaffale" : `📥 ${aggiunte} schede senza file sullo scaffale`);
  if (gia) parti.push(gia === 1 ? "una c'era già" : `${gia} c'erano già`);
  if (!aggiunte) return "Niente da aggiungere: c'erano già tutte";
  return parti.join(" · ");
}

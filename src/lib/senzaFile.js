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
import { TAVOLE, riconosci, raccoltaDellaGuida, chiaveSaga } from "./sagaBooks.js";
import { volume } from "./cammino.js";
import { cercaCopertina } from "./copertineRete.js";
import { urlCopertina } from "./consigliLiberi.js";
import { SENZA } from "./segnaposto.js";
import { TIPI_SCELTI } from "./library.js";

export { SENZA };

const numeroDi = (n) => {
  if (n == null || String(n).trim() === "") return null;
  const v = Number(String(n).trim().replace(",", "."));
  return Number.isFinite(v) ? v : null;
};

// una scheda nuova, col solo titolo e quel che il lettore sa di lei
export function schedaSenzaFile(
  { titolo, autore = "", saga = "", serie = "", numero = null, tipo = null } = {},
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
    // fumetti o manga scelti nel pannello: lo scaffale e il verso di
    // lettura li sanno prima che arrivi il file (`tipoDi`, `versoDiPartenza`)
    ...(TIPI_SCELTI.includes(tipo) ? { tipo } : {}),
  };
}

// UNA SCHEDA CHE C'E' GIA' NON SI RADDOPPIA (chiesto dal lettore: «se un
// libro o una saga sono già presenti non me li aggiungere di nuovo"): stesso
// titolo (senza maiuscole e segni) e, se tutt'e due l'hanno, stesso autore.
// Ma lo stesso libro si scrive in piu' modi: col nome della saga davanti
// («Mistborn: The Final Empire»), con la serie fra parentesi in coda
// («Empire in Black and Gold (Shadows of the Apt 1)»), in italiano. Le
// forme accorciate valgono solo con l'autore scritto da tutt'e due le parti
// e uguale (un «Part One» non e' ogni «Part One»); la traduzione la sa la
// guida (`riconosci`: stesso volume della stessa guida).
const piano = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const corte = (t) => {
  const s = String(t || "");
  const senzaCoda = s.replace(/\s*\([^()]*\)\s*$/, "");
  const dopo = senzaCoda.includes(":") ? senzaCoda.slice(senzaCoda.indexOf(":") + 1) : "";
  return new Set([senzaCoda, dopo].map(piano).filter((x) => x && x !== piano(s)));
};
export function giaSulloScaffale(voce, libri = []) {
  const titolo = piano(voce?.titolo);
  const autore = piano(voce?.autore);
  const mie = new Set([titolo, ...corte(voce?.titolo)]);
  const ra = riconosci({ title: voce?.titolo, author: voce?.autore });
  const stessoVolume = (b) => {
    if (!ra?.titolo) return false;
    const rb = riconosci({ title: b?.title, author: b?.author });
    return rb?.saga === ra.saga && rb?.titolo === ra.titolo;
  };
  // «Jordan, Robert» e' «Robert Jordan»: le parole, non il loro ordine
  const parole = (a) => piano(a).split(" ").filter(Boolean).sort().join(" ");
  const chi = parole(voce?.autore);
  // LO STESSO POSTO NELLA STESSA RACCOLTA (il lettore, con Gachiakuta v01–v12
  // sullo scaffale e l'elenco di Hardcover che li proponeva tutti: «non lo
  // avevi già visto nella raccolta?»). «Gachiakuta v01 (2024) (Digital)
  // (Rillant)» e «Gachiakuta, Vol. 1» non si somigliano per titolo, ma
  // stanno nella stessa raccolta, nella stessa serie, allo stesso numero.
  // La serie conta: nel 40K il n° 1 dell'Eresia non e' il n° 1 di Gaunt's Ghosts
  const k = chiaveSaga(String(voce?.saga || "").trim());
  const n = numeroDi(voce?.numero);
  const serie = chiaveSaga(String(voce?.serie || "").trim());
  const stessoPosto = (b) => !!k && n != null && chiaveSaga(String(b?.saga || "").trim()) === k && numeroDi(b?.sagaOrder) === n && chiaveSaga(String(b?.series || "").trim()) === serie;
  return libri.some((b) => {
    if (stessoPosto(b)) return true;
    const suo = parole(b?.author);
    // un altro autore scritto non e' lo stesso titolo, ma puo' essere lo
    // stesso volume di una guida, riconosciuto ognuno col suo autore (il
    // «A Memory of Light» del solo Sanderson e' quello di Jordan)
    if (chi && suo && suo !== chi) return stessoVolume(b);
    if (piano(b?.title) === titolo) return true;
    if (autore && suo && [piano(b?.title), ...corte(b?.title)].some((t) => mie.has(t))) return true;
    return stessoVolume(b);
  });
}

// LA SAGA IN CUI FINISCONO LE SCHEDE DI UNA GUIDA: quella che il lettore
// usa gia' per i libri dello stesso universo. Sul suo tablet i libri del 40K
// stanno sotto «Warhammer 40K», e i Gaunt's Ghosts senza file devono finire
// li', accanto all'Eresia, non in una raccolta nuova. Senza libri suoi, il
// nome dell'universo o della guida.
export const sagaPerLaGuida = (tav, libri = [], opzioni = {}) => raccoltaDellaGuida(tav.saga, libri, opzioni) || tav.universo || tav.saga;

// LA SERIE ACCANTO ALLA RACCOLTA (chiesto dal lettore: «mettere non solo il
// nome della saga nella quale voglio finire ma anche il nome della serie,
// così che vengano messi in ordine come i libri della Horus Heresy del
// 40K»). La proposta e' la serie che i volumi dell'elenco hanno tutti uguale
// (Gaunt's Ghosts), se no il nome della serie di Wikidata o di Hardcover; una guida a cicli
// (gli Elderlings) o un mondo intero non ne hanno una sola, e il campo vuoto
// lascia a ogni volume la sua.
export function serieDellElenco(esito = {}) {
  const tutte = new Set((esito.volumi || []).map((v) => String(v.serie || "").trim()));
  const [una] = tutte;
  if (tutte.size === 1 && una) return una;
  return esito.fonte === "wikidata" || esito.fonte === "hardcover" ? String(esito.nome || "").trim() : "";
}

// le schede dell'elenco nella raccolta e nella serie scelte: un campo vuoto
// lascia quel che l'elenco scrive, e una serie che si chiama come la
// raccolta non e' una serie (sarebbe un ripiano dentro se stesso)
export function nellaRaccolta(volumi = [], raccolta = "", serie = "") {
  const r = String(raccolta || "").trim();
  const s = String(serie || "").trim();
  return volumi.map((v) => {
    const saga = r || v.saga || "";
    const sua = s || v.serie || "";
    return { ...v, saga, serie: chiaveSaga(sua) === chiaveSaga(saga) ? "" : sua };
  });
}

// LE RACCOLTE E LE SERIE CHE HAI GIA', da scegliere invece che da riscrivere
// (chiesto dal lettore per il libro solo: «permettimi anche di metterlo in
// una raccolta o saga se serve»). Una raccolta e' la saga scritta nelle
// schede: due grafie della stessa chiave sono una, con quella piu' usata.
function grafie(valori) {
  const per = new Map();
  for (const v of valori) {
    const t = String(v || "").trim();
    const k = chiaveSaga(t);
    if (!t || !k) continue;
    const g = per.get(k) || new Map();
    g.set(t, (g.get(t) || 0) + 1);
    per.set(k, g);
  }
  return [...per.values()]
    .map((g) => [...g.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0])
    .sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));
}

export const raccolteEsistenti = (libri = []) => grafie(libri.map((b) => b?.saga));

// le serie dentro una raccolta, quelle che le sue schede scrivono
export function serieDellaRaccolta(libri = [], raccolta = "") {
  const k = chiaveSaga(String(raccolta || "").trim());
  if (!k) return [];
  return grafie(libri.filter((b) => chiaveSaga(String(b?.saga || "").trim()) === k).map((b) => b?.series));
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
  const romanzi = (cammino.tappe || [])
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
  // LE STORIE DI MEZZO (il lettore: «non mi consideri anche le storie di
  // intramezzo delle serie?»): la guida le tiene a parte (`novelle`), fuori
  // dal cammino e dal riconoscimento, e qui stanno al loro numero, fra i
  // romanzi; l'elenco le propone senza spunta. Portano il loro ciclo
  // (`capitolo`): una guida ristretta a un ciclo prende solo le sue.
  const storie = (tav.novelle || [])
    .map((n) => {
      const v = { titolo: n.t, autore: n.a || AUTORI[tav.saga] || "", saga, serie: tav.parti ? tav.saga : n.c || "", numero: n.o, capitolo: n.c || "", anno: n.anno || null, novella: true };
      return { ...v, gia: giaSulloScaffale(v, libri) };
    });
  return [...romanzi, ...storie].sort((a, b) => (a.numero ?? Infinity) - (b.numero ?? Infinity));
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

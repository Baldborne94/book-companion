// UNA SAGA DAL SUO NOME (`components/AggiungiSenzaFile.jsx`,
// `test/saga-da-nome.test.mjs`). Chiesto dal lettore: «quando aggiungo il
// nome di una saga in automatico mi aggiungi nell'ordine corretto i libri
// con copertina di quella saga».
//
// Due strade, nell'ordine in cui ci si puo' fidare:
// 1. LE GUIDE SCRITTE A MANO (`TAVOLE`): l'elenco e' quello, esatto, col
//    numero del cammino. Anche coi nomi in italiano e con «Siege of Terra»,
//    che e' la dodicesima parte dell'Eresia.
// 2. WIKIDATA: la serie col suo nome, e i suoi membri che sono libri col
//    NUMERO nella serie (P179 col qualificatore P1545, intero: «2.5» e' la
//    novella fra due romanzi). Wikidata per la Black Library sa poco (la
//    sezione degli autori e' stata tolta per questo: «Gaunt's Ghosts · 2
//    libri»), quindi l'elenco si MOSTRA prima di scriverlo, e il lettore
//    toglie quel che non vuole: si propone, non si scrive in silenzio.
// Si chiede all'API di Wikidata (`origin=*`), mai al servizio SPARQL.
import { TAVOLE, riconosci } from "./sagaBooks.js";
import { camminoDellaGuida, guideIntere } from "./cammino.js";
import { vociDallaGuida, giaSulloScaffale } from "./senzaFile.js";

export const API = "https://www.wikidata.org/w/api.php";
// le serie: di libri, di romanzi, di opere, le trilogie
export const SERIE = ["Q277759", "Q1667921", "Q7725310", "Q13593966", "Q53815"];
// i libri: opera letteraria, romanzo, opera scritta, libro
export const LIBRI = ["Q7725634", "Q8261", "Q47461344", "Q571"];
// non volumi della saga: edizioni, racconti, novelle, raccolte
export const NON_VOLUMI = ["Q3331189", "Q49084", "Q149537", "Q1279564", "Q105420", "Q472808"];
export const UNIVERSO = "Q559618";

export const piano = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^(the|il|lo|la|i|gli|le|l) /, "")
    .trim();

// I NOMI DELLE GUIDE, anche come li dice il lettore. `parte` restringe la
// guida a un suo capitolo: Siege of Terra e' la parte 12 dell'Eresia
const NOMI = [
  { nomi: ["mondo disco", "discworld"], saga: "Discworld" },
  { nomi: ["eresia di horus", "horus heresy", "eresia"], saga: "The Horus Heresy" },
  { nomi: ["siege of terra", "assedio di terra", "horus heresy siege of terra"], saga: "The Horus Heresy", parte: "Part 12 · The Siege of Terra", nome: "The Siege of Terra" },
  { nomi: ["seconda apocalisse", "second apocalypse"], saga: "The Second Apocalypse" },
  { nomi: ["gaunts ghosts", "gaunt ghosts", "fantasmi di gaunt"], saga: "Gaunt's Ghosts" },
  { nomi: ["eisenhorn"], saga: "Eisenhorn" },
  { nomi: ["ravenor"], saga: "Ravenor" },
  { nomi: ["hellboy"], saga: "Hellboy" },
  { nomi: ["malazan book of the fallen", "libro dei caduti di malazan"], saga: "Malazan Book of the Fallen" },
  { nomi: ["stormlight", "stormlight archive", "cronache della folgorluce"], saga: "The Stormlight Archive" },
  { nomi: ["mistborn", "wax and wayne"], saga: "Mistborn" },
  { nomi: ["lockwood", "lockwood co", "lockwood and co"], saga: "Lockwood & Co." },
  { nomi: ["bartimaeus", "bartimaeus sequence", "trilogia di bartimeus", "bartimeus"], saga: "Bartimaeus" },
  { nomi: ["kingkiller", "kingkiller chronicle", "cronache dell'assassino del re", "assassino del re"], saga: "The Kingkiller Chronicle" },
  { nomi: ["realm of the elderlings", "elderlings"], saga: "The Realm of the Elderlings" },
  { nomi: ["wheel of time", "ruota del tempo"], saga: "The Wheel of Time" },
  // I MONDI: tutte le guide dello stesso `universo`, ognuna coi suoi numeri
  // (chiesto dal lettore: «raccoglie tutte le saghe»)
  { nomi: ["cosmere", "cosmoverse", "cosmoverso"], universo: "Cosmere" },
  { nomi: ["tales of witness", "witness"], saga: "Witness" },
  { nomi: ["malazan", "malazan universe", "malazan world", "mondo di malazan", "universo di malazan"], universo: "Malazan" },
  { nomi: ["first law", "first law world", "mondo della prima legge"], universo: "The First Law" },
  { nomi: ["banished lands"], universo: "The Banished Lands" },
  { nomi: ["warhammer 40k", "warhammer 40000", "warhammer 40 000", "40k"], universo: "Warhammer 40K" },
  // le sue cinque serie: la guida ristretta al suo ciclo
  { nomi: ["farseer", "farseer trilogy"], saga: "The Realm of the Elderlings", parte: "The Farseer Trilogy", nome: "The Farseer Trilogy" },
  { nomi: ["liveship traders", "liveship", "liveship traders trilogy"], saga: "The Realm of the Elderlings", parte: "Liveship Traders", nome: "Liveship Traders" },
  { nomi: ["tawny man", "tawny man trilogy"], saga: "The Realm of the Elderlings", parte: "The Tawny Man", nome: "The Tawny Man" },
  { nomi: ["rain wild chronicles", "rain wild", "rain wilds chronicles"], saga: "The Realm of the Elderlings", parte: "The Rain Wilds Chronicles", nome: "The Rain Wilds Chronicles" },
  { nomi: ["fitz and the fool", "fitz and the fool trilogy"], saga: "The Realm of the Elderlings", parte: "Fitz and the Fool", nome: "Fitz and the Fool" },
];

// LE PAROLE CHE DICONO «E' UNA SAGA» E NON SONO IL SUO NOME. Il lettore ha
// cercato «raven's shadow series» e non ha trovato niente: la ricerca per
// nome di Wikidata combacia sull'etichetta («Raven's Shadow»), e la parola
// in piu' la manda a vuoto. Il nome scritto si prova com'e', e se non trova
// niente si riprova senza (`variantiDelNome`): «Bartimaeus Sequence» resta
// buono alla prima.
const GENERICHE = /\b(series|serie|saga|trilogy|trilogia|cycle|ciclo|books|libri|novels|romanzi)\b/gi;
export const senzaParoleGeneriche = (nome) =>
  String(nome || "")
    .replace(/(\b(la|the|il|le)\s+)?\b(saga|serie|series|trilogia|trilogy|ciclo|cycle)\s+(dell'|della|degli|dei|del|di|of)\s*/gi, " ")
    .replace(GENERICHE, " ")
    .replace(/\s+/g, " ")
    .trim();
export const variantiDelNome = (nome) => [...new Set([String(nome || "").trim(), senzaParoleGeneriche(nome)].filter(Boolean))];

export function guidaDalNome(nome) {
  for (const variante of variantiDelNome(nome)) {
    const k = piano(variante);
    if (!k) continue;
    const n = NOMI.find((x) => x.nomi.some((v) => piano(v) === k)) || null;
    if (n) return n;
    const tav = guideIntere().find((t) => piano(t.saga) === k);
    if (tav) return { saga: tav.saga };
  }
  return null;
}

// I VOLUMI DI UNA GUIDA, tutti, coi tuoi segnati (`gia`)
export function volumiDallaGuida(trovata, libri = [], opzioni = {}) {
  if (trovata.universo) {
    const voci = guideIntere()
      .filter((t) => t.universo === trovata.universo)
      .flatMap((t) => vociDallaGuida(camminoDellaGuida(t, libri, opzioni), libri, opzioni));
    return voci.length ? { fonte: "guida", nome: trovata.universo, saga: voci[0].saga, universo: true, volumi: voci } : null;
  }
  const tav = TAVOLE.find((t) => t.saga === trovata.saga);
  if (!tav) return null;
  const cammino = camminoDellaGuida(tav, libri, opzioni);
  const voci = vociDallaGuida(cammino, libri, opzioni).filter((v) => !trovata.parte || v.capitolo === trovata.parte);
  return { fonte: "guida", nome: trovata.nome || tav.saga, saga: voci[0]?.saga || tav.saga, volumi: voci };
}

// ---- Wikidata -----------------------------------------------------------------

const valore = (c) => c?.mainsnak?.datavalue?.value;
export const ids = (claims, p) => (claims?.[p] || []).map((c) => valore(c)?.id).filter(Boolean);
export const indirizzo = (p) => `${API}?${new URLSearchParams({ format: "json", origin: "*", ...p })}`;
export const etichetta = (e) => e?.labels?.en?.value || e?.labels?.it?.value || "";

// la serie fra le candidate: la prima che E' una serie e non un universo
export function sceltaSerie(candidati = [], entita = {}) {
  for (const q of candidati) {
    const tipi = ids(entita[q]?.claims, "P31");
    if (tipi.includes(UNIVERSO)) continue;
    if (tipi.some((t) => SERIE.includes(t))) return q;
  }
  return null;
}

// un membro → un volume col suo numero in QUESTA serie, o niente
export function volumeDa(e, serie) {
  const c = e?.claims || {};
  const titolo = etichetta(e);
  if (!titolo) return null;
  const tipi = [...ids(c, "P31"), ...ids(c, "P7937")];
  if (!tipi.some((t) => LIBRI.includes(t)) || tipi.some((t) => NON_VOLUMI.includes(t))) return null;
  const legame = (c.P179 || []).find((x) => valore(x)?.id === serie);
  const grezzo = legame?.qualifiers?.P1545?.[0]?.datavalue?.value;
  const numero = grezzo != null && /^\d+$/.test(String(grezzo).trim()) ? Number(grezzo) : null;
  const tempo = String(valore((c.P577 || [])[0])?.time || "");
  return { titolo, numero, anno: Number(tempo.slice(1, 5)) || null, autoreId: ids(c, "P50")[0] || null };
}

// L'ORDINE: col numero, i volumi numerati e basta (uno senza numero in una
// saga numerata e' quasi sempre una novella o un'edizione); se nessuno ha
// il numero, i libri per anno, e lo si dice (`perAnno`)
export function inOrdine(volumi = []) {
  const numerati = volumi.filter((v) => v.numero != null);
  const visti = new Set();
  const unici = (l) => l.filter((v) => (visti.has(piano(v.titolo)) ? false : visti.add(piano(v.titolo))));
  if (numerati.length) return { perAnno: false, volumi: unici(numerati.sort((a, b) => a.numero - b.numero || (a.anno || 0) - (b.anno || 0))) };
  return { perAnno: true, volumi: unici(volumi.filter((v) => v.anno).sort((a, b) => a.anno - b.anno)).map((v, i) => ({ ...v, numero: i + 1 })) };
}

// Sei domande al piu' (otto se il nome va ripulito): la ricerca, i tipi
// delle candidate, i membri, le loro schede (a cinquanta), i nomi degli autori. `prendi(url)` da' il JSON.
// la serie col nome com'e', e se non c'e' col nome senza le parole generiche
async function serieDalNome(nome, prendi) {
  for (const variante of variantiDelNome(nome)) {
    const s = await prendi(indirizzo({ action: "wbsearchentities", search: variante, language: "en", uselang: "it", type: "item", limit: "7" }));
    const candidati = (s?.search || []).map((x) => x.id).filter(Boolean);
    if (!candidati.length) continue;
    const e = await prendi(indirizzo({ action: "wbgetentities", ids: candidati.join("|"), props: "labels|claims", languages: "en|it" }));
    const q = sceltaSerie(candidati, e?.entities || {}) || serieSenzaTipo(s.search, e?.entities || {});
    if (q) return { q, e };
  }
  return null;
}

// UNA SERIE CHE WIKIDATA NOMINA E BASTA. Il lettore ha cercato «Shadows of
// the Apt»: Wikidata ha la voce («fantasy series by Adrian Tchaikovsky») ma
// senza tipo, e nessun romanzo la indica. Presa per quel che e', i suoi
// libri sono zero, e il pannello dice che la saga c'e' ma l'elenco no,
// invece di «non ho trovato una saga con questo nome».
const DICE_SERIE = /\b(series|serie|saga|trilogy|trilogia|cycle|ciclo)\b/i;
export function serieSenzaTipo(risultati = [], entita = {}) {
  const r = risultati.find((x) => x?.id && DICE_SERIE.test(x.description || "") && !ids(entita[x.id]?.claims, "P31").length);
  return r ? r.id : null;
}

export async function sagaDaWikidata(nome, prendi) {
  const trovata = await serieDalNome(nome, prendi);
  if (!trovata) return null;
  const { q, e } = trovata;
  return volumiDellaSerie(q, etichetta(e.entities[q]) || nome, prendi);
}

// I volumi di una serie gia' trovata (dal nome o dall'autore)
export async function volumiDellaSerie(q, titolo, prendi) {
  const m = await prendi(indirizzo({ action: "query", list: "search", srsearch: `haswbstatement:P179=${q}`, srlimit: "200", srnamespace: "0" }));
  const membri = (m?.query?.search || []).map((x) => x.title).filter((x) => /^Q\d+$/.test(x));
  const entita = {};
  for (let i = 0; i < membri.length; i += 50) {
    const r = await prendi(indirizzo({ action: "wbgetentities", ids: membri.slice(i, i + 50).join("|"), props: "labels|claims", languages: "en|it" }));
    Object.assign(entita, r?.entities || {});
  }
  const { perAnno, volumi } = inOrdine(Object.values(entita).map((x) => volumeDa(x, q)).filter(Boolean));
  const autori = [...new Set(volumi.map((v) => v.autoreId).filter(Boolean))];
  const nomi = {};
  if (autori.length) {
    const r = await prendi(indirizzo({ action: "wbgetentities", ids: autori.slice(0, 50).join("|"), props: "labels", languages: "en|it" }));
    for (const [k, v] of Object.entries(r?.entities || {})) nomi[k] = etichetta(v);
  }
  return {
    fonte: "wikidata",
    nome: titolo,
    saga: titolo,
    perAnno,
    volumi: volumi.map((v) => ({ titolo: v.titolo, autore: nomi[v.autoreId] || "", saga: titolo, serie: "", numero: v.numero, anno: v.anno })),
  };
}

// ---- le saghe di un autore ----------------------------------------------------
//
// Chiesto dal lettore: «permettimi la ricerca per autore cosi' da sapere che
// saghe ha fatto, cosi' le puoi aggiungere direttamente». Due elenchi, come
// per il nome: prima le GUIDE dell'app in cui l'autore ha dei volumi (Abnett
// → Gaunt's Ghosts, Eisenhorn, Ravenor, e l'Eresia dove ne ha scritti), poi
// le SERIE di Wikidata dei suoi libri, quelle con piu' libri prima. Una
// serie che ha gia' la sua guida non si ripete.

// chi di mestiere scrive: scrittore, romanziere, autore, poeta, autore per ragazzi…
export const SCRITTORI = ["Q36180", "Q6625963", "Q482980", "Q15949613", "Q49757", "Q4853732", "Q18844224"];
const AUTORI_DELLE_GUIDE = { Discworld: "Terry Pratchett", Hellboy: "Mike Mignola" };
const paroleDi = (s) => piano(s).split(" ").filter((p) => p.length > 1);

// il nome scritto sta nell'autore se ogni sua parola c'e' («Abnett», «dan abnett»)
export const eLAutore = (scritto, autore) => {
  const w = paroleDi(scritto);
  const a = new Set(paroleDi(autore));
  return w.length > 0 && w.every((p) => a.has(p));
};

export function guideDellAutore(nome) {
  const sue = guideIntere()
    .map((tav) => ({ tav, quanti: tav.libri.filter((v) => (v.tipo || "") !== "racconto" && eLAutore(nome, v.a || AUTORI_DELLE_GUIDE[tav.saga] || "")).length }))
    .filter((x) => x.quanti > 0)
    .sort((a, b) => b.quanti - a.quanti)
    .map(({ tav, quanti }) => ({ fonte: "guida", saga: tav.saga, nome: tav.saga, quanti }));
  // IL SUO MONDO, PRIMA (il lettore: «raccoglie tutte le saghe»): dove ha
  // volumi in due guide o piu' dello stesso universo, il mondo intero, col
  // conto dei suoi volumi e di quelli degli altri che ci scrivono
  const universi = new Map();
  for (const g of sue) {
    const u = TAVOLE.find((t) => t.saga === g.saga)?.universo;
    if (u) universi.set(u, (universi.get(u) || 0) + 1);
  }
  const mondi = [...universi.entries()]
    .filter(([, n]) => n > 1)
    .map(([u]) => ({ fonte: "guida", universo: u, nome: u, quanti: volumiDallaGuida({ universo: u })?.volumi.length || 0 }));
  return [...mondi, ...sue];
}

// l'autore giusto fra quelli col suo nome: il primo che di mestiere scrive
export function sceltaAutore(candidati = [], entita = {}) {
  for (const c of candidati) if (ids(entita[c]?.claims, "P106").some((m) => SCRITTORI.includes(m))) return c;
  return null;
}

// Le serie dei suoi libri su Wikidata: la ricerca, i mestieri delle
// candidate, i suoi libri (P50), le loro schede (a cinquanta), i nomi delle
// serie. Solo le opere che sono libri, e solo le serie e non gli universi.
export async function serieDellAutore(nome, prendi) {
  const s = await prendi(indirizzo({ action: "wbsearchentities", search: nome, language: "en", uselang: "it", type: "item", limit: "7" }));
  const candidati = (s?.search || []).map((x) => x.id).filter(Boolean);
  if (!candidati.length) return null;
  const e = await prendi(indirizzo({ action: "wbgetentities", ids: candidati.join("|"), props: "labels|claims", languages: "en|it" }));
  const q = sceltaAutore(candidati, e?.entities || {});
  if (!q) return null;
  const m = await prendi(indirizzo({ action: "query", list: "search", srsearch: `haswbstatement:P50=${q}`, srlimit: "500", srnamespace: "0" }));
  const opere = (m?.query?.search || []).map((x) => x.title).filter((x) => /^Q\d+$/.test(x));
  // IL CONTO E' QUELLO DELL'ELENCO (il lettore: «perché dice 13 libri e ne
  // mostra 3?»): i Liveship Traders su Wikidata sono tre romanzi e dieci
  // volumi delle edizioni spezzate francese e tedesca, senza titolo in
  // inglese ne' in italiano. Si contano i volumi come li mette in fila
  // l'elenco (`volumeDa`, `inOrdine`), e un libro senza titolo non c'e'.
  const perSerie = new Map();
  const suoi = [];
  for (let i = 0; i < opere.length; i += 50) {
    const r = await prendi(indirizzo({ action: "wbgetentities", ids: opere.slice(i, i + 50).join("|"), props: "labels|claims", languages: "en|it" }));
    for (const x of Object.values(r?.entities || {})) {
      const qui = new Set(ids(x?.claims, "P179"));
      const v = volumeDa(x, null);
      if (!v) continue;
      suoi.push(v);
      for (const serie of qui) perSerie.set(serie, [...(perSerie.get(serie) || []), volumeDa(x, serie)]);
    }
  }
  const serie = [...perSerie.keys()];
  const voci = [];
  for (let i = 0; i < serie.length; i += 50) {
    const r = await prendi(indirizzo({ action: "wbgetentities", ids: serie.slice(i, i + 50).join("|"), props: "labels|claims", languages: "en|it" }));
    for (const [k, v] of Object.entries(r?.entities || {})) {
      // una serie di libri, non l'universo né la serie TV («Doctor Who» di Abnett)
      const tipi = ids(v?.claims, "P31");
      if (tipi.includes(UNIVERSO) || !tipi.some((t) => SERIE.includes(t))) continue;
      const titolo = etichetta(v);
      const quanti = inOrdine(perSerie.get(k)).volumi.length;
      if (titolo && quanti) voci.push({ fonte: "wikidata", q: k, nome: titolo, quanti });
    }
  }
  // GLI ALTRI SUOI LIBRI (il lettore, con John Gwynne: «e le altre saghe di
  // questo autore non le consideri?»): Wikidata ha i suoi romanzi ma non
  // le serie dei Bloodsworn e di Of Blood and Bone. Quelli che non stanno
  // in nessuna serie dell'elenco si mostrano a parte, per anno, e la
  // raccolta la scrive il lettore.
  // …e non la serie stessa scritta come un libro («The Ki and Vandien
  // Quartet» di Hobb, sopra fra le serie e sotto fra gli altri libri)
  const inSerie = new Set(voci.flatMap((x) => [piano(x.nome), ...perSerie.get(x.q).map((v) => piano(v.titolo))]));
  const visti = new Set();
  const sciolti = suoi
    .filter((v) => !inSerie.has(piano(v.titolo)) && !visti.has(piano(v.titolo)) && visti.add(piano(v.titolo)))
    .sort((a, b) => (a.anno || 9999) - (b.anno || 9999) || a.titolo.localeCompare(b.titolo))
    .map(({ titolo, anno }) => ({ titolo, anno }));
  return { autore: etichetta(e.entities[q]) || nome, serie: voci.sort((a, b) => b.quanti - a.quanti || a.nome.localeCompare(b.nome)), sciolti };
}

// La strada intera per un autore: le guide, poi Wikidata senza i doppioni
export async function saghePerAutore(nome, { prendi } = {}) {
  const guide = guideDellAutore(nome);
  const w = prendi ? await serieDellAutore(nome, prendi) : null;
  const giaGuide = new Set(guide.map((g) => g.saga).filter(Boolean));
  const giaMondi = new Set(guide.map((g) => g.universo || TAVOLE.find((t) => t.saga === g.saga)?.universo).filter(Boolean));
  const giaDetta = (nomeSerie) => {
    const g = guidaDalNome(nomeSerie);
    return !!g && (giaGuide.has(g.saga) || giaMondi.has(g.universo));
  };
  const altre = (w?.serie || []).filter((x) => !giaDetta(x.nome));
  const autore = w?.autore || nome;
  // i libri sciolti che una guida conosce stanno gia' nella guida
  const sciolti = (w?.sciolti || []).filter((v) => !giaGuide.has(riconosci({ title: v.titolo, author: autore })?.saga));
  const altri = sciolti.length ? [{ fonte: "sciolti", nome: "Altri libri", autore, quanti: sciolti.length, volumi: sciolti }] : [];
  if (!guide.length && !altre.length && !altri.length) return null;
  return { autore, saghe: [...guide, ...altre, ...altri] };
}

// I libri di una saga scelta dall'elenco dell'autore
export async function libriDellaSaga(voce, { libri = [], prendi } = {}) {
  if (voce.fonte === "guida") return volumiDallaGuida(voce.universo ? { universo: voce.universo } : { saga: voce.saga }, libri);
  if (voce.fonte === "sciolti") {
    const volumi = voce.volumi.map((v) => ({ titolo: v.titolo, autore: voce.autore || "", saga: "", serie: "", numero: null, anno: v.anno }));
    return { fonte: "sciolti", nome: voce.nome, saga: "", volumi: volumi.map((v) => ({ ...v, gia: giaSulloScaffale(v, libri) })) };
  }
  const w = await volumiDellaSerie(voce.q, voce.nome, prendi);
  return { ...w, volumi: w.volumi.map((v) => ({ ...v, gia: giaSulloScaffale(v, libri) })) };
}

// La strada intera: prima le guide, poi Wikidata
export async function sagaDalNome(nome, { libri = [], prendi } = {}) {
  const g = guidaDalNome(nome);
  if (g) return volumiDallaGuida(g, libri);
  if (!prendi) return null;
  const w = await sagaDaWikidata(nome, prendi);
  return w ? { ...w, volumi: w.volumi.map((v) => ({ ...v, gia: giaSulloScaffale(v, libri) })) } : null;
}

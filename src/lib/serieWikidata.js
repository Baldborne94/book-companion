// LA SAGA SU WIKIDATA (`lib/novita.js`, `android/Novita.java`).
// Chiesto dal lettore: «come fa a sapere della raccolta Cosmoverse chi è
// l'autore, quali libri ne fanno parte e cosa ne uscirà dopo? … non riesci
// a riconoscermi nessuna saga?». Gli autori di una raccolta dicono i loro
// libri nuovi, anche quelli che con la saga non c'entrano; Wikidata sa di
// quale serie e' parte un libro (P179), di quale opera (P361), di quale
// universo (P1434), e la data di uscita, anche annunciata (P577).
//
// IL NOME DELLA RACCOLTA NON BASTA: la «Cosmoverse» del lettore su Wikidata
// si chiama «Cosmere», e «Berserk» e' anche un film. Si cerca dal nome E dai
// titoli dei volumi (la serie di cui il libro e' parte), e vince la serie
// che fra i suoi membri ha piu' titoli della raccolta. Nessun titolo in
// comune, nessuna serie: si resta agli autori.
//
// Si chiede all'API di Wikidata (`origin=*`, come Lexicanum), non al
// servizio delle query SPARQL: quello razionava a una domanda al minuto.
export const API_WIKIDATA = "https://www.wikidata.org/w/api.php";
export const LEGAMI = ["P179", "P361", "P1434"];
// TUTTE LE SERIE DI UNA RACCOLTA (scelto dal lettore davanti al suo
// «Warhammer 40K»: «ci sono anche saghe inerenti all'universo 40k… come le
// gestisci?»). Si cercano i primi titoli della raccolta e il primo di ogni
// suo ciclo (la Serie della scheda), e i nomi dei cicli; si seguono le serie
// che coprono i suoi titoli, mai un universo intero (`UNIVERSO`: il Cosmere,
// il Mondo Disco come luogo, il 40K sarebbero ogni libro nuovo, anche di
// serie che il lettore non ha).
export const TITOLI_DA_PROVARE = 3;
// i titoli cercati in tutto: ognuno sono due domande
export const PROVE_MAX = 10;
// le serie candidate che si aprono: ognuna e' una domanda in piu'
export const CANDIDATE_MAX = 12;
// le serie che una raccolta segue al piu' (il guscio ne guarda tante)
export const SERIE_MAX = 8;
export const UNIVERSO = "Q559618";

const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(the|a|an|il|lo|la|l'|i|gli|le|un|una|uno)\s+/, "")
    .replace(/^l'/, "");

// le forme di un titolo che possono combaciare: intero, senza la coda fra
// parentesi («Horus Rising (The Horus Heresy Book 1)»), e i due lati dei
// due punti («Mistborn: The Final Empire» e' anche «The Final Empire»)
export function formeDelTitolo(t) {
  const s = String(t || "").replace(/\s*[([].*$/, "").trim();
  const forme = new Set([norm(t), norm(s)]);
  const due = s.split(/\s*:\s*/);
  if (due.length === 2) {
    forme.add(norm(due[0]));
    forme.add(norm(due[1]));
  }
  forme.delete("");
  return [...forme].filter((f) => f.length >= 3);
}

export function titoliDellaRaccolta(libri = []) {
  const visti = new Set();
  const out = [];
  for (const b of libri || []) {
    const t = String(b?.title || "").trim();
    const k = norm(t);
    if (!k || visti.has(k)) continue;
    visti.add(k);
    out.push(t);
  }
  return out;
}

// quali titoli della raccolta stanno fra i membri (etichette e alias, in
// inglese e in italiano: i libri del lettore possono essere tradotti)
export function titoliFraIMembri(entita = {}, titoli = []) {
  const nomi = new Set();
  for (const e of Object.values(entita || {})) {
    for (const l of Object.values(e?.labels || {})) for (const f of formeDelTitolo(l?.value)) nomi.add(f);
    for (const lista of Object.values(e?.aliases || {})) for (const a of lista || []) for (const f of formeDelTitolo(a?.value)) nomi.add(f);
  }
  return titoli.filter((t) => formeDelTitolo(t).some((f) => nomi.has(f)));
}

// LE SERIE CHE COPRONO LA RACCOLTA: la piu' coperta prima, poi solo quelle
// che aggiungono titoli non ancora coperti (la «Cosmoverse» del lettore
// puo' tenere Stormlight e Mistborn), al piu' `SERIE_MAX`. A pari titoli
// vince quella che si chiama come la raccolta, poi la piu' stretta: il
// Cosmere copre lo Stormlight, ma i suoi altri libri sono un'altra saga
export function serieCheCoprono(candidate = [], { max = SERIE_MAX, nome = "" } = {}) {
  const comeLaRaccolta = (c) => !!nome && formeDelTitolo(c.nome).some((f) => formeDelTitolo(nome).includes(f));
  const restano = candidate.filter((c) => c.titoli?.length);
  const coperti = new Set();
  const scelte = [];
  while (scelte.length < max) {
    let meglio = null;
    let quanti = 0;
    for (const c of restano) {
      if (scelte.includes(c)) continue;
      const nuovi = c.titoli.filter((t) => !coperti.has(t)).length;
      const pari = nuovi === quanti && nuovi > 0;
      const meglioDi = pari && (comeLaRaccolta(c) !== comeLaRaccolta(meglio) ? comeLaRaccolta(c) : c.membri < meglio.membri);
      if (nuovi > quanti || meglioDi) {
        meglio = c;
        quanti = nuovi;
      }
    }
    if (!meglio) break;
    scelte.push(meglio);
    for (const t of meglio.titoli) coperti.add(t);
  }
  return scelte;
}

// le serie di cui sono parte gli elementi trovati da un titolo
export function serieDegli(entita = {}) {
  const out = [];
  for (const e of Object.values(entita || {})) {
    for (const p of LEGAMI) {
      for (const c of e?.claims?.[p] || []) {
        const id = c?.mainsnak?.datavalue?.value?.id;
        if (id && !out.includes(id)) out.push(id);
      }
    }
  }
  return out;
}

// i titoli da cercare: i primi della raccolta, poi il primo di ogni ciclo
export function titoliDaProvare(libri = [], max = PROVE_MAX) {
  const out = titoliDellaRaccolta(libri).slice(0, TITOLI_DA_PROVARE);
  const cicli = new Set();
  for (const b of libri || []) {
    const ciclo = norm(b?.series);
    const t = String(b?.title || "").trim();
    if (!ciclo || cicli.has(ciclo) || !t) continue;
    cicli.add(ciclo);
    if (!out.some((x) => norm(x) === norm(t))) out.push(t);
  }
  return out.slice(0, max);
}

// i nomi dei cicli della raccolta, una volta sola
export const nomiDeiCicli = (libri = []) => {
  const visti = new Map();
  for (const b of libri || []) {
    const n = String(b?.series || "").trim();
    if (n && !visti.has(norm(n))) visti.set(norm(n), n);
  }
  return [...visti.values()];
};

// GLI AUTORI DECIDONO FRA DUE SERIE CON LO STESSO TITOLO. Misurato sul 40K
// del lettore: «The Solar War» e' anche il secondo della trilogia «The Long
// Winter» di A. G. Riddle, e la serie entrava per quel titolo. Una serie
// che su Wikidata ha i suoi autori (P50) e nessuno e' un autore della
// raccolta non si segue; senza autori dichiarati, o con una raccolta senza
// autori, non si giudica. Si confronta il cognome (l'ultima parola).
const cognome = (n) => norm(n).split(" ").filter(Boolean).pop() || "";
export function cognomiDellaRaccolta(libri = []) {
  const out = new Set();
  for (const b of libri || []) {
    for (const a of String(b?.author || "").split(/\s*(?:;|&| e | and |,)\s*/i)) {
      const c = cognome(a);
      if (c.length >= 3 && !/^(sconosciuto|unknown|anonimo|various|vv)$/.test(c)) out.add(c);
    }
  }
  return out;
}
export const autoriDi = (e) => (e?.claims?.P50 || []).map((c) => c?.mainsnak?.datavalue?.value?.id).filter(Boolean);
export function autoriCompatibili(e, nomiAutori = {}, cognomi = new Set()) {
  const ids = autoriDi(e);
  if (!ids.length || !cognomi.size) return true;
  return ids.some((id) => cognomi.has(cognome(nomiAutori[id])));
}

// un universo intero non e' una serie da seguire
export const eUnUniverso = (e) => (e?.claims?.P31 || []).some((c) => c?.mainsnak?.datavalue?.value?.id === UNIVERSO);

export const domandaMembri = (q) => `haswbstatement:${LEGAMI.map((p) => `${p}=${q}`).join("|")}`;

const indirizzo = (p) => `${API_WIKIDATA}?${new URLSearchParams({ format: "json", origin: "*", ...p })}`;

// LA SERIE DI UNA RACCOLTA: `prendi(url)` da' il JSON (la rete e' iniettata,
// cosi' si prova in Node). Torna [{ id, nome, membri, combaciano }] o null.
export async function cercaSerie({ nome = "", libri = [] } = {}, prendi) {
  const titoli = titoliDellaRaccolta(libri);
  if (!titoli.length) return null;
  const candidate = [];
  const aggiungi = (id) => {
    if (id && !candidate.includes(id)) candidate.push(id);
  };
  const cerca = async (testo, lingua) => {
    const r = await prendi(indirizzo({ action: "wbsearchentities", search: testo, language: lingua, uselang: lingua, type: "item", limit: "5" }));
    return (r?.search || []).map((x) => x.id).filter(Boolean);
  };
  // prima dai titoli: la serie di cui un volume e' parte e' la prova piu' forte
  for (const t of titoliDaProvare(libri)) {
    const ids = (await cerca(String(t).replace(/\s*[([].*$/, ""), "en")).slice(0, 3);
    if (!ids.length) continue;
    const r = await prendi(indirizzo({ action: "wbgetentities", ids: ids.join("|"), props: "claims" }));
    for (const id of serieDegli(r?.entities)) aggiungi(id);
  }
  for (const ciclo of nomiDeiCicli(libri)) for (const id of (await cerca(ciclo, "en")).slice(0, 2)) aggiungi(id);
  if (String(nome).trim()) {
    for (const lingua of ["en", "it"]) for (const id of (await cerca(String(nome).trim(), lingua)).slice(0, 2)) aggiungi(id);
  }
  if (!candidate.length) return null;
  // nomi e tipi delle candidate in una domanda: gli universi escono qui
  const tipi = {};
  for (let i = 0; i < candidate.length; i += 50) {
    const e = await prendi(indirizzo({ action: "wbgetentities", ids: candidate.slice(i, i + 50).join("|"), props: "labels|claims", languages: "it|en" }));
    Object.assign(tipi, e?.entities || {});
  }
  // i nomi degli autori delle candidate, in una domanda
  const cognomi = cognomiDellaRaccolta(libri);
  const nomiAutori = {};
  const idAutori = [...new Set(candidate.flatMap((q) => autoriDi(tipi[q])))];
  if (cognomi.size && idAutori.length) {
    for (let i = 0; i < idAutori.length; i += 50) {
      const e = await prendi(indirizzo({ action: "wbgetentities", ids: idAutori.slice(i, i + 50).join("|"), props: "labels", languages: "en|it" }));
      for (const [id, x] of Object.entries(e?.entities || {})) nomiAutori[id] = x?.labels?.en?.value || x?.labels?.it?.value || "";
    }
  }
  const misurate = [];
  for (const q of candidate.filter((q) => !eUnUniverso(tipi[q]) && autoriCompatibili(tipi[q], nomiAutori, cognomi)).slice(0, CANDIDATE_MAX)) {
    const r = await prendi(indirizzo({ action: "query", list: "search", srsearch: domandaMembri(q), srlimit: "500", srnamespace: "0" }));
    const membri = (r?.query?.search || []).map((x) => x.title).filter((x) => /^Q\d+$/.test(x));
    if (!membri.length) continue;
    const entita = {};
    for (let i = 0; i < membri.length; i += 50) {
      const e = await prendi(indirizzo({ action: "wbgetentities", ids: membri.slice(i, i + 50).join("|"), props: "labels|aliases", languages: "en|it" }));
      Object.assign(entita, e?.entities || {});
    }
    const l = tipi[q]?.labels || {};
    misurate.push({ id: q, nome: l.it?.value || l.en?.value || q, membri: membri.length, titoli: titoliFraIMembri(entita, titoli) });
  }
  const scelte = serieCheCoprono(misurate, { nome });
  return scelte.length ? scelte.map((x) => ({ id: x.id, nome: x.nome, membri: x.membri, combaciano: x.titoli.length })) : null;
}

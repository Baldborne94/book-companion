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
// i titoli della raccolta che si cercano uno per uno per trovare la serie
export const TITOLI_DA_PROVARE = 3;
// le serie candidate che si aprono: ognuna e' una domanda in piu'
export const CANDIDATE_MAX = 6;
// le serie che una raccolta segue al piu'
export const SERIE_MAX = 3;

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
  for (const t of titoli.slice(0, TITOLI_DA_PROVARE)) {
    const ids = (await cerca(String(t).replace(/\s*[([].*$/, ""), "en")).slice(0, 3);
    if (!ids.length) continue;
    const r = await prendi(indirizzo({ action: "wbgetentities", ids: ids.join("|"), props: "claims" }));
    for (const id of serieDegli(r?.entities)) aggiungi(id);
  }
  if (String(nome).trim()) {
    for (const lingua of ["en", "it"]) for (const id of (await cerca(String(nome).trim(), lingua)).slice(0, 2)) aggiungi(id);
  }
  const misurate = [];
  for (const q of candidate.slice(0, CANDIDATE_MAX)) {
    const r = await prendi(indirizzo({ action: "query", list: "search", srsearch: domandaMembri(q), srlimit: "500", srnamespace: "0" }));
    const membri = (r?.query?.search || []).map((x) => x.title).filter((x) => /^Q\d+$/.test(x));
    if (!membri.length) continue;
    const entita = {};
    for (let i = 0; i < membri.length; i += 50) {
      const e = await prendi(indirizzo({ action: "wbgetentities", ids: membri.slice(i, i + 50).join("|"), props: "labels|aliases", languages: "en|it" }));
      Object.assign(entita, e?.entities || {});
    }
    misurate.push({ id: q, membri: membri.length, titoli: titoliFraIMembri(entita, titoli) });
  }
  if (!misurate.some((c) => c.titoli.length)) return null;
  const e = await prendi(indirizzo({ action: "wbgetentities", ids: misurate.map((x) => x.id).join("|"), props: "labels", languages: "it|en" }));
  for (const c of misurate) {
    const l = e?.entities?.[c.id]?.labels || {};
    c.nome = l.it?.value || l.en?.value || c.id;
  }
  const scelte = serieCheCoprono(misurate, { nome });
  return scelte.length ? scelte.map((x) => ({ id: x.id, nome: x.nome, membri: x.membri, combaciano: x.titoli.length })) : null;
}

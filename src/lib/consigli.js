// I CONSIGLI DELL'ORACOLO (`components/DaPrendere.jsx`, `test/consigli.test.mjs`).
//
// Detto dal lettore guardando la prima versione di «Da prendere»: «fatto
// cosi' non serve a niente — o mi consigli libri che possono piacermi in base
// a quello che leggo, o libri dello stesso autore, o i volumi delle mie saghe
// che non ho in libreria». Aveva ragione: fuori dalle tre tavole che
// spediamo, la pagina sapeva dire soltanto «First Law n° 3 (se esiste)», cioe'
// un numero — e con un numero in libreria non ci vai.
//
// I titoli li sa il MODELLO, e qui chiederglieli e' il punto. La regola di
// casa «i titoli non escono mai» protegge dagli spoiler le domande sulla
// TRAMA, dove un modello che riconosce il libro risponderebbe a memoria; qui
// la memoria e' proprio quel che serve, e l'elenco che parte sono titoli,
// autori, saghe, stato e voto — mai un passaggio. E' dichiarato sulla pagina
// prima del tasto e in PRIVACY.md.
//
// LA PARTE CHE SBAGLIA IN SILENZIO E' IL TITOLO INVENTATO: un modello che non
// sa il quarto volume di una saga puo' scriverne uno plausibile, e un libro
// che non esiste in una lista della spesa e' un pomeriggio perso fra gli
// scaffali. Ogni titolo si cerca quindi su Open Library (titolo + autore, la
// stessa scelta del catalogo delle saghe), e quel che non si trova si DICE
// sulla voce invece di sparire — il catalogo non ha tutto, e un romanzo
// uscito il mese scorso sarebbe una perdita peggiore. Un buco di rete non e'
// «non trovato»: la voce resta senza segno.
//
// E QUEL CHE HAI GIA' NON SI PROPONE, qualunque cosa dica il modello: la
// risposta passa dallo stesso confronto dei doppioni dell'import (un'altra
// edizione dello stesso romanzo e' lo stesso romanzo), e quel che sta nella
// lista — tenuto o scartato — resta fuori come per le proposte delle tavole.
// Si filtra a ogni disegno e non al salvataggio: un volume importato stasera
// deve sparire dai consigli di ieri senza richiederli.
import { getStatus } from "./library.js";
import { sembraGiaLetto } from "./importBook.js";
import { idTitolo } from "./daPrendere.js";
import { scegliOpera } from "./sagaDalCatalogo.js";
import { autorePerIlCatalogo } from "./retroInRete.js";

const KEY = "bc_consigli";

// Le tre sezioni, nell'ordine in cui la pagina le mostra: prima quel che ti
// serve per andare avanti, poi quel che e' vicino a cio' che sai gia' di
// amare, per ultimo la scoperta.
export const SEZIONI = [
  { chiave: "saghe", nome: "Per andare avanti nelle tue saghe" },
  { chiave: "autori", nome: "Dagli autori che leggi" },
  { chiave: "gusti", nome: "Potrebbero piacerti" },
];

// Il ragionamento paga dallo stesso budget della risposta (la lezione di
// `TETTO_SCHEDA`), e qui la risposta sono trenta voci in JSON.
export const TETTO_CONSIGLI = 8000;
// Una biblioteca da mille volumi non deve diventare una richiesta da un
// dollaro: i libri che dicono qualcosa dei gusti (letti, in lettura,
// votati, lasciati) passano sempre, quelli mai aperti riempiono il resto
// finche' c'e' posto — servono al modello solo a non riproporli.
export const MAX_LIBRI = 600;

const STATI = { read: "letto", reading: "in lettura", abandoned: "abbandonato" };

// Una riga per libro. Il voto conta piu' di tutto (e' la sola cosa che dice
// «mi e' piaciuto»), l'abbandono dice cosa evitare, e il numero nella saga
// e' quel che permette di dire QUALE volume manca.
export function rigaLibro(b, stato) {
  const pezzi = [`${b.title || "?"}`];
  if (b.author) pezzi.push(`— ${b.author}`);
  if (b.saga) pezzi.push(`[${b.saga}${b.sagaOrder != null ? ` n° ${b.sagaOrder}` : ""}]`);
  const tra = [];
  if (STATI[stato]) tra.push(STATI[stato]);
  if (b.rating > 0) tra.push(`voto ${b.rating}/5`);
  if (b.fav) tra.push("preferito");
  if (tra.length) pezzi.push(`(${tra.join(", ")})`);
  return `- ${pezzi.join(" ")}`;
}

const dice = (b, stato) => !!STATI[stato] || b.rating > 0 || b.fav;

export function richiestaConsigli(books = [], { statusOf = getStatus } = {}) {
  const conStato = books.filter((b) => b?.title).map((b) => ({ b, st: statusOf(b.id) }));
  const primi = conStato.filter((x) => dice(x.b, x.st));
  const altri = conStato.filter((x) => !dice(x.b, x.st));
  const scelti = [...primi, ...altri].slice(0, MAX_LIBRI);
  const righe = scelti.map((x) => rigaLibro(x.b, x.st));
  const tagliati = conStato.length - scelti.length;

  const system = [
    "Sei un libraio esperto che consiglia libri a un lettore partendo dalla sua biblioteca.",
    "Consigli SOLO libri che esistono davvero e sono pubblicati: se non sei sicuro di un titolo, non scriverlo.",
    "Mai libri che sono gia' nella biblioteca del lettore, nemmeno in un'altra edizione, traduzione o raccolta.",
    "Scrivi i titoli nella lingua in cui il lettore li ha in biblioteca: se i suoi libri sono in inglese, il titolo originale inglese.",
    "Le motivazioni sono in italiano, una frase breve ciascuna, e senza anticipare niente della trama oltre la premessa.",
    "Rispondi SOLO con un oggetto JSON, senza testo prima o dopo.",
  ].join("\n");

  const user = [
    `La biblioteca del lettore (${conStato.length} libri${tagliati > 0 ? `, qui ne vedi ${scelti.length}` : ""}):`,
    ...righe,
    "",
    "Dammi tre elenchi:",
    "1. \"saghe\": per ogni saga o serie di cui il lettore ha letto o sta leggendo almeno un volume, i volumi che NON ha, a partire dal primo dopo l'ultimo che ha letto, nell'ordine di lettura consigliato. Al massimo 3 per saga. Includi anche le saghe riconoscibili dai titoli e dagli autori anche se nella biblioteca il campo saga manca. Niente per le saghe che ha gia' completo.",
    "2. \"autori\": altri libri degli autori di cui ha letto e apprezzato qualcosa (voto alto, preferiti, letti), che non stanno gia' nell'elenco \"saghe\". Al massimo 2 per autore, al massimo 10 in tutto, prima gli autori che ha votato meglio.",
    "3. \"gusti\": 8 libri di ALTRI autori, scelti sui suoi gusti: i voti alti e i preferiti pesano di piu', gli abbandonati dicono cosa evitare.",
    "",
    "Forma di ogni voce: {\"titolo\": \"...\", \"autore\": \"...\", \"saga\": \"...\" oppure null, \"numero\": numero nella saga oppure null, \"perche\": \"...\"}.",
    "Per \"saghe\" il campo \"perche\" dice dopo quale volume viene (es. \"dopo «X», che hai letto\").",
    "Risposta: {\"saghe\": [...], \"autori\": [...], \"gusti\": [...]}",
  ].join("\n");

  return { system, user, libri: scelti.length };
}

// Il JSON del modello, letto con la diffidenza che merita: puo' arrivare
// dentro un recinto di codice, con del testo attorno, o monco. Una voce
// senza titolo non e' una voce, un numero che non e' un numero diventa
// `null`, e una risposta illeggibile e' `null` — mai sezioni inventate.
export function leggiConsigli(testo) {
  const s = String(testo || "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  let dati;
  try {
    dati = JSON.parse(s.slice(a, b + 1));
  } catch {
    return null;
  }
  if (!dati || typeof dati !== "object") return null;
  const out = {};
  let quante = 0;
  for (const { chiave } of SEZIONI) {
    const voci = Array.isArray(dati[chiave]) ? dati[chiave] : [];
    out[chiave] = voci
      .map((v) => {
        const titolo = String(v?.titolo || "").trim();
        if (!titolo) return null;
        const autore = String(v?.autore || "").trim();
        const n = Number(v?.numero);
        return {
          id: idTitolo(titolo, autore),
          titolo,
          autore,
          saga: String(v?.saga || "").trim(),
          numero: v?.numero != null && Number.isFinite(n) && n > 0 ? n : null,
          perche: String(v?.perche || "").trim(),
        };
      })
      .filter(Boolean);
    quante += out[chiave].length;
  }
  return quante ? out : null;
}

// Quel che si mostra: via quel che hai gia', quel che sta nella lista
// (tenuto o scartato), e i doppioni fra una sezione e l'altra — lo stesso
// libro sta nella PRIMA sezione che lo nomina, che e' la piu' vicina a te.
export function daMostrare(consigli, books = [], lista = []) {
  const noti = new Set((lista || []).filter((v) => v && v.id && !v.deleted).map((v) => v.id));
  const visti = new Set();
  const out = [];
  for (const { chiave, nome } of SEZIONI) {
    const voci = (consigli?.[chiave] || []).filter((v) => {
      if (!v?.id || noti.has(v.id) || visti.has(v.id)) return false;
      visti.add(v.id);
      return !sembraGiaLetto({ title: v.titolo, author: v.autore }, books);
    });
    if (voci.length) out.push({ chiave, nome, voci });
  }
  return out;
}

// C'e' nel catalogo? `true`/`false` e' una risposta; un buco di rete
// ESPLODE, come in `cercaSaga`, perche' «non ho potuto chiedere» non e'
// «non esiste».
export async function nelCatalogo({ titolo, autore }, fetcher) {
  const f = fetcher || fetch;
  const a = autorePerIlCatalogo(autore);
  const q = new URLSearchParams({ title: titolo, fields: "key,title,author_name", limit: "5" });
  if (a) q.set("author", a);
  const r = await f(`https://openlibrary.org/search.json?${q}`);
  if (!r?.ok) throw new Error(`catalogo ${r?.status || "?"}`);
  const json = await r.json();
  return !!scegliOpera(json?.docs || [], { title: titolo, author: autore, filtrata: !!a });
}

// Si controllano tutte le voci, quattro alla volta: una per volta trenta
// titoli sarebbero mezzo minuto davanti a una pagina ferma. `verificato`
// e' `true`, `false`, o assente se la rete non ha risposto.
export async function verificaTutti(consigli, { controlla = nelCatalogo, onProgress, insieme = 4 } = {}) {
  const voci = SEZIONI.flatMap(({ chiave }) => consigli?.[chiave] || []);
  let fatte = 0;
  let prossima = 0;
  const lavora = async () => {
    while (prossima < voci.length) {
      const v = voci[prossima++];
      try {
        v.verificato = await controlla(v);
      } catch {
        delete v.verificato;
      }
      fatte++;
      onProgress?.(fatte, voci.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(insieme, voci.length) }, lavora));
  return consigli;
}

// Il giro intero: la domanda, la lettura, il controllo. `chiedi` e il
// controllo si passano da fuori, cosi' un test lo prova senza rete.
export async function chiediConsigli(books, { chiedi, controlla, statusOf = getStatus, onFase } = {}) {
  const { system, user } = richiestaConsigli(books, { statusOf });
  onFase?.("chiedo");
  const r = await chiedi({ system, user, tetto: TETTO_CONSIGLI });
  if (r?.error) return r;
  const consigli = leggiConsigli(r.answer);
  if (!consigli) return { error: r.tagliata ? "tagliata" : "illeggibile", uso: r.uso };
  onFase?.("controllo", 0, 0);
  await verificaTutti(consigli, { controlla, onProgress: (a, b) => onFase?.("controllo", a, b) });
  return { consigli, uso: r.uso, quando: Date.now() };
}

// Stanno sul dispositivo e non viaggiano: sono una risposta pagata una volta
// e si rileggono gratis, ma sono un suggerimento, non un dato tuo — quel che
// vuoi tenere lo metti nella lista, e la lista viaggia.
export function leggiConsigliSalvati() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v && v.consigli ? v : null;
  } catch {
    return null;
  }
}

export function scriviConsigli(giro) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ consigli: giro.consigli, quando: giro.quando, uso: giro.uso || null }));
  } catch {
    /* storage pieno: i consigli restano fino alla chiusura della pagina */
  }
}

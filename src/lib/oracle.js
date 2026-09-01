// L'Oracolo legge il passaggio NEL SUO contesto e spiega cosa vuol dire:
// quello che glossario e dizionario non possono fare, perche' il senso di
// una battuta o di un gioco di parole sta nel paragrafo, non nella parola.
// La chiave API e' dell'utente e non lascia mai il dispositivo: la chiamata
// parte dal browser dritta verso l'API Anthropic, nessun server in mezzo.

import { daUsage, registra, oltreIlTetto, leggiTetto, restaDelMese } from "./spesa.js";

const KEY = "bc_ai_key";

export function getOracleKey() {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setOracleKey(k) {
  try {
    const v = String(k || "").trim();
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage indisponibile: pazienza, si richiedera' la chiave */
  }
}

export const hasOracle = () => !!getOracleKey();

// ---------------------------------------------------------------------------
// QUANDO SCADE LA CHIAVE.
//
// LA DATA NON SI PUO' CHIEDERE, e va detto invece di far finta. La scadenza
// di una chiave vive nell'Admin API di Anthropic
// (`/v1/organizations/api_keys`), che vuole una chiave di AMMINISTRAZIONE —
// non quella normale che sta qui — e mandare una chiave di amministrazione
// dal browser sarebbe una pessima idea a prescindere. Con la chiave normale
// l'unica cosa che si scopre e' che NON vale piu', e la si scopre il giorno
// dopo, con un 401 in faccia mentre stavi leggendo.
//
// Quindi la data la scrive il lettore quando salva la chiave, ed e'
// FACOLTATIVA: una funzione che pretende una data prima di lasciarti
// incollare una chiave e' peggio del problema che risolve. Sta sul
// dispositivo accanto alla chiave, e con lei se ne va.
const KEY_SCADE = "bc_ai_key_scade";

export function leggiScadenza() {
  try {
    const v = localStorage.getItem(KEY_SCADE) || "";
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
  } catch {
    return "";
  }
}

export function scriviScadenza(iso) {
  try {
    const v = String(iso || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) localStorage.setItem(KEY_SCADE, v);
    else localStorage.removeItem(KEY_SCADE);
  } catch {
    /* storage negato: si perde il promemoria, non la chiave */
  }
}

// Quanti giorni prima si comincia a dirlo. Dieci: il lettore ha chiesto di
// poterla mettere «il giorno prima», e un avviso che arriva il giorno prima
// e basta e' un avviso che, se quel giorno non apri l'app, non arriva mai.
export const GIORNI_AVVISO = 10;

const aMezzogiorno = (iso) => Date.parse(`${iso}T12:00:00`);

// I GIORNI SI CONTANO SUL CALENDARIO, NON SULLE ORE. Con la sottrazione fra
// istanti, una chiave che scade domani mattina e una che scade domani sera
// darebbero «0 giorni» e «1 giorno» — e in mezzo ci passa il cambio d'ora,
// che sposta di sessanta minuti e fa saltare un giorno intero. Fissando
// tutt'e due a mezzogiorno resta un numero di giorni vero: oggi e' 0,
// domani e' 1, e ieri e' -1 comunque vada l'orologio.
export function statoChiave({ scade, ora = Date.now() } = {}) {
  const s = scade === undefined ? leggiScadenza() : scade;
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return { stato: "ignota", giorni: null };
  const fine = aMezzogiorno(s);
  if (!Number.isFinite(fine)) return { stato: "ignota", giorni: null };
  const oggi = new Date(ora);
  const inizio = aMezzogiorno(
    `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}-${String(oggi.getDate()).padStart(2, "0")}`
  );
  const giorni = Math.round((fine - inizio) / 86400000);
  if (giorni < 0) return { stato: "scaduta", giorni };
  if (giorni <= GIORNI_AVVISO) return { stato: "inScadenza", giorni };
  return { stato: "valida", giorni };
}

// La frase, che non e' un dettaglio: «scade fra 0 giorni» non lo direbbe
// nessuno, e «1 giorni» si legge come un guasto.
export function frasScadenza(st) {
  if (!st || st.stato === "ignota") return null;
  if (st.stato === "scaduta") {
    const g = -st.giorni;
    return g === 1 ? "La chiave è scaduta ieri." : `La chiave è scaduta ${g} giorni fa.`;
  }
  if (st.giorni === 0) return "La chiave scade oggi.";
  if (st.giorni === 1) return "La chiave scade domani.";
  return `La chiave scade fra ${st.giorni} giorni.`;
}

// Il paragrafo attorno alla selezione va colto quando la selezione esiste
// ancora: al primo tocco sul menu e' gia' svanita, e con lei il contesto.
// Nei PDF il blocco piu' vicino e' l'intero livello testo della pagina,
// per questo si ritaglia una finestra centrata su quel che si e' scelto.
export function contextAround(sel, maxLen = 700) {
  try {
    if (!sel || !sel.rangeCount) return "";
    const scelto = String(sel.toString() || "").replace(/\s+/g, " ").trim();
    let node = sel.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType !== 1) node = node.parentElement;
    const blocco = node?.closest?.("p, li, blockquote, td, h1, h2, h3, div") || node;
    const tutto = String(blocco?.textContent || "").replace(/\s+/g, " ").trim();
    if (!tutto) return scelto;
    if (tutto.length <= maxLen) return tutto;
    const at = scelto ? tutto.indexOf(scelto) : -1;
    const centro = at >= 0 ? at + scelto.length / 2 : tutto.length / 2;
    const from = Math.max(0, Math.min(Math.round(centro - maxLen / 2), tutto.length - maxLen));
    const pezzo = tutto.slice(from, from + maxLen);
    return (from > 0 ? "…" : "") + pezzo + (from + maxLen < tutto.length ? "…" : "");
  } catch {
    return "";
  }
}

// Niente markdown: la scheda mostra testo e basta. E niente spoiler: il
// modello conosce i libri e senza freno racconterebbe volentieri il finale.
const SISTEMA = [
  "Sei l'Oracolo di un'app di lettura. Il lettore, italiano, sta leggendo un",
  "libro in lingua originale e ti mostra un passaggio che non gli è chiaro,",
  "insieme al paragrafo in cui compare. Spiega in italiano che cosa significa",
  "il passaggio in quel contesto: sciogli modi di dire, slang, parlato",
  "storpiato, giochi di parole e riferimenti. Non tradurre parola per parola:",
  "rendi il senso, e se c'è una battuta spiega perché fa ridere. Da 2 a 5",
  "frasi, tono da amico che conosce bene la lingua, senza markdown né",
  "elenchi. Non rivelare MAI eventi del libro oltre il punto mostrato.",
].join(" ");

const cache = new Map();

// IL TETTO E' DELLA DOMANDA, NON DELLA CHIAMATA.
//
// Con un tetto solo per tutti, la scheda di un personaggio su cinque
// volumi si troncava a meta' frase: restava senza l'ultimo movimento, e
// senza i divisori la scheda perdeva pure i titoletti. E il tetto lo
// dividono in due: `thinking: adaptive` PAGA DAL MEDESIMO BUDGET, quindi
// il ragionamento su trenta passaggi si mangiava la risposta.
//
// Il tetto largo NON e' il permesso di dilungarsi: quanto scrivere lo
// dice il prompt, che chiede una scheda compatta. Serve solo perche' il
// ragionamento abbia dove stare senza mangiarsi il finale.
export const TETTO_BREVE = 1500;
// Su una saga lunga davanti al modello finiscono cento passaggi, e il
// ragionamento cresce con loro: il tetto deve restare piu' alto di quanto
// serve, o si torna al troncamento a meta' frase. Non e' il permesso di
// scrivere di piu' — quanto scrivere lo dice il prompt, che chiede una
// scheda compatta — ma lo spazio perche' il ragionamento non si mangi il
// finale della risposta.
export const TETTO_SCHEDA = 6000;

// La chiamata sola, senza sapere cosa si sta chiedendo: la usano sia la
// spiegazione di un passaggio sia la scheda di un personaggio, e gli errori
// vanno tradotti in un posto solo.
export async function chiedi({ system, user, tetto = TETTO_BREVE }, fetcher) {
  const chiave = getOracleKey();
  if (!chiave) return { error: "chiave" };
  // IL TETTO SI GUARDA QUI, davanti alla porta, per la stessa ragione per cui
  // qui si segna la spesa: e' l'unico punto da cui passano tutte le domande.
  // Messo in ognuna, la prossima se lo dimenticherebbe — e una funzione che
  // si dimentica il tetto e' un tetto che non c'e'.
  //
  // Si guarda quel che e' GIA' stato speso, non quel che costera' questa
  // richiesta: prima di farla nessuno lo sa. Si puo' quindi sforare di una
  // domanda sola, e la scheda lo dice invece di fingere un pareggio.
  //
  // E si passa in un modo solo: ALZANDO IL TETTO. Un «chiedi lo stesso» che
  // scavalca senza toccarlo lascerebbe sullo schermo un numero che non
  // comanda piu' niente — meglio un tetto che si sposta con un tocco e resta
  // vero, che un tetto vero a meta'.
  if (oltreIlTetto()) return { error: "tetto", tettoMese: leggiTetto(), resta: restaDelMese() };
  try {
    const r = await (fetcher || fetch)("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": chiave,
        "anthropic-version": "2023-06-01",
        // e' il permesso esplicito per chiamare l'API da un browser: senza,
        // il CORS rifiuta apposta, per scoraggiare chiavi altrui nei siti
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-opus-5",
        max_tokens: tetto,
        thinking: { type: "adaptive" },
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (r.status === 401 || r.status === 403) return { error: "chiave" };
    if (!r.ok) return { error: "api" };
    const data = await r.json();
    const answer = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    // I TOKEN CONSUMATI SI SEGNANO, e si segnano QUI perche' qui passano
    // tutte le domande — spiegazione, scheda personaggio, «Dove eravamo
    // rimasti», «Prima di cominciare». Metterlo in ognuna vorrebbe dire
    // che la prossima si dimentica. `registra` non esplode mai: il lettore
    // ha appena pagato questa risposta, e un conto che non si scrive non
    // deve portarsela via.
    const uso = daUsage(data.usage);
    registra(data.usage);
    // una risposta troncata si DICHIARA: mostrata com'e' sembra finita, e
    // il lettore crede che la storia si fermi li'
    return answer ? { answer, tagliata: data.stop_reason === "max_tokens", uso } : { error: "api" };
  } catch {
    return { error: "rete" };
  }
}

export async function consultaOracolo({ text, context, book }, fetcher) {
  const brano = String(text || "").trim();
  if (!getOracleKey()) return { error: "chiave" };
  if (!brano) return { error: "vuoto" };
  const k = `${book?.id || ""}|${brano}`;
  if (cache.has(k)) return cache.get(k);
  const righe = [];
  if (book?.title) righe.push(`Libro: «${book.title}»${book.author ? ` di ${book.author}` : ""}.`);
  righe.push(`Passaggio selezionato: «${brano}»`);
  const attorno = String(context || "").trim();
  if (attorno && attorno !== brano) righe.push(`Il paragrafo attorno: «${attorno}»`);
  const out = await chiedi({ system: SISTEMA, user: righe.join("\n") }, fetcher);
  if (out.answer) cache.set(k, out);
  return out;
}

// IL PROMEMORIA ALL'AVVIO, UNA VOLTA AL GIORNO.
//
// «Almeno dimmi quando scade, cosi' posso gia' inserirla il giorno prima»:
// la riga dentro la scheda dell'Oracolo la vedi solo se apri l'Oracolo, e
// chi deve sostituire una chiave che ancora funziona l'Oracolo non lo sta
// aprendo — sta leggendo. Quindi lo si dice all'avvio.
//
// UNA VOLTA AL GIORNO, non a ogni avvio: un avviso che torna ogni volta che
// apri l'app si impara a chiudere senza leggerlo, ed e' proprio il giorno
// che conta che non lo guarderesti. La data dell'ultimo avviso sta accanto
// alle altre, sul dispositivo.
const KEY_AVVISO = "bc_ai_key_avviso";

export function daAvvisare({ ora = Date.now(), stato } = {}) {
  const st = stato || statoChiave({ ora });
  if (st.stato !== "inScadenza" && st.stato !== "scaduta") return null;
  const oggi = new Date(ora);
  const chiave = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}-${String(oggi.getDate()).padStart(2, "0")}`;
  try {
    if (localStorage.getItem(KEY_AVVISO) === chiave) return null;
    localStorage.setItem(KEY_AVVISO, chiave);
  } catch {
    // senza storage non si puo' ricordare di averlo gia' detto: meglio
    // dirlo di nuovo che non dirlo affatto, perche' e' l'unico avviso che
    // arriva PRIMA che la funzione smetta di rispondere
  }
  return frasScadenza(st);
}

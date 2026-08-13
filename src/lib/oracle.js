// L'Oracolo legge il passaggio NEL SUO contesto e spiega cosa vuol dire:
// quello che glossario e dizionario non possono fare, perche' il senso di
// una battuta o di un gioco di parole sta nel paragrafo, non nella parola.
// La chiave API e' dell'utente e non lascia mai il dispositivo: la chiamata
// parte dal browser dritta verso l'API Anthropic, nessun server in mezzo.

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
    // una risposta troncata si DICHIARA: mostrata com'e' sembra finita, e
    // il lettore crede che la storia si fermi li'
    return answer ? { answer, tagliata: data.stop_reason === "max_tokens" } : { error: "api" };
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

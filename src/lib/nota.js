// LE NOTE A PIE' DI PAGINA SI LEGGONO SUL POSTO.
//
// Nei Pratchett le note sono meta' del divertimento, e il rimando e' un
// asterisco in apice: un bersaglio da pochi pixel. Il lettore non riusciva
// a toccarlo («come mai non riesco a cliccare l'asterisco?»): il dito
// mancava la <a> e il tocco cadeva nelle fasce di voltata. E anche
// colpendolo, epub.js SALTEREBBE alla pagina delle note in fondo al libro
// — il segno di lettura si sposta e tornare indietro e' un'impresa
// (chiesto dal lettore: «vorrei che poi letto mi riporti al punto in cui
// ero»). La cura fa meglio del ritorno: NON CI SI MUOVE AFFATTO. La nota
// arriva in una scheda sopra la pagina, chiusa la scheda sei dove eri.
//
// Questo modulo e' la parte provabile: riconoscere un rimando di nota,
// risolvere il suo percorso, estrarre il testo della nota, allargare il
// bersaglio del tocco. Il resto (la scheda) sta nel Reader.

// Un RIMANDO DI NOTA non e' un collegamento qualunque: un link di indice
// («Capitolo 3») deve continuare a navigare. Si riconosce dalla dichiarazione
// (epub:type="noteref", role="doc-noteref") o dal testo, che e' un SEGNO e
// non una parola: *, †, cifre, [3]. Un link esterno non e' mai una nota.
export function eNotaRef({ href = "", testo = "", tipo = "", ruolo = "" } = {}) {
  if (!href || /^(https?|mailto|tel):/i.test(href)) return false;
  if (/noteref/i.test(tipo) || /doc-noteref/i.test(ruolo)) return true;
  // senza dichiarazione serve il frammento: un rimando punta DENTRO un
  // documento, non a un documento intero
  if (!href.includes("#")) return false;
  const t = String(testo).replace(/[\s ]+/g, "");
  return /^[*†‡§¶#]{1,3}$|^\[?\d{1,3}\]?$/.test(t);
}

// il percorso del rimando, risolto dalla cartella del documento che lo
// ospita: «notes.xhtml» dentro «OEBPS/c1.xhtml» e' «OEBPS/notes.xhtml»,
// e «../note/n.xhtml» risale come deve. Solo il frammento = stesso file.
export function risolviHref(rel, base = "") {
  const [file, frammento = ""] = String(rel || "").split("#");
  if (!file) return { file: String(base).split("#")[0], frammento };
  try {
    const u = new URL(file, `http://x/${String(base).split("#")[0]}`);
    return { file: decodeURIComponent(u.pathname.replace(/^\//, "")), frammento };
  } catch {
    return { file, frammento };
  }
}

// L'ancora nuda non e' la nota: tanti ePub mettono l'id su una <a> vuota o
// su un <sup>, e la nota e' il paragrafo che li contiene. Un contenitore
// grosso (la sezione con TUTTE le note) invece non va preso: si sale solo
// fino al primo blocco piccolo.
// quanto testo basta perche' un elemento sia «la nota» e non un'ancora
export const NOTA_MINIMA = 4;

// DUE FAMIGLIE DI BLOCCHI, e la differenza non e' cosmetica.
//
// `p`, `li`, `aside`… sono i posti dove una nota STA: chi scrive un ePub
// ci mette dentro il testo della nota e basta, quindi salire fin li' e'
// sempre giusto, per lunga che sia.
//
// `div` e `section` invece non dicono niente: possono essere la nota o
// possono essere IL LIBRO INTERO. Nei convertiti da Mobi — l'Eric del
// lettore — il romanzo e' un documento solo dentro un unico <div>, e le
// ancore delle note sono <a name> nude appese li' dentro. `closest("div")`
// tornava quel <div>, il controllo era solo «ha abbastanza testo», e la
// scheda mostrava l'INIZIO DEL LIBRO: «Begin Reading» piu' l'epigrafe,
// tagliata a 1500 caratteri cosi' bene da sembrare una nota vera.
const BLOCCHI_VERI = "aside, li, p, dd, blockquote, td";
const BLOCCHI_GENERICI = "div, section";

// oltre questo, un contenitore generico non e' una nota: e' il capitolo,
// o il libro. Una nota di Pratchett lunga sta sotto le mille battute.
export const NOTA_TETTO = 1500;

const quanto = (el) => String(el?.textContent || "").trim().length;
const eGenerico = (el) => /^(div|section)$/i.test(el?.tagName || "");

// un blocco vero va bene per quanto sia lungo; uno generico solo se e'
// piccolo, o si finisce a mostrare il libro al posto della nota
const puoEssereNota = (el) => !!el && quanto(el) >= NOTA_MINIMA && !(eGenerico(el) && quanto(el) > NOTA_TETTO);

// IL PRIMO BLOCCO CHE SEGUE l'ancora, saltando i vuoti. E' la forma dei
// libri convertiti da Mobi (l'Eric del lettore): `<a id="filepos1"></a>`
// da sola, e la nota nel paragrafo SUCCESSIVO — dove `closest` non arriva
// mai, perche' l'ancora non sta dentro niente. Si guarda avanti di pochi
// passi, e se i fratelli finiscono si sale di un piano: piu' in la' non
// c'e' piu' la nota, c'e' il resto del libro.
export function primoBloccoDopo(el, passi = 4) {
  let cur = el;
  for (let i = 0; i < passi && cur; i++) {
    let succ = cur.nextElementSibling;
    while (succ && !puoEssereNota(succ)) succ = succ.nextElementSibling;
    if (succ) return succ;
    cur = cur.parentElement;
    if (!cur || /^(body|html)$/i.test(cur.tagName || "")) return null;
  }
  return null;
}

// L'ancora nuda non e' la nota: tanti ePub mettono l'id su una <a> vuota o
// su un <sup>. La nota e' il blocco che li CONTIENE — oppure, quando
// l'ancora sta fuori da ogni blocco, quello che la SEGUE.
// IL BERSAGLIO DI UN FRAMMENTO, e non basta `getElementById`: i libri
// convertiti da Mobi scrivono spesso l'ancora alla vecchia maniera,
// `<a name="filepos257551"></a>`, che `getElementById` NON vede — il
// frammento risultava introvabile, la scheda restava muta e il tocco si
// ripiegava su un salto che moriva in silenzio.
export function bersaglio(doc, frammento) {
  if (!doc || !frammento) return null;
  try {
    const perId = doc.getElementById(frammento);
    if (perId) return perId;
  } catch {
    /* documento senza getElementById: si prova col nome */
  }
  try {
    return doc.querySelector(`[name="${String(frammento).replace(/["\\]/g, "\\$&")}"]`) || null;
  } catch {
    return null;
  }
}

export function estraiNota(doc, frammento) {
  const ancora = bersaglio(doc, frammento);
  if (!ancora) return "";
  // il frammento che punta dritto alla nota: <aside>, <li>, <p> col testo
  const marcatore = quanto(ancora) < NOTA_MINIMA || /^a$/i.test(ancora.tagName || "");
  if (!marcatore) return puoEssereNota(ancora) ? pulisciNota(ancora.textContent) : "";

  // PRIMA il blocco vero che la contiene: li' una nota ci sta per davvero,
  // e la lunghezza non conta.
  let el = ancora.closest?.(BLOCCHI_VERI);
  // poi, e solo se e' piccolo, un contenitore generico
  if (!puoEssereNota(el)) el = ancora.closest?.(BLOCCHI_GENERICI);
  // e se nemmeno quello, la nota e' il blocco che SEGUE l'ancora nuda —
  // la forma dei convertiti da Mobi, dove l'ancora sta appesa da sola
  if (!puoEssereNota(el)) el = primoBloccoDopo(ancora);
  return puoEssereNota(el) ? pulisciNota(el.textContent) : "";
}

const NOTA_MAX = 1500;

// via il ritorno («↩»), i capi a piu' spazi, e un tetto: una nota lunga
// mezzo capitolo e' quasi sempre il contenitore preso per sbaglio
export function pulisciNota(testo) {
  let t = String(testo || "").replace(/\s+/g, " ").trim();
  t = t.replace(/[↩⏎←]\s*$/g, "").trim();
  if (t.length > NOTA_MAX) {
    const taglio = t.lastIndexOf(". ", NOTA_MAX);
    t = `${t.slice(0, taglio > NOTA_MAX / 2 ? taglio + 1 : NOTA_MAX)}…`;
  }
  return t;
}

// IL BERSAGLIO SI ALLARGA: l'asterisco e' alto dieci pixel, e pretendere il
// tocco esatto e' pretendere una mira che su un tablet non esiste. Un tocco
// che cade a un soffio da un rimando e' per il rimando, non per la voltata.
// `rettangoli` = [{left, top, right, bottom, ref}] dei soli rimandi.
export function piuVicina(rettangoli = [], x, y, raggio = 28) {
  let scelto = null;
  let minima = Infinity;
  for (const r of rettangoli) {
    const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
    const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
    const d = Math.hypot(dx, dy);
    if (d < minima) {
      minima = d;
      scelto = r;
    }
  }
  return minima <= raggio ? scelto : null;
}

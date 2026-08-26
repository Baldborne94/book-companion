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
export function estraiNota(doc, frammento) {
  if (!doc || !frammento) return "";
  let el = null;
  try {
    el = doc.getElementById(frammento);
  } catch {
    el = null;
  }
  if (!el) return "";
  const suo = String(el.textContent || "").trim();
  if (!suo || suo.length < 4 || /^a$/i.test(el.tagName || "")) {
    el = el.closest?.("aside, li, p, dd, blockquote") || el;
  }
  return pulisciNota(el.textContent);
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

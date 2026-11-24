import { queryRegex } from "./wordForms.js";

// Non si usa il find() di epub.js: cerca alla lettera, e chi scrive «muscle
// in» non troverebbe mai «muscling in». Qui la domanda diventa una
// espressione con tutte le forme flesse e si scorrono i nodi di testo come
// farebbe lui, CFI dal range cosi' il risultato si apre (e si accende) al
// punto giusto.
function cercaNelCapitolo(section, re, results, limit) {
  const doc = section.document;
  if (!doc?.body) return;
  const walker = doc.createTreeWalker(doc.body, 4 /* solo nodi di testo */);
  let node;
  while ((node = walker.nextNode()) && results.length < limit) {
    const text = node.textContent;
    if (!text || !text.trim()) continue;
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      try {
        const range = doc.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const a = Math.max(0, m.index - 55);
        const b = Math.min(text.length, m.index + m[0].length + 55);
        results.push({
          cfi: section.cfiFromRange(range),
          excerpt:
            (a > 0 ? "…" : "") + text.slice(a, b).replace(/\s+/g, " ").trim() + (b < text.length ? "…" : ""),
        });
      } catch {
        /* range fuori misura: si passa al prossimo */
      }
      if (results.length >= limit) break;
    }
  }
}

export async function searchBook(book, query, limit = 60) {
  const results = [];
  const re = queryRegex(query);
  if (!re) return results;
  for (const item of book.spine.spineItems) {
    if (results.length >= limit) break;
    try {
      await item.load(book.load.bind(book));
      cercaNelCapitolo(item, re, results, limit);
    } catch {
      /* capitolo illeggibile: si continua con gli altri */
    } finally {
      item.unload();
    }
  }
  return results;
}

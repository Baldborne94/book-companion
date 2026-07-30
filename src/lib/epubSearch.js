export async function searchBook(book, query, limit = 60) {
  const results = [];
  for (const item of book.spine.spineItems) {
    if (results.length >= limit) break;
    try {
      await item.load(book.load.bind(book));
      results.push(...item.find(query).slice(0, limit - results.length));
    } catch {
      /* capitolo illeggibile: si continua con gli altri */
    } finally {
      item.unload();
    }
  }
  return results;
}

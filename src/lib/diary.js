const GIORNO = 24 * 60 * 60 * 1000;

export const dayCount = (from, to) => Math.max(1, Math.round((to - from) / GIORNO));

// Un anno di letture: i libri finiti raccolti per anno di fine, dal piu'
// recente. La durata si calcola solo dove c'e' anche la data d'inizio —
// i libri finiti prima che il diario esistesse ne sono privi e restano
// senza, invece di mostrare numeri inventati.
export function buildDiary(books, dates) {
  const done = [];
  const reading = [];
  for (const b of books) {
    const { started, finished, status } = dates(b.id);
    if (finished) done.push({ book: b, started, finished, days: started ? dayCount(started, finished) : null });
    else if (status === "reading" && started) reading.push({ book: b, started });
  }
  done.sort((a, b) => b.finished - a.finished);
  reading.sort((a, b) => b.started - a.started);

  const years = [];
  for (const e of done) {
    const y = new Date(e.finished).getFullYear();
    const last = years[years.length - 1];
    if (last && last.year === y) last.entries.push(e);
    else years.push({ year: y, entries: [e] });
  }
  return { years, reading, total: done.length };
}

export function yearStats(entries) {
  const withDays = entries.filter((e) => e.days != null);
  const media = withDays.length
    ? Math.round(withDays.reduce((s, e) => s + e.days, 0) / withDays.length)
    : null;
  // con un libro solo non c'e' un "piu' veloce": sarebbe lo stesso libro
  const veloce = withDays.length > 1
    ? withDays.reduce((a, b) => (b.days < a.days ? b : a))
    : null;
  return { libri: entries.length, media, veloce };
}

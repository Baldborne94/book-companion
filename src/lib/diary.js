const GIORNO = 24 * 60 * 60 * 1000;

export const dayCount = (from, to) => Math.max(1, Math.round((to - from) / GIORNO));

// Un anno di letture: i libri finiti raccolti per anno di fine, dal piu'
// recente. La durata si calcola solo dove c'e' anche la data d'inizio —
// i libri finiti prima che il diario esistesse ne sono privi e restano
// senza, invece di mostrare numeri inventati.
// E I LETTI SENZA ANNO SONO UN TERZO MUCCHIO.
//
// Da quando «letto» non scrive piu' la data di oggi su un libro che l'app
// non ti ha visto leggere (`lettoQui` in `library.js`), esiste un libro
// finito che non sa dire QUANDO. Contarlo in un anno sarebbe la bugia da
// cui veniamo; lasciarlo fuori del tutto sarebbe peggio ancora — un libro
// che hai letto sparirebbe dal diario e dal conto — quindi sta in un
// mucchio suo, in fondo come i «Volumi soli» dello scaffale, e nel TOTALE
// ci va: «quanti ne hai finiti» e' una domanda a cui lo stato risponde
// gia', mentre «quando» e' un fatto solo se qualcuno l'ha scritto.
export function buildDiary(books, dates) {
  const done = [];
  const reading = [];
  const senzaData = [];
  for (const b of books) {
    const { started, finished, status } = dates(b.id);
    // ABBANDONATO NON E' FINITO. `setStatus` toglie gia' la data di fine
    // quando molli un libro, ma il diario non deve fidarsi di quello solo:
    // un archivio vecchio o un dispositivo rimasto indietro possono avere
    // tutt'e due i segni, e nel dubbio la parola definitiva ce l'ha lo stato.
    if (status === "abandoned") continue;
    if (finished) done.push({ book: b, started, finished, days: started ? dayCount(started, finished) : null });
    else if (status === "read") senzaData.push({ book: b, started: 0, finished: 0, days: null, senza: true });
    else if (status === "reading" && started) reading.push({ book: b, started });
  }
  done.sort((a, b) => b.finished - a.finished);
  reading.sort((a, b) => b.started - a.started);
  // niente date da confrontare: l'unico ordine onesto e' l'alfabeto
  senzaData.sort((a, b) => String(a.book.title || "").localeCompare(String(b.book.title || ""), "it"));

  const years = [];
  for (const e of done) {
    const y = new Date(e.finished).getFullYear();
    const last = years[years.length - 1];
    if (last && last.year === y) last.entries.push(e);
    else years.push({ year: y, entries: [e] });
  }
  return { years, reading, senzaData, total: done.length + senzaData.length };
}

// LA PORTA DEL DIARIO DICE UN NUMERO.
//
// «Quando hai cominciato e finito ogni libro, anno per anno» descrive la
// stanza e non dice niente di TUO: il conto l'app ce l'ha gia' — lo mostra
// dentro — e sull'Ingresso restava un cartello. Una porta che porta il suo
// numero e' una risposta.
//
// PRIMA L'ANNO IN CORSO, che e' la domanda che uno si fa davvero; a gennaio
// — o su chi quest'anno non ha ancora chiuso niente — si ripiega sul totale
// invece di tacere, perche' «23 libri finiti» e' comunque suo. E gli zeri
// non si dicono: chi non ha finito niente tiene la descrizione di sempre,
// o la porta scriverebbe «0 libri» a ogni apertura e si imparerebbe a non
// leggerla — proprio il giorno che il numero arriva.
export function rigaDiario(diario, anno = new Date().getFullYear(), obiettivo = 0) {
  const quest = diario?.years?.find((y) => y.year === anno)?.entries?.length || 0;
  // con un obiettivo la porta dice a che punto sei, anche a zero: «0 di 24»
  // a gennaio e' l'obiettivo appena scelto, non un conto vuoto da tacere
  if (obiettivo > 0) return `${quest} di ${obiettivo} libri quest'anno`;
  if (quest) return `Quest'anno hai finito ${quest} ${quest === 1 ? "libro" : "libri"}`;
  const tutti = diario?.total || 0;
  if (tutti) return `${tutti} ${tutti === 1 ? "libro finito" : "libri finiti"} in tutto`;
  return null;
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

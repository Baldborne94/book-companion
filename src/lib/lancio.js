// L'APP SI APRE ANCHE DA FUORI. Due porte, tutt'e due dichiarate nel
// manifest e servite qui:
//
// - le SCORCIATOIE (tenere premuta l'icona → «Libreria», «Musica»): arrivano
//   come `/?apri=libreria`, e la sezione si sceglie prima del primo render;
// - «APRI CON» (un ePub scaricato da Chrome, ricevuto su Telegram): il
//   sistema apre l'app e le passa il file per `window.launchQueue`, e il
//   file entra dalla stessa porta dell'input della Libreria.
//
// Le due funzioni sono pure apposta: la lettura dell'URL e la raccolta dei
// file da un `LaunchParams` sbagliano in silenzio — una sezione che non
// esiste lascia l'ingresso, un handle non letto è un libro che non entra
// senza un errore che lo dica — e così si provano con dei finti.

// i nomi che stanno negli URL sono italiani (li vede chi guarda la barra
// degli indirizzi), gli id delle sezioni no
const NOMI = { ingresso: "home", libreria: "library", musica: "music" };

export function sezioneDaUrl(search, sezioni = []) {
  let apri;
  try {
    apri = new URLSearchParams(search || "").get("apri");
  } catch {
    return null;
  }
  if (!apri) return null;
  const id = NOMI[apri.toLowerCase()] || apri;
  return sezioni.some((s) => s?.id === id) ? id : null;
}

// Da un `LaunchParams` ai `File` veri: gli handle si aprono uno per uno e
// quello che non si apre si salta, o un file rotto in una condivisione di
// tre bloccherebbe anche gli altri due.
export async function fileDaLancio(params) {
  const handles = Array.isArray(params?.files) ? params.files : [];
  const out = [];
  for (const h of handles) {
    try {
      const f = await h?.getFile?.();
      if (f) out.push(f);
    } catch {
      /* un handle che non si apre non e' un libro */
    }
  }
  return out;
}

// Lo stesso URL letto due volte aprirebbe due volte la stessa sezione: dopo
// averlo servito si ripulisce, tenendo lo `state` — è lì che `indietro.js`
// segna la sua guardia, e cancellarlo le farebbe perdere il segno.
export function pulisciUrl(win = globalThis) {
  try {
    const h = win.history;
    const l = win.location;
    if (!h?.replaceState || !l) return;
    if (!l.search) return;
    h.replaceState(h.state, "", l.pathname || "/");
  } catch {
    /* senza history non c'e' niente da pulire */
  }
}

import { putFile, putCover, listFileIds, putTrack } from "./bookStore.js";
import { loadBooks, saveBooks, setProgress, setStatus, touchBook, clearTombstones, setDates } from "./library.js";
import { setCfi, saveMarks, saveHighlights } from "./annotations.js";
import { setBookMusic, getFavoritesRaw, saveFavorites, getListsRaw, saveLists } from "./music.js";
import { tuttiIGlossari, fondi, scriviGlossari, quantiTermini } from "./glossarioMio.js";

// Come per i libri: quello che c'e' gia' resta, dall'archivio si prende
// solo cio' che manca. Una melodia si riconosce dal suo id.
export function planMelodie(archivio = [], locali = []) {
  const noti = new Set(locali.map((f) => f.id));
  return archivio.filter((f) => f?.id && !noti.has(f.id));
}

// Ripristinare non e' sovrascrivere: quello che c'e' gia' sul dispositivo
// e' presumibilmente piu' fresco dell'archivio e resta com'e'. Dall'archivio
// si prende cio' che manca — i libri spariti e i file mai scaricati.
export function planRestore({ archiveBooks = [], localBooks = [], localFileIds = new Set() }) {
  const known = new Set(localBooks.map((b) => b.id));
  const add = [];
  const fill = [];
  const kept = [];
  for (const b of archiveBooks) {
    if (!b?.id) continue;
    if (!known.has(b.id)) add.push(b);
    else {
      kept.push(b);
      if (!localFileIds.has(b.id)) fill.push(b);
    }
  }
  return { add, fill, kept };
}

const stripState = (b) => {
  const { progress, status, started, finished, cfi, marks, highlights, music, file, cover, ...meta } = b;
  return meta;
};

// gli archivi v1 non dichiaravano il percorso: si riconosce dal suffisso
const findFile = (zip, book) => {
  if (book.file && zip.file(book.file)) return zip.file(book.file);
  const tail = `-${book.id.slice(0, 8)}.${book.fileType || "epub"}`;
  return zip.file(new RegExp(`^libri/.*${tail.replace(/\./g, "\\.")}$`))[0] || null;
};

async function apri(archive) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(archive);
  const manifest = zip.file("biblioteca.json");
  if (!manifest) throw new Error("Non sembra un archivio di Book Companion");
  let data;
  try {
    data = JSON.parse(await manifest.async("string"));
  } catch {
    throw new Error("L'indice dell'archivio è illeggibile");
  }
  if (data?.app !== "book-companion" || !Array.isArray(data.books)) {
    throw new Error("Non sembra un archivio di Book Companion");
  }
  return { zip, data };
}

// SBIRCIARE PRIMA DI APRIRE. Un archivio e' un blocco unico e finora
// entrava tutto senza chiedere: chi voleva solo i libri si ritrovava in
// casa anche le melodie, e viceversa. Qui si legge il solo indice — nessun
// byte estratto, nessuna scrittura — per poter dire cosa c'e' dentro e
// lasciar scegliere.
export async function sbircia(archive) {
  const { data } = await apri(archive);
  return {
    libri: data.books.length,
    melodie: Array.isArray(data.melodie) ? data.melodie.length : 0,
    raccolte: Array.isArray(data.raccolte) ? data.raccolte.length : 0,
    termini: quantiTermini(data.glossari),
    // gli archivi v1 non portavano segnalibri ed evidenziazioni: si dice
    // prima, non dopo aver ripristinato
    parziale: !(data.version >= 2),
  };
}

// `cosa` dice quali meta' prendere. Le raccolte seguono le melodie: sono
// nomi ed elenchi di id di brani, e senza i brani non suonerebbero.
export async function restoreLibrary(archive, { onProgress, cosa } = {}) {
  const prendi = { libri: true, melodie: true, ...(cosa || {}) };
  const say = (m) => onProgress?.(m);

  say("Apro l'archivio…");
  const { zip, data } = await apri(archive);

  const localBooks = loadBooks();
  const localFileIds = new Set(await listFileIds().catch(() => []));
  const { add, fill, kept } = prendi.libri
    ? planRestore({ archiveBooks: data.books, localBooks, localFileIds })
    : { add: [], fill: [], kept: [] };

  let restoredFiles = 0;
  const next = [...localBooks];

  for (const b of [...add, ...fill]) {
    say(`Ripristino «${b.title || "senza titolo"}»…`);
    const entry = findFile(zip, b);
    if (entry) {
      await putFile(b.id, await entry.async("blob"));
      restoredFiles++;
    }
    if (b.cover && zip.file(b.cover)) {
      await putCover(b.id, await zip.file(b.cover).async("blob"));
    }
  }

  for (const b of add) {
    next.push(stripState(b));
    setProgress(b.id, b.progress || 0);
    setStatus(b.id, b.status || "unread");
    if (b.started || b.finished) setDates(b.id, { started: b.started, finished: b.finished });
    if (b.cfi) setCfi(b.id, b.cfi);
    if (Array.isArray(b.marks) && b.marks.length) saveMarks(b.id, b.marks);
    if (Array.isArray(b.highlights) && b.highlights.length) saveHighlights(b.id, b.highlights);
    if (b.music) setBookMusic(b.id, b.music);
    touchBook(b.id);
  }

  if (add.length) saveBooks(next);
  // un libro cancellato ha lasciato una lapide: senza toglierla, la prima
  // sincronizzazione lo cancellerebbe di nuovo
  if (add.length) clearTombstones(add.map((b) => b.id));

  const localiMel = getFavoritesRaw();
  const nuoveMel = prendi.melodie
    ? planMelodie(Array.isArray(data.melodie) ? data.melodie : [], localiMel)
    : [];
  let melodieRipristinate = 0;
  for (const f of nuoveMel) {
    const { track, ...voce } = f;
    if (track && zip.file(track)) {
      say(`Ripristino «${voce.name || "una melodia"}»…`);
      await putTrack(voce.trackId, await zip.file(track).async("blob"));
      melodieRipristinate++;
    } else if (voce.trackId) {
      // il preferito c'e' ma i byte no: meglio non lasciare in elenco una
      // melodia che non suonerebbe
      continue;
    }
    localiMel.push(voce);
  }
  if (nuoveMel.length) saveFavorites(localiMel);

  // le raccolte sono solo nomi ed elenchi di id: nessun byte da ripristinare,
  // e i brani che qui non esistono li salta gia' `braniDi`
  const localiRac = getListsRaw();
  const nuoveRac = prendi.melodie
    ? planMelodie(Array.isArray(data.raccolte) ? data.raccolte : [], localiRac)
    : [];
  if (nuoveRac.length) saveLists([...localiRac, ...nuoveRac]);

  // I termini scritti a mano seguono i libri: sono voci di glossario di una
  // saga, non musica. Quello che e' gia' qui resta com'e' — puo' essere una
  // correzione fatta ieri — e dall'archivio si prende solo cio' che manca.
  let termini = 0;
  if (prendi.libri && data.glossari) {
    const esito = fondi(tuttiIGlossari(), data.glossari);
    if (esito.nuove) {
      scriviGlossari(esito.glossari);
      termini = esito.nuove;
    }
  }

  return {
    added: add.length,
    kept: kept.length,
    files: restoredFiles,
    melodie: melodieRipristinate,
    raccolte: nuoveRac.length,
    termini,
    books: loadBooks(),
    partial: !(data.version >= 2),
  };
}

import { putFile, putCover, listFileIds, putTrack } from "./bookStore.js";
import { loadBooks, saveBooks, setProgress, setStatus, touchBook, clearTombstones, setDates } from "./library.js";
import { setCfi, saveMarks, saveHighlights } from "./annotations.js";
import { setBookMusic, getFavoritesRaw, saveFavorites, getListsRaw, saveLists } from "./music.js";
import { tuttiIGlossari, fondi, scriviGlossari, quantiTermini } from "./glossarioMio.js";
import { contaDiario, ripristinaDiario } from "./archivioDiario.js";
import { sbirciaFile, unisciSbirciate, sorgente, frasePezzi } from "./archivioPezzi.js";

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
    if (!known.has(b.id)) {
      add.push(b);
      // lo stesso id due volte nell'archivio entrava due volte, cioe' due
      // schede con lo stesso id in biblioteca (preso dal test)
      known.add(b.id);
    } else {
      kept.push(b);
      if (!localFileIds.has(b.id)) fill.push(b);
    }
  }
  return { add, fill, kept };
}

const stripState = (b) => {
  const { progress, status, started, finished, cfi, marks, highlights, music, file, cover, grezzo, pezzo, ...meta } = b;
  return meta;
};

// IL RIPRISTINO PRENDE PIU' FILE (lib/archivioPezzi.js). Un archivio puo'
// essere a pezzi: si sceglie tutto insieme e ogni file dice chi e'. Si
// legge a fette (`apriZip`) anche lo zip di sempre — prima JSZip lo
// caricava intero, e un vecchio archivio da due giga chiudeva la scheda.
// un file solo, o i byte di uno (i test, e chi li ha gia' in mano), valgono
// come un elenco di uno; un FileList come un elenco
const unoSolo = (x) => x instanceof Blob || x instanceof ArrayBuffer || ArrayBuffer.isView(x);
const comeElenco = (x) => (!x ? [] : unoSolo(x) ? [x] : Array.isArray(x) ? x : typeof x.length === "number" ? [...x] : [x]);

export async function sbircia(files) {
  const sbirciate = [];
  // come faceva JSZip, si accetta anche la promessa dei byte
  for (const f of comeElenco(await files)) sbirciate.push(await sbirciaFile(await f));
  const insieme = unisciSbirciate(sbirciate);
  if (insieme.senzaIndice) {
    // un nostro indice rotto e' un guasto con un nome suo: dirlo come «non
    // e' un archivio» manderebbe a cercare un altro file
    const rotto = sbirciate.find((s) => /illeggibile/.test(s?.errore || ""));
    if (rotto) throw new Error(rotto.errore);
    throw new Error(
      insieme.grezzi
        ? "Manca un pezzo .zip dell'archivio: è quello che dice di chi sono gli altri file"
        : "Non sembra un archivio di Book Companion"
    );
  }
  const data = insieme.data;
  return {
    insieme,
    libri: data.books.length,
    melodie: Array.isArray(data.melodie) ? data.melodie.length : 0,
    raccolte: Array.isArray(data.raccolte) ? data.raccolte.length : 0,
    termini: quantiTermini(data.glossari),
    // null su un archivio senza diario (fino alla v4) o col diario vuoto
    diario: contaDiario(data.diario),
    // gli archivi v1 non portavano segnalibri ed evidenziazioni: si dice
    // prima, non dopo aver ripristinato
    parziale: !(data.version >= 2),
    pezzi: frasePezzi(insieme),
    // l'archivio che va su Drive da solo: niente byte, e il pannello lo dice
    soloSchede: !!data.soloSchede,
    quando: data.exportedAt || null,
    estranei: insieme.estranei,
  };
}

// I byte di un libro: dal suo grezzo, o dallo zip che lo tiene. Gli
// archivi v1 non dichiaravano il percorso: si riconosce dal suffisso.
async function byteDelLibro(src, book) {
  if (book.grezzo) return src.grezzo(book.pezzo) || null;
  if (book.file && src.nomi.includes(book.file)) return src.zip(book.file);
  const coda = `-${book.id.slice(0, 8)}.${book.fileType || "epub"}`;
  const trovato = src.nomi.find((n) => n.startsWith("libri/") && n.endsWith(coda));
  return trovato ? src.zip(trovato) : null;
}

// `cosa` dice quali meta' prendere. Le raccolte seguono le melodie: sono
// nomi ed elenchi di id di brani, e senza i brani non suonerebbero.
export async function restoreLibrary(archivio, { onProgress, cosa } = {}) {
  const prendi = { libri: true, melodie: true, diario: true, ...(cosa || {}) };
  const say = (m) => onProgress?.(m);

  say("Apro l'archivio…");
  const insieme = archivio?.insieme || (await sbircia(archivio)).insieme;
  const { data } = insieme;
  const src = sorgente(insieme);

  const localBooks = loadBooks();
  const localFileIds = new Set(await listFileIds().catch(() => []));
  const { add, fill, kept } = prendi.libri
    ? planRestore({ archiveBooks: data.books, localBooks, localFileIds })
    : { add: [], fill: [], kept: [] };

  let restoredFiles = 0;
  // i libri il cui file sta in un pezzo che non hai scelto: entrano lo
  // stesso (scheda, segni, punto di lettura) e il file lo porta il pezzo
  // mancante, scelto dopo — `fill` riempie proprio questo buco
  let senzaFile = 0;
  const next = [...localBooks];

  for (const b of [...add, ...fill]) {
    say(`Ripristino «${b.title || "senza titolo"}»…`);
    const blob = await byteDelLibro(src, b);
    if (blob) {
      await putFile(b.id, blob);
      restoredFiles++;
    } else if (b.file || b.grezzo) senzaFile++;
    if (b.cover && src.nomi.includes(b.cover)) {
      await putCover(b.id, await src.zip(b.cover));
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
    const { track, trackGrezzo, pezzo, ...voce } = f;
    const blob = trackGrezzo ? src.grezzo(pezzo) : track && src.nomi.includes(track) ? await src.zip(track) : null;
    if (blob) {
      say(`Ripristino «${voce.name || "una melodia"}»…`);
      await putTrack(voce.trackId, blob);
      melodieRipristinate++;
    } else if (voce.trackId && !voce.drive) {
      // il preferito c'e' ma i byte no: meglio non lasciare in elenco una
      // melodia che non suonerebbe. Una melodia di Drive i byte li ha
      // lassu', e scende quando la suoni.
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

  // Il diario ha la sua casella: non e' fatto di libri ne' di musica, e chi
  // riporta dentro i soli libri di un vecchio archivio puo' non volere il
  // tempo di lettura di allora mescolato a quello di adesso.
  const diario = prendi.diario && data.diario ? ripristinaDiario(data.diario) : null;

  return {
    added: add.length,
    diario,
    kept: kept.length,
    files: restoredFiles,
    senzaFile,
    melodie: melodieRipristinate,
    raccolte: nuoveRac.length,
    termini,
    books: loadBooks(),
    partial: !(data.version >= 2),
  };
}

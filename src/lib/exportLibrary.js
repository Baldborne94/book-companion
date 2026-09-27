import { getFile, getCover } from "./bookStore.js";
import { loadBooks, getProgress, getStatus, getStarted, getFinished } from "./library.js";
import { getCfi, getMarks, getHighlights } from "./annotations.js";
import { getBookMusic, getFavoritesRaw, getListsRaw, isFile, loadTrack } from "./music.js";
import { tuttiIGlossari } from "./glossarioMio.js";
import { diarioPerArchivio } from "./archivioDiario.js";
import { pianoPezzi, nomePezzo, mappaPezzi, costruisciPezzo } from "./archivioPezzi.js";

// v1 conteneva solo metadati e file: un ripristino avrebbe perso segnalibri,
// evidenziazioni e punto di lettura. Da v2 l'archivio si basta da solo.
// Da v3 porta anche le melodie: da quando la musica di sottofondo puo'
// essere un file tuo, quei byte esistono solo qui dentro e in IndexedDB —
// un archivio che li lasciasse fuori non sarebbe piu' un archivio completo.
// Da v4 porta anche i termini che il lettore ha scritto nel suo glossario:
// se li scrivi a mano e il backup non li porta con se', te ne accorgi il
// giorno che ripristini — cioe' il giorno peggiore.
// Da v5 porta anche il diario: quaderno delle parole, lista «Da prendere»,
// tempo di lettura, obiettivo dell'anno e racconti spuntati — viaggiavano
// nel cloud e non qui, e chi si affidava al solo archivio li perdeva.
export const ARCHIVE_VERSION = 5;

// DA QUANTO NON FAI UN ARCHIVIO.
//
// L'avviso sulla persistenza dice uno STATO («il browser può liberare
// questi dati»); non dice da quanto tempo non c'e' una copia al sicuro. Se
// il browser ha negato la persistenza e il tuo ultimo zip e' di marzo,
// l'app lo sa e non te lo diceva. Qui il conto si tiene, e la riga esce
// accanto al tasto che risolve — che e' «Esporta biblioteca».
const ULTIMO_KEY = "bc_last_export";
const GIORNO = 86400000;

export function ultimoArchivio() {
  const v = parseInt(localStorage.getItem(ULTIMO_KEY), 10);
  return Number.isFinite(v) ? v : 0;
}

// «4 mesi fa» dice quello che «118 giorni fa» non dice: che e' tanto.
export function daQuanto(giorni) {
  if (giorni < 14) return `${Math.floor(giorni)} giorni fa`;
  if (giorni < 30) return `${Math.floor(giorni / 7)} settimane fa`;
  const mesi = Math.floor(giorni / 30.4);
  if (mesi <= 1) return "un mese fa";
  if (mesi < 12) return `${mesi} mesi fa`;
  const anni = Math.floor(giorni / 365);
  return anni <= 1 ? "più di un anno fa" : `più di ${anni} anni fa`;
}

// Il promemoria non e' un assillo: sotto la soglia tace del tutto. La
// soglia pero' e' DUE, e la seconda e' la ragione per cui tutto questo
// esiste — a persistenza negata i byte stanno in una memoria che il
// browser puo' sfrattare, e un mese di silenzio e' troppo.
export function promemoriaArchivio({ ultimo = 0, ora = Date.now(), roba = 0, persistenza = "sconosciuta" } = {}) {
  // una biblioteca vuota non ha niente da perdere
  if (!roba) return null;
  if (!ultimo) return "Non hai mai fatto un archivio di questa biblioteca.";
  const giorni = (ora - ultimo) / GIORNO;
  if (giorni < (persistenza === "negata" ? 7 : 30)) return null;
  return `L'ultimo archivio è di ${daQuanto(giorni)}.`;
}

const safeName = (s) =>
  (s || "senza-titolo").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 60) || "senza-titolo";

// l'estensione di una melodia dal suo tipo: un grezzo esce col nome che il
// telefono sa aprire, non con un «.bin» che nessuno riconosce
const EXT_AUDIO = { mpeg: "mp3", mp3: "mp3", mp4: "m4a", "x-m4a": "m4a", aac: "aac", ogg: "ogg", opus: "opus", wav: "wav", "x-wav": "wav", flac: "flac", webm: "webm" };
export const estensioneAudio = (mime) => EXT_AUDIO[String(mime || "").split("/")[1]?.toLowerCase()] || "bin";

export function segnaArchivio(ora = Date.now()) {
  // La data si segna quando l'ultimo pezzo e' partito, che e' il piu' in
  // la' dove arriviamo: dove il file sia andato a finire dopo il click il
  // browser non ce lo dice, e fingere di saperlo sarebbe peggio che segnare
  // il tentativo. Un archivio a meta' non e' un archivio.
  try {
    localStorage.setItem(ULTIMO_KEY, String(ora));
  } catch {}
}

function scaricaBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  // un grezzo da un giga ci mette a partire: il link si tiene vivo a lungo
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}

// L'ARCHIVIO SI PREPARA, POI SI SCARICA A PEZZI (lib/archivioPezzi.js).
// Qui si raccoglie tutto — i byte restano in IndexedDB, si tengono solo i
// riferimenti — e si decide la spartizione; ogni pezzo si costruisce solo
// quando lo si chiede. Una biblioteca piccola resta UN pezzo col nome di
// sempre, e l'archivio e' identico a prima.
// `misure` serve ai test: con le soglie vere servirebbe un file da 50 MB.
export async function preparaArchivio(misure) {
  const books = loadBooks();
  const manifest = [];
  const voci = [];
  const byte = new Map();

  for (const b of books) {
    const entry = {
      ...b,
      progress: getProgress(b.id),
      status: getStatus(b.id),
      started: getStarted(b.id),
      finished: getFinished(b.id),
      cfi: getCfi(b.id),
      marks: getMarks(b.id),
      highlights: getHighlights(b.id),
      music: getBookMusic(b.id),
    };
    const blob = await getFile(b.id);
    if (blob) {
      entry.file = `libri/${safeName(b.title)}-${b.id.slice(0, 8)}.${b.fileType}`;
      byte.set(entry.file, blob);
      voci.push({ specie: "libro", id: b.id, byte: blob.size, nome: b.title, ext: b.fileType, percorso: entry.file, voce: entry });
    }
    const cover = await getCover(b.id);
    if (cover) {
      entry.cover = `copertine/${b.id}.bin`;
      byte.set(entry.cover, cover);
      voci.push({ specie: "copertina", id: b.id, byte: cover.size || 0, percorso: entry.cover });
    }
    manifest.push(entry);
  }

  const melodie = [];
  let melodieConByte = 0;
  for (const f of getFavoritesRaw()) {
    const voce = { ...f };
    if (isFile(f) && !f.deleted) {
      const blob = await loadTrack(f.trackId).catch(() => null);
      if (blob) {
        voce.track = `melodie/${f.trackId}.bin`;
        byte.set(voce.track, blob);
        voci.push({ specie: "melodia", id: f.id, byte: blob.size, nome: f.name, ext: estensioneAudio(f.mime || blob.type), percorso: voce.track, voce });
        melodieConByte++;
      }
    }
    melodie.push(voce);
  }

  const ora = new Date();
  const data = ora.toISOString().slice(0, 10);
  const piano = pianoPezzi(voci, misure);
  // un grezzo non sta in uno zip: la voce dell'indice lo dice per nome
  for (const p of piano.pezzi) {
    if (p.tipo !== "grezzo") continue;
    const v = p.voci[0];
    const nome = nomePezzo({ data, n: p.n, di: p.di, tipo: "grezzo", voce: v });
    const campo = v.specie === "melodia" ? "track" : "file";
    delete v.voce[campo];
    v.voce[v.specie === "melodia" ? "trackGrezzo" : "grezzo"] = nome;
    v.voce.pezzo = p.n;
  }

  const indice = {
    app: "book-companion",
    version: ARCHIVE_VERSION,
    exportedAt: ora.toISOString(),
    books: manifest,
    melodie,
    raccolte: getListsRaw(),
    glossari: tuttiIGlossari(),
    diario: diarioPerArchivio(),
    ...(piano.di > 1 ? { pezzi: mappaPezzi(piano, data) } : {}),
  };

  return {
    piano,
    libri: books.length,
    melodie: melodieConByte,
    nome: (n) => nomePezzo({ data, ...piano.pezzi[n - 1], voce: piano.pezzi[n - 1].voci[0] }),
    async scarica(n) {
      const pezzo = piano.pezzi[n - 1];
      const nome = nomePezzo({ data, ...pezzo, voce: pezzo.voci[0] });
      if (pezzo.tipo === "grezzo") {
        // il Blob di IndexedDB si scarica com'e': non passa dalla memoria
        const blob = byte.get(pezzo.voci[0].percorso);
        if (!blob) throw new Error("Il file non c'è più su questo dispositivo");
        scaricaBlob(blob, nome);
        return;
      }
      const { default: JSZip } = await import("jszip");
      const out = await costruisciPezzo({ pezzo, indice, JSZip, leggi: (v) => byte.get(v.percorso) || null });
      scaricaBlob(out, nome);
    },
  };
}

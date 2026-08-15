import { putFile, putCover } from "./bookStore.js";
import { riconosci } from "./sagaBooks.js";

// oltre questa taglia il libro non si ricuce: tenere in memoria due
// copie dell'archivio, su un tablet, vale piu' di qualche pagina bianca
const TROPPO_GROSSO = 80 * 1024 * 1024;

export async function importFiles(fileList) {
  const added = [];
  const errors = [];
  let cuciti = 0;
  // Quello che l'import faceva in silenzio. Il piu' importante non e' il
  // numero dei libri: e' quante volte i METADATI non si sono letti, perche'
  // allora il titolo resta il nome del file — e da un titolo sbagliato non
  // si riconosce la saga, non parte il glossario, e «Prima di cominciare»
  // non sa cosa viene prima. Prima lo scoprivi settimane dopo.
  let riconosciuti = 0;
  let senzaMetadati = 0;
  let senzaCopertina = 0;
  for (const file of Array.from(fileList)) {
    const lower = file.name.toLowerCase();
    const fileType = lower.endsWith(".epub") ? "epub" : lower.endsWith(".pdf") ? "pdf" : null;
    if (!fileType) {
      errors.push({ name: file.name, reason: "formato non supportato" });
      continue;
    }
    const id = crypto.randomUUID();
    // I PEZZI SI RICUCIONO ALL'INGRESSO. Un ePub spezzato in piu'
    // documenti lascia una facciata bianca a ogni giuntura, in mezzo a
    // una scena: qui il libro entra gia' intero. Si fa SOLO ora, perche'
    // cambia i CFI e su un libro gia' letto sposterebbe segnalibri,
    // evidenziazioni e punto di lettura.
    let daSalvare = file;
    if (fileType === "epub" && file.size <= TROPPO_GROSSO) {
      try {
        const { unisciPezzi } = await import("./unisciEpub.js");
        const cucito = await unisciPezzi(file);
        if (cucito?.blob) {
          daSalvare = cucito.blob;
          cuciti += cucito.cuciti;
        }
      } catch {
        /* libro che non si lascia ricucire: entra com'e', con le sue giunture */
      }
    }
    try {
      await putFile(id, daSalvare);
    } catch {
      errors.push({ name: file.name, reason: "salvataggio fallito" });
      continue;
    }
    const meta = {
      id,
      title: file.name.replace(/\.(epub|pdf)$/i, ""),
      author: "",
      series: "",
      fileType,
      addedAt: Date.now(),
      rating: 0,
      notes: "",
    };
    let letto = null;
    try {
      letto = fileType === "epub" ? await enrichEpub(meta, daSalvare) : await enrichPdf(meta, file);
    } catch {
      /* estrazione fallita: il libro resta col filename come titolo */
    }
    if (!letto?.titolo) senzaMetadati += 1;
    if (!letto?.copertina) senzaCopertina += 1;
    // saga e numero d'ordine dal titolo, senza chiederli a mano: e' quello
    // che accende il glossario e fa funzionare il «prossimo della saga»
    const saga = riconosci({ title: meta.title, author: meta.author, fileName: file.name });
    if (saga) {
      riconosciuti += 1;
      meta.saga = saga.saga;
      if (saga.sagaOrder != null) meta.sagaOrder = saga.sagaOrder;
      // il CICLO era riconosciuto e poi buttato via. E' l'informazione che
      // dice quale storia continua un volume: nel Mondo Disco «cosa e'
      // successo prima» sono le Guardie, non tutti e quarantuno i romanzi.
      if (saga.ciclo && !meta.series) meta.series = saga.ciclo;
    }
    added.push(meta);
  }
  return { added, errors, cuciti, riconosciuti, senzaMetadati, senzaCopertina };
}

// IL RESOCONTO DELL'IMPORT, in una riga sola.
//
// L'app faceva parecchie cose in silenzio: ricuciva i libri spezzati,
// riconosceva la saga, ripiegava sul nome del file quando i metadati non
// si leggevano. Quando una andava storta te ne accorgevi settimane dopo,
// da una saga che non si accendeva o da un titolo assurdo sullo scaffale.
//
// L'ordine e' quello dell'importanza per chi legge: prima cosa e' entrato,
// poi cosa abbiamo aggiustato, poi cosa NON siamo riusciti a leggere —
// perche' quest'ultima e' l'unica su cui c'e' qualcosa da fare (aprire la
// scheda e scrivere titolo e autore a mano).
export function resoconto({ added = [], errors = [], cuciti = 0, riconosciuti = 0, senzaMetadati = 0 } = {}) {
  const parti = [];
  if (added.length)
    parti.push(added.length === 1 ? "Un nuovo tomo sullo scaffale ✨" : `${added.length} nuovi tomi sullo scaffale ✨`);
  // se il libro arrivava a pezzi vale la pena dirlo: spiega perche' adesso
  // il testo scorre dove prima c'erano facciate bianche
  if (cuciti) parti.push(cuciti === 1 ? "un pezzo ricucito 🪡" : `${cuciti} pezzi ricuciti 🪡`);
  if (riconosciuti)
    parti.push(riconosciuti === 1 ? "una saga riconosciuta 🔖" : `${riconosciuti} saghe riconosciute 🔖`);
  if (senzaMetadati)
    parti.push(
      senzaMetadati === 1
        ? "un titolo preso dal nome del file — controllalo nella scheda"
        : `${senzaMetadati} titoli presi dal nome del file — controllali nella scheda`
    );
  for (const e of errors) parti.push(`«${e.name}»: ${e.reason}`);
  return parti.join(" · ") || "Nessun file importato";
}

async function enrichEpub(meta, file) {
  const { default: ePub } = await import("epubjs");
  const book = ePub(await file.arrayBuffer());
  const esito = { titolo: false, copertina: false };
  try {
    const md = await book.loaded.metadata;
    if (md?.title?.trim()) {
      meta.title = md.title.trim();
      esito.titolo = true;
    }
    if (md?.creator?.trim()) meta.author = md.creator.trim();
    let cover = null;
    const coverPath = await book.loaded.cover;
    if (coverPath && book.archive) cover = await book.archive.getBlob(coverPath);
    if (!cover) {
      const url = await book.coverUrl();
      if (url) cover = await (await fetch(url)).blob();
    }
    if (cover) {
      await putCover(meta.id, cover);
      esito.copertina = true;
    }
  } finally {
    book.destroy();
  }
  return esito;
}

async function enrichPdf(meta, file) {
  const { renderPdfThumb } = await import("./pdfThumb.js");
  const thumb = await renderPdfThumb(await file.arrayBuffer());
  if (thumb) await putCover(meta.id, thumb);
  // un PDF il titolo non lo dichiara quasi mai: il nome del file e' la
  // norma, non un guasto, e non va contato fra i silenzi da segnalare
  return { titolo: true, copertina: !!thumb };
}

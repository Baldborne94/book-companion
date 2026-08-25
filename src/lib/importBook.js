import { putFile, putCover } from "./bookStore.js";
import { riconosci } from "./sagaBooks.js";
import { dalMetadata } from "./sinossi.js";

// oltre questa taglia il libro non si ricuce: tenere in memoria due
// copie dell'archivio, su un tablet, vale piu' di qualche pagina bianca
const TROPPO_GROSSO = 80 * 1024 * 1024;

// I DOPPIONI. L'id di un libro e' un `randomUUID`, quindi lo STESSO file
// importato due volte faceva due libri distinti: due punti di lettura, due
// scaffali di evidenziazioni, due voci nel diario — e nessuno lo diceva.
// Succede piu' spesso di quanto sembri: un archivio vecchio ripristinato,
// un file ricaricato «per sicurezza», un cambio di dispositivo.
//
// Si riconosce in due modi, e sono due cose diverse:
//
// (1) L'IMPRONTA DEI BYTE. Un file identico e' identico: qui non c'e'
//     niente da chiedere e niente da guadagnare a tenerne due copie, e il
//     doppione si salta. Si misura sui byte ORIGINALI, non su quelli
//     ricuciti: la ricucitura puo' cambiare da una versione all'altra
//     dell'app, i byte che ti sei scelto no.
//
// (2) TITOLO E AUTORE. Un'altra edizione dello stesso romanzo ha byte
//     diversi e resta un file legittimo — magari e' proprio la copia
//     migliore che stavi cercando. Quello NON si salta: si importa e si
//     DICE, perche' la scelta di tenerne una sola e' tua.
export async function impronta(bytes) {
  const cripto = globalThis.crypto?.subtle;
  if (!cripto || !bytes?.byteLength) return null;
  try {
    const d = await cripto.digest("SHA-256", bytes);
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // senza impronta il libro entra lo stesso: un doppione in piu' e' un
    // fastidio, un libro non importato e' un danno
    return null;
  }
}

export const giaInLibreria = (imp, libri = []) =>
  (imp && libri.find((b) => b?.impronta === imp)) || null;

// IL RIPASSO DELLE IMPRONTE, sui libri che erano gia' qui.
//
// L'impronta si calcola all'import, e basta. Chi aveva la biblioteca
// prima di questa cura ce l'ha vuota su TUTTI i libri — cioe' proprio la
// collezione che si vorrebbe proteggere. Rimettere dentro lo stesso file
// di un romanzo vecchio non lo faceva saltare: il confronto sui byte non
// aveva niente con cui confrontare, e restava solo il sospetto per titolo
// e autore, che si limita a dirtelo.
//
// Stessa forma di ogni passata lunga dell'app (`portaACasa`, la ricerca
// in biblioteca): **un tomo per volta**, perche' aprirne venti insieme su
// un tablet vuol dire tenere in memoria venti romanzi; avanzamento col
// titolo che scende; e il filo `vivo` per fermarla a meta', con quello
// che e' stato fatto che resta fatto.
//
// `leggiByte` arriva da fuori (e' `getFile` di `bookStore`) per la
// ragione di sempre: cosi' un test la chiama con un finto invece di
// tirarsi dietro IndexedDB.
export async function ripassaImpronte(libri = [], { leggiByte, onProgress, vivo } = {}) {
  const attivo = vivo || (() => true);
  const esito = { scritte: 0, senzaByte: 0, illeggibili: 0, fermato: false, campi: {} };
  // solo quelli che non ce l'hanno: chi l'ha gia' non si ri-legge: sono
  // decine di megabyte per un valore che verrebbe identico
  const mancanti = libri.filter((b) => b && !b.impronta);
  for (const [i, b] of mancanti.entries()) {
    if (!attivo()) {
      esito.fermato = true;
      break;
    }
    onProgress?.({ i, totale: mancanti.length, titolo: b.title });
    // UN TOMO RIMASTO NEL CLOUD NON E' UN GUASTO: non ha i byte qui, e
    // scaricare mezza biblioteca per calcolare degli hash sarebbe un
    // prezzo che nessuno ha chiesto di pagare. Si conta e si dice.
    // il `.then` invece di `Promise.resolve(leggiByte(...))` non e' stile:
    // un `leggiByte` che esplode SUBITO — senza tornare una promessa —
    // scavalcherebbe il `catch` e si porterebbe via tutto il giro, insieme
    // alle impronte gia' calcolate. Preso da un test.
    const file = await Promise.resolve()
      .then(() => leggiByte?.(b.id))
      .catch(() => null);
    if (!file) {
      esito.senzaByte += 1;
      continue;
    }
    const imp = await impronta(await file.arrayBuffer().catch(() => null));
    if (!imp) {
      esito.illeggibili += 1;
      continue;
    }
    esito.campi[b.id] = imp;
    esito.scritte += 1;
  }
  return esito;
}

const chiave = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // articoli e punteggiatura non distinguono due edizioni
    .replace(/\b(the|a|an|il|lo|la|i|gli|le|un|uno|una)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// L'autore si confronta a parole ordinate, come in `sagaBooks`: «Abercrombie,
// Joe» e «Joe Abercrombie» sono la stessa persona. E se una delle due copie
// l'autore non ce l'ha, il titolo da solo deve bastare — un ePub senza
// metadati e' proprio il caso in cui il doppione e' piu' probabile.
const chiaveAutore = (a) => chiave(a).split(" ").filter(Boolean).sort().join(" ");

export function sembraGiaLetto({ title, author } = {}, libri = []) {
  const t = chiave(title);
  if (t.length < 3) return null;
  const a = chiaveAutore(author);
  return (
    libri.find((b) => {
      if (chiave(b?.title) !== t) return false;
      const suo = chiaveAutore(b?.author);
      return !a || !suo || suo === a;
    }) || null
  );
}

export async function importFiles(fileList, libri = []) {
  const added = [];
  const errors = [];
  // i due modi di essere un doppione: saltati e segnalati
  const saltati = [];
  const sospetti = [];
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
    // L'impronta si prende PRIMA di salvare: un doppione dei byte non deve
    // nemmeno occupare lo spazio che poi andrebbe liberato. E si confronta
    // anche coi libri entrati in questo stesso giro — la stessa cartella
    // trascinata due volte e' il modo piu' facile di farlo.
    const imp = await impronta(await file.arrayBuffer().catch(() => null));
    const noto = giaInLibreria(imp, [...libri, ...added]);
    if (noto) {
      saltati.push({ name: file.name, title: noto.title });
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
    // il titolo si sa solo adesso: un'altra edizione dello stesso romanzo
    // entra comunque — tenerne una sola e' una scelta tua, non nostra — ma
    // non entra di nascosto
    const gemello = sembraGiaLetto(meta, [...libri, ...added]);
    if (gemello) sospetti.push({ title: meta.title });
    if (imp) meta.impronta = imp;
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
  return { added, errors, saltati, sospetti, cuciti, riconosciuti, senzaMetadati, senzaCopertina };
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
export function resoconto({
  added = [],
  errors = [],
  saltati = [],
  sospetti = [],
  cuciti = 0,
  riconosciuti = 0,
  senzaMetadati = 0,
  senzaCopertina = 0,
} = {}) {
  const parti = [];
  if (added.length)
    parti.push(added.length === 1 ? "Un nuovo tomo sullo scaffale ✨" : `${added.length} nuovi tomi sullo scaffale ✨`);
  // il doppione dei byte si dice SUBITO dopo il conto, perche' e' quello
  // che spiega perche' i tomi entrati sono meno dei file che hai passato
  if (saltati.length)
    parti.push(
      saltati.length === 1
        ? `«${saltati[0].title || saltati[0].name}» era già in libreria, saltato 👯`
        : `${saltati.length} erano già in libreria, saltati 👯`
    );
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
  // LA COPERTINA MANCANTE SI DICE, come il titolo. Era contata e mai
  // mostrata, e un dorso disegnato in mezzo allo scaffale sembra una scelta
  // nostra invece che un file a cui l'immagine non si e' trovata — il
  // lettore ci ha messo settimane ad accorgersene, e ha dovuto dirlo lui.
  // Sta accanto al titolo perche' e' la stessa specie di riga: qualcosa che
  // non siamo riusciti a leggere, e che tu puoi rimettere a mano.
  if (senzaCopertina)
    parti.push(
      senzaCopertina === 1
        ? "un tomo senza copertina — puoi metterla tu dalla scheda 🖼"
        : `${senzaCopertina} tomi senza copertina — puoi metterle tu dalla scheda 🖼`
    );
  // l'altra edizione e' entrata: qui non c'e' un guasto da riparare, c'e'
  // una scelta da fare — tenerle tutt'e due o cancellarne una
  if (sospetti.length)
    parti.push(
      sospetti.length === 1
        ? `«${sospetti[0].title}» sembra già in libreria in un'altra copia — decidi tu`
        : `${sospetti.length} sembrano già in libreria in un'altra copia — decidi tu`
    );
  for (const e of errors) parti.push(`«${e.name}»: ${e.reason}`);
  // «Nessun file importato» resta per il caso in cui non e' successo
  // NIENTE: un doppione saltato la sua riga ce l'ha gia', e dire che non e'
  // stato importato niente senza dire perche' sarebbe una bugia per omissione
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
    // IL RETRO DEL LIBRO era già qui dentro e lo buttavamo via. Costa una
    // riga, non costa rete, e non passa da nessun modello: l'ha scritto
    // l'editore, ed è senza spoiler per mestiere.
    meta.sinossi = dalMetadata(md);
    // Una sola strada per tutt'e due i punti dove serve una copertina:
    // qui all'import e nel tasto ↺ della scheda. Prima erano due copie
    // della stessa logica, e potevano divergere — infatti divergevano.
    const { trovaCopertina } = await import("./copertina.js");
    const cover = await trovaCopertina(book);
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

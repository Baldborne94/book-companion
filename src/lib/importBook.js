import { putFile, getFile, putCover, getCover, removeBookData, removeAux } from "./bookStore.js";
import { getProgress } from "./library.js";
import { getMarks, getHighlights } from "./annotations.js";
import { riconosci, nomeInBiblioteca, chiaveSaga } from "./sagaBooks.js";
import { sagaDalTitolo } from "./sagaDalTitolo.js";
import { dalMetadata } from "./sinossi.js";
import { collana } from "./collana.js";

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

// IL TITOLO DENTRO UN TITOLO PIU' LUNGO, DELLO STESSO AUTORE, E' UN LIBRO
// CHE HAI (`giaInCasa`; segnalato dal lettore con «Gardens of the Moon»
// proposto fra i consigli mentre stava sul suo scaffale). Il confronto dei
// doppioni vuole i titoli UGUALI, ed e' giusto all'import, dove un falso
// positivo salterebbe un file; ma sullo scaffale i titoli portano
// l'etichettatura di chi ha impacchettato il file («Malazan 01 - Gardens
// of the Moon», un omnibus coi tre titoli dentro) e un consiglio va
// scartato anche li'. Per non mangiarsi i libri veri: l'autore dev'essere
// CONOSCIUTO e uguale da tutt'e due i lati (non basta che uno manchi, come
// nei doppioni), il titolo cercato almeno `TITOLO_MIN` lettere, e a parole
// intere — «Mort» non sta dentro «Mortal Engines».
const TITOLO_MIN = 5;
//
// E UN TITOLO TRADOTTO E' LO STESSO LIBRO (chiesto dal lettore: «vai con la
// 4», era un limite dichiarato). Da un titolo solo non si puo' sapere che
// «I giardini della luna» e' «Gardens of the Moon», e le strade sono due:
// `altri` — i titoli che il catalogo conosce per la stessa opera, cioe'
// l'edizione italiana quando Open Library ce l'ha — e `stessoPosto`, che la
// lingua non la guarda affatto.
export function giaInCasa({ title, author, saga, numero, altri } = {}, libri = []) {
  for (const titolo of [title, ...(Array.isArray(altri) ? altri : [])]) {
    if (!titolo) continue;
    if (sembraGiaLetto({ title: titolo, author }, libri)) return true;
    const t = chiave(titolo);
    const a = chiaveAutore(author);
    if (t.length < TITOLO_MIN || !a) continue;
    if (libri.some((b) => chiaveAutore(b?.author) === a && ` ${chiave(b?.title)} `.includes(` ${t} `))) return true;
  }
  return stessoPosto({ author, saga, numero }, libri);
}

// LO STESSO POSTO NELLA STESSA SAGA E' LO STESSO LIBRO, in qualunque lingua
// sia scritto il titolo: «Malazan n° 1» in casa col titolo italiano e il
// consiglio «Gardens of the Moon, Malazan n° 1» sono un volume solo. Due
// guardie, perche' sbagliare qui fa sparire un consiglio buono:
// - dove nella tua saga uno stesso numero porta DUE titoli diversi i numeri
//   non sono una fila sola (il Cosmoverse numera Mistborn e la Folgoluce da
//   uno) e il numero non dice piu' quale libro — si tace;
// - un autore CONOSCIUTO da tutt'e due i lati e diverso e' una smentita,
//   uno mancante no, come nei doppioni.
export function stessoPosto({ author, saga, numero } = {}, libri = []) {
  const n = Number(numero);
  const k = saga ? chiaveSaga(saga) : "";
  if (!k || !Number.isFinite(n) || n <= 0) return false;
  const fratelli = (libri || []).filter((b) => b?.saga && chiaveSaga(b.saga) === k);
  const perNumero = new Map();
  for (const b of fratelli) {
    const m = Number(b.sagaOrder);
    if (b.sagaOrder == null || b.sagaOrder === "" || !Number.isFinite(m)) continue;
    if (!perNumero.has(m)) perNumero.set(m, new Set());
    perNumero.get(m).add(chiave(b.title));
  }
  if ([...perNumero.values()].some((titoli) => titoli.size > 1)) return false;
  const a = chiaveAutore(author);
  return fratelli.some((b) => {
    if (Number(b.sagaOrder) !== n) return false;
    const suo = chiaveAutore(b.author);
    return !a || !suo || suo === a;
  });
}

// UN DOPPIONE SENZA BYTE NON E' UN DOPPIONE: E' IL FILE CHE TORNA A CASA.
//
// Segnalato dal lettore davanti a trentasette tomi che non hanno copia né
// qui né nel cloud: «in che senso non c'è copia, li ho importati io». La
// scheda e i byte vivono in due posti diversi — la scheda in
// `localStorage`, il file in IndexedDB — e il file può sparire da tutt'e
// due i lati (mai salito perché il giro moriva, e sfrattato di qui dal
// browser) lasciando la scheda intatta sullo scaffale. La strada per
// rimediare è una sola: reimportare il file.
//
// E proprio lì l'import gli sbatteva la porta in faccia, in due modi
// opposti e tutt'e due sbagliati. **Con l'impronta scritta** riconosceva
// il doppione e SALTAVA il file — «era già in libreria» — senza mai
// guardare se quei byte ci fossero davvero: la scheda restava vuota
// com'era. **Senza impronta** (ed è il caso dei tomi entrati prima che
// l'impronta esistesse, cioè proprio questi) entrava come libro NUOVO, e
// la scheda vecchia restava lì morta a tenersi punto di lettura ed
// evidenziazioni che non si sarebbero più aperti.
//
// Le due regole non sono la stessa, e la differenza è cosa si può
// spostare per sbaglio:
//
//   `stessiByte` — l'impronta combacia, quindi è provatamente lo stesso
//   file: evidenziazioni e punto di lettura restano al loro posto, e si
//   adotta sempre.
//
//   altrimenti è un'ALTRA EDIZIONE dello stesso romanzo, e lì i CFI non
//   valgono più: adottarla su una scheda che porta dei segni metterebbe
//   le evidenziazioni su righe che non hai scelto — il difetto silenzioso
//   peggiore che ci sia. Si adotta solo una scheda `segnato: false`, dove
//   non c'è niente da spostare; con dei segni entra come libro nuovo e si
//   dichiara, che è la regola di sempre (tenerne una sola è una scelta
//   del lettore).
//
// E se i byte QUI ci sono, allora è un doppione vero e si salta come prima.
export function ritornaACasa({ stessiByte = false, byteQui = false, segnato = false } = {}) {
  if (byteQui) return false;
  if (stessiByte) return true;
  return !segnato;
}

// I byte di quel libro sono QUI? E' l'altra meta' della domanda: senza,
// «l'ho gia'» e' una risposta data senza guardare.
const byteInCasa = async (id) => !!(await getFile(id).catch(() => null));

// Una scheda porta dei SEGNI se ci hai evidenziato, messo un segnalibro o
// anche solo letto: sono tutte cose ancorate ai byte di PRIMA.
const schedaSegnata = (id) => {
  try {
    return getHighlights(id).length > 0 || getMarks(id).length > 0 || getProgress(id) > 0;
  } catch {
    // nel dubbio si tratta come segnata: il lato sicuro e' non adottare
    return true;
  }
};

// IL TRASLOCO, per il gemello riconosciuto DOPO aver scritto il file sotto
// un id nuovo (il titolo si sa solo a metadati letti). La scheda non si
// tocca: torna solo il corpo del libro.
async function traslocaSu(scheda, tempId) {
  const blob = await getFile(tempId).catch(() => null);
  if (!blob) return null;
  await putFile(scheda.id, blob);
  // la copertina segue SOLO se la scheda non ne ha gia' una: quella puo'
  // essere la copertina che ti sei messo a mano, e sovrascriverla di
  // nascosto sarebbe un dispetto
  if (!(await getCover(scheda.id).catch(() => null))) {
    const cov = await getCover(tempId).catch(() => null);
    if (cov) await putCover(scheda.id, cov).catch(() => {});
  }
  // quel che era calcolato sui byte di prima non vale piu': le posizioni
  // cachate di epub.js darebbero percentuali sballate per sempre, e il
  // verdetto sulla spezzatura parla di un altro file
  await removeAux(`loc_${scheda.id}`).catch(() => {});
  await removeAux(`salute_${scheda.id}`).catch(() => {});
  await removeBookData(tempId).catch(() => {});
  return scheda;
}

export async function importFiles(fileList, libri = []) {
  const added = [];
  const errors = [];
  // i due modi di essere un doppione: saltati e segnalati
  const saltati = [];
  const sospetti = [];
  // i file tornati dentro una scheda che era rimasta senza byte
  const ritrovati = [];
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
    // IL DOPPIONE VERO si salta prima di `putFile`, o occuperebbe uno
    // spazio da liberare dopo. Ma se di quel libro i byte qui NON ci sono,
    // questo file non e' un doppione: e' la sua copia che torna a casa, e
    // l'impronta dice che e' lo stesso identico file — segni e punto di
    // lettura restano dov'erano (vedi `ritornaACasa`).
    let ritorno = null;
    if (noto) {
      if (!ritornaACasa({ stessiByte: true, byteQui: await byteInCasa(noto.id) })) {
        saltati.push({ name: file.name, title: noto.title });
        continue;
      }
      ritorno = noto;
    }
    const id = ritorno ? ritorno.id : crypto.randomUUID();
    // l'estrazione non deve coprire la copertina che c'e' gia': puo' essere
    // quella che ti sei messo a mano
    const copertinaSua = ritorno ? await getCover(ritorno.id).catch(() => null) : null;
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
    if (copertinaSua) await putCover(ritorno.id, copertinaSua).catch(() => {});
    // il titolo si sa solo adesso: un'altra edizione dello stesso romanzo
    // entra comunque — tenerne una sola e' una scelta tua, non nostra — ma
    // non entra di nascosto. A meno che la scheda del gemello i byte non
    // ce li abbia piu': allora questo file e' il suo, e fondare un libro
    // nuovo lascerebbe quella scheda morta a tenersi i tuoi segni.
    const gemello = !ritorno ? sembraGiaLetto(meta, [...libri, ...added]) : null;
    if (gemello) {
      const adottabile = ritornaACasa({
        byteQui: await byteInCasa(gemello.id),
        segnato: schedaSegnata(gemello.id),
      });
      ritorno = adottabile ? await traslocaSu(gemello, id) : null;
      if (!ritorno) sospetti.push({ title: meta.title });
    }
    // La scheda ritrovata NON si tocca — titolo, saga, voto e note sono
    // tuoi, e comandano come sempre: torna solo il file. Quel che si
    // scrive e' l'impronta, cosi' la prossima volta il libro si riconosce
    // dai byte invece che dal titolo.
    if (ritorno) {
      ritrovati.push({ id: ritorno.id, title: ritorno.title || meta.title, impronta: imp || null });
      continue;
    }
    if (!letto?.titolo) senzaMetadati += 1;
    if (!letto?.copertina) senzaCopertina += 1;
    if (imp) meta.impronta = imp;
    // saga e numero d'ordine dal titolo, senza chiederli a mano: e' quello
    // che accende il glossario e fa funzionare il «prossimo della saga»
    const saga = riconosci({ title: meta.title, author: meta.author, fileName: file.name });
    // LA COLLANA SCRITTA NEL FILE VIENE DOPO LA TAVOLA, e non prima: la
    // tavola conosce l'ORDINE DI LETTURA (l'Eresia rimescola apposta la
    // collana) e sa anche il ciclo, che il file non dice mai. Ma dove la
    // tavola non arriva — cioe' su quasi tutti i libri — la collana del
    // file e' l'unica che sappia rispondere, e risponde gratis: niente
    // rete, nessun modello, e funziona sul primo libro di un autore che
    // non conosciamo (chiesto dal lettore: «per ogni libro che inserisci
    // devi gia' riconoscere se appartiene a una saga e che numero e'»).
    if (!saga && letto?.collana) {
      riconosciuti += 1;
      // scritta COME E' GIA' SCRITTA in casa: due file della stessa saga
      // la scrivono con e senza l'articolo, e alla lettera erano due ripiani
      meta.saga = nomeInBiblioteca(letto.collana.serie, [...libri, ...added]);
      // il numero non si inventa: una collana senza posto resta una collana
      if (letto.collana.numero != null) meta.sagaOrder = letto.collana.numero;
    }
    // E DOPO LA COLLANA, IL TITOLO: «Malice: The Faithful and the Fallen
    // Series Book 1» la saga ce l'ha scritta addosso, ed e' l'unica strada
    // sul primo libro di un autore nuovo quando il file la collana non ce
    // l'ha. Il solo numero («02 Valour») si prende se una saga c'e' gia'.
    if (!saga) {
      const nelTitolo = sagaDalTitolo({ title: meta.title, fileName: file.name, author: meta.author });
      if (!meta.saga && nelTitolo?.saga) {
        riconosciuti += 1;
        meta.saga = nomeInBiblioteca(nelTitolo.saga, [...libri, ...added]);
      }
      if (meta.saga && meta.sagaOrder == null && nelTitolo?.sagaOrder != null) meta.sagaOrder = nelTitolo.sagaOrder;
    }
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
  return { added, errors, saltati, sospetti, ritrovati, cuciti, riconosciuti, senzaMetadati, senzaCopertina };
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
  ritrovati = [],
  cuciti = 0,
  riconosciuti = 0,
  senzaMetadati = 0,
  senzaCopertina = 0,
} = {}) {
  const parti = [];
  if (added.length)
    parti.push(added.length === 1 ? "Un nuovo tomo sullo scaffale ✨" : `${added.length} nuovi tomi sullo scaffale ✨`);
  // IL FILE TORNATO A CASA si dice per primo fra i doppioni, perche' e' il
  // rovescio esatto del «saltato»: li' il file non e' entrato perche' c'era
  // gia', qui e' entrato DENTRO la scheda che era rimasta senza. Senza
  // questa riga il lettore vedrebbe «nessun nuovo tomo» dopo aver
  // reimportato un romanzo, che e' il contrario di quel che e' successo.
  if (ritrovati.length)
    parti.push(
      ritrovati.length === 1
        ? `«${ritrovati[0].title || "un tomo"}» ha ritrovato il suo file 🏠`
        : `${ritrovati.length} tomi hanno ritrovato il loro file 🏠`
    );
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
    // E LA COLLANA ERA LÌ ACCANTO, buttata via allo stesso modo. epub.js
    // legge titolo, autore e descrizione e basta: `calibre:series` e
    // `belongs-to-collection` non li guarda nessuno. Si prende l'OPF com'è
    // scritto — `book.archive` è già aperto, non si riapre niente — e lo
    // legge una funzione pura (vedi `collana.js`).
    // LO SLASH DAVANTI NON È UN DETTAGLIO: `Archive.getText` fa `url.substr(1)`
    // perché si aspetta un percorso assoluto, e senza lo slash cerca
    // «EBPS/content.opf» — non lo trova, e torna `undefined` SENZA alzare
    // niente. Il `catch` qui sotto non serviva a prenderlo: la collana
    // restava vuota su ogni libro e l'import sembrava funzionare. Preso in
    // un browser vero, non leggendo il diff.
    try {
      const percorso = book.container?.packagePath;
      const opf =
        percorso && book.archive?.getText
          ? await book.archive.getText(`/${String(percorso).replace(/^\/+/, "")}`)
          : "";
      esito.collana = collana(opf);
    } catch {
      /* un OPF che non si legge non è un import fallito: la saga si mette a mano */
    }
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

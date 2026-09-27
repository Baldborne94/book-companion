import { eFumetto } from "./fumetto.js";

const BOOKS_KEY = "bc_books";
const LAST_KEY = "bc_lastopen";
const TOMBS_KEY = "bc_tombs";

export const touchBook = (id, ts = Date.now()) =>
  localStorage.setItem(`bc_upd_${id}`, String(ts));

export function getUpdatedAt(id, fallback = 0) {
  const v = parseInt(localStorage.getItem(`bc_upd_${id}`), 10);
  return Number.isFinite(v) ? Math.max(v, fallback) : fallback;
}

export function getTombstones() {
  try {
    const v = JSON.parse(localStorage.getItem(TOMBS_KEY));
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export function addTombstone(id, ts = Date.now()) {
  localStorage.setItem(TOMBS_KEY, JSON.stringify({ ...getTombstones(), [id]: ts }));
}

export function clearTombstones(ids) {
  const t = getTombstones();
  ids.forEach((id) => delete t[id]);
  localStorage.setItem(TOMBS_KEY, JSON.stringify(t));
}

export function loadBooks() {
  try {
    const raw = localStorage.getItem(BOOKS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveBooks(books) {
  localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
}

export function getProgress(id) {
  const v = parseFloat(localStorage.getItem(`bc_prog_${id}`));
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

export function setProgress(id, fraction) {
  localStorage.setItem(`bc_prog_${id}`, String(Math.min(1, Math.max(0, fraction))));
  touchBook(id);
}

export function getStatus(id) {
  return localStorage.getItem(`bc_status_${id}`) || "unread";
}

// Il diario nasce qui: setStatus e' l'unico passaggio comune a tutte le
// strade (reader, scheda del libro, apertura), quindi le date si scrivono
// una volta sola e nessun percorso puo' dimenticarsele.
export const getStarted = (id) => parseInt(localStorage.getItem(`bc_start_${id}`), 10) || 0;
export const getFinished = (id) => parseInt(localStorage.getItem(`bc_end_${id}`), 10) || 0;

export function setDates(id, { started, finished }) {
  if (started) localStorage.setItem(`bc_start_${id}`, String(started));
  else if (started === 0) localStorage.removeItem(`bc_start_${id}`);
  if (finished) localStorage.setItem(`bc_end_${id}`, String(finished));
  else if (finished === 0) localStorage.removeItem(`bc_end_${id}`);
}

// LETTO NON VUOL DIRE LETTO ADESSO.
//
// «Letto» scriveva la data di OGGI, sempre, e il diario raccoglie i libri
// per anno di fine: un romanzo vecchio, messo in biblioteca adesso per
// dire che l'hai gia' letto, finiva fra i libri di quest'anno e gonfiava
// il conto dell'anno in corso (segnalato: «non mi aggiungere ogni volta
// libri che metto come letto nel 2026, magari sono libri vecchi che sto
// aggiungendo per dire che li ho gia' letti»).
//
// La data di oggi si scrive solo dove l'app ti ha VISTO leggere: una data
// d'inizio — che nasce quando il libro passa «in lettura», cioe' quando lo
// apri — oppure del progresso. Un libro che salta da «da leggere» a
// «letto» senza essere mai stato aperto e' una dichiarazione sul PASSATO,
// e QUANDO sia successo l'app non lo sa: oggi e' la sola data che non puo'
// essere vera. Non si scrive niente, e l'anno lo scrivi tu nella scheda.
//
// Non e' una data che si perde: il libro resta fra i letti e nel conto
// totale, e il diario lo raccoglie a parte (`senzaData` in `diary.js`).
export const lettoQui = (id) => getStarted(id) > 0 || getProgress(id) > 0;

export function setStatus(id, status) {
  const prev = getStatus(id);
  localStorage.setItem(`bc_status_${id}`, status);
  if (status !== prev) {
    const now = Date.now();
    if (status === "reading" && !getStarted(id)) setDates(id, { started: now });
    // un libro ripreso e finito di nuovo aggiorna la data di fine
    if (status === "read" && lettoQui(id)) setDates(id, { finished: now });
    // tornare a "da leggere" e' un azzeramento esplicito
    if (status === "unread") setDates(id, { started: 0, finished: 0 });
    // ABBANDONARE NON E' FINIRE. La data d'inizio resta — quel libro l'hai
    // davvero cominciato, ed e' un pezzo della tua storia di lettore — ma
    // quella di fine se ne va: senza toglierla, un romanzo prima dichiarato
    // letto e poi mollato resterebbe nel diario fra i finiti, e il conto
    // dell'anno direbbe una cosa che non e' successa.
    //
    // La data d'inizio pero' non si INVENTA (qui e nel ramo di sopra si
    // scriveva `started: now` quando mancava): un libro mollato senza
    // averlo mai aperto non l'hai cominciato oggi, e quella data finta
    // riaprirebbe la porta dall'altra parte — dichiarato «letto» un minuto
    // dopo, `lettoQui` la troverebbe e scriverebbe di nuovo l'anno in corso.
    if (status === "abandoned") setDates(id, { finished: 0 });
  }
  touchBook(id);
}

// L'ANNO SI SCRIVE A MANO, E SI FISSA A META' ANNO.
//
// L'unica cosa che il lettore ricorda di un libro letto anni fa e'
// l'anno — non il giorno — quindi il campo chiede quello. La data si posa
// al primo di LUGLIO, a mezzogiorno: un fuso orario puo' spostare un
// istante di mezza giornata, e il 1° gennaio o il 31 dicembre finirebbero
// nell'anno sbagliato: proprio il difetto che questo campo viene a curare.
// E' la stessa ragione per cui la scadenza della chiave fissa i due capi a
// mezzogiorno.
//
// Tre regole: vuoto TOGLIE la data (il libro resta letto, senza anno);
// un anno che non sta in piedi — nel futuro, o prima che esistessero i
// libri stampati — non si scrive affatto, invece di scriverne uno storto;
// e se l'anno e' gia' quello **non si tocca niente**, o la data esatta di
// un libro letto qui («12 marzo, in sei giorni») diventerebbe un primo
// luglio qualunque solo perche' hai riaperto la scheda.
const MEZZO_ANNO = 6;
export const ANNO_MIN = 1000;

export const annoFinito = (id) => {
  const t = getFinished(id);
  return t ? new Date(t).getFullYear() : 0;
};

export function segnaAnnoFine(id, anno) {
  const testo = String(anno ?? "").trim();
  if (!testo) {
    setDates(id, { finished: 0 });
    touchBook(id);
    return true;
  }
  const n = parseInt(testo, 10);
  if (!Number.isFinite(n) || n < ANNO_MIN || n > new Date().getFullYear()) return false;
  if (annoFinito(id) === n) return true;
  setDates(id, { finished: new Date(n, MEZZO_ANNO, 1, 12).getTime() });
  touchBook(id);
  return true;
}

export function getLastOpened() {
  return localStorage.getItem(LAST_KEY);
}

export function setLastOpened(id) {
  localStorage.setItem(LAST_KEY, id);
  localStorage.setItem("bc_prefs_upd", String(Date.now()));
}

export function removeBookMeta(id) {
  saveBooks(loadBooks().filter((b) => b.id !== id));
  addTombstone(id);
  localStorage.removeItem(`bc_upd_${id}`);
  localStorage.removeItem(`bc_music_${id}`);
  localStorage.removeItem(`bc_prog_${id}`);
  localStorage.removeItem(`bc_status_${id}`);
  localStorage.removeItem(`bc_cfi_${id}`);
  localStorage.removeItem(`bc_marks_${id}`);
  localStorage.removeItem(`bc_hl_${id}`);
  localStorage.removeItem(`bc_start_${id}`);
  localStorage.removeItem(`bc_end_${id}`);
  if (getLastOpened() === id) localStorage.removeItem(LAST_KEY);
}

// LA RICERCA SULLO SCAFFALE, e i campi che le mancavano.
//
// Cercava su titolo, autore e saga. Non sul genere, non sul ciclo, e
// soprattutto **non sulle note che hai scritto tu** nella scheda del
// libro: potevi annotare «quello col finale che non mi torna» e poi non
// ritrovarlo mai piu'. Le note sono l'unico campo che nessun altro posto
// dell'app sa cercare — il giardino delle citazioni cerca le note SULLE
// CITAZIONI, che sono un'altra cosa.
//
// Sta qui e non dentro `Library.jsx` per la ragione di sempre: senza JSX
// un test la puo' chiamare.
//
// Gli accenti si appianano da tutt'e due i lati (`piatto`): sul tablet la
// tastiera l'accento te lo fa scrivere, ma nessuno cerca «Sanderson,
// L'Arcanista» accentato — e un titolo che non si trova per una dieresi e'
// un titolo perso.
const piatto = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// I campi sono in ordine di quanto e' probabile che tu stia cercando
// quello. Non e' un dettaglio estetico: `some` si ferma al primo che
// combacia, e il titolo e' quello che cerchi quasi sempre.
export const CAMPI_RICERCA = ["title", "author", "saga", "series", "genre", "notes"];

export function combacia(book, query) {
  const q = piatto(query).trim();
  if (!q) return true;
  if (!book) return false;
  return CAMPI_RICERCA.some((c) => piatto(book[c]).includes(q));
}

// COME AVEVI LASCIATO LO SCAFFALE. Raggruppamento e ordinamento nascevano
// da capo a ogni apertura della Libreria: chi preferisce vedere i generi,
// o l'ordine d'ingresso, doveva ridirlo ogni volta. Il filtro invece NON
// si ricorda apposta — una Libreria che si riapre con meta' dei libri
// nascosti sembra una libreria che ha perso dei libri, e non c'e' niente
// sullo schermo che spieghi perche'.
const VISTA_KEY = "bc_vista";

export function leggiVista(dflt) {
  try {
    const v = JSON.parse(localStorage.getItem(VISTA_KEY));
    return v && typeof v === "object" ? { ...dflt, ...v } : dflt;
  } catch {
    return dflt;
  }
}

export function scriviVista(vista) {
  try {
    localStorage.setItem(VISTA_KEY, JSON.stringify(vista));
  } catch {
    /* memoria piena o negata: la vista di partenza va benissimo */
  }
}

// Una voce salvata che non esiste piu' — un raggruppamento che abbiamo
// tolto, come «Saga» o «Niente» — lascerebbe il menu in bianco e la
// Libreria a mostrare tutt'altro: quel che non si riconosce torna alla
// disposizione di sempre, che e' la PRIMA voce di ogni elenco (il titolo
// sta per primo fra gli ordinamenti proprio perche' e' l'ordine di
// partenza). Le voci si passano da fuori: le conosce la Libreria, e cosi'
// un test le finge invece di importare un componente.
export function vistaValida(gruppi, ordini) {
  const dflt = { group: gruppi[0].id, sort: ordini[0].id };
  const v = leggiVista(dflt);
  return {
    group: gruppi.some((g) => g.id === v.group) ? v.group : dflt.group,
    sort: ordini.some((s) => s.id === v.sort) ? v.sort : dflt.sort,
  };
}

// E UN TASTO SOLO AL POSTO DI DUE TENDINE, che e' quel che il lettore
// vedeva: «serve avere sia raggruppa che ordina? mi sembra un po'
// confusionario averli entrambi» — e, dopo la prima cura, «li vedo ancora
// tutti e due». Le due scelte restano, perche' sono ortogonali (una dice
// QUALI ripiani, l'altra IN CHE ORDINE) e fonderle darebbe diciotto voci
// di menu; a sparire e' la coppia di comandi sull'intestazione.
//
// IL TASTO DEVE DIRE LA SCELTA IN CORSO, o si sostituirebbero due tendine
// che almeno si leggevano con una porta chiusa: «Saga · Titolo» si legge
// senza aprire niente.
//
// E LE PAROLE VENGONO DAGLI STESSI ELENCHI del menu di prima, passati da
// fuori come in `vistaValida`: scritte a mano qui sarebbero due posti da
// cambiare insieme e da dimenticare separatamente. Una voce che non
// esiste piu' mostra il suo id invece di sparire — `vistaValida` quel
// caso lo chiude gia' a monte, e un buco nell'etichetta sarebbe un tasto
// che non dice piu' niente.
export function etichettaVista(vista, gruppi, ordini) {
  const nome = (elenco, id) => elenco.find((x) => x.id === id)?.label || id || "?";
  return `${nome(gruppi, vista?.group)} · ${nome(ordini, vista?.sort)}`;
}

// «E' la disposizione di sempre?» — serve solo ad accendere il tasto
// quando NON lo e', cosi' si vede a colpo d'occhio che lo scaffale in
// questo momento e' raccolto o ordinato in un altro modo. La partenza e'
// la PRIMA voce di ogni elenco, la stessa regola di `vistaValida`: un
// nome scritto a mano qui si dimenticherebbe il giorno che le voci
// cambiano ordine.
export function vistaDiSempre(vista, gruppi, ordini) {
  return vista?.group === gruppi[0]?.id && vista?.sort === ordini[0]?.id;
}

// IL NUMERO DI LETTURA TIENE I DECIMALI: il file lo scrive cosi' (Calibre
// mette 2.5 alla novella fra il secondo e il terzo) e la scheda lo
// mostrava, ma al primo tocco strappava il punto — quel che l'app aveva
// letto da sola non si poteva riscrivere a mano. Quel che non e' un numero
// vale «nessuno», mai NaN: un NaN salvato non torna piu' indietro. E la
// virgola vale come il punto: la tastiera decimale di un tablet italiano
// da' quella.
export function numeroLettura(s) {
  const t = String(s ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// mentre si scrive nella casella: via tutto quel che non e' cifra o
// punto, e la virgola diventa punto. Resta una stringa, perche' «2.» a
// meta' battitura e' legittimo e un numero non saprebbe tenerlo.
export function pulisciNumero(s) {
  return String(s ?? "").replace(",", ".").replace(/[^\d.]/g, "");
}

// PERCHÉ LO SCAFFALE È VUOTO, e come tornare a vederlo.
//
// C'era una riga sola: «Nessun tomo risponde all'appello con questi
// filtri…». Dice il vero e non serve a niente — **è un vicolo cieco**: lo
// scaffale sembra aver perso i libri e non c'è niente da toccare per
// riaverli. È esattamente la ragione per cui il filtro NON si ricorda fra
// un'apertura e l'altra («una Libreria che si riapre con metà dei libri
// nascosti sembra una libreria che ha perso dei libri, e non c'è niente
// sullo schermo che spieghi perché») — solo che dentro la sessione quella
// ragione vale uguale: filtri, cerchi, ti distrai, e lo scaffale è vuoto.
//
// **LA RIGA UTILE DICE QUALE DELLE DUE LEVE STA NASCONDENDO**, e non è un
// dettaglio: con la ricerca E il filtro accesi, sapere che tre tomi
// rispondono alla ricerca ma nessuno è fra i «Letti» dice quale delle due
// mollare. Una riga che dice solo «non c'è niente» lascia a indovinare.
//
// Sta qui e non nel componente per la ragione di sempre: un test in Node
// non importa un `.jsx`, e una frase che dice la cosa sbagliata non alza
// nessun errore.
export function scaffaleVuoto({ totale = 0, query = "", filtro = "all", conLaSolaRicerca = null, nomeFiltro = "" } = {}) {
  const cerca = String(query || "").trim();
  const filtra = filtro && filtro !== "all";
  // nessuna leva tirata e lo scaffale è vuoto lo stesso: non sappiamo
  // perché, e non si inventa una causa — si dice quel che si vede
  if (!cerca && !filtra)
    return { frase: "Nessun tomo sullo scaffale.", vie: [] };

  const vie = [];
  if (cerca) vie.push({ id: "query", label: "Cancella la ricerca" });
  if (filtra) vie.push({ id: "filtro", label: "Mostra tutti i tomi" });

  const nome = nomeFiltro || "questo filtro";
  if (cerca && filtra) {
    // il caso che vale la pena distinguere: la ricerca TROVA, ed è il
    // filtro a nascondere. Senza questo ramo si molla la leva sbagliata.
    if (Number.isFinite(conLaSolaRicerca) && conLaSolaRicerca > 0)
      return {
        frase: `${conLaSolaRicerca === 1 ? "Un tomo risponde" : `${conLaSolaRicerca} tomi rispondono`} a «${cerca}», ma ${conLaSolaRicerca === 1 ? "non è" : "nessuno è"} fra i «${nome}».`,
        vie,
      };
    return { frase: `Nessun tomo risponde a «${cerca}» fra i «${nome}».`, vie };
  }
  if (cerca) return { frase: `Nessun tomo risponde a «${cerca}».`, vie };
  // solo il filtro: il conto dice quanti ne stai nascondendo, che è
  // l'informazione che spiega lo scaffale vuoto
  return {
    frase: totale
      ? `Nessuno dei tuoi ${totale} tomi è fra i «${nome}».`
      : `Nessun tomo è fra i «${nome}».`,
    vie,
  };
}

// LIBRI E FUMETTI NON SI MESCOLANO QUANDO LI CERCHI (chiesto dal lettore:
// «visto che sto caricando sia libri che manga che fumetti fai in modo
// che l'applicazione mi differenzi tra questi due generi quando li voglio
// cercare cosi' non ci confondiamo»). Il tipo lo dice il file
// (`fileType`: cbz e cbr sono fumetti, il resto libri), e sullo scaffale
// e' un filtro come lo stato — che, come lo stato, NON si ricorda fra
// un'apertura e l'altra: una Libreria che si riapre coi soli fumetti
// sembra una libreria che ha perso i libri.
export const TIPI = [
  { id: "tutti", label: "Tutti" },
  { id: "libri", label: "📚 Libri" },
  { id: "fumetti", label: "💬 Fumetti" },
  { id: "manga", label: "🏮 Manga" },
];

// E I MANGA DAI FUMETTI (chiesto dal lettore: «mi metteresti anche manga
// cosi li differenziamo bene?»). Qui il file non basta: un manga e un
// fumetto sono tutt'e due CBZ o CBR. I segni sono due, e si leggono dal
// libro: il verso da destra che la scheda del CBZ dichiara (`verso`), e il
// GENERE — «Fumetti · Manga» dal selettore, o qualunque genere scritto a
// mano che dica manga. Il genere vale anche su un PDF: una scansione di
// manga resta un manga.
//
// E IL MANGA E' UN TIPO, NON UN GENERE (detto dal lettore davanti al
// consiglio di scriverlo nel genere: «non dovrebbe essere un genere il
// manga»). Il genere dice di cosa parla una storia — fantasy, giallo —
// mentre libro, fumetto e manga dicono che oggetto hai in mano, e i due
// campi non si mescolano: un manga fantasy e' fantasy nel genere e manga
// nel tipo. Il segno vero e' quindi `tipo` sul libro, scelto nella scheda:
// «manga» o «fumetti», e la scelta scritta COMANDA — anche «fumetti» su un
// volume di una saga manga, o su un CBZ che si dichiara da destra. Senza
// una scelta restano i segni di prima: il verso della scheda del CBZ e un
// genere che dica manga, perche' chi l'ha gia' scritto li' non deve
// vedersi sparire i manga dallo scaffale.
const MANGA = /\bmanga\b/i;
export const TIPI_SCELTI = ["fumetti", "manga"];
const tipoScelto = (b) => (TIPI_SCELTI.includes(b?.tipo) ? b.tipo : null);
export const eManga = (b) => {
  const scelto = tipoScelto(b);
  if (scelto) return scelto === "manga";
  return b?.verso === "rtl" || MANGA.test(b?.genre || "");
};

const chiaveSaga = (b) => String(b?.saga || "").trim().toLowerCase();

// E LA SAGA SI PORTA DIETRO I SUOI VOLUMI: segnare manga uno solo dei
// quaranta One Piece deve bastare, o il lettore dovrebbe aprire quaranta
// schede. Si propaga solo ai FUMETTI della stessa saga — un romanzo in
// ePub della stessa storia resta un libro — e solo da un volume che manga
// lo e' per un segno suo, mai per eredita', o due saghe si contagerebbero.
export function tipiDi(books) {
  const sagheManga = new Set();
  for (const b of books || []) {
    const k = chiaveSaga(b);
    if (k && eManga(b)) sagheManga.add(k);
  }
  const mappa = new Map();
  for (const b of books || []) {
    // un «fumetti» scelto a mano non eredita niente: e' una scelta
    const tipo = eManga(b)
      ? "manga"
      : eFumetto(b)
        ? !tipoScelto(b) && sagheManga.has(chiaveSaga(b))
          ? "manga"
          : "fumetti"
        : "libri";
    mappa.set(b.id, tipo);
  }
  return mappa;
}

export const tipoDi = (b, mappa) =>
  mappa?.get(b?.id) ?? (eManga(b) ? "manga" : eFumetto(b) ? "fumetti" : "libri");
export const delTipo = (b, tipo, mappa) => !tipo || tipo === "tutti" || tipoDi(b, mappa) === tipo;

// I chip compaiono solo quando in casa ci sono ALMENO DUE tipi, e solo
// quelli che ci sono: con libri e manga soltanto, «Fumetti» sarebbe uno
// scaffale vuoto garantito, e un comando che non cambia niente e' peggio
// di un comando che manca.
export function tipiPresenti(books, mappa = tipiDi(books)) {
  const ci = new Set();
  for (const b of books || []) ci.add(tipoDi(b, mappa));
  if (ci.size < 2) return [];
  return TIPI.filter((t) => t.id === "tutti" || ci.has(t.id));
}
export const serveFiltroTipo = (books) => tipiPresenti(books).length > 0;

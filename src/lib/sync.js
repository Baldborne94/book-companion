import { getClient, isSyncConfigured, BUCKET } from "./supabase.js";
import { putFile, getFile, putCover, getCover, removeBookData, listFileIds, getTrack, putTrack } from "./bookStore.js";
import {
  loadBooks, saveBooks, getProgress, setProgress, getStatus, setStatus,
  getUpdatedAt, touchBook, getTombstones, clearTombstones, getLastOpened,
  getStarted, getFinished, setDates,
} from "./library.js";
import {
  getCfi, setCfi, getMarks, saveMarks, getHighlights, saveHighlights, removeAnnotations, setJump,
} from "./annotations.js";
import { getBookMusic, setBookMusic, getFavoritesRaw, writeFavorites, getListsRaw, writeLists } from "./music.js";
import { tuttiIGlossari, scriviGlossari } from "./glossarioMio.js";
import { planSync, mergePrefs, rowFromLocal, localFromRow, normalizeRow, withRepush, colonnaMancante, senzaColonna, percheMelodia } from "./syncCore.js";

const LAST_SYNC_KEY = "bc_lastsync";
const REPUSH_KEY = "bc_repush";
const UPLOADED_KEY = "bc_uploaded";
// Le copertine hanno un registro loro, e non e' un capriccio: vedi sotto.
const UPLOADED_COV_KEY = "bc_uploaded_cov";
const PREFS_UPD_KEY = "bc_prefs_upd";

export const getLastSync = () => parseInt(localStorage.getItem(LAST_SYNC_KEY), 10) || 0;

// I BYTE DI UN LIBRO SONO CAMBIATI IN CASA (la visita l'ha ricucito): la
// copia nel cloud e' quella vecchia, e i file salgono una volta per sempre
// — senza togliere il libro dal registro non risalirebbe mai piu'.
export function daRicaricare(id) {
  try {
    const su = JSON.parse(localStorage.getItem(UPLOADED_KEY)) || [];
    localStorage.setItem(UPLOADED_KEY, JSON.stringify(su.filter((x) => x !== id)));
  } catch {
    /* senza registro non c'e' niente da dimenticare */
  }
}
export const touchPrefs = () => localStorage.setItem(PREFS_UPD_KEY, String(Date.now()));

const uploaded = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(UPLOADED_KEY)) || []);
  } catch {
    return new Set();
  }
};
const markUploaded = (id) =>
  localStorage.setItem(UPLOADED_KEY, JSON.stringify([...uploaded(), id]));

const copertineSu = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(UPLOADED_COV_KEY)) || []);
  } catch {
    return new Set();
  }
};
const segnaCopertina = (id) =>
  localStorage.setItem(UPLOADED_COV_KEY, JSON.stringify([...copertineSu(), id]));

const filePath = (uid, book) => `${uid}/${book.id}.${book.fileType || "epub"}`;
const coverPath = (uid, id) => `${uid}/${id}.cover`;
// Le melodie stanno nello stesso secchio dei libri: il permesso guarda solo
// la prima cartella (`uid/…`), quindi una sottocartella non chiede niente a
// nessuno.
const trackPath = (uid, trackId) => `${uid}/melodie/${trackId}`;

export async function getSession() {
  const sb = await getClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session || null;
}

export async function signIn(email) {
  const sb = await getClient();
  if (!sb) throw new Error("sync non configurata");
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  const sb = await getClient();
  await sb?.auth.signOut();
}

// Schema non ancora migrato: invece di rompere tutta la sincronizzazione,
// si rinuncia al singolo campo e si salva il resto.
const DEGRADE = [
  {
    test: (m) => /started_at|finished_at/i.test(m),
    label: "diario di lettura",
    apply: (rows) => rows.map(({ started_at, finished_at, ...r }) => r),
  },
  {
    test: (m) => /genre|saga/i.test(m),
    label: "genere e saga",
    apply: (rows) => rows.map(({ genre, saga, saga_order, ...r }) => r),
  },
  {
    test: (m) => /impronta/i.test(m),
    label: "impronta dei doppioni",
    apply: (rows) => rows.map(({ impronta, ...r }) => r),
  },
  {
    test: (m) => /'fav'/i.test(m),
    label: "cuore dei preferiti",
    apply: (rows) => rows.map(({ fav, ...r }) => r),
  },
  {
    test: (m) => /rating/i.test(m) || /invalid input syntax for type integer/i.test(m),
    label: "mezze stelle",
    apply: (rows) => rows.map((r) => ({ ...r, rating: Math.round(r.rating || 0) })),
  },
];

async function upsertBooks(sb, rows) {
  let payload = rows;
  const dropped = [];
  for (let i = 0; i <= DEGRADE.length; i++) {
    const { error } = await sb.from("books").upsert(payload);
    if (!error) return dropped;
    const msg = `${error.message || ""} ${error.details || ""}`;
    const step = DEGRADE.find((d) => !dropped.includes(d.label) && d.test(msg));
    if (!step) throw error;
    payload = step.apply(payload);
    dropped.push(step.label);
  }
  return dropped;
}

function readLocalState(id) {
  return {
    status: getStatus(id),
    started: getStarted(id),
    finished: getFinished(id),
    progress: getProgress(id),
    cfi: getCfi(id),
    marks: getMarks(id),
    highlights: getHighlights(id),
    music: getBookMusic(id),
  };
}

function writeLocalState(id, state) {
  setStatus(id, state.status);
  // dopo setStatus, che altrimenti le riscriverebbe con l'ora locale
  if (state.started || state.finished) {
    setDates(id, { started: state.started, finished: state.finished });
  }
  setProgress(id, state.progress);
  if (state.cfi) setCfi(id, state.cfi);
  saveMarks(id, state.marks);
  saveHighlights(id, state.highlights);
  if (state.music) setBookMusic(id, state.music);
}

function localPrefs() {
  let reader = null;
  try {
    reader = JSON.parse(localStorage.getItem("bc_reader") || "null");
  } catch {
    /* preferenze illeggibili: si riparte dai default */
  }
  return {
    reader,
    music_favs: getFavoritesRaw(),
    music_lists: getListsRaw(),
    glossari: tuttiIGlossari(),
    last_opened: getLastOpened(),
    updated_at: parseInt(localStorage.getItem(PREFS_UPD_KEY), 10) || 0,
  };
}

export async function syncNow({ onProgress } = {}) {
  if (!isSyncConfigured()) return { skipped: "non configurata" };
  const sb = await getClient();
  const session = await getSession();
  if (!session) return { skipped: "non connesso" };
  const uid = session.user.id;
  const say = (m) => onProgress?.(m);

  say("Leggo la biblioteca…");
  const books = loadBooks();
  const localRows = books.map((b) =>
    rowFromLocal(b, readLocalState(b.id), getUpdatedAt(b.id, b.addedAt || 1))
  );
  const tombstones = getTombstones();

  const { data: remoteRows, error } = await sb.from("books").select("*").eq("user_id", uid);
  if (error) throw error;

  const { pull, push, removeLocal } = planSync({
    localRows,
    tombstones,
    remoteRows: remoteRows || [],
  });

  // Se questo dispositivo e' piu' recente ma piu' indietro, la posizione
  // remota non va persa: la teniamo da parte e la proponiamo all'apertura.
  for (const row of push) {
    if (row.deleted) continue;
    const r = (remoteRows || []).find((x) => x.id === row.id);
    if (r && !r.deleted && r.cfi && (r.progress || 0) > (row.progress || 0) + 0.02) {
      setJump(row.id, { cfi: r.cfi, progress: r.progress });
    }
  }

  // Finche' lo schema resta indietro il flag non si chiude: al primo invio
  // completo i campi persi tornano nel cloud da soli.
  const repairing = localStorage.getItem(REPUSH_KEY) !== "done";
  const toPush = repairing ? withRepush({ push, pull, removeLocal, localRows }) : push;
  let degraded = false;

  if (toPush.length) {
    say(`Invio ${toPush.length} ${toPush.length === 1 ? "libro" : "libri"}…`);
    const rows = toPush.map((r) => ({ ...normalizeRow(r), user_id: uid }));
    const missing = await upsertBooks(sb, rows);
    degraded = missing.length > 0;
    if (degraded) say(`Sincronizzato (${missing.join(", ")}: aggiorna lo schema)`);
    const deletedIds = push.filter((r) => r.deleted).map((r) => r.id);
    if (deletedIds.length) {
      const paths = deletedIds.flatMap((id) => [
        `${uid}/${id}.epub`,
        `${uid}/${id}.pdf`,
        coverPath(uid, id),
      ]);
      await sb.storage.from(BUCKET).remove(paths).catch(() => {});
      clearTombstones(deletedIds);
    }
  }
  if (!degraded) localStorage.setItem(REPUSH_KEY, "done");

  const already = uploaded();
  const localFiles = new Set(await listFileIds());
  for (const row of push) {
    if (row.deleted || already.has(row.id)) continue;
    const book = books.find((b) => b.id === row.id);
    if (!book || !localFiles.has(row.id)) continue;
    const blob = await getFile(row.id);
    if (!blob) continue;
    say(`Carico «${book.title}»…`);
    const { error: sErr } = await sb.storage
      .from(BUCKET)
      .upload(filePath(uid, book), blob, { upsert: true, contentType: blob.type || undefined });
    if (sErr && sErr.statusCode !== "409") throw sErr;
    markUploaded(row.id);
  }

  // LE COPERTINE HANNO UN REGISTRO LORO.
  //
  // Salivano appese al file, dentro il giro dei libri da caricare e solo
  // per quelli mai caricati prima. Bastava che la copertina arrivasse DOPO
  // — un libro importato senza, poi rivestito; o l'estrazione andata a buon
  // fine al secondo tentativo — e quella copertina non partiva mai piu':
  // il libro era gia' fra i «caricati», e nessuno lo riguardava. Sull'altro
  // dispositivo restava un dorso disegnato per sempre, senza un modo per
  // rimediare che non fosse reimportare tutto.
  //
  // Adesso e' un giro suo, con la sua memoria: si guarda ogni libro che una
  // copertina ce l'ha qui, e si manda quella che non e' ancora partita. Il
  // registro separato serve proprio a questo — legare le copertine al
  // registro dei file vorrebbe dire, per farne salire una, rispedire lassu'
  // trenta megabyte di romanzo.
  const covGia = copertineSu();
  let copertineNuove = 0;
  for (const b of books) {
    if (covGia.has(b.id)) continue;
    const cover = await getCover(b.id).catch(() => null);
    if (!cover) continue;
    const { error: cErr } = await sb.storage
      .from(BUCKET)
      .upload(coverPath(uid, b.id), cover, { upsert: true });
    // una copertina che non sale non ferma niente: si riprova al giro dopo
    if (cErr && cErr.statusCode !== "409") continue;
    segnaCopertina(b.id);
    copertineNuove += 1;
    if (copertineNuove === 1) say("Mando su le copertine…");
  }

  // LE MELODIE SONO BYTE COME I LIBRI, e vanno dove vanno i libri. Finora
  // viaggiava solo la voce dell'elenco: sull'altro dispositivo compariva il
  // nome e non suonava niente, che e' il modo peggiore di sincronizzare una
  // cosa. Il caricamento si fa una volta sola per melodia (`uploaded`), e
  // chi non riesce ci riprova al giro dopo.
  const melodie = getFavoritesRaw();
  let melodieSu = 0;
  let melodieNo = 0;
  // il PERCHE' di ogni rifiuto, non buttato via: al lettore si dice la
  // causa vera, non «forse lo spazio e' finito» (che era un indovinello,
  // e sul suo pannello era pure smentito dal contatore)
  const melodiePerche = new Set();
  for (const f of melodie) {
    if (f.deleted || !f.trackId || already.has(f.trackId)) continue;
    const blob = await getTrack(f.trackId).catch(() => null);
    // i byte stanno su un altro dispositivo: da qui non c'e' niente da
    // caricare, e non e' un guaio
    if (!blob) continue;
    say(`Carico «${f.name || "una melodia"}»…`);
    const { error: mErr } = await sb.storage
      .from(BUCKET)
      .upload(trackPath(uid, f.trackId), blob, { upsert: true, contentType: blob.type || undefined });
    // spazio finito o rete che cade: la melodia resta non caricata e ci si
    // riprova, ma il resto della sincronizzazione non deve saltare per aria.
    // Va pero' DETTO: un caricamento che fallisce in silenzio ti lascia a
    // credere che la musica sia al sicuro lassu' quando non c'e'.
    if (mErr && mErr.statusCode !== "409") {
      melodieNo++;
      melodiePerche.add(percheMelodia(mErr));
      continue;
    }
    markUploaded(f.trackId);
    melodieSu++;
  }
  // le lapidi valgono anche lassu': una melodia dimenticata non deve restare
  // a occupare spazio per sempre. Si cancella da qualunque dispositivo,
  // perche' chi ha caricato i byte puo' essere un altro.
  const spente = melodie.filter((f) => f.deleted && f.trackId).map((f) => trackPath(uid, f.trackId));
  if (spente.length) await sb.storage.from(BUCKET).remove(spente).catch(() => {});

  if (pull.length || removeLocal.length) say("Ricevo le novità…");
  let next = loadBooks();
  try {
    for (const row of pull) {
      const { book, state } = localFromRow(row);
      const i = next.findIndex((b) => b.id === book.id);
      if (i >= 0) next[i] = { ...next[i], ...book };
      else next.push(book);
      writeLocalState(book.id, state);
      touchBook(book.id, row.updated_at);
      // UNA COPERTINA NON VALE UN RIPRISTINO. Stava dentro il giro senza
      // rete di sicurezza: un solo scaricamento andato storto — e sono
      // cinquantaquattro, su una connessione qualunque — buttava via
      // l'intera ricezione, perche' `saveBooks` sta in fondo e non ci si
      // arrivava mai. Il libro si tiene comunque: senza copertina si vede
      // il dorso disegnato, ed e' infinitamente meglio di niente.
      try {
        if (!(await getCover(book.id))) {
          const { data } = await sb.storage.from(BUCKET).download(coverPath(uid, book.id));
          if (data) await putCover(book.id, data);
        }
      } catch {
        /* si riprova alla prossima sincronizzazione */
      }
    }

    for (const id of removeLocal) {
      next = next.filter((b) => b.id !== id);
      removeAnnotations(id);
      await removeBookData(id).catch(() => {});
    }
  } finally {
    // Quel che e' sceso resta sceso, anche se il giro si e' rotto a meta':
    // e' la stessa regola di «Porta qui i tomi» e della ricerca in
    // biblioteca. Rifare cinquanta libri da capo per un intoppo al
    // quarantanovesimo non lo merita nessuno.
    if (pull.length || removeLocal.length) saveBooks(next);
  }

  const { data: remotePrefsRows } = await sb.from("prefs").select("*").eq("user_id", uid).limit(1);
  const { merged, applyLocal, pushRemote } = mergePrefs(localPrefs(), remotePrefsRows?.[0] || null);
  const stamp = pushRemote ? Date.now() : merged.updated_at;
  if (applyLocal) {
    if (merged.reader) localStorage.setItem("bc_reader", JSON.stringify(merged.reader));
    writeFavorites(merged.music_favs);
    writeLists(merged.music_lists);
    scriviGlossari(merged.glossari || {});
    if (merged.last_opened) localStorage.setItem("bc_lastopen", merged.last_opened);
  }
  if (pushRemote) {
    // Le preferenze rinunciano alle colonne che lo schema non ha ancora,
    // una per volta, come fanno i libri: prima una colonna mancante
    // faceva morire tutto il giro, e «ultima sincronizzazione» restava
    // «mai» anche quando i libri erano saliti e scesi senza un graffio.
    let riga = { ...merged, updated_at: stamp, user_id: uid };
    const persi = [];
    for (let i = 0; i <= 8; i += 1) {
      const { error } = await sb.from("prefs").upsert(riga);
      if (!error) break;
      const manca = colonnaMancante(error);
      const ridotta = manca ? senzaColonna(riga, manca) : null;
      if (!ridotta) throw error;
      riga = ridotta;
      persi.push(manca);
    }
    if (persi.length) say(`Sincronizzato (${persi.join(", ")}: aggiorna lo schema)`);
  }
  localStorage.setItem(PREFS_UPD_KEY, String(stamp));

  localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  return {
    pushed: toPush.length,
    pulled: pull.length,
    removed: removeLocal.length,
    melodieSu,
    melodieNo,
    melodiePerche: [...melodiePerche],
    books: loadBooks(),
  };
}

// LA COPERTINA CAMBIATA A MANO DEVE PARTIRE SUBITO, e da sola.
//
// Le copertine salgono insieme al file del libro, una volta sola per
// sempre (`bc_uploaded`): dopo quel giro nessuno le riguarda piu'. Una
// copertina rimessa a mano non partirebbe mai — e togliere il libro dai
// «gia' caricati» per farla partire vorrebbe dire rispedire lassu' anche i
// trenta megabyte del romanzo, per un'immagine da cinquanta chilobyte.
// Quindi va per conto suo, e in silenzio: se il cloud non c'e' o non
// risponde, la copertina qui e' cambiata lo stesso, che e' quello che il
// lettore ha chiesto.
export async function caricaCopertina(bookId) {
  if (!isSyncConfigured()) return false;
  try {
    const session = await getSession();
    if (!session) return false;
    const sb = await getClient();
    const uid = session.user.id;
    const cover = await getCover(bookId);
    if (!cover) {
      await sb.storage.from(BUCKET).remove([coverPath(uid, bookId)]);
      return true;
    }
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(coverPath(uid, bookId), cover, { upsert: true });
    return !error;
  } catch {
    return false;
  }
}

export async function ensureLocalFile(book) {
  const local = await getFile(book.id);
  if (local) return local;
  if (!isSyncConfigured()) return null;
  const session = await getSession();
  if (!session) return null;
  const sb = await getClient();
  const { data, error } = await sb.storage.from(BUCKET).download(filePath(session.user.id, book));
  if (error || !data) return null;
  await putFile(book.id, data);
  return data;
}

// PORTARE A CASA I TOMI RIMASTI NEL CLOUD.
//
// Un libro arrivato dalla sincronizzazione ha qui titolo, copertina e
// progresso, ma i byte scendono solo la prima volta che lo apri. Per
// leggere va benissimo; per le domande che attraversano la saga no —
// «Chi è costui?» sfoglia i volumi che hai finito, e un volume che non e'
// su questo dispositivo resta muto (adesso lo dichiara, ma resta muto).
// Aprirli uno per uno per sbloccarli e' una faccenda da dieci minuti:
// questo giro li porta giu' tutti insieme, una volta sola.
//
// Un tomo per volta, come ogni passata lunga di questa app: venti
// scaricamenti in parallelo su una connessione da tablet sono il modo di
// non finirne nessuno. Il filo `vivo` e' l'unico modo di fermarlo a meta',
// e quel che e' gia' sceso resta sceso.
export async function portaACasa(libri, { onProgress, vivo } = {}) {
  const attivo = vivo || (() => true);
  const esito = { scesi: 0, falliti: 0, fermato: false };
  if (!isSyncConfigured()) return esito;
  const session = await getSession();
  if (!session) return esito;
  const sb = await getClient();
  // si guarda adesso chi manca davvero: fra il conto della Libreria e
  // questo giro il lettore puo' aver aperto un libro
  const mancanti = [];
  for (const b of libri) {
    if (!(await getFile(b.id).catch(() => null))) mancanti.push(b);
  }
  for (const [i, b] of mancanti.entries()) {
    if (!attivo()) {
      esito.fermato = true;
      break;
    }
    onProgress?.({ i, totale: mancanti.length, titolo: b.title });
    try {
      const { data, error } = await sb.storage
        .from(BUCKET)
        .download(filePath(session.user.id, b));
      if (error || !data) esito.falliti += 1;
      else {
        await putFile(b.id, data);
        esito.scesi += 1;
      }
    } catch {
      esito.falliti += 1;
    }
  }
  return esito;
}

// Come `ensureLocalFile` per i libri: i byte si scaricano quando servono
// davvero, non a ogni sincronizzazione. Su un portatile che apri una volta
// al mese non ha senso tirare giu' mezzo giga di musica per sport.
export async function ensureLocalTrack(trackId, onScarico) {
  const local = await getTrack(trackId).catch(() => null);
  if (local) return local;
  if (!isSyncConfigured()) return null;
  const session = await getSession();
  if (!session) return null;
  const sb = await getClient();
  // l'avviso parte solo adesso, che si scarica per davvero: annunciarlo
  // prima di sapere se c'e' un cloud da cui prendere e' una bugia breve
  onScarico?.();
  const { data, error } = await sb.storage.from(BUCKET).download(trackPath(session.user.id, trackId));
  if (error || !data) return null;
  await putTrack(trackId, data);
  return data;
}

// QUANTO PESI LASSU'.
//
// Il piano gratuito da' un gigabyte, e finora ci si navigava al buio: te ne
// accorgevi quando qualcosa smetteva di caricarsi. Qui si chiede l'elenco
// del secchio e si sommano le dimensioni, separando i libri dalle melodie —
// perche' la risposta interessante non e' «quanto», e' «chi».
//
// Il conto e' quello che c'e' VERAMENTE nel secchio, non quello che secondo
// noi ci dovrebbe essere: cosi' vengono fuori anche gli avanzi di libri
// cancellati altrove.
async function elenca(sb, cartella) {
  const dentro = [];
  for (let salto = 0; ; salto += 100) {
    const { data, error } = await sb.storage
      .from(BUCKET)
      .list(cartella, { limit: 100, offset: salto });
    if (error || !data?.length) break;
    dentro.push(...data);
    if (data.length < 100) break;
  }
  return dentro;
}

// la parte che sa contare, separata da quella che sa chiedere: cosi' si puo'
// provare senza un secchio vero sotto
export function contaSpazio(radiceGrezza, braniGrezzi) {
  // Le cartelle compaiono nell'elenco senza metadati. Lo scarto si fa QUI e
  // non solo in chi chiede: una cartella contata come libro non si vede —
  // pesa zero — ma fa dire «4 libri» dove ce ne sono tre.
  const file = (lista) => (lista || []).filter((o) => o?.metadata);
  const radice = file(radiceGrezza);
  const brani = file(braniGrezzi);
  const peso = (lista) => lista.reduce((s, o) => s + (o.metadata?.size || 0), 0);
  const copertine = radice.filter((o) => o.name.endsWith(".cover"));
  const libri = radice.filter((o) => !o.name.endsWith(".cover"));
  return {
    libri: { quanti: libri.length, byte: peso(libri) },
    copertine: { quanti: copertine.length, byte: peso(copertine) },
    melodie: { quanti: brani.length, byte: peso(brani) },
    totale: peso(radice) + peso(brani),
  };
}

export async function cloudUsage() {
  if (!isSyncConfigured()) return null;
  const session = await getSession();
  if (!session) return null;
  const sb = await getClient();
  const uid = session.user.id;
  try {
    return contaSpazio(await elenca(sb, uid), await elenca(sb, `${uid}/melodie`));
  } catch {
    return null;
  }
}

export async function localFileIds() {
  try {
    return new Set(await listFileIds());
  } catch {
    return new Set();
  }
}

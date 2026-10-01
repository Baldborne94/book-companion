import { getClient, isSyncConfigured, BUCKET } from "./supabase.js";
import { esitoRegistrazione } from "./accesso.js";
import {
  putFile,
  getFile,
  putCover,
  getCover,
  removeBookData,
  removeFileOnly,
  listFileIds,
  listCoverIds,
  misureCopertine,
} from "./bookStore.js";
import {
  loadBooks, saveBooks, getProgress, setProgress, getStatus, setStatus,
  getUpdatedAt, touchBook, getTombstones, clearTombstones, getLastOpened,
  getStarted, getFinished, setDates, getSchedaAt, posaScheda,
} from "./library.js";
import {
  getCfi, setCfi, removeAnnotations, setJump,
  segnalibriInteri, evidenziazioniIntere, posaSegnalibri, posaEvidenziazioni,
} from "./annotations.js";
import { getBookMusic, setBookMusic, getFavoritesRaw, writeFavorites, saveFavorites, getListsRaw, writeLists, loadTrack, dropTrack } from "./music.js";
import { tuttiIGlossari, scriviGlossari } from "./glossarioMio.js";
import { raccontiLetti, scriviRacconti } from "./racconti.js";
import { leggiPreferite, scriviPreferite, fondiPreferite } from "./raccoltePreferite.js";
import { leggiTempo, scriviTempo, fondiTempo } from "./tempo.js";
import { leggiObiettivi, scriviObiettivi, fondiObiettivi } from "./obiettivo.js";
import { leggiQuaderno, scriviQuaderno, fondiQuaderno } from "./quaderno.js";
import { leggiDaPrendere, scriviDaPrendere, fondiDaPrendere } from "./daPrendere.js";
import { leggiRigheLeggere, aPagine, leggiRigheIntere, idDaLeggereInteri, completaPull, planSync, mergePrefs, rowFromLocal, localFromRow, normalizeRow, withRepush, colonnaMancante, senzaColonna, fondiAnnotazioni, upsertBooks, contaSpazio, portaGiu, nonCeLassu, copertineDaScaricare, copertineDaCaricare, copertineInAttesa, segnaInAttesa, fondiSchede } from "./syncCore.js";
import { daTogliereDalSecchio, avanziDelSecchio, segnaSuDrive, leggereDaLontano, nomeSuDrive } from "./driveCore.js";
import { raccontaGiro } from "./resoconto.js";
import { giroDrive, giroMelodie, archiviaSuDrive, driveAcceso, driveProntoOra, mappaDrive, scaricaDaDrive, collegaDrive, fileRemoto, fermaCbrCompresso, sostituisciSuDrive, chiaveDrive, DriveScollegato, adottaCbz, elencaFile } from "./drive.js";
import { tipiDi, tipoDi } from "./library.js";
import { misureFile, listTrackIds } from "./bookStore.js";
import { nuovaMemoria, firmaLontana } from "./ultimiLontani.js";
import { unaPerChiave } from "./inVolo.js";

const LONTANI = nuovaMemoria();

// `contaSpazio` viveva qui ed e' passata in `syncCore` con le altre
// decisioni pure; si riesporta perche' chi la cercava la trovi dov'era.
export { contaSpazio };

const LAST_SYNC_KEY = "bc_lastsync";
const REPUSH_KEY = "bc_repush";
const PREFS_UPD_KEY = "bc_prefs_upd";

export const getLastSync = () => parseInt(localStorage.getItem(LAST_SYNC_KEY), 10) || 0;

export const touchPrefs = () => localStorage.setItem(PREFS_UPD_KEY, String(Date.now()));

const filePath = (uid, book) => `${uid}/${book.id}.${book.fileType || "epub"}`;
const coverPath = (uid, id) => `${uid}/${id}.cover`;
// per un pezzo le melodie sono salite in `uid/melodie/`: la cartella resta
// nel conto dello spazio finche' non e' vuota, e la spazzata qui sotto la
// svuota una volta per dispositivo
const MELODIE_SVUOTATE_KEY = "bc_melodie_svuotate";

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

// EMAIL E PASSWORD, chiesto dal lettore: aspettare una mail e aprirne il
// link ogni volta che si cambia dispositivo e' una porta che si apre solo
// se la posta funziona — e su un tablet, dove l'app e' installata come
// PWA, il link apre il browser invece dell'app. La password sta nel
// portachiavi del dispositivo e si entra in due tocchi.
//
// Il link per posta NON se ne va: e' la strada di scorta quando la
// password non ce l'hai piu', ed e' anche l'unica che funziona senza aver
// mai registrato niente.
export async function entraConPassword(email, password) {
  const sb = await getClient();
  if (!sb) throw new Error("sync non configurata");
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

// La sessione puo' NON arrivare, ed e' il caso normale: se il progetto
// Supabase chiede la conferma dell'indirizzo (impostazione di partenza),
// `signUp` registra l'utente e manda una mail, ma dentro non ci si entra
// finche' non si conferma. Chi chiama deve poterlo dire, o il pannello
// resterebbe fermo senza spiegare perche'.
export async function registraConPassword(email, password) {
  const sb = await getClient();
  if (!sb) throw new Error("sync non configurata");
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
  // «dentro» | «conferma» | «esiste» — il terzo e' l'email gia' registrata,
  // che Supabase NON segnala come errore: vedi `esitoRegistrazione`
  return { esito: esitoRegistrazione(data) };
}

// LA SESSIONE PUO' CADERE SENZA CHE NESSUNO ABBIA PREMUTO «ESCI»: la
// libreria di Supabase la butta via da sola quando il refresh token viene
// rifiutato dal server e l'access token e' gia' scaduto (`_removeSession`
// nel giro di rinfresco), e fin qui l'app se ne accorgeva solo al prossimo
// sguardo — la nuvoletta restava accesa e il pannello riproponeva i campi
// dell'accesso senza una riga a dire perche' («avevo già fatto accesso,
// perché mi chiede di nuovo…»). Chi ascolta qui puo' dirlo. L'uscita
// voluta si distingue da quella subita, o si direbbe «scaduta» a chi ha
// appena premuto il tasto.
let uscitaVoluta = false;
export function onAuthChange(cb) {
  let sub = null;
  let vivo = true;
  getClient().then((sb) => {
    if (!sb || !vivo) return;
    sub = sb.auth.onAuthStateChange((evento, sessione) => {
      const voluta = uscitaVoluta;
      if (evento === "SIGNED_OUT") uscitaVoluta = false;
      cb(evento, sessione, voluta);
    }).data?.subscription;
    if (!vivo) sub?.unsubscribe();
  });
  return () => {
    vivo = false;
    sub?.unsubscribe();
  };
}

// LA CONFERMA CHE NON ARRIVA PIU' E' UN VICOLO CIECO. Se il progetto
// chiede di confermare l'indirizzo, chi si e' registrato e poi ha perso
// quel messaggio — cestinato, finito nello spam, aperto su un altro
// dispositivo e mai piu' ritrovato — non ha NESSUNA strada dentro l'app:
// «Entra» risponde per sempre che l'indirizzo non e' confermato,
// «Registrati» che l'email c'e' gia', e il link per posta non conferma
// niente. L'unico modo era andare a rovistare nel pannello di Supabase.
export async function rimandaConferma(email) {
  const sb = await getClient();
  if (!sb) throw new Error("sync non configurata");
  const { error } = await sb.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

// Serve a chi e' entrato col link e vuole smettere di dipenderne, ed e'
// anche l'unica strada per rimettere una password dimenticata: si entra
// col link, si riscrive la password, e la volta dopo si entra in due
// tocchi. Cosi' non serve una pagina di recupero tutta sua.
export async function cambiaPassword(password) {
  const sb = await getClient();
  if (!sb) throw new Error("sync non configurata");
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  uscitaVoluta = true;
  const sb = await getClient();
  await sb?.auth.signOut();
}

// Schema non ancora migrato: invece di rompere tutta la sincronizzazione,
// si rinuncia al singolo campo e si salva il resto.
function readLocalState(id) {
  return {
    status: getStatus(id),
    started: getStarted(id),
    finished: getFinished(id),
    progress: getProgress(id),
    cfi: getCfi(id),
    // INTERI, lapidi comprese: se lassu' salissero solo i vivi, l'altro
    // dispositivo non saprebbe mai che un'evidenziazione l'hai cancellata
    // e te la rimanderebbe indietro al primo giro
    marks: segnalibriInteri(id),
    highlights: evidenziazioniIntere(id),
    music: getBookMusic(id),
  };
}

// Torna `true` se la fusione ha lasciato qui dentro qualcosa che il cloud
// non ha: quella riga va rimandata su, o le annotazioni di questo
// dispositivo resterebbero qui per sempre — la sua riga e' piu' vecchia,
// quindi non verra' mai spinta da sola.
function writeLocalState(id, state) {
  setStatus(id, state.status);
  // dopo setStatus, che altrimenti le riscriverebbe con l'ora locale
  if (state.started || state.finished) {
    setDates(id, { started: state.started, finished: state.finished });
  }
  setProgress(id, state.progress);
  if (state.cfi) setCfi(id, state.cfi);
  // SI FONDONO, NON SI SOSTITUISCONO: qui prima si scriveva addosso al
  // locale quello che arrivava dal cloud, e chi aveva evidenziato di qua
  // fra due sincronizzazioni perdeva tutto senza un avviso.
  const segni = fondiAnnotazioni(segnalibriInteri(id), state.marks);
  const evid = fondiAnnotazioni(evidenziazioniIntere(id), state.highlights);
  posaSegnalibri(id, segni.lista);
  posaEvidenziazioni(id, evid.lista);
  if (state.music) setBookMusic(id, state.music);
  return segni.daMandare + evid.daMandare > 0;
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
    racconti: [...raccontiLetti()],
    tempo: leggiTempo(),
    obiettivi: leggiObiettivi(),
    quaderno: leggiQuaderno(),
    da_prendere: leggiDaPrendere(),
    raccolte_fav: leggiPreferite(),
    last_opened: getLastOpened(),
    updated_at: parseInt(localStorage.getItem(PREFS_UPD_KEY), 10) || 0,
  };
}

// IL GIRO DI DRIVE, con quel che sa solo questo dispositivo: quali libri
// hanno i byte qui, quanto pesano, e di che tipo sono (la cartella dove va
// un libro nuovo). Un Drive che esplode non si porta via la sincronizzazione
// delle schede: si conta come un file non salito, e al giro dopo si riprova.
async function giroDelDrive(books, { say, inUscita, secchio = null, altrove = null } = {}) {
  if (!driveAcceso()) return {};
  try {
    const qui = new Set(await listFileIds().catch(() => []));
    const misure = await misureFile().catch(() => new Map());
    const tipi = tipiDi(books);
    const esito = await giroDrive(books, {
      tipo: (b) => tipoDi(b, tipi),
      qui,
      misure,
      inUscita,
      secchio,
      leggiByte: async (id) => {
        const qua = await getFile(id).catch(() => null);
        if (qua) return qua;
        const b = books.find((x) => x.id === id);
        return b && altrove ? altrove(b) : null;
      },
      say,
    });
    if (esito.saltato) return esito;
    const falliti = (esito.falliti || 0) + (await giroDellaMusica(say));
    return { ...esito, falliti, archiviato: await archivioDelGiorno(books, say) };
  } catch {
    return { falliti: 1 };
  }
}

// L'ARCHIVIO DELLE SCHEDE va su Drive dopo i file (vedi `archiviaSuDrive`):
// una volta al giorno, e un archivio che non parte non si porta via il giro.
async function archivioDelGiorno(books, say) {
  try {
    const r = await archiviaSuDrive(
      async () => {
        say("Metto al sicuro le schede su Drive…");
        return (await import("./exportLibrary.js")).archivioSchede();
      },
      { roba: books.length + getFavoritesRaw().length }
    );
    return !!r.fatto;
  } catch {
    return false;
  }
}

// LA MUSICA DOPO I LIBRI: sale quel che ha i byte qui, e le voci che stanno
// su Drive si segnano (`segnaSuDrive`) — e' quel segno a farle viaggiare
// nelle preferenze fino all'altro dispositivo, che le scarica quando le
// suoni. Torna quante non sono salite; un giro della musica che esplode non
// si porta via quello dei libri.
async function giroDellaMusica(say) {
  try {
    const qui = new Set(await listTrackIds().catch(() => []));
    const m = await giroMelodie(getFavoritesRaw(), { qui, leggiTrack: (id) => loadTrack(id).catch(() => null), say });
    if (m.melodie) {
      // si rilegge l'elenco di ADESSO: una melodia aggiunta mentre il giro
      // caricava non va sovrascritta con la copia di quando e' partito
      const { lista, cambiate } = segnaSuDrive(getFavoritesRaw(), m.melodie);
      if (cambiate) saveFavorites(lista);
    }
    return m.falliti || 0;
  } catch {
    return 1;
  }
}

// Senza un accesso a Supabase i libri su Drive si riconoscono e salgono lo
// stesso: le schede restano su questo dispositivo, i file vanno al sicuro.
export async function sincronizzaSoloDrive({ onProgress } = {}) {
  return giroDelDrive(loadBooks(), { say: (m) => onProgress?.(m) });
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
    rowFromLocal(b, readLocalState(b.id), getUpdatedAt(b.id, b.addedAt || 1), getSchedaAt(b.id))
  );
  const tombstones = getTombstones();
  // le righe di prima, per dire alla fine che cosa e' cambiato
  const primaQui = new Map(localRows.map((r) => [r.id, r]));
  const copertineScese = new Set();
  const copertineSalite = new Set();

  // LE RIGHE LEGGERE PER DECIDERE, INTERE SOLO QUELLE CHE SI MUOVONO (vedi
  // `leggiRigheLeggere` in `syncCore.js`): la biblioteca intera a ogni giro
  // erano seicento righe con tutte le evidenziazioni, per scoprire quasi
  // sempre che non era cambiato niente
  const tabella = () => sb.from("books");
  const lette = await leggiRigheLeggere((colonne) => aPagine((da, a) => tabella().select(colonne).eq("user_id", uid).order("id").range(da, a)));
  const remoteRows = lette.righe;

  // i libri che la fusione delle annotazioni arricchisce e che vanno
  // rimandati su a fine ricezione
  const daRimandare = [];

  const piano = planSync({
    localRows,
    tombstones,
    remoteRows: remoteRows || [],
  });
  const { push, removeLocal } = piano;
  let pull = piano.pull;
  // chi scende e chi sale sopra una riga che c'e' gia' si legge intero; una
  // riga che doveva scendere e non e' arrivata intera resta al giro dopo
  let intere = new Map();
  if (lette.intere) intere = new Map(remoteRows.map((r) => [r.id, r]));
  else {
    const ids = idDaLeggereInteri({ pull, push, remote: remoteRows });
    if (ids.length) intere = await leggiRigheIntere((lotto) => tabella().select("*").eq("user_id", uid).in("id", lotto), ids);
    pull = completaPull(pull, intere);
  }

  // Se questo dispositivo e' piu' recente ma piu' indietro, la posizione
  // remota non va persa: la teniamo da parte e la proponiamo all'apertura.
  for (const row of push) {
    if (row.deleted) continue;
    const r = intere.get(row.id);
    if (r && !r.deleted && r.cfi && (r.progress || 0) > (row.progress || 0) + 0.02) {
      setJump(row.id, { cfi: r.cfi, progress: r.progress });
    }
  }

  // LA FUSIONE VALE ANCHE IN PARTENZA, non solo in ricezione.
  //
  // Il caso: leggo sul tablet alle 10, e sul telefono avevo evidenziato
  // alle 9:50. La riga del tablet e' piu' recente, quindi PARTE — e senza
  // questa fusione si porterebbe dietro solo le sue annotazioni,
  // cancellando dal cloud quelle del telefono. Non sarebbero perse per
  // sempre (il telefono ce le ha ancora, e alla sua prossima
  // sincronizzazione le rimanderebbe su), ma per un po' il cloud
  // racconterebbe una bugia — e su un dispositivo che non si accende piu'
  // quella bugia diventa definitiva.
  //
  // Quel che si fonde si scrive anche qui, senza timbrare l'ora: e' il
  // nostro stesso invio, non roba nuova, e ri-timbrare farebbe ripartire
  // la stessa riga al giro dopo.
  for (const row of push) {
    if (row.deleted) continue;
    const r = intere.get(row.id);
    if (!r || r.deleted) continue;
    const segni = fondiAnnotazioni(row.marks, Array.isArray(r.marks) ? r.marks : []);
    const evid = fondiAnnotazioni(row.highlights, Array.isArray(r.highlights) ? r.highlights : []);
    row.marks = segni.lista;
    row.highlights = evid.lista;
    posaSegnalibri(row.id, segni.lista);
    posaEvidenziazioni(row.id, evid.lista);
  }

  // LA SCHEDA PIU' NUOVA LASSU' NON SI COPRE (vedi `schedaPiuNuova`): la
  // riga sale perche' la lettura di qui e' piu' recente, ma coi campi della
  // scheda di lassu', che si posano anche qui
  const schede = fondiSchede({ push, pull, intere, locali: localRows });
  push.splice(0, push.length, ...schede.push);
  pull = schede.pull;
  const schedeScese = schede.scese;
  if (schedeScese.size) {
    saveBooks(loadBooks().map((b) => (schedeScese.has(b.id) ? { ...b, ...localFromRow(schedeScese.get(b.id)).book } : b)));
    for (const [id, riga] of schedeScese) posaScheda(id, riga.scheda_at);
  }

  // Finche' lo schema resta indietro il flag non si chiude: al primo invio
  // completo i campi persi tornano nel cloud da soli.
  const repairing = localStorage.getItem(REPUSH_KEY) !== "done";
  // `piano.pull` e non `pull`: una riga che doveva scendere e non e' arrivata
  // intera e' comunque piu' nuova lassu', e il rinvio di riparazione non
  // deve rimandarci sopra la copia vecchia di qui
  const toPush = repairing ? withRepush({ push, pull: piano.pull, removeLocal, localRows }) : push;
  let degraded = false;

  if (toPush.length) {
    say(`Invio ${toPush.length} ${toPush.length === 1 ? "libro" : "libri"}…`);
    const rows = toPush.map((r) => ({ ...normalizeRow(r), user_id: uid }));
    const missing = await upsertBooks((p) => sb.from("books").upsert(p), rows);
    degraded = missing.length > 0;
    if (degraded) say(`Sincronizzato (${missing.join(", ")}: aggiorna lo schema)`);
    const deletedIds = push.filter((r) => r.deleted).map((r) => r.id);
    if (deletedIds.length) {
      const paths = deletedIds.flatMap((id) => [
        `${uid}/${id}.epub`,
        `${uid}/${id}.pdf`,
        `${uid}/${id}.cbz`,
        `${uid}/${id}.cbr`,
        coverPath(uid, id),
      ]);
      await sb.storage.from(BUCKET).remove(paths).catch(() => {});
      clearTombstones(deletedIds);
    }
  }
  if (!degraded) localStorage.setItem(REPUSH_KEY, "done");

  // I FILE DEI LIBRI NON SALGONO PIU' SU SUPABASE: stanno su Google Drive
  // (deciso dal lettore, che li' ha 100 GB e qui uno). Il secchio si tiene
  // le copertine, e dei libri solo quel che Drive non ha ancora — il tempo
  // di portarlo su (vedi `giroDrive` e `daTogliereDalSecchio`).
  let secchio = null;
  try {
    secchio = contaSpazio(await elenca(sb, uid), []);
  } catch {
    /* senza l'elenco non si indovina: si riprova al giro dopo */
  }
  let falliti = 0;
  let prefsGuaste = "";
  const drive = await giroDelDrive(books, {
    say,
    inUscita: new Set(removeLocal),
    secchio: secchio?.idLibri || null,
    // un libro che sta solo nel secchio si scarica da li' e sale su Drive
    // senza passare dal dispositivo: il tablet si voleva libero
    altrove: async (b) => {
      const { data } = await sb.storage.from(BUCKET).download(filePath(uid, b));
      return data || null;
    },
  });
  falliti += drive.falliti || 0;
  // E QUEL CHE DRIVE HA, IL SECCHIO LO LASCIA: e' spazio del piano gratuito
  // occupato da una seconda copia. Solo dopo un giro di Drive riuscito —
  // con la chiave scaduta la mappa e' quella di ieri, e nel dubbio il
  // secchio si tiene la sua copia.
  if (drive.mappa && secchio?.idLibri) {
    const via = daTogliereDalSecchio(secchio.idLibri, drive.mappa);
    if (via.length) say(`Libero il cloud da ${via.length === 1 ? "un libro" : `${via.length} libri`} che stanno su Drive…`);
    for (let i = 0; i < via.length; i += 100) {
      const percorsi = via
        .slice(i, i + 100)
        .flatMap((id) => ["epub", "pdf", "cbz", "cbr"].map((ext) => `${uid}/${id}.${ext}`));
      // uno sgombero non riuscito non ferma niente: si riprova al giro dopo
      await sb.storage.from(BUCKET).remove(percorsi).catch(() => {});
    }
  }
  // e quel che non e' di nessun libro vivo se ne va con o senza Drive
  // (vedi `avanziDelSecchio`)
  if (secchio?.idLibri) {
    const avanzi = avanziDelSecchio(secchio.idLibri, {
      libri: books,
      righe: remoteRows || [],
      lapidi: Object.keys(tombstones || {}),
      inUscita: removeLocal,
    });
    if (avanzi.length) say(`Tolgo dal cloud ${avanzi.length === 1 ? "un file" : `${avanzi.length} file`} che non è più di nessun libro…`);
    for (let i = 0; i < avanzi.length; i += 100) {
      const percorsi = avanzi
        .slice(i, i + 100)
        .flatMap((id) => ["epub", "pdf", "cbz", "cbr"].map((ext) => `${uid}/${id}.${ext}`));
      await sb.storage.from(BUCKET).remove(percorsi).catch(() => {});
    }
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
  let copertineNuove = 0;
  const copertineQui = new Set(await listCoverIds().catch(() => []));
  const inAttesa = copertineInAttesa();
  for (const b of copertineDaCaricare(books, { qui: copertineQui, lassu: secchio?.idCopertine, inAttesa })) {
    const cover = await getCover(b.id).catch(() => null);
    if (!cover) continue;
    const { error: cErr } = await sb.storage
      .from(BUCKET)
      .upload(coverPath(uid, b.id), cover, { upsert: true });
    // una copertina che non sale non ferma niente: si riprova al giro dopo
    if (cErr && cErr.statusCode !== "409") continue;
    segnaInAttesa(b.id, false);
    copertineSalite.add(b.id);
    // l'elenco del secchio e' di prima del viaggio: senza, la copertina
    // appena salita sembrerebbe un'altra, e scenderebbe quella vecchia
    secchio.idCopertine.add(b.id);
    secchio.misureCopertine.set(b.id, cover.size);
    copertineNuove += 1;
    if (copertineNuove === 1) say("Mando su le copertine…");
  }
  // una copertina tolta qui (tornata al dorso) mentre il cloud non
  // rispondeva: lassu' c'e' ancora quella di prima, e si toglie adesso
  if (secchio) {
    for (const id of copertineInAttesa()) {
      if (copertineQui.has(id)) continue;
      try {
        const { error } = await sb.storage.from(BUCKET).remove([coverPath(uid, id)]);
        if (error) continue;
        segnaInAttesa(id, false);
        secchio.idCopertine.delete(id);
      } catch {
        /* si riprova al giro dopo */
      }
    }
  }

  // I FILE AUDIO NON SALGONO PIU' (deciso dal lettore: «ogni dispositivo ha
  // i suoi file e condivide solo i link»). Per un pezzo sono saliti nella
  // cartella `melodie/` del secchio, e quei byte adesso non li scarica piu'
  // nessuno: si tolgono, una volta per dispositivo, cosi' non restano a
  // pesare sul gigabyte del piano. Chi ha i file ce li ha ancora in casa.
  if (!localStorage.getItem(MELODIE_SVUOTATE_KEY)) {
    try {
      const avanzi = (await elenca(sb, `${uid}/melodie`))
        .filter((o) => o?.metadata)
        .map((o) => `${uid}/melodie/${o.name}`);
      if (avanzi.length) {
        say("Tolgo dal cloud le melodie di una volta…");
        const { error } = await sb.storage.from(BUCKET).remove(avanzi);
        if (error) throw error;
      }
      localStorage.setItem(MELODIE_SVUOTATE_KEY, "1");
    } catch {
      /* si riprova al giro dopo: il resto della sincronizzazione non aspetta */
    }
  }

  if (pull.length || removeLocal.length) say("Ricevo le novità…");
  let next = loadBooks();
  try {
    for (const row of pull) {
      // e la scheda piu' nuova QUI resta: la lettura scende, la scheda no,
      // e la riga fusa risale (vedi `fondiSchede`)
      const tieniScheda = schede.tenute.has(row.id);
      const { book, state } = localFromRow(row);
      const i = next.findIndex((b) => b.id === book.id);
      if (i >= 0) next[i] = { ...next[i], ...book };
      else next.push(book);
      const arricchita = writeLocalState(book.id, state);
      touchBook(book.id, row.updated_at);
      posaScheda(book.id, Number(row.scheda_at) || 0);
      // L'EBOOK TOLTO ALTROVE SE NE VA ANCHE DA QUI. «Togli l'ebook, tieni
      // la scheda» e' una scelta sul LIBRO, non su un dispositivo: se i
      // byte restassero qui, questo tablet si terrebbe un file che la sua
      // stessa scheda dichiara sparito — invisibile e a occupare spazio,
      // cioe' il contrario di quel che il comando promette. La copertina e
      // i tuoi segni non si toccano, e il file si rimette reimportandolo.
      if (book.fileTolto) await removeFileOnly(book.id).catch(() => {});
      // La fusione ha aggiunto roba nostra: da adesso questa riga e' piu'
      // recente di quella lassu', cosi' anche se il viaggio di ritorno
      // qui sotto non riesce, la prossima sincronizzazione la manda.
      if (arricchita || tieniScheda) {
        touchBook(book.id);
        daRimandare.push(book.id);
      }
      // UNA COPERTINA NON VALE UN RIPRISTINO. Stava dentro il giro senza
      // rete di sicurezza: un solo scaricamento andato storto — e sono
      // cinquantaquattro, su una connessione qualunque — buttava via
      // l'intera ricezione, perche' `saveBooks` sta in fondo e non ci si
      // arrivava mai. Il libro si tiene comunque: senza copertina si vede
      // il dorso disegnato, ed e' infinitamente meglio di niente.
      try {
        if (!copertineInAttesa().has(book.id) && !(await getCover(book.id))) {
          const { data } = await sb.storage.from(BUCKET).download(coverPath(uid, book.id));
          if (data) {
            await putCover(book.id, data);
            copertineScese.add(book.id);
          }
        }
      } catch {
        /* si riprova alla prossima sincronizzazione */
      }
    }

    // IL VIAGGIO DI RITORNO. Senza, la fusione salverebbe le annotazioni
    // di questo dispositivo qui e basta: l'altro non le vedrebbe mai,
    // perche' la nostra riga era la piu' vecchia. Se non parte non si
    // perde niente — il locale e' gia' salvo e il segno del tempo dice
    // che tocca a noi.
    if (daRimandare.length) {
      say(`Rimando ${daRimandare.length === 1 ? "un libro" : `${daRimandare.length} libri`} con le annotazioni fuse…`);
      try {
        const rows = daRimandare
          .map((id) => next.find((b) => b.id === id))
          .filter(Boolean)
          .map((b) => ({
            ...normalizeRow(rowFromLocal(b, readLocalState(b.id), getUpdatedAt(b.id, b.addedAt || 1), getSchedaAt(b.id))),
            user_id: uid,
          }));
        if (rows.length) await upsertBooks((p) => sb.from("books").upsert(p), rows);
      } catch {
        /* la prossima sincronizzazione riprova: qui non si e' perso niente */
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

  // LE COPERTINE CHE MANCANO QUI SI VANNO A RIPRENDERE, fuori dal giro di
  // `pull` (vedi `copertineDaScaricare`): dentro, una riga gia' in pari non
  // ci ripassava mai piu' e il dorso disegnato restava per sempre sopra
  // un'immagine che lassu' c'e' eccome.
  //
  // Una copertina che non scende non ferma niente — e' la stessa regola del
  // giro che le manda su: senza, si vede il dorso disegnato, che e'
  // infinitamente meglio di una ricezione buttata via.
  if (secchio?.idCopertine?.size) {
    try {
      const qui = new Set(await listCoverIds());
      const mancanti = copertineDaScaricare(next, {
        qui,
        lassu: secchio.idCopertine,
        misureQui: await misureCopertine(),
        misureLassu: secchio.misureCopertine,
        inAttesa: copertineInAttesa(),
      });
      if (mancanti.length)
        say(`Riprendo ${mancanti.length === 1 ? "una copertina" : `${mancanti.length} copertine`}…`);
      for (const b of mancanti) {
        try {
          const { data } = await sb.storage.from(BUCKET).download(coverPath(uid, b.id));
          if (data) {
            await putCover(b.id, data);
            copertineScese.add(b.id);
          }
        } catch {
          /* si riprova alla prossima sincronizzazione */
        }
      }
    } catch {
      /* senza l'elenco di casa non si indovina: si riprova al giro dopo */
    }
  }

  const { data: remotePrefsRows } = await sb.from("prefs").select("*").eq("user_id", uid).limit(1);
  const { merged, favsLocali, applyLocal, pushRemote } = mergePrefs(localPrefs(), remotePrefsRows?.[0] || null);
  const stamp = pushRemote ? Date.now() : merged.updated_at;
  if (applyLocal) {
    if (merged.reader) localStorage.setItem("bc_reader", JSON.stringify(merged.reader));
    // qui si scrivono i link fusi PIU' i file di questo dispositivo, che
    // non sono mai partiti; lassu' (`merged`) vanno i soli link
    writeFavorites(favsLocali);
    // una melodia cancellata sull'altro dispositivo se ne va anche da qui,
    // byte compresi: sono la cosa pesante, e nessuna voce li suonera' piu'
    for (const f of favsLocali) if (f.deleted && f.trackId) dropTrack(f.trackId);
    writeLists(merged.music_lists);
    scriviGlossari(merged.glossari || {});
    scriviRacconti(merged.racconti || []);
    // si rifonde con quel che c'e' ADESSO: una voltata arrivata mentre il
    // giro era in rete ha gia' scritto il suo minuto, e sovrascriverlo con la
    // copia letta all'inizio del giro lo perderebbe
    scriviTempo(fondiTempo(leggiTempo(), merged.tempo));
    scriviObiettivi(fondiObiettivi(leggiObiettivi(), merged.obiettivi));
    scriviQuaderno(fondiQuaderno(leggiQuaderno(), merged.quaderno));
    scriviDaPrendere(fondiDaPrendere(leggiDaPrendere(), merged.da_prendere));
    // il cuore delle raccolte: rifuso con quel che c'e' adesso, come la lista
    scriviPreferite(fondiPreferite(leggiPreferite(), merged.raccolte_fav));
    if (merged.last_opened) localStorage.setItem("bc_lastopen", merged.last_opened);
  }
  if (pushRemote) {
    // Le preferenze rinunciano alle colonne che lo schema non ha ancora,
    // una per volta, come fanno i libri: prima una colonna mancante
    // faceva morire tutto il giro, e «ultima sincronizzazione» restava
    // «mai» anche quando i libri erano saliti e scesi senza un graffio.
    let riga = { ...merged, updated_at: stamp, user_id: uid };
    const persi = [];
    // E NEMMENO LE PREFERENZE SI PORTANO VIA IL GIRO. Qui c'era un `throw`,
    // ed era l'ultimo rimasto: un errore che non e' una colonna mancante
    // saltava il timbro dell'ora e il resoconto, quindi il pannello diceva
    // «Sincronizzazione fallita» sopra a libri, file e copertine arrivati
    // tutti a destinazione. Quel che e' andato storto e' delle preferenze:
    // si conta, si dice, e il giro finisce.
    try {
      for (let i = 0; i <= 8; i += 1) {
        const { error } = await sb.from("prefs").upsert(riga);
        if (!error) break;
        const manca = colonnaMancante(error);
        const ridotta = manca ? senzaColonna(riga, manca) : null;
        if (!ridotta) {
          prefsGuaste = error?.message || "errore";
          break;
        }
        riga = ridotta;
        persi.push(manca);
      }
    } catch (e) {
      prefsGuaste = e?.message || "errore";
    }
    if (persi.length) say(`Sincronizzato (${persi.join(", ")}: aggiorna lo schema)`);
    if (prefsGuaste) say(`Preferenze non sincronizzate: ${prefsGuaste}`);
  }
  localStorage.setItem(PREFS_UPD_KEY, String(stamp));

  localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  const remotaDi = new Map((remoteRows || []).map((r) => [r.id, r]));
  const titoloDi = (id) => next.find((b) => b.id === id)?.title || primaQui.get(id)?.title || "";
  const racconto = raccontaGiro({
    arrivati: pull.map((row) => ({ prima: primaQui.get(row.id) || null, dopo: row })),
    schede: [...schedeScese].map(([id, row]) => ({ prima: primaQui.get(id) || null, dopo: row })),
    // una riga che lassu' c'e' ma non si e' letta intera non e' «nuova»:
    // la riga leggera non ha i campi, e un campo che manca non si racconta
    partiti: push.filter((r) => !r.deleted).map((row) => ({ prima: intere.get(row.id) || remotaDi.get(row.id) || null, dopo: row })),
    tolti: removeLocal.map((id) => primaQui.get(id)?.title).filter(Boolean),
    cancellati: push.filter((r) => r.deleted).map((r) => intere.get(r.id)?.title).filter(Boolean),
    copertine: [
      ...[...copertineScese].map((id) => ({ titolo: titoloDi(id), verso: "qui" })),
      ...[...copertineSalite].map((id) => ({ titolo: titoloDi(id), verso: "lassu" })),
    ].filter((c) => c.titolo),
  });
  return {
    racconto,
    pushed: toPush.length,
    pulled: pull.length,
    removed: removeLocal.length,
    // i file che non sono saliti: si contano e si dicono, non alzano piu'
    falliti,
    prefsGuaste,
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
  // segnata PRIMA del viaggio: se non arriva, il giro la manda dopo invece
  // di coprirla con quella di prima che sta ancora lassu'
  segnaInAttesa(bookId, true);
  try {
    const session = await getSession();
    if (!session) return false;
    const sb = await getClient();
    const uid = session.user.id;
    const cover = await getCover(bookId);
    if (!cover) {
      const { error } = await sb.storage.from(BUCKET).remove([coverPath(uid, bookId)]);
      if (!error) segnaInAttesa(bookId, false);
      return !error;
    }
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(coverPath(uid, bookId), cover, { upsert: true });
    if (!error) segnaInAttesa(bookId, false);
    return !error;
  } catch {
    return false;
  }
}

// L'EBOOK TOLTO A MANO SE NE VA ANCHE DAL SECCHIO.
//
// «Togli l'ebook, tieni la scheda» vuol dire togliere il file, non
// nasconderlo: lasciandone una copia lassu' il libro resterebbe con la
// nuvoletta addosso e «Porta qui i tomi» si offrirebbe di riscaricarlo —
// cioe' il tasto che disfa la scelta appena fatta — e quei megabyte
// continuerebbero a pesare sul gigabyte del piano.
//
// LA COPERTINA RESTA, e non e' una dimenticanza: e' lei che tiene il libro
// sullo scaffale, ed e' anche quella che l'altro dispositivo va a
// riprendersi. Senza cloud non c'e' niente da fare e non e' un guasto: i
// byte di qui se ne sono andati lo stesso, che e' il grosso del lavoro.
export async function togliFileDalCloud(book) {
  if (!isSyncConfigured() || !book?.id) return false;
  try {
    const session = await getSession();
    if (!session) return false;
    const sb = await getClient();
    const { error } = await sb.storage.from(BUCKET).remove([filePath(session.user.id, book)]);
    return !error;
  } catch {
    return false;
  }
}

// UN LIBRO SI PRENDE PRIMA DA DRIVE, poi dal secchio: da quando i file
// stanno su Drive il secchio ha solo quel che non e' ancora stato portato
// lassu'. A chiave scaduta si chiede la chiave nuova — chi apre un libro ha
// appena toccato lo schermo, e Google la finestra la apre solo dopo un tocco.
// Un file che Drive non ha piu' (tolto a mano dal lettore) e' «non c'e'»,
// non un guasto: si prova il secchio.
// una discesa per file (`inVolo.js`): il lettore e il giro dei libri in
// lettura chiedevano lo stesso volume insieme, e la rete si divideva in due
const DISCESE = unaPerChiave();
const scendi = (voce, onProgress) => DISCESE(voce.id, (avvisa) => scaricaDaDrive(voce.id, { onProgress: avvisa, totale: voce.byte }), { onProgress });

async function dalDrive(book, { onProgress } = {}) {
  const voce = driveAcceso() ? mappaDrive()[book.id] : null;
  if (!voce) return null;
  if (!driveProntoOra()) await collegaDrive();
  try {
    return await scendi(voce, onProgress);
  } catch (e) {
    if (e?.status === 404) return null;
    throw e;
  }
}

// I byte di un libro che qui non c'e', PRESI E BASTA: da Drive, poi dal
// secchio, e niente scritto su disco. E' la strada di chi legge — vedi
// `fileDaLeggere` — e di chi vuole tenerlo (`ensureLocalFile`), che ci
// aggiunge la scrittura.
async function prendiFile(book, opzioni = {}) {
  const daDrive = await dalDrive(book, opzioni).catch(() => null);
  if (daDrive) return daDrive;
  if (!isSyncConfigured()) return null;
  const session = await getSession();
  if (!session) return null;
  const sb = await getClient();
  const { data, error } = await sb.storage.from(BUCKET).download(filePath(session.user.id, book));
  if (error || !data) return null;
  return data;
}

// IL FILE CHE UN READER DEVE APRIRE, E LA SITUAZIONE PULITA (chiesta dal
// lettore: «tutti i libri, fumetti e manga li tieni su Drive e me li leggo
// puntando lì, e solo se voglio leggerli offline me li scarichi in
// locale»). Tre casi, in quest'ordine:
// - i byte sono QUI: quelli, come sempre;
// - un fumetto o un PDF grossi su Drive: il file LONTANO letto a pezzi
//   (`leggereDaLontano`), col segno `daLontano` per il banner della chiave;
// - tutto il resto che sta lassu' (l'ePub, che epub.js vuole intero; il
//   CBR; i piccoli): scende in MEMORIA per questa lettura, col segno
//   `lontano`, e NON si scrive su disco. Riaprendolo si riprende da Drive.
// Prima di questa cura la terza strada era `ensureLocalFile`: ogni libro
// aperto restava sul tablet per sempre, e la «situazione pulita» durava
// fino alla prima lettura. Sul tablet resta solo quel che il lettore ha
// CHIESTO: «Tieni sul tablet» nella scheda, «Scarica qui» in Libreria, o
// il volume dopo se ha acceso l'anticipo.
// il pezzo di un PDF: lo stesso che pdf.js chiede da se' (`rangeChunkSize`)
const PEZZO_PDF = 64 * 1024;
export async function fileDaLeggere(book, { onProgress } = {}) {
  const local = await getFile(book.id);
  if (local) return local;
  const voce = driveAcceso() ? mappaDrive()[book.id] : null;
  await fermaCbrCompresso(book.fileType, voce);
  if (leggereDaLontano(book, voce)) {
    if (!driveProntoOra()) await collegaDrive();
    const f = fileRemoto(voce.id, voce.byte, book.fileType === "pdf" ? { minimo: PEZZO_PDF } : {});
    f.daLontano = true;
    return f;
  }
  // l'ultimo libro letto da lontano si riapre dalla memoria, senza
  // riscaricarlo (`lib/ultimiLontani.js`): stesso file lassu', stessa copia
  const firma = firmaLontana(voce);
  const ricordato = LONTANI.prendi(book.id, firma);
  if (ricordato) return ricordato;
  const preso = await prendiFile(book, { onProgress });
  if (preso) {
    preso.lontano = true;
    LONTANI.tieni(book.id, firma, preso);
  }
  return preso;
}

// UN CBR GIA' IN BIBLIOTECA CHE IL BROWSER NON APRIRA' MAI (compresso e
// oltre `CBR_MAX`: vedi `rarInCbz.js`) si converte in CBZ dal lettore, con
// un tocco. Se sta su Drive si legge da li' a finestre e il CBZ prende il
// suo posto lassu' (`sostituisciSuDrive`, il CBR nel cestino); se sta qui,
// il CBZ prende il suo posto qui. I nomi delle pagine restano, quindi anche
// l'ordine e il segno di lettura. Torna quel che cambia nella scheda.
// `chiedi: false` (il giro della Manutenzione): a chiave scaduta non si apre
// la finestra di Google, che fuori da un tocco il browser bloccherebbe — si
// dice «scollegato» e il giro si ferma.
export async function convertiLibroInCbz(book, { onProgress, chiedi = true } = {}) {
  const { convertiInCbz } = await import("./archivioFumetto.js");
  const { improntaDi } = await import("./importBook.js");
  const { formatoDaByte } = await import("./fumetto.js");
  const { pianoConversione, PERCHE_DOPPIONE } = await import("./convertiCbr.js");
  const formato = async (b) => (b ? formatoDaByte(new Uint8Array(await b.slice(0, 8).arrayBuffer())) : null);
  const qui = await getFile(book.id).catch(() => null);
  const voce = driveAcceso() ? mappaDrive()[book.id] : null;
  if (voce?.id && !driveProntoOra()) {
    if (!chiedi) throw new DriveScollegato();
    await collegaDrive();
  }
  // IL GEMELLO GIA' FATTO (vedi `gemelloCbzDi`): accanto al CBR su Drive c'e'
  // gia' il suo CBZ. Libero, si adotta; di un'altra scheda, e' un doppione
  if (voce?.id) {
    const { gemelloCbzDi } = await import("./driveCore.js");
    const gem = gemelloCbzDi(voce.id, await elencaFile());
    if (gem) {
      const altro = gem.appProperties?.bcId;
      if (altro && altro !== book.id) throw new Error(PERCHE_DOPPIONE);
      await adottaCbz({ bookId: book.id, vecchio: voce.id, nuovo: gem.id, byte: Number(gem.size) || 0 });
      LONTANI.dimentica?.(book.id);
      await removeFileOnly(book.id).catch(() => {});
      if (!(await getCover(book.id).catch(() => null))) {
        const { copertinaOriginale } = await import("./copertina.js");
        const f = fileRemoto(gem.id, Number(gem.size) || 0);
        f.daLontano = true;
        const cover = await copertinaOriginale({ ...book, fileType: "cbz" }, f).catch(() => null);
        if (cover) await putCover(book.id, cover).catch(() => {});
      }
      return { fileType: "cbz" };
    }
  }
  const lassu = voce?.id ? fileRemoto(voce.id, voce.byte) : null;
  const piano = pianoConversione({ qui: await formato(qui), lassu: await formato(lassu) });
  if (!piano) throw new Error("il file di questo libro non c'è, né qui né su Google Drive");
  let cbz = piano.sorgente === "qui" ? qui : lassu;
  if (piano.converti) {
    cbz = piano.sorgente === "qui"
      ? await convertiInCbz({ blob: qui }, { onProgress })
      : await convertiInCbz({ drive: { id: voce.id, chiave: chiaveDrive() }, misura: voce.byte }, { onProgress });
    if (qui) await putFile(book.id, cbz);
  }
  if (piano.sostituisci) {
    await sostituisciSuDrive(voce.id, cbz, {
      nome: nomeSuDrive({ ...book, fileType: "cbz" }),
      bookId: book.id,
      onProgress: (p) => onProgress?.({ ...p, carico: true }),
    });
  }
  LONTANI.dimentica?.(book.id);
  // la copertina che mancava (un CBR compresso da Drive non la dava: la
  // prima pagina compressa non si legge da lontano) si prende dal CBZ
  if (!(await getCover(book.id).catch(() => null))) {
    const { copertinaOriginale } = await import("./copertina.js");
    const cover = await copertinaOriginale({ ...book, fileType: "cbz" }, cbz).catch(() => null);
    if (cover) await putCover(book.id, cover).catch(() => {});
  }
  // l'impronta dei byte nuovi, se li ho in mano: da Drive vorrebbe dire
  // scaricare il volume solo per quella
  const impronta = cbz === lassu ? undefined : await improntaDi(cbz).catch(() => undefined);
  return { fileType: "cbz", ...(impronta ? { impronta } : {}) };
}

// I CBZ CONVERTITI SU COLAB (vedi `cbzDaAdottare`): dopo il giro, ogni CBR
// che ha il suo gemello CBZ accanto su Drive diventa quel CBZ — segno, saga
// e voto restano, la copertina che mancava si prende dal CBZ, e la copia CBR
// rimasta sul tablet se ne va (il lettore aprirebbe ancora quella). Si fa
// solo con la chiave in mano: nessuna finestra di Google senza un tocco.
// Torna, libro per libro, quel che cambia nella scheda, e lo dice SUBITO a
// `onFatto`: centosette volumi con la copertina da prendere sono minuti, e
// la scheda non aspetta l'ultimo (vedi `cbzGiaAdottati`).
export async function adottaCbzConvertiti(libri, { onFatto } = {}) {
  if (!driveAcceso() || !driveProntoOra()) return [];
  const { cbzDaAdottare, cbzGiaAdottati } = await import("./driveCore.js");
  const cbr = (libri || []).filter((b) => b?.fileType === "cbr");
  if (!cbr.length) return [];
  const file = await elencaFile();
  const da = [...cbzGiaAdottati(cbr, mappaDrive(), file), ...cbzDaAdottare(cbr, mappaDrive(), file)];
  const fatti = [];
  for (const a of da) {
    try {
      if (a.vecchio) await adottaCbz(a);
      LONTANI.dimentica?.(a.bookId);
      await removeFileOnly(a.bookId).catch(() => {});
      if (!(await getCover(a.bookId).catch(() => null))) {
        const { copertinaOriginale } = await import("./copertina.js");
        const f = fileRemoto(a.nuovo, a.byte);
        f.daLontano = true;
        const cover = await copertinaOriginale({ fileType: "cbz" }, f).catch(() => null);
        if (cover) await putCover(a.bookId, cover).catch(() => {});
      }
      const { IMPRONTA_INTERA } = await import("./importBook.js");
      const fatto = { id: a.bookId, patch: { fileType: "cbz", impronta: a.sha && a.byte <= IMPRONTA_INTERA ? a.sha : undefined } };
      fatti.push(fatto);
      onFatto?.(fatto);
    } catch (e) {
      if (e?.name === "DriveScollegato") break;
    }
  }
  return fatti;
}

// IL SEGUITO CHE SCENDE DA SE' (`lib/anticipo.js`): come `ensureLocalFile`
// ma SENZA CHIEDERE NIENTE A NESSUNO. Qui non c'e' un tocco dietro — si
// arriva da una voltata — quindi a chiave di Google scaduta non si apre la
// finestra (il browser la bloccherebbe, e se non la bloccasse sarebbe peggio:
// un accesso a Google in faccia a chi sta leggendo). Si dice «chiave» e ci
// si riprova alla prossima occasione. Esiti: «gia'» (era qui), «sceso»,
// «chiave», «assente» (lassu' non c'e'), «errore».
export async function anticipaFile(book) {
  if (await getFile(book.id).catch(() => null)) return "gia";
  try {
    const voce = driveAcceso() ? mappaDrive()[book.id] : null;
    if (voce) {
      if (!driveProntoOra()) return "chiave";
      try {
        // il volume appena letto e' gia' in memoria (`LONTANI`); se sta
        // scendendo per il lettore, ci si aggancia a quella discesa
        await putFile(book.id, LONTANI.prendi(book.id, firmaLontana(voce)) || (await scendi(voce)));
        return "sceso";
      } catch (e) {
        if (e?.name === "DriveScollegato") return "chiave";
        if (e?.status !== 404) throw e;
      }
    }
    if (!isSyncConfigured()) return "assente";
    const session = await getSession();
    if (!session) return "assente";
    const sb = await getClient();
    const { data, error } = await sb.storage.from(BUCKET).download(filePath(session.user.id, book));
    if (!data) return error && !nonCeLassu(error) ? "errore" : "assente";
    await putFile(book.id, data);
    return "sceso";
  } catch {
    return "errore";
  }
}

// TENERE IL LIBRO SUL TABLET: gli stessi byte di `prendiFile`, scritti su
// disco. Da qui passano i soli gesti che lo CHIEDONO — la scheda, «Scarica
// qui», il ripristino — mai una lettura.
// Chi lo tiene sul tablet dopo averlo letto da Drive ha gia' il file in
// memoria (`LONTANI`): si scrive quello, invece di scaricarlo di nuovo.
export async function ensureLocalFile(book, { onProgress } = {}) {
  const local = await getFile(book.id);
  if (local) return local;
  const voce = driveAcceso() ? mappaDrive()[book.id] : null;
  const preso = LONTANI.prendi(book.id, firmaLontana(voce)) || (await prendiFile(book, { onProgress }));
  if (!preso) return null;
  await putFile(book.id, preso);
  return preso;
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
// Il giro vero sta in `portaGiu` (syncCore): qui si dice solo dove sono i
// byte e come si scaricano.
// `scollegato` NON e' uno zero come gli altri: dice che al secchio non si e'
// nemmeno chiesto. Senza, chi legge l'esito non puo' distinguere «guardato,
// non c'era niente» da «non ho potuto guardare» — vedi `frasePortata`.
const NIENTE = { scesi: 0, assenti: 0, falliti: 0, fermato: false, scollegato: true };

async function daScaricare() {
  if (!isSyncConfigured()) return null;
  const session = await getSession();
  if (!session) return null;
  const sb = await getClient();
  const scarica = async (percorso) => {
    const { data, error } = await sb.storage.from(BUCKET).download(percorso);
    if (data) return data;
    if (nonCeLassu(error)) return null;
    throw error || new Error("scaricamento senza byte");
  };
  return { uid: session.user.id, scarica };
}

export async function portaACasa(libri, { onProgress, vivo } = {}) {
  const suDrive = driveAcceso() ? mappaDrive() : {};
  const dalDriveServe = (libri || []).some((b) => suDrive[b.id]);
  // il tasto e' un tocco: e' il momento buono per rinnovare la chiave di
  // Google, se e' scaduta — piu' avanti il browser la finestra la blocca
  if (dalDriveServe && !driveProntoOra()) await collegaDrive().catch(() => {});
  const drive = dalDriveServe && driveProntoOra();
  const cloud = await daScaricare();
  if (!cloud && !drive) return { ...NIENTE };
  return portaGiu(libri, {
    manca: async (b) => !(await getFile(b.id).catch(() => null)),
    scarica: async (b) => {
      if (drive && suDrive[b.id]) {
        try {
          return await scaricaDaDrive(suDrive[b.id].id);
        } catch (e) {
          if (e?.status !== 404) throw e;
        }
      }
      return cloud ? cloud.scarica(filePath(cloud.uid, b)) : null;
    },
    posa: (b, byte) => putFile(b.id, byte),
    titolo: (b) => b.title,
    onProgress,
    vivo,
  });
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

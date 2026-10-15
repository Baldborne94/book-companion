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
import { getBookMusic, setBookMusic, getFavoritesRaw, writeFavorites, getListsRaw, writeLists, dropTrack } from "./music.js";
import { tuttiIGlossari, scriviGlossari } from "./glossarioMio.js";
import { raccontiLetti, scriviRacconti } from "./racconti.js";
import { leggiPreferite, scriviPreferite, fondiPreferite } from "./raccoltePreferite.js";
import { leggiVoti, scriviVoti, fondiVoti, inViaggio, dalViaggio } from "./votiRaccolte.js";
import { leggiDispositivi, scriviDispositivi, fondiDispositivi, aggiornaQui, nomeDispositivo } from "./dispositivi.js";
import { leggiTempo, scriviTempo, fondiTempo, dispositivo } from "./tempo.js";
import { leggiObiettivi, scriviObiettivi, fondiObiettivi } from "./obiettivo.js";
import { leggiQuaderno, scriviQuaderno, fondiQuaderno } from "./quaderno.js";
import { leggiDaPrendere, scriviDaPrendere, fondiDaPrendere } from "./daPrendere.js";
import { aGruppi } from "./aGruppi.js";
import { avanziDelSecchio, leggiRigheLeggere, aPagine, fraseCopertine, COPERTINE_INSIEME, leggiRigheIntere, idDaLeggereInteri, completaPull, planSync, mergePrefs, rowFromLocal, localFromRow, normalizeRow, withRepush, colonnaMancante, senzaColonna, fondiAnnotazioni, upsertBooks, contaSpazio, portaGiu, nonCeLassu, copertineDaScaricare, copertineDaCaricare, mandaCopertine, copertineInAttesa, segnaInAttesa, fondiSchede } from "./syncCore.js";
import { raccontaGiro } from "./resoconto.js";
import { togliAvanziDrive } from "./avanziDrive.js";


// `contaSpazio` viveva qui ed e' passata in `syncCore` con le altre
// decisioni pure; si riesporta perche' chi la cercava la trovi dov'era.
export { contaSpazio };

const LAST_SYNC_KEY = "bc_lastsync";
const REPUSH_KEY = "bc_repush";
const PREFS_UPD_KEY = "bc_prefs_upd";

export const getLastSync = () => parseInt(localStorage.getItem(LAST_SYNC_KEY), 10) || 0;

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

// «PASSWORD DIMENTICATA?» COME IN CIAK (chiesto dal lettore: «fai come per
// Ciak»): l'email di reimpostazione, non il link d'accesso. Supabase la
// manda col suo modello «Reset password», e il link riporta qui con
// `type=recovery`: la libreria lo dice con l'evento `PASSWORD_RECOVERY`, e
// l'app chiede subito la password nuova. Si torna alla radice del sito,
// l'indirizzo che Supabase accetta gia' (un segno nell'indirizzo, come prima,
// andava aggiunto fra i Redirect URLs, e un link vecchio tornava senza).
export async function mandaReimpostazione(email) {
  const sb = await getClient();
  if (!sb) throw new Error("sync non configurata");
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) throw error;
}

// EMAIL E PASSWORD, chiesto dal lettore: aspettare una mail e aprirne il
// link ogni volta che si cambia dispositivo e' una porta che si apre solo
// se la posta funziona — e su un tablet, dove l'app e' installata come
// PWA, il link apre il browser invece dell'app. La password sta nel
// portachiavi del dispositivo e si entra in due tocchi.
//
// Chi la password non ce l'ha piu' (o non l'ha mai scelta) se ne fa
// mandare una nuova per email: `mandaReimpostazione`.
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

// Da dentro, o tornati dal link di «Password dimenticata?»
// (`PASSWORD_RECOVERY`): la volta dopo si entra in due tocchi.
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
    // il cuore e i voti delle raccolte nella stessa colonna (`inViaggio`)
    raccolte_fav: inViaggio(leggiPreferite(), leggiVoti(), leggiDispositivi()),
    last_opened: getLastOpened(),
    updated_at: parseInt(localStorage.getItem(PREFS_UPD_KEY), 10) || 0,
  };
}

export async function syncNow({ onProgress, onLibri } = {}) {
  if (!isSyncConfigured()) return { skipped: "non configurata" };
  const sb = await getClient();
  const session = await getSession();
  if (!session) return { skipped: "non connesso" };
  const uid = session.user.id;
  const say = (m) => onProgress?.(m);
  // la riga col permesso a lungo termine di Google, dei tempi di Drive
  // (`avanziDrive.js`): una volta per account e dispositivo
  await togliAvanziDrive({ sb, uid }).catch(() => {});

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

  // I FILE DEI LIBRI NON SALGONO SU SUPABASE: il secchio si tiene le
  // copertine, e dei libri quel che c'era da prima.
  let secchio = null;
  try {
    secchio = contaSpazio(await elenca(sb, uid), []);
  } catch {
    /* senza l'elenco non si indovina: si riprova al giro dopo */
  }
  let falliti = 0;
  let prefsGuaste = "";
  // quel che non e' di nessun libro vivo se ne va (vedi `avanziDelSecchio`)
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
  const copertineQui = new Set(await listCoverIds().catch(() => []));
  const inAttesa = copertineInAttesa();
  const salite = await mandaCopertine(copertineDaCaricare(books, { qui: copertineQui, lassu: secchio?.idCopertine, inAttesa }), {
    prendi: (id) => getCover(id).catch(() => null),
    manda: async (id, cover) => {
      const { error } = await sb.storage.from(BUCKET).upload(coverPath(uid, id), cover, { upsert: true });
      return !error || error.statusCode === "409";
    },
    say,
  });
  for (const { id, byte } of salite) {
    segnaInAttesa(id, false);
    copertineSalite.add(id);
    // l'elenco del secchio e' di prima del viaggio: senza, la copertina
    // appena salita sembrerebbe un'altra, e scenderebbe quella vecchia
    secchio.idCopertine.add(id);
    secchio.misureCopertine.set(id, byte);
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

  // si dice sempre: senza, la frase di prima (le copertine) restava a
  // schermo su un lavoro che era gia' un altro
  say(pull.length > 20 ? `Ricevo ${pull.length} libri…` : pull.length || removeLocal.length ? "Ricevo le novità…" : "Guardo le preferenze…");
  let next = loadBooks();
  const senzaCopertina = [];
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
      // LA COPERTINA SCENDE DOPO, A SCHEDE GIA' SALVATE (misurato sul
      // banco: 727 libri a 120 ms di latenza, il telefono vuoto per 99
      // secondi e poi tutto insieme — le schede erano qui dopo un secondo,
      // e aspettavano le copertine scese una alla volta). Qui si segna solo
      // chi ne manca; scendono qui sotto, a gruppi.
      try {
        if (!copertineInAttesa().has(book.id) && !(await getCover(book.id))) senzaCopertina.push(book.id);
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
  // le schede si vedono ADESSO, non alla fine del giro
  if (pull.length || removeLocal.length) onLibri?.(next);

  // LE COPERTINE CHE MANCANO QUI SI VANNO A RIPRENDERE, fuori dal giro di
  // `pull` (vedi `copertineDaScaricare`): dentro, una riga gia' in pari non
  // ci ripassava mai piu' e il dorso disegnato restava per sempre sopra
  // un'immagine che lassu' c'e' eccome.
  //
  // Una copertina che non scende non ferma niente — e' la stessa regola del
  // giro che le manda su: senza, si vede il dorso disegnato, che e'
  // infinitamente meglio di una ricezione buttata via.
  //
  // Senza l'elenco del secchio si scaricano almeno quelle dei libri appena
  // scesi, com'era prima. E scendono A GRUPPI (`COPERTINE_INSIEME`), dicendo
  // a che punto sono: una alla volta ognuna aspettava la sua latenza.
  try {
    const mancanti = secchio?.idCopertine?.size
      ? copertineDaScaricare(next, {
          qui: new Set(await listCoverIds()),
          lassu: secchio.idCopertine,
          misureQui: await misureCopertine(),
          misureLassu: secchio.misureCopertine,
          inAttesa: copertineInAttesa(),
        })
      : next.filter((b) => senzaCopertina.includes(b.id));
    let fatte = 0;
    if (mancanti.length) say(fraseCopertine(0, mancanti.length));
    await aGruppi(
      mancanti,
      async (b) => {
        try {
          const { data } = await sb.storage.from(BUCKET).download(coverPath(uid, b.id));
          if (data) {
            await putCover(b.id, data);
            copertineScese.add(b.id);
          }
        } catch {
          /* si riprova alla prossima sincronizzazione */
        }
        fatte += 1;
        if (fatte % 25 === 0 && fatte < mancanti.length) say(fraseCopertine(fatte, mancanti.length));
      },
      COPERTINE_INSIEME
    );
  } catch {
    /* senza l'elenco di casa non si indovina: si riprova al giro dopo */
  }

  // quali libri tiene questo dispositivo, perche' l'altro non li dica persi
  const quiOra = await listFileIds().catch(() => null);
  scriviDispositivi(aggiornaQui(leggiDispositivi(), quiOra, { dispositivo: dispositivo(), nome: nomeDispositivo() }));
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
    const arrivati = dalViaggio(merged.raccolte_fav);
    scriviPreferite(fondiPreferite(leggiPreferite(), arrivati.preferite));
    scriviVoti(fondiVoti(leggiVoti(), arrivati.voti));
    scriviDispositivi(fondiDispositivi(leggiDispositivi(), arrivati.dispositivi));
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

// UN CBR GIA' IN BIBLIOTECA CHE IL BROWSER NON APRIRA' MAI (compresso e
// oltre `CBR_MAX`: vedi `rarInCbz.js`) si converte in CBZ dal lettore, con
// un tocco: il CBZ prende il suo posto qui. I nomi delle pagine restano,
// quindi anche l'ordine e il segno di lettura. Torna quel che cambia nella
// scheda.
export async function convertiLibroInCbz(book, { onProgress } = {}) {
  const { convertiInCbz } = await import("./archivioFumetto.js");
  const { improntaDi } = await import("./importBook.js");
  const { formatoDaByte } = await import("./fumetto.js");
  const { pianoConversione } = await import("./convertiCbr.js");
  const qui = await getFile(book.id).catch(() => null);
  const piano = pianoConversione({ qui: qui ? formatoDaByte(new Uint8Array(await qui.slice(0, 8).arrayBuffer())) : null });
  if (!piano) throw new Error("il file di questo libro non c'è su questo dispositivo");
  let cbz = qui;
  if (piano.converti) {
    cbz = await convertiInCbz({ blob: qui }, { onProgress });
    await putFile(book.id, cbz);
  }
  // la copertina che mancava si prende dal CBZ
  if (!(await getCover(book.id).catch(() => null))) {
    const { copertinaOriginale } = await import("./copertina.js");
    const cover = await copertinaOriginale({ ...book, fileType: "cbz" }, cbz).catch(() => null);
    if (cover) await putCover(book.id, cover).catch(() => {});
  }
  const impronta = await improntaDi(cbz).catch(() => undefined);
  return { fileType: "cbz", ...(impronta ? { impronta } : {}) };
}

// PORTARE A CASA I TOMI RIMASTI NEL CLOUD: un libro arrivato dalla
// sincronizzazione ha qui titolo, copertina e progresso, e i byte che il
// secchio ha ancora scendono tutti insieme, un tomo per volta. Il giro vero
// sta in `portaGiu` (syncCore). `scollegato` NON e' uno zero come gli altri:
// dice che al secchio non si e' nemmeno chiesto (vedi `frasePortata`).
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
  const cloud = await daScaricare();
  if (!cloud) return { ...NIENTE };
  return portaGiu(libri, {
    manca: async (b) => !(await getFile(b.id).catch(() => null)),
    scarica: (b) => cloud.scarica(filePath(cloud.uid, b)),
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

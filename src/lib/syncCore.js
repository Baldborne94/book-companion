import { fondi } from "./glossarioMio.js";
import { fondiRacconti } from "./racconti.js";
import { fondiPreferite } from "./raccoltePreferite.js";
import { fondiTempo } from "./tempo.js";
import { fondiObiettivi } from "./obiettivo.js";
import { fondiQuaderno } from "./quaderno.js";
import { fondiDaPrendere } from "./daPrendere.js";

// gli stessi valori di `TIPI_SCELTI` in `library.js`, che da qui non si
// importa: e' il modulo dello storage, e il nucleo della sincronizzazione
// resta puro
const TIPI_SCELTI = ["fumetti", "manga"];

const EMPTY_ROW = {
  title: "",
  author: "",
  series: "",
  file_type: "epub",
  genre: "",
  saga: "",
  saga_order: null,
  added_at: 0,
  rating: 0,
  notes: "",
  // L'IMPRONTA E IL CUORE MANCAVANO, e il cuore ha fatto fallire la
  // sincronizzazione del lettore: «null value in column "fav" of relation
  // "books" violates not-null constraint». Vedi il commento qui sotto — il
  // meccanismo era gia' scritto, ma chi ha aggiunto le due colonne a
  // `rowFromLocal` non e' passato di qui, e il difetto resta INVISIBILE
  // finche' nessuno cancella un libro: senza una lapide nel lotto tutte le
  // righe hanno le stesse chiavi e non c'e' niente da riempire.
  impronta: null,
  fav: false,
  saga_tolta: false,
  file_tolto: false,
  tipo: null,
  status: "unread",
  started_at: 0,
  finished_at: 0,
  progress: 0,
  cfi: null,
  marks: [],
  highlights: [],
  music: null,
  file_ext: null,
  deleted: false,
  updated_at: 0,
  scheda_at: 0,
};

// PostgREST unisce le chiavi di un batch: una riga con meno colonne
// (le lapidi) le riceverebbe come null, non come default.
//
// QUINDI `EMPTY_ROW` DEVE COPRIRE OGNI COLONNA CHE `rowFromLocal` SA
// MANDARE, e il patto lo tiene un test (`test/lapidi.test.mjs`) perche' a
// mano non lo tiene nessuno: aggiungere una colonna la' sopra e scordarsi
// di qui non alza niente finche' il lotto e' fatto di sole righe piene —
// tutte con le stesse chiavi, niente da riempire. Il giorno che il lettore
// cancella un libro, la lapide entra nello stesso lotto con due chiavi in
// meno e Postgres rifiuta l'INTERA sincronizzazione. E' successo con `fav`,
// che e' `not null`: `impronta` era passata liscia solo perche' e'
// nullable, cioe' scriveva un null in silenzio invece di lamentarsi.
export const normalizeRow = (row) => ({ ...EMPTY_ROW, ...row });

export const rowFromLocal = (book, state, updatedAt, schedaAt = 0) => ({
  id: book.id,
  title: book.title || "",
  author: book.author || "",
  series: book.series || "",
  genre: book.genre || "",
  saga: book.saga || "",
  saga_order: book.sagaOrder ?? null,
  file_type: book.fileType || "epub",
  added_at: book.addedAt || 0,
  rating: book.rating || 0,
  notes: book.notes || "",
  // l'impronta dei byte: e' quella che riconosce lo stesso file importato
  // due volte, e senza di lei il doppione fra due dispositivi si puo' solo
  // segnalare per titolo e autore, non saltare
  impronta: book.impronta || null,
  // il cuore dei preferiti: una scelta del lettore, non una soglia di
  // stelle, quindi deve viaggiare — e `false` deve poter spegnere un
  // `true` sull'altro dispositivo
  fav: !!book.fav,
  // la saga tolta a mano: e' una scelta del lettore, e deve viaggiare o
  // l'altro dispositivo gliela rimetterebbe al primo giro — e' l'unica cosa
  // che ferma le cinque strade della saga. `false` come il cuore, per la
  // stessa ragione: deve poter spegnere un `true` sceso da lassu'.
  saga_tolta: !!book.sagaTolta,
  // l'ebook tolto a mano: e' una scelta del lettore («tengo la scheda, il
  // file no»), quindi deve viaggiare — se no l'altro dispositivo
  // rispedirebbe i byte nel secchio al primo giro e la nuvoletta tornerebbe
  // a promettere uno scaricamento che il lettore ha appena rifiutato.
  // `false` come il cuore: deve poter spegnere un `true` sceso da lassu'.
  file_tolto: !!book.fileTolto,
  // fumetto o manga, scelto nella scheda: sale anche vuoto, cosi' una
  // scelta tolta si spegne anche lassu'
  tipo: TIPI_SCELTI.includes(book.tipo) ? book.tipo : null,
  status: state.status || "unread",
  started_at: state.started || 0,
  finished_at: state.finished || 0,
  progress: state.progress || 0,
  cfi: state.cfi ?? null,
  marks: state.marks || [],
  highlights: state.highlights || [],
  music: state.music ?? null,
  file_ext: book.fileType || "epub",
  deleted: false,
  updated_at: updatedAt,
  scheda_at: schedaAt || 0,
});

export const localFromRow = (row) => ({
  book: {
    id: row.id,
    title: row.title || "",
    author: row.author || "",
    series: row.series || "",
    genre: row.genre || "",
    saga: row.saga || "",
    sagaOrder: row.saga_order ?? null,
    fileType: row.file_type || "epub",
    addedAt: row.added_at || 0,
    rating: row.rating || 0,
    notes: row.notes || "",
    ...(row.impronta ? { impronta: row.impronta } : {}),
    ...(row.fav ? { fav: true } : {}),
    ...(row.saga_tolta ? { sagaTolta: true } : {}),
    // QUESTO SCENDE SEMPRE, anche da spento, e non e' una svista: un libro
    // riceve i byte scendendo le scale nell'altro verso (il file si
    // reimporta), e allora il segno DEVE potersi spegnere — la riga di
    // sotto fonde con `{...vecchio, ...nuovo}`, quindi una chiave assente
    // lascerebbe in piedi il «senza ebook» di prima e quel libro resterebbe
    // chiuso per sempre su questo dispositivo. Prezzo dichiarato: su uno
    // schema non migrato la colonna non c'e', quindi arriva `false` e il
    // segno si spegne — e' il lato giusto dove sbagliare, perche' fa
    // ricomparire un libro invece di nasconderlo.
    fileTolto: !!row.file_tolto,
    // scende solo se la colonna c'e': su uno schema non migrato manca, e
    // un `null` inventato qui cancellerebbe la scelta fatta su questo
    // dispositivo a ogni giro. Se c'e', scende anche vuota — o una scelta
    // tolta sull'altro dispositivo resterebbe accesa qui per sempre.
    ...("tipo" in row ? { tipo: TIPI_SCELTI.includes(row.tipo) ? row.tipo : null } : {}),
  },
  state: {
    status: row.status || "unread",
    started: row.started_at || 0,
    finished: row.finished_at || 0,
    progress: row.progress || 0,
    cfi: row.cfi ?? null,
    marks: Array.isArray(row.marks) ? row.marks : [],
    highlights: Array.isArray(row.highlights) ? row.highlights : [],
    music: row.music ?? null,
  },
});

// UNO SCHEMA NON MIGRATO NON DEVE ROMPERE TUTTA LA SINCRONIZZAZIONE.
//
// PostgREST dice esattamente quale colonna non trova: «Could not find the
// 'music_lists' column of 'prefs' in the schema cache». Per i libri c'era
// gia' una scala di rinuncia; le preferenze invece morivano alla prima
// colonna mancante, e con loro moriva TUTTO il giro — compresa la riga
// «ultima sincronizzazione», che restava «mai» per sempre.
//
// Succede sul serio: `music_lists` esiste dalle raccolte musicali, e chi
// non aveva rilanciato lo schema se l'e' trovata addosso mesi dopo.
export function colonnaMancante(error) {
  const testo = `${error?.message || ""} ${error?.details || ""}`;
  const m = /'([a-z_]+)'\s+column/i.exec(testo);
  return m ? m[1] : null;
}

// Quello che identifica la riga non si toglie mai: senza `user_id` la
// scrittura non e' piu' nemmeno rivolta a qualcuno.
const INTOCCABILI = new Set(["user_id", "updated_at", "id"]);

export function senzaColonna(riga, nome) {
  if (!nome || INTOCCABILI.has(nome) || !(nome in riga)) return null;
  const { [nome]: _via, ...resto } = riga;
  return resto;
}

// LA SCALA DI RINUNCIA DEI LIBRI, sorella di `colonnaMancante`.
//
// `senzaColonna` cura le preferenze una colonna alla volta, leggendo il nome
// dall'errore. Per i libri non basta: certe rinunce ne toccano PIU' D'UNA
// insieme (genere e saga stanno o non stanno), e una — le mezze stelle — non
// e' una colonna che manca ma un tipo che non regge i decimali, quindi non
// si toglie niente, si arrotonda. Da qui una scala scritta a mano.
//
// Sta QUI e non in `sync.js` perche' e' la stessa materia di `colonnaMancante`
// e `senzaColonna`, che stanno gia' qui: come loro non tocca la rete, decide
// soltanto. E come loro si puo' provare.
export const DEGRADE = [
  // l'ora della scheda: senza, la scheda torna a seguire la riga intera
  {
    test: (m) => /scheda_at/i.test(m),
    label: "ora della scheda",
    apply: (rows) => rows.map(({ scheda_at, ...r }) => r),
  },
  {
    test: (m) => /started_at|finished_at/i.test(m),
    label: "diario di lettura",
    apply: (rows) => rows.map(({ started_at, finished_at, ...r }) => r),
  },
  // LA SAGA TOLTA A MANO, e va PRIMA di «genere e saga» per la stessa
  // ragione del numero di collana coi decimali: il gradino di sotto prova
  // `/genre|saga/i`, che dentro «saga_tolta» ci sta — si porterebbe via
  // genere, saga e numero lasciando in piedi la colonna di cui il database
  // si lamentava, e al secondo errore identico non resterebbe nessun
  // gradino. Il piu' specifico parla per primo.
  {
    test: (m) => /saga_tolta/i.test(m),
    label: "saga tolta a mano",
    apply: (rows) => rows.map(({ saga_tolta, ...r }) => r),
  },
  {
    test: (m) => /tipo/i.test(m),
    label: "fumetto o manga",
    apply: (rows) => rows.map(({ tipo, ...r }) => r),
  },
  {
    test: (m) => /file_tolto/i.test(m),
    label: "ebook tolto a mano",
    apply: (rows) => rows.map(({ file_tolto, ...r }) => r),
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
  // IL NUMERO DI COLLANA CON I DECIMALI, e va PRIMA delle mezze stelle.
  //
  // Segnalato dal lettore col pannello in mano: «Sincronizzazione fallita:
  // invalid input syntax for type integer: "0.18"». Da quando la collana si
  // legge dal file, il numero tiene i decimali di Calibre (2.5 e' la novella
  // fra il secondo e il terzo) — ma `saga_order` nello schema di chi c'era
  // prima e' `int`. Postgres rifiuta con LO STESSO messaggio delle mezze
  // stelle, senza dire la colonna: il gradino delle stelle lo prendeva per
  // suo, arrotondava un voto che non c'entrava, riprovava, e al secondo
  // errore identico non restava nessun gradino — l'errore usciva nudo e con
  // lui moriva tutto il giro.
  //
  // Postgres pero' dice il VALORE rifiutato, fra virgolette, e quello basta
  // a sapere di chi e': se e' un numero di collana non intero che stiamo
  // mandando, e' questo gradino; se no e' un voto. E non si arrotonda —
  // 2.5 arrotondato a 3 metterebbe la novella sopra a un romanzo vero —
  // si lascia il posto vuoto lassu' finche' lo schema non si aggiorna, e la
  // rinuncia si dice per nome. I numeri interi salgono come sempre.
  {
    test: (m, rows) => {
      const v = valoreRifiutato(m);
      return v != null && rows.some((r) => nonIntero(r.saga_order) && String(r.saga_order) === v);
    },
    label: "numero di collana con decimali",
    apply: (rows) => rows.map((r) => (nonIntero(r.saga_order) ? { ...r, saga_order: null } : r)),
  },
  {
    test: (m) => /rating/i.test(m) || /invalid input syntax for type integer/i.test(m),
    label: "mezze stelle",
    apply: (rows) => rows.map((r) => ({ ...r, rating: Math.round(r.rating || 0) })),
  },
];

function valoreRifiutato(msg) {
  const m = /invalid input syntax for type integer:\s*"([^"]*)"/i.exec(msg);
  return m ? m[1] : null;
}

const nonIntero = (n) => typeof n === "number" && Number.isFinite(n) && !Number.isInteger(n);

// `manda` arriva da fuori — di norma `(p) => sb.from("books").upsert(p)` — per
// la ragione di sempre: cosi' un test la chiama con un finto invece di
// tirarsi dietro un database. Torna l'elenco di quel che si e' dovuto
// lasciare per strada, che il pannello mostra al lettore: una rinuncia
// taciuta e' un pezzo di biblioteca che non sale e nessuno lo sa.
export async function upsertBooks(manda, rows) {
  let payload = rows;
  const dropped = [];
  // UN GIRO IN PIU' DEI GRADINI: l'ultimo tentativo e' quello DOPO aver
  // sceso l'ultimo scalino, o l'ultima rinuncia si applicherebbe senza mai
  // essere provata.
  for (let i = 0; i <= DEGRADE.length; i++) {
    const { error } = await manda(payload);
    if (!error) return dropped;
    const msg = `${error.message || ""} ${error.details || ""}`;
    const step = DEGRADE.find((d) => !dropped.includes(d.label) && d.test(msg, payload));
    // un errore che non e' una colonna mancante non si cura scendendo: e'
    // un guasto vero, e va detto invece di girare a vuoto
    if (!step) throw error;
    payload = step.apply(payload);
    dropped.push(step.label);
  }
  return dropped;
}

// LA PARTE CHE SA CONTARE, separata da quella che sa chiedere: cosi' si puo'
// provare senza un secchio vero sotto.
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
    // CHI C'E' DAVVERO LASSU', per nome e non per conteggio. Lo stesso
    // elenco che si stava gia' pesando risponde anche alla domanda che
    // conta — «questo libro ha una copia?» — e sapere che i file sono 108
    // su 115 libri non dice QUALI sette sono scoperti.
    idLibri: new Set(libri.map((o) => o.name.replace(/\.[^.]+$/, ""))),
    // E LE COPERTINE HANNO IL LORO ELENCO, per la stessa ragione: dice
    // quali si possono andare a prendere senza bussare a vuoto su
    // centocinquanta indirizzi che non esistono.
    idCopertine: new Set(copertine.map((o) => o.name.replace(/\.cover$/, ""))),
    // e quanto pesa ognuna: dice se quella qui e' la stessa
    misureCopertine: new Map(copertine.map((o) => [o.name.replace(/\.cover$/, ""), Number(o.metadata?.size) || 0])),
  };
}

// QUALI COPERTINE DEVONO SCENDERE.
//
// Scendevano SOLO dentro il giro di `pull`, cioe' mentre la riga di quel
// libro passava di li' perche' nel cloud era piu' recente — ed e' la stessa
// trappola del caricamento dei file, che ci e' costata sette romanzi
// scoperti: una riga in pari non ci ripassa MAI PIU'. Bastava perdere la
// copertina qui — la memoria del browser sfrattata, un ripristino, un
// dispositivo nuovo che ha gia' ricevuto tutto — e il dorso disegnato
// restava per sempre, con l'immagine ferma lassu' a un indirizzo che
// nessuno andava piu' a guardare (segnalato: «su tablet alcune copertine
// non caricano piu' o non si vedono»).
//
// Adesso e' un giro suo, come per i file: si guarda chi la copertina qui
// non ce l'ha e lassu' si'. Senza l'elenco del secchio non si chiede
// niente — bussare a vuoto su ogni libro sarebbe una raffica di 404 a ogni
// sincronizzazione.
//
// E SCENDE ANCHE QUELLA CHE QUI C'E' MA E' UN'ALTRA (segnalato: «perche' le
// copertine modificate da PC non se le e' portate dietro?», con la
// fotografia di Alice in Borderland v01 rivestito sul PC e ancora con la
// prima pagina sul tablet). Si scendeva solo dove qui non c'era niente, e
// il tablet una copertina ce l'aveva gia': quella di prima. Adesso si
// confronta la MISURA di qua e di la' — due immagini diverse non pesano
// mai uguale al byte, e la copia scesa pesa quanto quella lassu', quindi
// al giro dopo tutto e' fermo. Una misura che non si conosce non decide
// niente. Lassu' vince, salvo la copertina cambiata QUI che non e' ancora
// partita (`inAttesa`): quella deve salire, non essere coperta.
const altraCopertina = (id, misureQui, misureLassu) => {
  const a = Number(misureQui?.get(id)) || 0;
  const b = Number(misureLassu?.get(id)) || 0;
  return a > 0 && b > 0 && a !== b;
};

export function copertineDaScaricare(libri, { qui, lassu, misureQui, misureLassu, inAttesa } = {}) {
  if (!lassu) return [];
  return (libri || []).filter(
    (b) =>
      b?.id &&
      lassu.has(b.id) &&
      !inAttesa?.has(b.id) &&
      (!(qui && qui.has(b.id)) || altraCopertina(b.id, misureQui, misureLassu)),
  );
}

// E QUALI DEVONO SALIRE, che e' la stessa domanda girata.
//
// Salivano guardando un REGISTRO di questo dispositivo (`bc_uploaded_cov`):
// «questa copertina l'ho gia' mandata», e da li' in poi nessuno la
// riguardava. E' la forma esatta del difetto che ci e' costato quattro
// giri — i file dentro `push`, le copertine dentro `pull`, e queste — cioe'
// **una decisione presa su un registro invece che sullo stato**: il
// registro non sa niente di un secchio svuotato, di un dispositivo nuovo,
// di una copia che lassu' non e' mai arrivata perche' il giro moriva
// prima. Adesso decide l'elenco del secchio, come per i file: la copertina
// sale se ce l'ho QUI e lassu' non c'e'.
//
// Senza l'elenco non si carica niente — stesso lato sicuro di `daCaricare`:
// un giro saltato si rifa', un rinvio in massa no.
//
// Una copertina CAMBIATA qui, che lassu' c'e' gia' nella versione di
// prima, la manda `caricaCopertina` al momento del cambio; se quel viaggio
// non riesce resta `inAttesa` (`bc_cov_attesa`) e sale qui, al primo giro
// buono.
const ATTESA_KEY = "bc_cov_attesa";

export function copertineInAttesa(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(ATTESA_KEY) || "[]");
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function segnaInAttesa(id, si, storage = globalThis.localStorage) {
  const v = copertineInAttesa(storage);
  if (si) v.add(id);
  else v.delete(id);
  try {
    storage.setItem(ATTESA_KEY, JSON.stringify([...v]));
  } catch {
    /* storage pieno: al peggio la copertina sale al prossimo cambio */
  }
}

export function copertineDaCaricare(libri, { qui, lassu, inAttesa } = {}) {
  if (!lassu) return [];
  return (libri || []).filter((b) => b?.id && qui?.has(b.id) && (!lassu.has(b.id) || inAttesa?.has(b.id)));
}

// PORTARE GIU' UNO PER VOLTA. E' il giro di «Porta qui i tomi», staccato
// da Supabase e da IndexedDB cosi' un test lo prova con dei finti (e chi
// un giorno avra' altri byte da portare giu' lo riusa): `manca` dice se i byte NON sono qui
// (guardato ADESSO, non al conto di prima — fra il conto e il tocco il
// lettore puo' aver aperto un libro), `scarica` li prende dal cloud e torna
// null se non ci sono, `posa` li scrive in casa. Un elemento per volta,
// come ogni passata lunga di questa app: venti scaricamenti in parallelo
// su una connessione da tablet sono il modo di non finirne nessuno. Il
// filo `vivo` e' l'unico modo di fermarlo a meta', e quel che e' gia'
// sceso resta sceso.
//
// «NON C'E' LASSU'» NON E' «NON HO POTUTO CHIEDERE», e per un pezzo sono
// state la stessa cosa: `scarica` tornava `null` sia sul 404 sia sulla rete
// caduta, e il lettore leggeva «2 non sono scesi» su due file che lassu'
// non c'erano mai stati — un messaggio che non suggerisce niente se non
// premere ancora, cosa che non potra' mai funzionare. Adesso il contratto
// e' quello del vocabolario: `null` e' una RISPOSTA («guardato, non c'e'»),
// e un guasto di passaggio si ALZA. Chi conta tiene i due numeri separati,
// perche' chiedono al lettore due cose diverse: l'assente si ricarica dal
// file, il fallito si riprova.
export async function portaGiu(voci, { manca, scarica, posa, titolo, onProgress, vivo }) {
  const attivo = vivo || (() => true);
  const esito = { scesi: 0, assenti: 0, falliti: 0, fermato: false };
  const mancanti = [];
  for (const v of voci) {
    if (await manca(v)) mancanti.push(v);
  }
  for (const [i, v] of mancanti.entries()) {
    if (!attivo()) {
      esito.fermato = true;
      break;
    }
    onProgress?.({ i, totale: mancanti.length, titolo: titolo(v) });
    try {
      const byte = await scarica(v);
      if (!byte) esito.assenti += 1;
      else {
        await posa(v, byte);
        esito.scesi += 1;
      }
    } catch {
      esito.falliti += 1;
    }
  }
  return esito;
}

// IL SECCHIO CHE DICE «NON CE L'HO» STA RISPONDENDO, NON ROMPENDOSI, ed e'
// la domanda da cui dipende cosa si dice al lettore: un 404 e' definitivo
// — quel file va ricaricato dal dispositivo che ce l'ha — mentre tutto il
// resto e' un guasto di passaggio, dove riprovare ha senso. Sbagliare da
// questo lato manda a reimportare un romanzo che sta benissimo.
//
// Si guarda in tre posti perche' il codice del servizio arriva scritto in
// tre modi diversi (`statusCode` come STRINGA, `status` come numero, il
// messaggio in parole), e non e' detto quale dei tre ci sara'.
export const nonCeLassu = (e) =>
  `${e?.statusCode ?? ""}` === "404" ||
  e?.status === 404 ||
  /not.?found/i.test(`${e?.message || ""} ${e?.error || ""}`);

// I FILE DEI LIBRI SALGONO SU GOOGLE DRIVE, NON PIU' NEL SECCHIO: chi
// decide cosa sale sta in `driveCore.js` (`daCaricare`), con le regole che
// qui erano costate quattro giri — si decide sullo STATO e non su un
// registro, e senza l'elenco di lassu' non parte niente. Con i file sono
// andati via anche il «troppo grande per il piano gratuito» e il rimando
// dei file ricuciti: Drive un tetto da cinquanta megabyte non ce l'ha, e
// la copia lassu' resta quella originale, che il reader ricuce da se' alla
// prima apertura.

// I TOMI CHE NON SONO DA NESSUNA PARTE.
//
// Un libro senza byte in casa e senza copia nel secchio non e' «nel
// cloud»: e' un romanzo che non hai piu', e la nuvoletta sulla copertina
// gli promette uno scaricamento che non potra' mai riuscire. Riceve i soli
// tomi che qui non ci sono — quelli con la nuvoletta — e tiene quelli che
// il secchio non ha.
//
// Quelli che i byte ce li hanno QUI non si contano, ed e' la regola di
// casa: da soli risalgono alla prima sincronizzazione, e cio' che l'app
// cura da se' non si segnala.
//
// Senza l'elenco del secchio si TACE invece di accusare: non sapere non e'
// un allarme, come per la persistenza e per lo spazio.
// E L'EBOOK TOLTO A MANO NON E' UN TOMO PERDUTO. E' la stessa lezione
// della saga tolta: un libro senza byte perche' il lettore li ha buttati e
// uno senza byte perche' sono andati persi sono lo STESSO record, e le due
// cose chiedono l'opposto — uno va ricaricato dal file, l'altro sta come
// vuole lui. Senza questa riga l'app gli griderebbe dietro per sempre di
// rimettere il file che ha appena deciso di togliere.
export function senzaCopia(soloNelCloud, idLassu) {
  if (!idLassu) return [];
  return (soloNelCloud || []).filter((b) => b?.id && !b.fileTolto && !idLassu.has(b.id));
}

// E QUELLI CHE UN TASTO PUO' DAVVERO PORTARE GIU' SONO GLI ALTRI.
//
// Segnalato con la Libreria in mano: «☁ Porta qui 18 tomi», e accanto la
// riga che diceva che quei diciotto non sono ne' qui ne' nel cloud. Il
// tasto contava `nelCloud` — i tomi che i byte qui non ce li hanno — e fra
// quelli ci stanno anche i perduti: offriva di scaricare diciotto file che
// **l'app sapeva gia'** non esistere lassu'. Un tasto che promette una cosa
// impossibile e' peggio di un tasto che manca, e le due righe si
// contraddicevano a mezzo centimetro di distanza.
//
// **Senza l'elenco del secchio si offrono TUTTI**, ed e' il verso opposto
// di `senzaCopia`, che senza elenco non accusa nessuno: non sapere non e'
// un allarme, ma non e' nemmeno una ragione per togliere il tasto — li'
// l'unico modo di scoprirlo e' provare.
//
// E QUI l'ebook tolto a mano si toglie da tutt'e due i rami, anche da
// quello senza elenco: «Porta qui N tomi» non deve mai contare un libro
// che il lettore ha svuotato apposta — sarebbe il tasto che disfa la sua
// scelta, e per giunta su un file che nel secchio non c'e' piu'.
export function daPortare(soloNelCloud, idLassu) {
  const l = (soloNelCloud || []).filter((b) => !b?.fileTolto);
  return idLassu ? l.filter((b) => b?.id && idLassu.has(b.id)) : l;
}

// IL SEGNO SUL DORSO, e la nuvoletta sul tomo perduto non ci va piu'.
//
// Tre stati si vedevano uguali a due: un libro senza byte qui poteva essere
// lassu' (e la nuvoletta diceva il vero: si scarica quando lo apri) o da
// nessuna parte — e la nuvoletta gli prometteva lo stesso uno scaricamento
// che non potra' mai riuscire, mentre la riga d'avviso in Libreria diceva il
// contrario. Qui si decide in un punto solo, con la STESSA regola di
// `senzaCopia`: senza l'elenco del secchio non si accusa nessuno e resta la
// nuvoletta, che al peggio promette un tentativo.
export function segnoDorso(b, localIds, idLassu) {
  if (b?.fileTolto) return "tolto";
  if (!localIds || !b?.id || localIds.has(b.id)) return null;
  if (idLassu && !idLassu.has(b.id)) return "perduto";
  return "cloud";
}

// E si dicono per NOME: in una biblioteca da cento volumi «2 tomi» lascia
// il lettore a cercare quali. Tre titoli e poi il conto — un elenco intero
// in una riga di servizio diventa un muro.
export function fraseSenzaCopia(libri) {
  const l = libri || [];
  if (!l.length) return null;
  const nomi = l.slice(0, 3).map((b) => `«${b.title || "senza titolo"}»`);
  const resto = l.length - nomi.length;
  const elenco = resto ? `${nomi.join(", ")} e altri ${resto}` : nomi.join(", ");
  return `${elenco} ${l.length === 1 ? "non è" : "non sono"} né qui né nel cloud: ${
    l.length === 1 ? "ricaricalo" : "ricaricali"
  } dal file.`;
}

// LE PAROLE DEL GIRO, fuori dal componente per la ragione di sempre: un
// test in Node non importa un `.jsx`, e una frase che dice la cosa
// sbagliata non alza nessun errore. Gli zeri non si dicono — «0 non sono
// scesi» a ogni giro si impara a saltare — e l'assente porta con se' cosa
// farci, perche' un guaio senza la cura accanto lascia il lettore dov'era.
export function frasePortata(esito) {
  const { scesi = 0, assenti = 0, falliti = 0, fermato = false, scollegato = false } = esito || {};
  // E «NON HO POTUTO CHIEDERE» NON E' «NON C'ERA NIENTE DA FARE», che e' lo
  // stesso errore di `portaGiu` un piano piu' su: caduto l'accesso al
  // cloud non si chiede niente al secchio — zero scaricamenti tentati — e
  // il lettore che ha appena toccato «Porta qui 18 tomi» si sentiva
  // rispondere che non c'era niente da portare, cioe' il contrario del
  // tasto che aveva davanti. La frase dice cos'e' successo e cosa farci.
  if (scollegato)
    return "Non ho potuto chiedere al cloud: l'accesso non è più valido. Rientra dal pannello della nuvola — i tuoi libri restano qui.";
  const parti = [];
  if (scesi) parti.push(`${scesi} ${scesi === 1 ? "tomo è" : "tomi sono"} qui`);
  if (assenti)
    parti.push(
      `${assenti} ${assenti === 1 ? "non ha" : "non hanno"} copia lassù — ` +
        `${assenti === 1 ? "ricaricalo" : "ricaricali"} dal file`
    );
  if (falliti) parti.push(`${falliti} non ${falliti === 1 ? "è sceso" : "sono scesi"}`);
  if (!parti.length) return "Non c'era niente da portare a casa";
  return `${parti.join(", ")}${fermato ? " — giro fermato" : ""}`;
}

// LA SCHEDA E LA LETTURA HANNO DUE OROLOGI (segnalato: saghe scritte a mano
// sul PC, sparite dopo la sincronizzazione perche' il tablet aveva LETTO
// quei libri dopo). La riga intera va a chi l'ha toccata per ultimo — e
// leggere la tocca a ogni pagina — ma i campi della SCHEDA vanno a chi ha
// cambiato la scheda per ultimo. `null` = non si sa (orologi uguali, o lassu'
// la colonna non c'e'): decide la riga, come prima.
export const CAMPI_SCHEDA = ["title", "author", "series", "genre", "saga", "saga_order", "rating", "notes", "impronta", "fav", "saga_tolta", "file_tolto", "tipo"];

export function schedaPiuNuova(mia, sua) {
  if (!mia || !sua || sua.scheda_at == null) return null;
  const a = Number(mia.scheda_at) || 0;
  const b = Number(sua.scheda_at) || 0;
  if (a === b) return null;
  return a > b ? "mia" : "sua";
}

// `riga` con la scheda di `fonte`: la lettura resta quella di `riga`
export function conSchedaDi(riga, fonte) {
  const out = { ...riga };
  for (const k of CAMPI_SCHEDA) if (k in fonte) out[k] = fonte[k];
  out.scheda_at = Number(fonte.scheda_at) || 0;
  return out;
}

// LE DUE SCHEDE DI UN GIRO, decise insieme: chi sale sopra una riga che
// lassu' ha la scheda piu' nuova sale con quella (e la si posa qui:
// `scese`); chi scende sopra una scheda piu' nuova qui scende con la nostra
// (e la riga fusa risale: `tenute`). `intere` sono le righe lette intere
// lassu', `locali` quelle di qui.
export function fondiSchede({ push = [], pull = [], intere = new Map(), locali = [] } = {}) {
  const scese = new Map();
  const suSu = push.map((row) => {
    if (row.deleted) return row;
    const r = intere.get(row.id);
    if (!r || r.deleted || schedaPiuNuova(row, r) !== "sua") return row;
    const fusa = conSchedaDi(row, r);
    scese.set(row.id, fusa);
    return fusa;
  });
  const qui = new Map(locali.map((r) => [r.id, r]));
  const tenute = new Set();
  const giu = pull.map((row) => {
    const mia = qui.get(row.id);
    if (schedaPiuNuova(mia, row) !== "mia") return row;
    tenute.add(row.id);
    return conSchedaDi(row, mia);
  });
  return { push: suSu, pull: giu, scese, tenute };
}

// LA SCHEDA COM'E' CAMBIATA, letta come viaggia: due libri hanno la stessa
// scheda se darebbero gli stessi campi della scheda nella riga. Quel che
// non viaggia (la quarta di copertina, le memorie del riconoscimento) non
// cambia la scheda: timbrarla farebbe vincere questa copia, saga vecchia
// compresa, sulla scheda cambiata altrove.
const schedaDi = (b) => {
  const r = rowFromLocal(b || {}, {}, 0);
  return JSON.stringify(CAMPI_SCHEDA.map((k) => r[k] ?? null));
};
export const schedaDiversa = (a, b) => schedaDi(a) !== schedaDi(b);

// LE SCHEDE CHE UN GIRO HA CAMBIATO, da timbrare: la sincronizzazione
// manda solo i libri timbrati, e una saga trovata da sola — dal file, dal
// catalogo, dai fratelli — senza timbro restava su questo dispositivo
// (segnalato: undici libri messi in saga sul PC, «Fuori saga» sul tablet).
// Un libro nuovo non e' «cambiato»: lo timbra chi lo importa.
export function schedeCambiate(prima, dopo) {
  const vecchie = new Map((prima || []).filter((b) => b?.id).map((b) => [b.id, b]));
  return (dopo || []).filter((b) => b?.id && vecchie.has(b.id) && schedaDiversa(vecchie.get(b.id), b)).map((b) => b.id);
}

export function planSync({ localRows, tombstones, remoteRows }) {
  const remote = new Map(remoteRows.map((r) => [r.id, r]));
  const local = new Map(localRows.map((r) => [r.id, r]));
  const pull = [];
  const push = [];
  const removeLocal = [];

  for (const [id, row] of local) {
    const r = remote.get(id);
    if (!r || row.updated_at > r.updated_at) push.push(row);
    else if (r.deleted && r.updated_at >= row.updated_at) removeLocal.push(id);
    else if (r.updated_at > row.updated_at) pull.push(r);
  }

  for (const [id, ts] of Object.entries(tombstones)) {
    const r = remote.get(id);
    if (!r || ts > r.updated_at) push.push({ id, deleted: true, updated_at: ts });
  }

  for (const [id, r] of remote) {
    if (local.has(id) || tombstones[id] >= r.updated_at) continue;
    if (!r.deleted) pull.push(r);
  }

  return { pull, push, removeLocal };
}

// Uno schema migrato DOPO un salvataggio degradato lascia nel cloud righe
// con lo stesso updated_at ma prive dei campi nuovi: non ripartirebbero
// mai da sole. Si rimanda tutto cio' di cui il locale resta padrone,
// lasciando stare le righe che il cloud sta per insegnarci.
export function withRepush({ push, pull, removeLocal, localRows }) {
  const already = new Set(push.map((r) => r.id));
  const held = new Set([...pull.map((r) => r.id), ...removeLocal]);
  return [...push, ...localRows.filter((r) => !already.has(r.id) && !held.has(r.id))];
}

// LE EVIDENZIAZIONI NON SONO UN CAMPO DELLA RIGA: SONO UN INSIEME.
//
// Il resto di un libro — lo stato, la pagina, il voto — si fonde a riga
// intera con «vince chi ha scritto per ultimo», ed e' giusto: sono valori
// singoli, e di due valori uno dev'essere piu' recente. Segnalibri ed
// evidenziazioni no. Viaggiavano dentro quella riga, e in ricezione
// venivano SOSTITUITI in blocco: evidenziando un passaggio sul tablet e un
// altro sul telefono prima che i due si parlassero, il dispositivo con
// l'orologio piu' vecchio perdeva tutte le sue — in silenzio, e te ne
// accorgevi settimane dopo cercando una citazione che non c'era piu'.
//
// L'app sapeva gia' come si fa: le melodie si fondono per id qui sotto,
// col commento «unione, non sostituzione». Questa e' la stessa regola
// portata dove serve di piu'. Vince la versione col timbro piu' recente,
// e una LAPIDE e' una versione come le altre — cosi' una cancellazione
// batte la copia viva rimasta sull'altro dispositivo, invece di farsela
// rimandare indietro.
const chiaveNota = (x) => x?.id || x?.cfi || "";
// la lapide porta l'ora della cancellazione, l'annotazione modificata
// quella della modifica, e tutto il resto la sua nascita
const quandoNota = (x) => x?.deleted || x?.updatedAt || x?.createdAt || 0;
const stessaNota = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function fondiAnnotazioni(locali = [], remote = []) {
  const per = new Map();
  const daNoi = new Set();
  // il locale entra per primo e il remoto lo scalza solo se e' piu'
  // recente: a parita' di orologio vince quello che gia' c'e', o due
  // dispositivi fermi si rimbalzerebbero la stessa riga a ogni giro
  for (const x of locali || []) {
    const k = chiaveNota(x);
    if (!k) continue;
    if (!per.has(k) || quandoNota(x) > quandoNota(per.get(k))) {
      per.set(k, x);
      daNoi.add(k);
    }
  }
  const suo = new Map();
  for (const x of remote || []) {
    const k = chiaveNota(x);
    if (!k) continue;
    suo.set(k, x);
    if (!per.has(k) || quandoNota(x) > quandoNota(per.get(k))) {
      per.set(k, x);
      daNoi.delete(k);
    }
  }
  // Quel che il cloud non ha, o ha diverso, va rimandato su: senza questo
  // conto le annotazioni di questo dispositivo resterebbero qui per
  // sempre, perche' la sua riga e' piu' vecchia e non verra' mai spinta.
  let daMandare = 0;
  for (const k of daNoi) {
    if (!stessaNota(per.get(k), suo.get(k))) daMandare += 1;
  }
  const tutte = [...per.values()];
  return {
    // i vivi in ordine di nascita, le lapidi in coda: cosi' la parte che
    // il lettore vede resta quella di sempre
    lista: [
      ...tutte.filter((x) => !x.deleted).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
      ...tutte.filter((x) => x.deleted),
    ],
    daMandare,
  };
}

const favStamp = (f) => f.updatedAt || f.addedAt || 0;

// Unione, non sostituzione: melodie salvate su dispositivi diversi
// devono sopravvivere entrambe. Vince la versione piu' recente per id.
export function mergeFavorites(localFavs = [], remoteFavs = []) {
  const byId = new Map();
  for (const f of [...(remoteFavs || []), ...(localFavs || [])]) {
    if (!f?.id) continue;
    const prev = byId.get(f.id);
    if (!prev || favStamp(f) >= favStamp(prev)) byId.set(f.id, f);
  }
  return [...byId.values()].sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
}

// I TERMINI DEL GLOSSARIO viaggiano nelle preferenze, non coi libri: la
// chiave e' la saga, non il singolo volume. La fusione e' quella
// dell'archivio (`fondi`: quel che c'e' gia' resta, si prende solo cio' che
// manca), girata nel verso che dice l'orologio — chi ha scritto per ultimo
// vince, come per tutto il resto delle preferenze.
function fondiGlossari(local, remote, remoteNewer) {
  const a = remoteNewer ? remote : local;
  const b = remoteNewer ? local : remote;
  return fondi(a || {}, b || {}).glossari;
}

// I FILE AUDIO VIAGGIANO SOLO DA QUANDO STANNO SU DRIVE. Per un pezzo non
// viaggiavano affatto (deciso dal lettore: «ogni dispositivo ha i suoi
// file»): la voce di un file saliva col resto dell'elenco e sull'altro
// dispositivo compariva un nome che non suonava, e i byte, portati nel
// secchio per rimediare, erano la cosa piu' pesante del piano gratuito. Con
// Drive quei byte hanno un posto, e il lettore li ha voluti la': una voce
// con `trackId` sale solo col segno `drive` (lo scrive il giro della musica
// quando il brano e' lassu'), e l'altro dispositivo la scarica quando la
// suoni. Senza il segno resta dov'e' nata, come prima — e resta anche la
// regola di prima per quel che arriva da lassu' senza segno (scritto da una
// versione vecchia dell'app): non entra. Le lapidi seguono la voce: quella
// di un brano che viaggiava viaggia anche lei.
const eFile = (f) => !!f?.trackId;
const viaggia = (f) => !eFile(f) || !!f.drive;

export function mergePrefs(local, remote) {
  const link = mergeFavorites(
    (local.music_favs || []).filter(viaggia),
    (remote?.music_favs || []).filter(viaggia)
  );
  // i file di questo dispositivo che non sono ancora su Drive: restano qui,
  // salvo che lassu' ci sia gia' la loro versione segnata
  const giaFuse = new Set(link.map((f) => f.id));
  const mieiFile = (local.music_favs || []).filter((f) => !viaggia(f) && !giaFuse.has(f.id));
  // quel che si scrive QUI: le voci fuse piu' i miei file ancora fermi,
  // nell'ordine di nascita; quel che sale (`merged.music_favs`) sono le sole
  // voci che viaggiano
  const music_favs = link;
  const favsLocali = [...link, ...mieiFile].sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
  // le raccolte hanno la stessa forma dei preferiti (id, addedAt,
  // updatedAt, deleted), quindi si fondono con la stessa regola
  const music_lists = mergeFavorites(local.music_lists, remote?.music_lists);
  const remoteNewer = !!remote && (remote.updated_at || 0) > (local.updated_at || 0);
  const merged = {
    reader: remoteNewer ? (remote.reader ?? local.reader) : (local.reader ?? remote?.reader ?? null),
    last_opened: remoteNewer
      ? remote.last_opened || local.last_opened || null
      : local.last_opened || remote?.last_opened || null,
    music_favs,
    music_lists,
    glossari: fondiGlossari(local.glossari, remote?.glossari, remoteNewer),
    // I RACCONTI SPUNTATI SI UNISCONO, e ordinati: l'ordine di un insieme
    // non vuol dire niente, ma `eq` confronta il JSON — senza, due
    // dispositivi con le stesse spunte in ordine diverso si
    // rimbalzerebbero le preferenze a ogni giro.
    racconti: fondiRacconti(local.racconti, remote?.racconti).sort(),
    // IL TEMPO DI LETTURA E L'OBIETTIVO NON SEGUONO L'OROLOGIO DELLE
    // PREFERENZE: il tempo e' un'unione dei cassetti dei dispositivi (ognuno
    // scrive solo nel suo), l'obiettivo vince per l'ora in cui e' stato
    // scelto. «Vince chi ha scritto per ultimo» su tutto il blocco
    // butterebbe via le sere lette sull'altro dispositivo.
    tempo: fondiTempo(local.tempo, remote?.tempo),
    obiettivi: fondiObiettivi(local.obiettivi, remote?.obiettivi),
    // IL QUADERNO si fonde parola per parola, per l'ora di ciascuna: le
    // parole cercate sull'altro dispositivo nella stessa sera non si perdono
    quaderno: fondiQuaderno(local.quaderno, remote?.quaderno),
    // i libri da prendere: stessa forma e stessa regola del quaderno
    da_prendere: fondiDaPrendere(local.da_prendere, remote?.da_prendere),
    // il cuore delle raccolte: voce per voce, con le lapidi
    raccolte_fav: fondiPreferite(local.raccolte_fav, remote?.raccolte_fav),
    updated_at: Math.max(local.updated_at || 0, remote?.updated_at || 0),
  };
  const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  return {
    merged,
    favsLocali,
    applyLocal:
      !eq(favsLocali, local.music_favs) ||
      !eq(merged.music_lists, local.music_lists) ||
      !eq(merged.reader, local.reader) ||
      !eq(merged.glossari, local.glossari) ||
      !eq(merged.racconti, [...(local.racconti || [])].sort()) ||
      // si confronta con la forma NORMALIZZATA di ciascun lato: jsonb di
      // Postgres riordina le chiavi, e senza questo passaggio due registri
      // identici risulterebbero diversi a ogni giro
      !eq(merged.tempo, fondiTempo(local.tempo)) ||
      !eq(merged.obiettivi, fondiObiettivi(local.obiettivi)) ||
      !eq(merged.quaderno, fondiQuaderno(local.quaderno)) ||
      !eq(merged.da_prendere, fondiDaPrendere(local.da_prendere)) ||
      !eq(merged.raccolte_fav, fondiPreferite(local.raccolte_fav)) ||
      merged.last_opened !== (local.last_opened || null),
    pushRemote:
      !remote ||
      !eq(merged.music_favs, remote.music_favs) ||
      !eq(merged.music_lists, remote.music_lists) ||
      !eq(merged.reader, remote.reader) ||
      !eq(merged.glossari, remote.glossari) ||
      !eq(merged.racconti, [...(remote.racconti || [])].sort()) ||
      !eq(merged.tempo, fondiTempo(remote.tempo)) ||
      !eq(merged.obiettivi, fondiObiettivi(remote.obiettivi)) ||
      !eq(merged.quaderno, fondiQuaderno(remote.quaderno)) ||
      !eq(merged.da_prendere, fondiDaPrendere(remote.da_prendere)) ||
      !eq(merged.raccolte_fav, fondiPreferite(remote.raccolte_fav)) ||
      merged.last_opened !== (remote.last_opened || null),
  };
}

// COSA E' ANDATO STORTO SINCRONIZZANDO, detto in italiano.
//
// Segnalato due volte in un'ora, col pannello della nuvola in mano:
// «Sincronizzazione fallita: null value in column "fav" of relation
// "books" violates not-null constraint» e «invalid input syntax for type
// integer: "0.18"». Quel testo e' il messaggio GREZZO di Postgres, che
// `App.jsx` incollava sullo schermo cosi' com'era.
//
// E' il punto piu' ostile che l'app abbia: tutto il resto ha frasi scritte
// apposta — `GUAI`, `ESITI_CONTROLLO`, `fraseTace`, le frasi qui sopra — e
// proprio dove qualcosa si e' appena rotto si passava all'inglese e al
// gergo del database. **Nel momento in cui il lettore ha piu' bisogno di
// capire, gli si dava la cosa meno leggibile che l'app avesse.**
//
// Tre regole, tutte prese da `spiegaAccesso`, che questo mestiere lo fa
// gia' per l'accesso:
//
//  1. Ogni guasto riconosciuto dice COSA E' SUCCESSO **e cosa farci**: un
//     guasto senza la strada accanto lascia il lettore dov'era.
//  2. Quel che non sappiamo tradurre **si mostra com'e'**: una frase in
//     inglese e' brutta, nasconderla toglie l'unico appiglio.
//  3. Il testo grezzo NON si butta — va in `dettaglio`, ripiegato: e' quel
//     che serve a chi deve ripararlo quando gli arriva la fotografia.
//
// QUATTRO MESSAGGI DIVERSI DI POSTGRES VOGLIONO DIRE LA STESSA COSA al
// lettore — la colonna che manca, il tipo che non regge, il `not null`, la
// policy — e la strada e' una sola: rilanciare `supabase/schema.sql`. Si
// raggruppano, e **il nome della colonna finisce nella frase**, perche' e'
// l'unica cosa del testo grezzo che al lettore serva davvero.
// IL NOME SI CERCA NEI DUE POSTI DOVE LO SCRIVONO, e la forma di PostgREST
// si chiede a `colonnaMancante`, che quel mestiere lo fa gia' — scriverla
// qui sarebbe la stessa espressione in due file, da cambiare insieme e da
// dimenticare separatamente.
//
// E LE VIRGOLETTE SONO OBBLIGATORIE nella forma di Postgres: senza,
// «Could not find the 'music_lists' column **of** 'prefs'» da' la colonna
// «of», cioe' una frase che nomina con sicurezza una colonna che non
// esiste — peggio di una frase che non la nomina affatto. Preso provando
// la funzione sui messaggi veri, non rileggendola.
//
// E LA FORMA DI POSTGRES SI CHIEDE PER PRIMA, che non e' indifferente: col
// ripiego davanti, sul messaggio di PostgREST rispondeva `colonnaMancante`
// e la guardia sulle virgolette non veniva raggiunta mai — una guardia che
// non guarda niente, che e' peggio di nessuna guardia perche' il prossimo
// le crede (stessa lezione di `senzaAutore` in `titoli.js`). L'ha detto una
// mutazione sopravvissuta, non la rilettura.
function nomeColonna(err, testo) {
  const m = /(?:column|colonna)\s+["']([a-z_]+)["']/i.exec(testo);
  return (m ? m[1] : null) || colonnaMancante(err);
}

const SCHEMA_INDIETRO = (col) =>
  `Lo schema del database è indietro rispetto all'app${col ? `: la colonna «${col}» non c'è o non regge il valore` : ""}. ` +
  "Rilancia «supabase/schema.sql» sul progetto Supabase, poi riprova. I tuoi libri restano qui intanto.";

export function spiegaSync(err) {
  const testo = String(err?.message || err?.error_description || "").trim();
  const dettagli = `${testo} ${err?.details || ""} ${err?.hint || ""}`;
  const stato = Number(err?.status ?? err?.statusCode) || 0;
  // quel che diciamo noi e' gia' italiano e non ha un testo grezzo utile
  if (/sync non configurata/i.test(testo))
    return { frase: "La sincronizzazione non è configurata su questa copia dell'app.", dettaglio: null };

  // LA RETE PRIMA DI TUTTO: cade come un TypeError senza codice ne' stato,
  // e scambiata per un guasto del database manderebbe a rilanciare uno
  // schema che sta benissimo.
  if (stato === 0 && /fetch|network|load failed|connessione/i.test(testo))
    return {
      frase: "Non riesco a raggiungere il cloud: controlla la rete e riprova. I tuoi libri restano qui.",
      dettaglio: testo,
    };

  if (/row-level security|violates row-level/i.test(dettagli) || stato === 401 || stato === 403 || /jwt|token/i.test(testo)) {
    // 401 e JWT sono la sessione, la RLS e' lo schema: due cose diverse con
    // due strade diverse, e confonderle manda dalla parte sbagliata
    if (/row-level security|violates row-level/i.test(dettagli))
      return { frase: SCHEMA_INDIETRO(null), dettaglio: testo };
    return {
      frase: "L'accesso al cloud è scaduto: rientra dal pannello della nuvola. I tuoi libri restano qui.",
      dettaglio: testo,
    };
  }

  if (
    /violates not-null|null value in column|invalid input syntax|could not find the|schema cache|does not exist/i.test(dettagli)
  )
    return { frase: SCHEMA_INDIETRO(nomeColonna(err, dettagli)), dettaglio: testo };

  if (/exceeded the maximum allowed size|payload too large|entity too large/i.test(dettagli) || stato === 413)
    return {
      frase: "Un file è troppo grande per il piano del cloud: resta qui, al sicuro. La sua rete è l'archivio.",
      dettaglio: testo,
    };

  if (/quota|storage limit|exceeded.*quota/i.test(dettagli) || stato === 507)
    return {
      frase: "Lo spazio nel cloud è finito: guarda la barra in fondo alla Libreria per vedere cosa lo occupa.",
      dettaglio: testo,
    };

  if (/paused|project is paused/i.test(dettagli))
    return {
      frase: "Il progetto Supabase è in pausa: riattivalo dalla sua dashboard e riprova.",
      dettaglio: testo,
    };

  if (stato >= 500)
    return { frase: "Il cloud ha risposto male: riprovo più tardi da solo. I tuoi libri restano qui.", dettaglio: testo };

  // QUEL CHE NON SAPPIAMO TRADURRE SI MOSTRA COM'E' — ma allora il testo
  // grezzo E' gia' la frase, e ripeterlo sotto «dettagli» lo scriverebbe
  // due volte.
  return {
    frase: testo ? `Sincronizzazione fallita: ${testo}` : "Sincronizzazione fallita, riprovo più tardi.",
    dettaglio: null,
  };
}

// IL GIRO LEGGE LE RIGHE LEGGERE, E INTERE SOLO QUELLE CHE SI MUOVONO.
//
// Chiesto dal lettore fra le cose da rendere piu' veloci («fai il 2», il
// giro di sincronizzazione). A ogni giro si scaricava `select("*")` della
// biblioteca INTERA — seicento righe con dentro segnalibri, evidenziazioni,
// punto di lettura e note — per scoprire, quasi sempre, che non era
// cambiato niente. Per decidere (`planSync`) bastano quattro colonne: chi
// c'e', quando e' stato toccato, se e' cancellato, se l'ebook e' stato tolto
// (lo guarda `avanziDelSecchio`). Le righe intere servono solo a chi SCENDE
// e a chi SALE esistendo gia' lassu' (le sue annotazioni si fondono con le
// nostre prima di partire, e il punto di lettura piu' avanti si propone).
//
// La trappola e' una sola ed e' grave: una riga LEGGERA applicata come se
// fosse intera cancellerebbe qui titolo, saga, voto e note. Quindi una riga
// che doveva scendere e non e' arrivata intera NON si applica: resta per il
// giro dopo (`completaPull`).
export const COLONNE_LEGGERE = "id,updated_at,deleted,file_tolto";

// chi va letto intero: chi scende, e chi sale esistendo gia' lassu'
export function idDaLeggereInteri({ pull = [], push = [], remote = [] } = {}) {
  const lassu = new Map((remote || []).map((r) => [r.id, r]));
  const ids = new Set((pull || []).map((r) => r.id));
  for (const row of push || []) {
    if (row.deleted) continue;
    const r = lassu.get(row.id);
    if (r && !r.deleted) ids.add(row.id);
  }
  return [...ids];
}

// le righe da ricevere, INTERE: chi non e' arrivato resta fuori
export function completaPull(pull = [], intere = new Map()) {
  return (pull || []).map((r) => intere.get(r.id)).filter(Boolean);
}

// `leggi(colonne)` -> { data, error }, `leggiIds(ids)` -> { data, error }:
// il database si passa da fuori come in `upsertBooks`. Se la lettura
// leggera non riesce (uno schema senza `file_tolto`, un guasto qualunque)
// si legge tutto come prima: e' piu' lento, e sbagliato mai.
export async function leggiRigheLeggere(leggi) {
  const leggere = await leggi(COLONNE_LEGGERE);
  if (!leggere?.error) return { righe: leggere?.data || [], intere: false };
  const tutte = await leggi("*");
  if (tutte?.error) throw tutte.error;
  return { righe: tutte?.data || [], intere: true };
}

export const LOTTO_IDS = 100;

export async function leggiRigheIntere(leggiIds, ids = []) {
  const intere = new Map();
  for (let i = 0; i < ids.length; i += LOTTO_IDS) {
    const { data, error } = await leggiIds(ids.slice(i, i + LOTTO_IDS));
    if (error) throw error;
    for (const r of data || []) intere.set(r.id, r);
  }
  return intere;
}

// GOOGLE DRIVE, la parte che parla con la rete.
//
// Deciso dal lettore: i libri non stanno piu' su Supabase ma sul suo Google
// Drive, dove li ha gia' caricati a mano nelle cartelle «Libri», «Fumetti» e
// «Manga», e dove il piano e' da 100 GB invece di uno. Supabase resta per
// schede, progressi, evidenziazioni e copertine: pesano chilobyte, e sono
// quelle che fanno parlare fra loro i dispositivi.
//
// L'ACCESSO E' DI GOOGLE, NON NOSTRO: la chiave per entrare nel Drive la da'
// Google Identity Services a questo browser, dura un'ora e non passa da
// nessun server nostro — non ce ne sono. Il prezzo di non avere un server e'
// che dopo un'ora la chiave va richiesta, e Google la ridà solo dopo un tocco
// (una finestra che si apre e si chiude da sola): per questo il giro in
// background, a chiave scaduta, NON chiede niente e aspetta; la chiave si
// rinnova quando apri un libro che sta lassu', o dal tasto «Ricollega».
//
// Le decisioni — cosa e' gia' su Drive, cosa sale, cosa lascia il secchio —
// stanno in `driveCore.js`, dove un test le prova.

import { abbina, daCaricare, daTraslocare, scegliCartella, cartellaDelTipo, nomeSuDrive, spazioDrive, estensioneDi, ripulisciIdClient, idClientValido, PERCHE_ID_STORTO, abbinaMelodie, melodieDaCaricare, melodieFile, nomeMelodiaSuDrive } from "./driveCore.js";

const TOKEN_KEY = "bc_drive_token";
const ACCESO_KEY = "bc_drive_on";
const CLIENT_KEY = "bc_drive_client";
const MAPPA_KEY = "bc_drive_libri";
const MAPPA_MUSICA_KEY = "bc_drive_melodie";
const SCOPE = "https://www.googleapis.com/auth/drive";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const CARTELLA = "application/vnd.google-apps.folder";
// un pezzo alla volta: multiplo di 256 KB come vuole Drive, e abbastanza
// piccolo da non tenere in volo un giga intero se la rete cade a meta'
const PEZZO = 32 * 1024 * 1024;

export class DriveScollegato extends Error {
  constructor() {
    super("Google Drive non collegato");
    this.name = "DriveScollegato";
  }
}

const leggi = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const scrivi = (k, v) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* senza storage la chiave vive quanto la pagina */
  }
};

// L'identificativo del client OAuth: non e' un segreto (sta scritto nella
// pagina di ogni sito che usa l'accesso Google). Arriva dalla build o si
// incolla nel pannello, cosi' non serve rifare il deploy per provarlo.
export const clientId = () => ripulisciIdClient(import.meta.env?.VITE_GOOGLE_CLIENT_ID || leggi(CLIENT_KEY) || "");
export const scriviClientId = (v) => scrivi(CLIENT_KEY, ripulisciIdClient(v) || null);
export const driveConfigurato = () => !!clientId();
// «acceso» e' la scelta del lettore, e resta vera anche a chiave scaduta:
// la nuvoletta sui dorsi deve continuare a dire che il libro sta lassu'
export const driveAcceso = () => leggi(ACCESO_KEY) === "1";

let memoria = null;
function tokenValido() {
  let t = memoria;
  if (!t) {
    try {
      t = JSON.parse(leggi(TOKEN_KEY));
    } catch {
      t = null;
    }
  }
  if (!t?.chiave || !(t.scade > Date.now() + 60_000)) return null;
  memoria = t;
  return t.chiave;
}
export const driveProntoOra = () => !!tokenValido();
function dimenticaToken() {
  memoria = null;
  scrivi(TOKEN_KEY, null);
}

let gis = null;
function caricaGis() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
  if (!gis) {
    gis = new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => ok();
      s.onerror = () => {
        gis = null;
        ko(new Error("Non riesco a raggiungere Google: controlla la connessione."));
      };
      document.head.appendChild(s);
    });
  }
  return gis;
}

// LA CHIAVE SI CHIEDE SOLO DA UN TOCCO: Google la consegna in una finestra,
// e una finestra aperta senza un tocco il browser la blocca.
export async function collegaDrive() {
  const id = clientId();
  if (!id) throw new Error("Manca l'ID client di Google: incollalo qui sopra.");
  if (!idClientValido(id)) throw new Error(PERCHE_ID_STORTO);
  await caricaGis();
  const risposta = await new Promise((ok, ko) => {
    const client = globalThis.google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: SCOPE,
      prompt: driveAcceso() ? "" : "consent",
      callback: (r) => (r?.error ? ko(new Error(r.error_description || r.error)) : ok(r)),
      error_callback: (e) =>
        ko(new Error(e?.type === "popup_closed" ? "Finestra di Google chiusa prima di finire." : e?.message || "Accesso a Google non riuscito.")),
    });
    client.requestAccessToken();
  });
  const t = { chiave: risposta.access_token, scade: Date.now() + (Number(risposta.expires_in) || 3600) * 1000 };
  memoria = t;
  scrivi(TOKEN_KEY, JSON.stringify(t));
  scrivi(ACCESO_KEY, "1");
  return true;
}

export async function scollegaDrive() {
  const t = tokenValido();
  dimenticaToken();
  scrivi(ACCESO_KEY, null);
  scrivi(MAPPA_KEY, null);
  scrivi(MAPPA_MUSICA_KEY, null);
  try {
    if (t && globalThis.google?.accounts?.oauth2) globalThis.google.accounts.oauth2.revoke(t, () => {});
  } catch {
    /* la chiave scade comunque fra meno di un'ora */
  }
}

// Una chiamata alle API di Drive. Un 401 vuol dire chiave scaduta o
// ritirata: la si dimentica e si dice «scollegato», che e' un'altra cosa da
// un guasto — chi chiama lo usa per aspettare invece di contare un errore.
async function chiama(url, opzioni = {}) {
  const t = tokenValido();
  if (!t) throw new DriveScollegato();
  const r = await fetch(url, { ...opzioni, headers: { Authorization: `Bearer ${t}`, ...(opzioni.headers || {}) } });
  if (r.status === 401) {
    dimenticaToken();
    throw new DriveScollegato();
  }
  if (!r.ok && r.status !== 308) {
    let dettaglio = "";
    try {
      dettaglio = (await r.json())?.error?.message || "";
    } catch {
      /* senza corpo resta lo stato */
    }
    const e = new Error(`Google Drive ha risposto ${r.status}${dettaglio ? `: ${dettaglio}` : ""}`);
    e.status = r.status;
    throw e;
  }
  return r;
}

const q = (s) => encodeURIComponent(s);

async function elencaTutto(query, campi) {
  const tutti = [];
  let pagina = "";
  // un tetto ai giri: un Drive enorme non deve tenere il tablet in rete per
  // sempre, e duecentomila file sono gia' ben oltre quel che un libro chiede
  for (let giro = 0; giro < 200; giro += 1) {
    const url =
      `${API}/files?q=${q(query)}&spaces=drive&pageSize=1000` +
      `&fields=${q(`nextPageToken,files(${campi})`)}${pagina ? `&pageToken=${q(pagina)}` : ""}`;
    const d = await (await chiama(url)).json();
    tutti.push(...(d.files || []));
    if (!d.nextPageToken) break;
    pagina = d.nextPageToken;
  }
  return tutti;
}

export const elencaFile = () =>
  elencaTutto(
    `trashed=false and mimeType!='${CARTELLA}'`,
    "id,name,size,sha256Checksum,appProperties,parents"
  ).then((l) => l.filter((f) => estensioneDi(f.name)));

export const elencaCartelle = () => elencaTutto(`trashed=false and mimeType='${CARTELLA}'`, "id,name");

async function creaCartella(nome) {
  const r = await chiama(`${API}/files?fields=id,name`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: nome, mimeType: CARTELLA }),
  });
  return r.json();
}

// Il segno che dice al prossimo dispositivo «questo file e' quel libro».
// Sta nelle proprieta' private dell'app, che il lettore su Drive non vede.
// Il segno che dice al prossimo dispositivo «questo file e' quel libro» — o
// quella melodia, con `bcTrack` al posto di `bcId`.
const segnaCon = (fileId, props) =>
  chiama(`${API}/files/${fileId}?fields=id`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appProperties: { bc: "1", ...props } }),
  });
export const segna = (fileId, bookId) => segnaCon(fileId, { bcId: bookId });

export async function scaricaDaDrive(fileId) {
  const r = await chiama(`${API}/files/${fileId}?alt=media`);
  return r.blob();
}

// UN FILE DI DRIVE LETTO A PEZZI. Ha la forma che i lettori a fette si
// aspettano da un Blob — `size`, e `slice(da, a)` che da' `arrayBuffer()` e
// `stream()` — e ogni pezzo e' una richiesta con `Range`: di un ePub da
// venti megabyte per titolo, autore, saga e copertina ne scendono poche
// centinaia di chilobyte. Ogni richiesta pero' costa un viaggio, e i
// lettori chiedono pezzi piccolissimi (una testata di trenta byte, poi i
// suoi dati): si chiede sempre almeno `LETTURA_MINIMA` e si tengono gli
// ultimi pezzi, cosi' la testata e i dati che la seguono arrivano insieme.
// Un PDF lo chiede piu' piccolo (`minimo`): pdf.js per arrivare a una pagina
// attraversa l'albero delle pagine oggetto per oggetto, e ogni oggetto sta
// fra due immagini — 256 KB per ognuno sono pagine intere scaricate per
// leggerne tre righe.
const LETTURA_MINIMA = 256 * 1024;
const PEZZI_TENUTI = 8;
export function fileRemoto(fileId, size, { prendi, minimo = LETTURA_MINIMA } = {}) {
  const totale = Number(size) || 0;
  const tenuti = [];
  const scarica =
    prendi ||
    (async (da, a) => {
      const r = await chiama(`${API}/files/${fileId}?alt=media`, { headers: { Range: `bytes=${da}-${a - 1}` } });
      const buf = new Uint8Array(await r.arrayBuffer());
      // un server che ignora `Range` manda il file intero: lo si tiene
      // intero, invece di chiederlo di nuovo a ogni pezzo
      return r.status === 206 ? { da, buf } : { da: 0, buf };
    });
  const leggi = async (da, a) => {
    if (a <= da) return new Uint8Array(0);
    const t = tenuti.find((p) => p.da <= da && p.da + p.buf.length >= a);
    if (t) return t.buf.slice(da - t.da, a - t.da);
    const fine = Math.min(totale || a, Math.max(a, da + minimo));
    const p = await scarica(da, fine);
    tenuti.unshift(p);
    if (tenuti.length > PEZZI_TENUTI) tenuti.pop();
    if (p.da > da || p.da + p.buf.length < a) throw new Error("Google Drive ha mandato meno di quel che serviva.");
    return p.buf.slice(da - p.da, a - p.da);
  };
  const pezzo = (da = 0, a = totale) => {
    const i = Math.max(0, Math.min(totale, da < 0 ? totale + da : da));
    const f = Math.max(i, Math.min(totale, a < 0 ? totale + a : a));
    return {
      size: f - i,
      arrayBuffer: async () => (await leggi(i, f)).buffer,
      stream: () =>
        new ReadableStream({
          async start(c) {
            try {
              c.enqueue(await leggi(i, f));
              c.close();
            } catch (e) {
              c.error(e);
            }
          },
        }),
      slice: (x = 0, y = f - i) => pezzo(i + x, i + Math.min(y, f - i)),
    };
  };
  return pezzo(0, totale);
}

// UN LIBRO ELIMINATO LASCIA IL SUO FILE SU DRIVE (e' l'archivio del
// lettore), ma col segno addosso quel file resterebbe «di un libro»:
// «Aggiungi da Drive» non lo proporrebbe mai piu', perche' un file segnato
// che qui non ha una scheda sembra di un altro dispositivo. Si toglie il
// segno, e il file torna un file qualunque. Con la chiave scaduta non si
// puo': finche' la lapide vive il file resta proponibile lo stesso.
export async function smarcaSuDrive(bookId) {
  const m = mappaDrive();
  const f = m[bookId];
  if (!f) return;
  delete m[bookId];
  scriviMappa(m);
  if (!tokenValido()) return;
  await segnaCon(f.id, { bcId: null }).catch(() => {});
}

// Il libro nuovo nato da un file di Drive entra subito nella mappa: e'
// «lassu'» da adesso, con la nuvoletta, e si apre scaricandolo — senza
// aspettare il prossimo giro della sincronizzazione.
export function mettiNellaMappa(bookId, fileId, byte) {
  const m = mappaDrive();
  m[bookId] = { id: fileId, byte: Number(byte) || 0 };
  scriviMappa(m);
}

// IL CARICAMENTO A RIPRESA: un fumetto da un giga in una richiesta sola si
// perderebbe intero al primo buco di rete. Si apre una sessione, e i byte
// partono a pezzi con `Blob.slice`, che non copia niente finche' non tocca
// a quel pezzo — cosi' il volume non entra mai tutto nella memoria.
export async function caricaSuDrive(blob, { nome, cartella, bookId, props }) {
  const inizio = await chiama(`${UPLOAD}/files?uploadType=resumable&fields=id,size`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": blob.type || "application/octet-stream",
      "X-Upload-Content-Length": String(blob.size),
    },
    body: JSON.stringify({
      name: nome,
      ...(cartella ? { parents: [cartella] } : {}),
      appProperties: { bc: "1", ...(props || { bcId: bookId }) },
    }),
  });
  const dove = inizio.headers.get("Location");
  if (!dove) throw new Error("Google Drive non ha aperto il caricamento.");
  const totale = blob.size;
  for (let da = 0; ; ) {
    const a = Math.min(totale, da + PEZZO);
    const r = await chiama(dove, {
      method: "PUT",
      headers: { "Content-Range": totale ? `bytes ${da}-${a - 1}/${totale}` : "bytes */0" },
      body: blob.slice(da, a),
    });
    if (r.status !== 308) return r.json();
    const ricevuti = /bytes=0-(\d+)/.exec(r.headers.get("Range") || "");
    da = ricevuti ? Number(ricevuti[1]) + 1 : a;
  }
}

export async function spazioSuDrive() {
  const d = await (await chiama(`${API}/about?fields=storageQuota`)).json();
  return spazioDrive(d.storageQuota);
}

// DOVE STANNO I LIBRI SU DRIVE, per questo dispositivo: {bookId: {id, byte}}.
// Si riscrive a ogni giro, perche' la verita' e' Drive; qui c'e' la copia
// che serve a mostrare le nuvolette e ad aprire un libro senza rifare
// l'elenco di tutto il Drive.
export function mappaDrive() {
  try {
    const m = JSON.parse(leggi(MAPPA_KEY));
    return m && typeof m === "object" && !Array.isArray(m) ? m : {};
  } catch {
    return {};
  }
}
const scriviMappa = (m) => scrivi(MAPPA_KEY, JSON.stringify(m));
// `null` finche' un giro non ha ancora guardato Drive: «non so» non e' «non
// c'e'», e senza questa distinzione il primo avvio dopo il collegamento
// accuserebbe di essere perduti tutti i libri che stanno solo lassu'.
export const idSuDrive = () =>
  driveAcceso() && leggi(MAPPA_KEY) !== null ? new Set(Object.keys(mappaDrive())) : null;

// IL GIRO: riconoscere, segnare, mandare su quel che manca.
//
// `tipo` dice in quale cartella va un libro nuovo, `qui` quali libri hanno i
// byte su questo dispositivo, `misura` quanto pesano. Ogni intoppo su UN
// libro e' di quel libro — si conta e si va avanti, la regola del giro della
// sincronizzazione.
export async function giroDrive(libri, opzioni = {}) {
  if (!driveAcceso() || !driveConfigurato()) return { saltato: "spento" };
  if (!tokenValido()) return { saltato: "scaduto" };
  // la chiave che scade A META' GIRO non e' un guasto: il giro si ferma e
  // aspetta il prossimo tocco, e quel che e' gia' salito resta salito
  try {
    return await giro(libri, opzioni);
  } catch (e) {
    if (e instanceof DriveScollegato) return { saltato: "scaduto" };
    throw e;
  }
}

async function giro(libri, { tipo, qui, misure, inUscita, secchio, leggiByte, say = () => {}, vivo = () => true } = {}) {
  say("Guardo i libri su Google Drive…");
  const file = await elencaFile();
  const { mappa, daSegnare, ambigui } = abbina(libri, file, { misure });
  const salva = () => {
    const m = {};
    for (const [id, f] of mappa) m[id] = { id: f.id, byte: Number(f.size) || 0 };
    scriviMappa(m);
  };
  salva();
  let falliti = 0;
  // una scrittura per libro riconosciuto: con trecento libri sono minuti, e
  // una riga ferma su «Guardo i libri» per tutto quel tempo sembra un blocco
  for (const [k, { bookId, fileId }] of daSegnare.entries()) {
    if (!vivo()) break;
    if (k % 10 === 0) say(`Segno i libri riconosciuti su Drive: ${k} di ${daSegnare.length}…`);
    try {
      await segna(fileId, bookId);
    } catch (e) {
      if (e instanceof DriveScollegato) return { saltato: "scaduto", ambigui, falliti };
      /* il segno manca e basta: al prossimo giro lo si riconosce di nuovo */
    }
  }

  const suDrive = new Set(mappa.keys());
  // prima quel che ha i byte qui, poi quel che sta solo nel secchio di
  // Supabase: a chi legge `leggiByte` interessa solo da dove si prendono
  const mandare = [
    ...daCaricare(libri, { qui, lassu: suDrive, inUscita }),
    ...daTraslocare(libri, { secchio, drive: suDrive, qui }).filter((b) => !(inUscita && inUscita.has(b.id))),
  ];
  let caricati = 0;
  if (mandare.length) {
    const cartelle = await elencaCartelle();
    const perTipo = new Map();
    const cartellaDi = async (b) => {
      const t = tipo(b);
      if (perTipo.has(t)) return perTipo.get(t);
      const genitori = libri
        .filter((x) => mappa.has(x.id) && tipo(x) === t)
        .map((x) => mappa.get(x.id).parents?.[0]);
      let id = scegliCartella(t, { genitori, cartelle });
      if (!id) id = (await creaCartella(cartellaDelTipo(t))).id;
      perTipo.set(t, id);
      return id;
    };
    for (const b of mandare) {
      if (!vivo()) break;
      try {
        const blob = await leggiByte(b.id);
        if (!blob) continue;
        say(`Carico su Drive «${b.title}»…`);
        const f = await caricaSuDrive(blob, { nome: nomeSuDrive(b), cartella: await cartellaDi(b), bookId: b.id });
        mappa.set(b.id, { id: f.id, size: f.size ?? blob.size });
        salva();
        caricati += 1;
      } catch (e) {
        if (e instanceof DriveScollegato) return { saltato: "scaduto", ambigui, falliti, caricati };
        falliti += 1;
      }
    }
  }
  return { mappa: new Set(mappa.keys()), ambigui, falliti, caricati };
}

// LA MUSICA SU DRIVE (le decisioni in `driveCore.js`, vedi `abbinaMelodie`).
//
// Si elencano i file AUDIO per tipo, non per estensione: un brano caricato
// dall'app porta il tipo del file che il lettore ha scelto, e un'estensione
// che non conosciamo non deve farlo sparire dall'elenco — al giro dopo
// sembrerebbe mancante e ripartirebbe, ogni volta.
const elencaAudio = () =>
  elencaTutto(`trashed=false and mimeType contains 'audio/'`, "id,name,size,appProperties,parents");

export function mappaMelodie() {
  try {
    const m = JSON.parse(leggi(MAPPA_MUSICA_KEY));
    return m && typeof m === "object" && !Array.isArray(m) ? m : {};
  } catch {
    return {};
  }
}
const scriviMappaMelodie = (m) => scrivi(MAPPA_MUSICA_KEY, JSON.stringify(m));

// IL GIRO DELLA MUSICA: riconoscere, segnare, mandare su. Stesse regole del
// giro dei libri — la chiave scaduta aspetta, un intoppo su UN brano e' di
// quel brano. Torna le melodie che stanno su Drive (`trackId`).
export async function giroMelodie(favs, opzioni = {}) {
  if (!driveAcceso() || !driveConfigurato()) return { saltato: "spento" };
  if (!tokenValido()) return { saltato: "scaduto" };
  try {
    return await giroDellaMusica(favs, opzioni);
  } catch (e) {
    if (e instanceof DriveScollegato) return { saltato: "scaduto" };
    throw e;
  }
}

async function giroDellaMusica(favs, { qui, leggiTrack, say = () => {}, vivo = () => true } = {}) {
  const melodie = melodieFile(favs);
  if (!melodie.length) {
    scriviMappaMelodie({});
    return { melodie: new Set(), caricate: 0, falliti: 0, ambigui: 0 };
  }
  say("Guardo la musica su Google Drive…");
  const file = await elencaAudio();
  const { mappa, daSegnare, ambigui } = abbinaMelodie(melodie, file);
  const salva = () => {
    const m = {};
    for (const [id, f] of mappa) m[id] = { id: f.id, byte: Number(f.size) || 0 };
    scriviMappaMelodie(m);
  };
  salva();
  for (const { trackId, fileId } of daSegnare) {
    if (!vivo()) break;
    try {
      await segnaCon(fileId, { bcTrack: trackId });
    } catch (e) {
      if (e instanceof DriveScollegato) throw e;
      /* il segno manca e basta: al prossimo giro lo si riconosce di nuovo */
    }
  }
  const mandare = melodieDaCaricare(melodie, { qui, lassu: new Set(mappa.keys()) });
  let caricate = 0;
  let falliti = 0;
  if (mandare.length) {
    const genitori = [...mappa.values()].map((f) => f.parents?.[0]);
    let cartella = scegliCartella("musica", { genitori, cartelle: await elencaCartelle() });
    if (!cartella) cartella = (await creaCartella(cartellaDelTipo("musica"))).id;
    for (const m of mandare) {
      if (!vivo()) break;
      try {
        const blob = await leggiTrack(m.trackId);
        if (!blob) continue;
        say(`Carico su Drive la melodia «${m.name}»…`);
        const f = await caricaSuDrive(blob, { nome: nomeMelodiaSuDrive(m), cartella, props: { bcTrack: m.trackId } });
        mappa.set(m.trackId, { id: f.id, size: f.size ?? blob.size });
        salva();
        caricate += 1;
      } catch (e) {
        if (e instanceof DriveScollegato) throw e;
        falliti += 1;
      }
    }
  }
  return { melodie: new Set(mappa.keys()), caricate, falliti, ambigui };
}

// UNA MELODIA CHE QUI NON C'E' SI PRENDE DA DRIVE QUANDO LA SUONI.
//
// Si cerca nella mappa di questo dispositivo, e se il giro qui non l'ha
// ancora vista — l'ha caricata l'altro dispositivo un'ora fa — la si chiede
// a Drive per il suo segno: aspettare una sincronizzazione per suonare un
// brano che lassu' c'e' gia' sarebbe un'attesa che nessuno capirebbe.
// La chiave, se e' scaduta, si chiede qui: si arriva da un tocco su «suona».
// `null` = non c'e' su Drive (e allora si dice), un guasto si alza.
export async function melodiaDalDrive(trackId) {
  if (!driveAcceso() || !driveConfigurato() || !trackId) return null;
  if (!tokenValido()) await collegaDrive();
  let fileId = mappaMelodie()[trackId]?.id || null;
  if (!fileId) {
    const trovati = await elencaTutto(
      `trashed=false and appProperties has { key='bcTrack' and value='${String(trackId).replace(/[^\w-]/g, "")}' }`,
      "id,size"
    );
    fileId = trovati[0]?.id || null;
  }
  if (!fileId) return null;
  try {
    return await scaricaDaDrive(fileId);
  } catch (e) {
    if (e?.status === 404) return null;
    throw e;
  }
}

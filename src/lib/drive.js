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

import { abbina, daCaricare, daTraslocare, scegliCartella, cartellaDelTipo, nomeSuDrive, spazioDrive, estensioneDi } from "./driveCore.js";

const TOKEN_KEY = "bc_drive_token";
const ACCESO_KEY = "bc_drive_on";
const CLIENT_KEY = "bc_drive_client";
const MAPPA_KEY = "bc_drive_libri";
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
export const clientId = () => import.meta.env?.VITE_GOOGLE_CLIENT_ID || leggi(CLIENT_KEY) || "";
export const scriviClientId = (v) => scrivi(CLIENT_KEY, String(v || "").trim() || null);
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

const elencaCartelle = () => elencaTutto(`trashed=false and mimeType='${CARTELLA}'`, "id,name");

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
const segna = (fileId, bookId) =>
  chiama(`${API}/files/${fileId}?fields=id`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appProperties: { bc: "1", bcId: bookId } }),
  });

export async function scaricaDaDrive(fileId) {
  const r = await chiama(`${API}/files/${fileId}?alt=media`);
  return r.blob();
}

// IL CARICAMENTO A RIPRESA: un fumetto da un giga in una richiesta sola si
// perderebbe intero al primo buco di rete. Si apre una sessione, e i byte
// partono a pezzi con `Blob.slice`, che non copia niente finche' non tocca
// a quel pezzo — cosi' il volume non entra mai tutto nella memoria.
export async function caricaSuDrive(blob, { nome, cartella, bookId }) {
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
      appProperties: { bc: "1", bcId: bookId },
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
  for (const { bookId, fileId } of daSegnare) {
    if (!vivo()) break;
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

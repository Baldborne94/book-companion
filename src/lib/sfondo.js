// LA COPERTINA SULLA SCHERMATA DI BLOCCO, il lato della pagina.
//
// Chiesto dal lettore, dopo il salvaschermo: «mi appare anche se decido di
// spegnere io il dispositivo?». Uno schermo spento e' nero per tutti; la
// schermata di blocco pero' ha uno sfondo, e lo puo' cambiare un'app
// nativa: il guscio Android (`android/SchermataDiBlocco.java`). Chrome da'
// alle Trusted Web Activity un canale postMessage fra la pagina e il guscio:
// il guscio saluta per primo (`SALUTO`, con la porta attaccata), la pagina
// risponde sulla porta con la copertina gia' composta per lo schermo, a
// pezzi. Qui le decisioni, provate in Node; il canvas sta in
// `copertinaPerSchermo`, che chiede il browser.
export const SALUTO = "grimorio:pronto";
// la risposta al saluto: finche' non arriva, il guscio risaluta
export const CIAO = "grimorio:ciao";
const OK = "grimorio:sfondo:ok";
const ERRORE = "grimorio:sfondo:errore:";
// lo stesso di `public/.well-known/assetlinks.json` (`manifest.test.mjs`)
export const PACCHETTO = "it.bookcompanion.app";
export const CHIAVE = "bc_sfondo";
// un messaggio solo da mezzo megabyte non passa dal binder di Android
export const PEZZO = 48000;
// il lato lungo dello sfondo: oltre, solo byte in piu'
export const LATO_MAX = 2400;

// LA PAGINA SI RICORDA DEL GUSCIO PER TUTTA LA SESSIONE: il referrer
// `android-app://` e la query `?guscio=` ci sono solo alla prima apertura, e
// una ricarica (l'aggiornamento automatico dell'app, un `reload`) li perde
// — con l'APK 1110 la sezione «Anche a tablet spento» e' sparita del tutto.
// `sessionStorage` vive quanto la scheda, ricariche comprese, e muore con
// lei: e' la memoria giusta per «chi mi ha aperta».
export const CHIAVE_LANCIO = "bc_guscio_lancio";
export function ricordaLancio(info, storage = globalThis.sessionStorage) {
  if (!info?.versione) return;
  try {
    storage?.setItem(CHIAVE_LANCIO, JSON.stringify(info));
  } catch {
    /* senza memoria si va col referrer */
  }
}
export function lancioRicordato(storage = globalThis.sessionStorage) {
  try {
    const v = JSON.parse(storage?.getItem(CHIAVE_LANCIO) || "null");
    return v && v.versione ? v : null;
  } catch {
    return null;
  }
}

// dentro il guscio Chrome mette il pacchetto come referrer (lo stesso
// segno del rapporto dei guasti), o la pagina se lo ricorda
export const nelGuscio = (referrer = globalThis.document?.referrer, storage = globalThis.sessionStorage) =>
  String(referrer || "").startsWith("android-app://") || !!lancioRicordato(storage);

// LA PORTA ARRIVA PRIMA DEL SALUTO. L'APK 1110 ha detto «canale pronto»
// e la pagina non ha mai risposto: Chrome consegna alla finestra un
// `message` con dati VUOTI e la porta del canale attaccata, e tutto quel che
// il guscio scrive dopo — il saluto compreso — viaggia sulla porta, non
// sulla finestra. La pagina aspettava il saluto nel messaggio della
// finestra e lasciava la porta senza ascolto. Quindi la porta E' la stretta
// di mano: si prende, ci si risponde sopra, e si ascolta su di lei.
// L'ORIGINE E' `android-app://<host del sito>` (la riga «Messaggi alla
// pagina» dell'APK 1110, tre porte rifiutate): Chrome scrive cosi'
// l'origine di un'app Android verificata, con l'host del sito e non il
// pacchetto, e nessuna pagina web puo' produrla. Si accetta ogni
// `android-app://`, l'origine del sito, e un messaggio con la porta e il
// saluto scritto dentro da qualunque origine, perche' nel guscio nessun
// altro ne manda.
export function portaDelGuscio(e, origine) {
  const porta = e?.ports?.[0];
  if (!porta) return null;
  const o = String(e.origin || "");
  if (o && o !== origine && !o.startsWith("android-app://") && e.data !== SALUTO) return null;
  return porta;
}

// ogni `message` visto sulla finestra, per la diagnosi: origine, dati e
// quante porte, gli ultimi cinque
export const CHIAVE_MESSAGGI = "bc_guscio_messaggi";
export function annotaMessaggio(e, storage = globalThis.sessionStorage) {
  const voce = { o: String(e?.origin || ""), d: typeof e?.data === "string" ? e.data.slice(0, 40) : typeof e?.data, p: e?.ports?.length || 0 };
  try {
    const visti = JSON.parse(storage?.getItem(CHIAVE_MESSAGGI) || "[]");
    storage?.setItem(CHIAVE_MESSAGGI, JSON.stringify([...(Array.isArray(visti) ? visti : []), voce].slice(-5)));
  } catch {
    /* senza memoria niente diagnosi */
  }
  return voce;
}
export function messaggiVisti(storage = globalThis.sessionStorage) {
  try {
    const v = JSON.parse(storage?.getItem(CHIAVE_MESSAGGI) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
export const fraseMessaggi = (visti = []) =>
  visti.length ? visti.map((v) => `${v.o || "(senza origine)"} · «${v.d}» · ${v.p} ${v.p === 1 ? "porta" : "porte"}`).join(" | ") : "nessun messaggio visto";

// L'ULTIMA COPERTINA MANDATA, E COSA NE HA DETTO IL GUSCIO. Sul tablet la
// schermata di blocco mostrava il libro di prima e l'Ingresso quello in
// mano: la pagina aveva mandato la copertina nuova, ma su una porta che il
// guscio non ascoltava piu' (riaperta l'app dall'icona la sessione di Chrome
// cambia, e la porta di prima muore senza dirlo). Da fuori non si vedeva
// niente: ora ogni invio si segna, con la risposta, e le Impostazioni lo
// dicono. Nella sessione: vale per questa pagina aperta.
export const CHIAVE_INVIO = "bc_sfondo_invio";
// oltre, il silenzio del guscio e' un canale morto
export const RISPOSTA_ENTRO = 20000;
export function segnaInvio(voce, storage = globalThis.sessionStorage) {
  try {
    storage?.setItem(CHIAVE_INVIO, JSON.stringify(voce));
  } catch {
    /* senza memoria non si racconta */
  }
  return voce;
}
export function segnaRisposta(r, storage = globalThis.sessionStorage) {
  const voce = ultimoInvio(storage);
  if (!voce || !r) return voce;
  return segnaInvio({ ...voce, esito: r.ok ? "ok" : `guasto: ${r.errore}` }, storage);
}
export function ultimoInvio(storage = globalThis.sessionStorage) {
  try {
    const v = JSON.parse(storage?.getItem(CHIAVE_INVIO) || "null");
    return v && v.quando ? v : null;
  } catch {
    return null;
  }
}
const ora = (q) => new Date(q).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
export function fraseInvio(voce, adesso = Date.now()) {
  if (!voce) return "Nessuna copertina mandata da quando la pagina è aperta.";
  const chi = `«${voce.titolo || voce.id}» alle ${ora(voce.quando)}`;
  if (voce.esito === "senza copertina") return `${chi}: senza copertina, niente da mandare.`;
  if (voce.esito === "illeggibile") return `${chi}: la copertina non si è letta, non è partita.`;
  if (voce.esito === "ok") return `Ultima copertina mandata: ${chi} · messa.`;
  if (String(voce.esito || "").startsWith("guasto")) return `Ultima copertina mandata: ${chi} · ${voce.esito}.`;
  return `Ultima copertina mandata: ${chi} · ${adesso - voce.quando > RISPOSTA_ENTRO ? "il guscio non ha risposto" : "in attesa della risposta"}.`;
}

// AL SALUTO SI RIMANDA QUEL CHE NON E' STATO CONFERMATO: il guscio saluta a
// ogni pagina caricata e ogni volta che la scheda torna davanti, e una
// copertina mandata senza l'ok era quasi certamente finita su una porta
// morta. Quella confermata no: il guscio ce l'ha gia'.
export const dopoIlSaluto = (mandata, confermata) => (mandata && mandata === confermata ? mandata : null);

export function risposta(data) {
  if (data === OK) return { ok: true };
  if (typeof data === "string" && data.startsWith(ERRORE)) return { errore: data.slice(ERRORE.length) || "guasto sconosciuto" };
  return null;
}

export function pezzi(id, base64, max = PEZZO) {
  const n = Math.max(1, Math.ceil(base64.length / max));
  return Array.from({ length: n }, (_, i) => JSON.stringify({ sfondo: { id, i, n, dati: base64.slice(i * max, (i + 1) * max) } }));
}

// Lo sfondo si fa alla misura VERA dello schermo (pixel fisici), in piedi:
// la schermata di blocco e' in piedi, e un'immagine di un'altra misura
// Android la ritaglia. Sopra `tetto` si riduce: e' il lato lungo.
export function misuraSchermo({ width, height, dpr = 1, tetto = LATO_MAX } = {}) {
  const a = Math.max(1, Number(width) || 0);
  const b = Math.max(1, Number(height) || 0);
  const d = Number(dpr) > 0 ? Number(dpr) : 1;
  let w = Math.round(Math.min(a, b) * d);
  let h = Math.round(Math.max(a, b) * d);
  if (h > tetto) {
    w = Math.round((w * tetto) / h);
    h = tetto;
  }
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

// la copertina intera dentro lo schermo, come nel salvaschermo: ritagliarla
// per riempire taglierebbe proprio l'arte
export function dentroIlRettangolo(w, h, W, H) {
  if (!(w > 0) || !(h > 0) || !(W > 0) || !(H > 0)) return null;
  const k = Math.min(W / w, H / h);
  const lw = Math.round(w * k);
  const lh = Math.round(h * k);
  return { x: Math.floor((W - lw) / 2), y: Math.floor((H - lh) / 2), w: lw, h: lh };
}

// SPENTO FINCHE' NON LO ACCENDI TU: sostituisce lo sfondo della schermata
// di blocco, e quello di prima nessuno lo puo' rimettere
export function leggiSfondo(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(CHIAVE) === "1";
  } catch {
    return false;
  }
}

export function scriviSfondo(acceso, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CHIAVE, acceso ? "1" : "0");
  } catch {
    /* resta com'era */
  }
  return !!acceso;
}

// base64 senza il «data:» davanti: il guscio decodifica i byte e basta
export async function copertinaPerSchermo(blob, { w, h }, fondo = "#000000") {
  const img = await createImageBitmap(blob);
  try {
    const dove = dentroIlRettangolo(img.width, img.height, w, h);
    if (!dove) return null;
    const tela = document.createElement("canvas");
    tela.width = w;
    tela.height = h;
    const g = tela.getContext("2d");
    g.fillStyle = fondo;
    g.fillRect(0, 0, w, h);
    g.drawImage(img, dove.x, dove.y, dove.w, dove.h);
    return tela.toDataURL("image/jpeg", 0.85).split(",")[1] || null;
  } finally {
    img.close?.();
  }
}

// COSA DICE L'INDIRIZZO DI AVVIO. Il guscio apre la pagina con
// `?guscio=<versione>` e, dal secondo avvio, `&esito=s=1;c=1;r=1;v=0;p=0;
// a=0;f=0;e=…`: com'e' andato l'ultimo tentativo di parlare, passo per
// passo. E' l'unica strada che non passa dal canale, e serve proprio quando
// il canale non si apre. Si legge PRIMA che `pulisciUrl` tolga la query.
export function infoDalLancio(search) {
  let q;
  try {
    q = new URLSearchParams(String(search || ""));
  } catch {
    return { versione: null, esito: null };
  }
  const versione = /^\d+$/.test(q.get("guscio") || "") ? q.get("guscio") : null;
  const grezzo = q.get("esito");
  if (!grezzo) return { versione, esito: null };
  const esito = { grezzo };
  for (const pezzo of grezzo.split(";")) {
    const i = pezzo.indexOf("=");
    if (i > 0) esito[pezzo.slice(0, i)] = pezzo.slice(i + 1);
  }
  return { versione, esito };
}

// I passi, nell'ordine in cui avvengono: il primo che manca e' dove ci si
// e' fermati, e la frase lo dice con la cura che gli corrisponde.
const PASSI = [
  ["l", "il lanciatore non è stato creato (la LauncherActivity generata non estende GuscioActivity)"],
  ["k", "il callback di Chrome non è stato creato"],
  ["n", "Chrome non ha mai detto che la pagina è caricata (nessun evento di navigazione)"],
  ["s", "la sessione di Chrome non si è letta (R8 l'ha nascosta, o la libreria del guscio è cambiata: vedi scripts/apk.mjs)"],
  ["c", "Chrome non si è lasciato scaldare (nessun browser collegato)"],
  ["r", "Chrome ha rifiutato la richiesta del canale"],
  ["v", "Chrome non ha verificato l'origine del sito (assetlinks.json con use_as_origin: aspetta qualche minuto e riprova)"],
  ["p", "il canale non è mai stato pronto"],
  ["a", "il saluto del guscio non è mai arrivato alla pagina"],
];
export function fraseEsito(esito) {
  if (!esito) return null;
  for (const [k, frase] of PASSI) {
    if (esito[k] === "1") continue;
    // «u» e' l'ultimo evento visto: 1 partita, 2 caricata, 3 fallita, 4
    // interrotta, 5 scheda mostrata, 6 nascosta
    return frase + (k === "n" && esito.u ? ` (ultimo evento: ${esito.u})` : "") + (esito.e ? ` — ${esito.e}` : "");
  }
  const n = Number(esito.f) || 0;
  return n ? `tutto a posto, ${n === 1 ? "una copertina messa" : `${n} copertine messe`}` : "canale aperto e saluto ricevuto, ma nessuna copertina mandata";
}

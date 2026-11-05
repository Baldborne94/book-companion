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

// dentro il guscio Chrome mette il pacchetto come referrer (lo stesso
// segno del rapporto dei guasti)
export const nelGuscio = (referrer = globalThis.document?.referrer) => String(referrer || "").startsWith("android-app://");

// il saluto arriva come `message` sulla finestra, con la porta attaccata:
// l'origine e' quella del sito, verificata da Chrome con `use_as_origin`, o
// il pacchetto quando la verifica non c'e'
export function salutoDelGuscio(e, origine) {
  if (!e || e.data !== SALUTO || !e.ports?.length) return false;
  return e.origin === origine || e.origin === `android-app://${PACCHETTO}`;
}

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
  const esito = {};
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
    // «n» e' il numero dell'ultimo evento: 2 e' la pagina caricata
    const ok = k === "n" ? esito.n === "2" : esito[k] === "1";
    if (!ok) return frase + (k === "n" && esito.n ? ` (ultimo evento: ${esito.n})` : "") + (esito.e ? ` — ${esito.e}` : "");
  }
  const n = Number(esito.f) || 0;
  return n ? `tutto a posto, ${n === 1 ? "una copertina messa" : `${n} copertine messe`}` : "canale aperto e saluto ricevuto, ma nessuna copertina mandata";
}

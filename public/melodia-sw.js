// UNA MELODIA DI DRIVE SUONA MENTRE SCENDE (chiesto dal lettore: «la devi
// scaricare prima di riprodurla?»). L'<audio> non sa mettere la chiave di
// Google nella testata, e Drive senza chiave non da' il file: qui il
// service worker prende la richiesta del lettore audio a un indirizzo di
// casa, `/__melodia/<id del file>?k=<chiave>`, e la gira a Drive con la
// chiave nella testata e lo stesso `Range`. L'<audio> chiede i pezzi che
// gli servono (l'inizio per partire, un punto lontano quando salti) e
// Drive risponde 206: niente aspetta il file intero.
//
// Lo carica il service worker di Workbox con `importScripts` (vedi
// `vite.config.js`), prima delle sue rotte: un `respondWith` dato qui vince.
const DRIVE_MEDIA = "https://www.googleapis.com/drive/v3/files/";
const STRADA = "/__melodia/";

self.addEventListener("fetch", (evento) => {
  const u = new URL(evento.request.url);
  if (!u.pathname.startsWith(STRADA)) return;
  const id = decodeURIComponent(u.pathname.slice(STRADA.length));
  const testate = { Authorization: `Bearer ${u.searchParams.get("k")}` };
  const range = evento.request.headers.get("range");
  if (range) testate.Range = range;
  evento.respondWith(fetch(`${DRIVE_MEDIA}${encodeURIComponent(id)}?alt=media`, { headers: testate }));
});

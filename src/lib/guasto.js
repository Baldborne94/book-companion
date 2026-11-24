// UN PEZZO DELL'APP CHE NON C'E' PIU' NON E' UN GUASTO DEL LIBRO.
//
// Reader, PdfReader e le schede arrivano in chunk separati, caricati la
// prima volta che servono. Se nel frattempo e' uscita una versione nuova,
// la pagina aperta chiede un file col nome VECCHIO, che sul server non
// esiste piu': l'import fallisce e il Guasto lo raccoglie come un errore
// qualunque. Solo che «torna in biblioteca e riapri il tomo» li' non serve
// a niente — React ricorda l'import fallito e riaprire rifa' lo stesso
// errore. L'unica cura e' ricaricare, e allora bisogna dirlo.
//
// Ogni motore lo scrive a modo suo, e il lettore legge su Gecko: la frase
// di Firefox e' quella che conta di piu'.
const FIRME = [
  /Failed to fetch dynamically imported module/i, // Chromium
  /error loading dynamically imported module/i, // Firefox
  /Importing a module script failed/i, // Safari
  /Unable to preload CSS/i, // il precaricatore di Vite
];

export function pezzoMancante(err) {
  if (!err) return false;
  if (err.name === "ChunkLoadError") return true;
  const msg = String(err.message || err);
  return FIRME.some((re) => re.test(msg));
}

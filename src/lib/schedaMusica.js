// LA COPERTINA DEL LIBRO SULLA SCHEDA DELLA MUSICA.
//
// Chiesto dal lettore: «se ho ancora il book companion attivo in
// background, mostrare sullo schermo la copertina di quello che sto
// leggendo, tipo stile Kindle». Uno schermo LCD spento è nero e nessuna app
// lo cambia; quel che il sistema mostra fuori dall'app è la scheda della
// musica (tendina e schermata di blocco), e quella scheda accetta
// un'immagine. Quindi, mentre suona qualcosa, l'immagine è la copertina del
// libro che hai in mano.
//
// Le decisioni stanno qui (nessun canvas, nessun IndexedDB) perché si
// provano in Node; il disegno del quadrato sta in `copertinaQuadrata`, che
// chiede il browser.

const chiuso = (s) => s === "read" || s === "abandoned";

// Il libro della scheda: quello aperto nel lettore; a lettore chiuso,
// l'ultimo aperto — come il riquadro in cima all'Ingresso — purché non
// l'hai finito o abbandonato. Un libro chiuso sulla schermata di blocco
// direbbe «stai leggendo» una cosa che non leggi più.
export function libroDellaScheda({ aperto = null, ultimoId = null, libri = [], statoDi = () => "unread" } = {}) {
  if (aperto) return aperto;
  const b = ultimoId ? libri.find((x) => x?.id === ultimoId) : null;
  if (!b || chiuso(statoDi(b.id))) return null;
  return b;
}

// Il titolo resta quello del brano: i tasti della scheda comandano la
// musica, e un titolo di libro sopra ⏭ farebbe credere di voltare pagina.
// Il libro sta sotto, dove i lettori musicali scrivono l'artista.
export function metadatiScheda({ brano, libro, copertina } = {}) {
  const titolo = String(libro?.title || "").trim();
  const autore = String(libro?.author || "").trim();
  return {
    title: brano?.name || "Musica di sottofondo",
    artist: titolo ? (autore ? `${titolo} — ${autore}` : titolo) : "Book Companion",
    album: titolo ? "Book Companion" : "",
    artwork: copertina?.src ? [{ src: copertina.src, sizes: `${copertina.lato}x${copertina.lato}`, type: copertina.type }] : [],
  };
}

// Android mostra l'immagine della scheda in un riquadro quadrato e la
// RITAGLIA: una copertina in piedi perderebbe titolo e piedi. Si mette
// intera dentro un quadrato, su fondo scuro, come un libro su un tavolo.
export const LATO_SCHEDA = 512;
export function dentroIlQuadrato(w, h, lato = LATO_SCHEDA) {
  if (!(w > 0) || !(h > 0)) return null;
  const k = Math.min(lato / w, lato / h);
  const lw = Math.round(w * k);
  const lh = Math.round(h * k);
  return { x: Math.floor((lato - lw) / 2), y: Math.floor((lato - lh) / 2), w: lw, h: lh };
}

// Un indirizzo `data:` e non un `blob:`: la scheda la disegna il sistema,
// che l'immagine se la va a prendere da sé, e un `data:` non dipende dalla
// pagina che lo ha creato né va revocato.
export async function copertinaQuadrata(blob, fondo = "#0f0d1a", lato = LATO_SCHEDA) {
  const img = await createImageBitmap(blob);
  try {
    const dove = dentroIlQuadrato(img.width, img.height, lato);
    if (!dove) return null;
    const tela = document.createElement("canvas");
    tela.width = lato;
    tela.height = lato;
    const g = tela.getContext("2d");
    g.fillStyle = fondo;
    g.fillRect(0, 0, lato, lato);
    g.drawImage(img, dove.x, dove.y, dove.w, dove.h);
    return { src: tela.toDataURL("image/jpeg", 0.85), lato, type: "image/jpeg" };
  } finally {
    img.close?.();
  }
}

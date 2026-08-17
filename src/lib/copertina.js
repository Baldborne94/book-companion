// LA COPERTINA SI PUO' METTERE A MANO. Titolo, autore, saga e genere si
// correggono nella scheda del libro; la copertina no — e se l'ePub non ne
// aveva una, quel dorso restava muto sullo scaffale per sempre.
//
// Una foto scelta dal rullino pero' e' un file da qualche megabyte, e una
// copertina si guarda grande sei centimetri: metterla dentro com'e'
// vorrebbe dire spendere in una miniatura piu' spazio che in un romanzo, e
// portarsela dietro in ogni archivio e in ogni sincronizzazione.

// il lato lungo di una copertina utile: sul tablet la scheda la mostra a
// 150px e la libreria molto meno, quindi 800 basta anche per uno schermo
// a densita' tripla
export const LATO = 800;

// La misura si tiene in un posto suo perche' e' l'unico pezzo che si puo'
// provare senza un canvas. Le proporzioni non si toccano MAI: una
// copertina schiacciata si nota subito, ed e' peggio di nessuna copertina.
// Un'immagine gia' piccola non si ingrandisce — ingrandirla non aggiunge
// dettaglio, aggiunge solo byte.
export function misura(w, h, max = LATO) {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  const lato = Math.max(w, h);
  if (!Number.isFinite(max) || max <= 0 || lato <= max) return { w: Math.round(w), h: Math.round(h) };
  const k = max / lato;
  // mai zero: un lato arrotondato a zero darebbe un canvas che non disegna
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

const IMMAGINE = /^image\//;

// Torna il blob da salvare. Se qualcosa non funziona — formato che il
// browser non decodifica, canvas negato — si tiene il file ORIGINALE:
// una copertina pesante e' meglio di nessuna copertina, che e' il difetto
// che stiamo curando.
export async function preparaCopertina(file, max = LATO) {
  if (!file) return null;
  if (!IMMAGINE.test(file.type || "")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const m = misura(bitmap.width, bitmap.height, max);
    if (!m) return file;
    if (m.w === bitmap.width && m.h === bitmap.height && file.size < 400 * 1024) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = m.w;
    canvas.height = m.h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, m.w, m.h);
    bitmap.close?.();
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    return blob || file;
  } catch {
    return file;
  }
}

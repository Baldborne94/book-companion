// DOVE STANNO I LIBRI SUL DISCO DEL COMPUTER (`lib/disco.js`): la cartella
// «book-companion», dentro Libri, Fumetti e Manga, e in ognuna una cartella
// per saga. Erano le stesse cartelle di Google Drive, che non c'e' piu'.

export const RADICE = "book-companion";
export const CARTELLE = { libri: "Libri", fumetti: "Fumetti", manga: "Manga", musica: "Musica" };
export const cartellaDelTipo = (tipo) => CARTELLE[tipo] || CARTELLE.libri;

// Il nome ridotto a quel che conta per confrontarlo con un titolo: senza
// estensione, senza il «(1)» che Windows e Android aggiungono ai doppioni,
// senza accenti, punteggiatura e maiuscole.
export function nomeNudo(nome) {
  return String(nome || "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// LA CASA DI UN VOLUME SUL DISCO, dalla scheda: il tipo, la saga, e la parte
// (il ciclo) se c'e' — i JoJo in «Manga/JoJo's Bizarre Adventure/Parte 7», i
// B.P.R.D. sotto Hellboy («tutto sotto Hellboy, come da saga», chiesto dal
// lettore guardando la cartella dei fumetti). Un volume a se' sta nella
// cartella del suo tipo. Una sola regola per chi sposta e per chi controlla.
export function casaDelVolume(b, tipo) {
  const saga = String(b?.saga || "").trim();
  const ciclo = String(b?.series || "").trim();
  const pezzi = [cartellaDelTipo(tipo)];
  if (saga) pezzi.push(saga);
  if (saga && ciclo && ciclo.toLowerCase() !== saga.toLowerCase()) pezzi.push(ciclo);
  return pezzi;
}

// QUALE CARTELLA E' LA CASA DEI LIBRI, fra quella scelta e le sue figlie: lei
// se si chiama «book-companion», la sua figlia con quel nome, oppure lei se
// dentro ha subito Libri, Fumetti o Manga. L'ultima strada e' per il NAS
// collegato come unita' di rete (Y:): la cartella condivisa si chiama
// book-companion, ma Windows la presenta col nome dell'unita', e il controllo
// diceva «qui dentro non c'e' la cartella».
export async function casaDelDisco(scelta) {
  if (!scelta) return null;
  if (String(scelta.name || "").trim().toLowerCase() === RADICE) return scelta;
  const figlia = await scelta.getDirectoryHandle(RADICE).catch(() => null);
  if (figlia) return figlia;
  for (const nome of [CARTELLE.libri, CARTELLE.fumetti, CARTELLE.manga]) {
    if (await scelta.getDirectoryHandle(nome).catch(() => null)) return scelta;
  }
  return null;
}

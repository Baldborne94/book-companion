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

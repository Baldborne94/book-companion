// LA CASA DEI LIBRI SI TROVA ANCHE NELL'UNITA' DI RETE. Il NAS collegato su
// Windows come Y: e' la cartella book-companion, ma Windows la presenta col
// nome dell'unita': «Controlla il disco» diceva «qui dentro non c'e' la
// cartella». Ora vale anche una cartella che ha subito Libri, Fumetti o Manga.
import { casaDelDisco } from "../src/lib/casa.js";

function cartella(name, figlie = {}) {
  return {
    name,
    async getDirectoryHandle(n) {
      if (!(n in figlie)) throw new Error("NotFoundError");
      return figlie[n];
    },
  };
}

export default async function (t) {
  const bc = cartella("book-companion", { Libri: cartella("Libri") });
  t.eq("scelta lei, col suo nome", await casaDelDisco(bc), bc);
  const maiuscola = cartella("Book-Companion");
  t.eq("il nome senza badare alle maiuscole", await casaDelDisco(maiuscola), maiuscola);
  const disco = cartella("E:", { "book-companion": bc });
  t.eq("scelto il disco che la contiene: la figlia", await casaDelDisco(disco), bc);
  const unita = cartella("Y:\\", { Fumetti: cartella("Fumetti"), Manga: cartella("Manga") });
  t.eq("l'unita' di rete con dentro i tipi: lei", await casaDelDisco(unita), unita);
  const soloManga = cartella("", { Manga: cartella("Manga") });
  t.eq("basta uno dei tipi", await casaDelDisco(soloManga), soloManga);
  t.eq("una cartella qualunque: niente", await casaDelDisco(cartella("Documenti", { Foto: cartella("Foto") })), null);
  t.eq("la sola Musica non e' una casa di libri", await casaDelDisco(cartella("X", { Musica: cartella("Musica") })), null);
  t.eq("niente scelta, niente casa", await casaDelDisco(null), null);
}

// LA MUSICA SI PRENDE DA DRIVE COME I LIBRI (`sceltaMusicaDalPicker`,
// `audioSotto`, `melodieDaAggiungere` in `lib/driveCore.js`; chiesto dal
// lettore). Sbaglia in silenzio: un brano scelto che non entra, una
// cartella scelta che porta dentro i libri invece della musica, lo stesso
// brano due volte.
import { sceltaMusicaDalPicker, audioSotto, melodieDaAggiungere, eAudio, libriSotto } from "../src/lib/driveCore.js";

export default async function (t) {
  // ---- quel che torna dal selettore ----------------------------------------
  const s = sceltaMusicaDalPicker([
    { id: "m1", name: "Pioggia.mp3", mimeType: "audio/mpeg" },
    { id: "m2", name: "Senza tipo.flac" },
    { id: "c1", name: "Musica", mimeType: "application/vnd.google-apps.folder" },
    { id: "l1", name: "Dune.epub", mimeType: "application/epub+zip" },
    { id: "m1", name: "Pioggia.mp3", mimeType: "audio/mpeg" },
  ]);
  t.eq("i brani, anche senza tipo (dall'estensione), una volta sola", s.sciolti.map((x) => x.id).join(), "m1,m2");
  t.eq("le cartelle a parte", s.cartelle.map((x) => x.id).join(), "c1");
  t.eq("un libro non e' musica, e si dice", s.scartati.join(), "Dune.epub");
  t.c("audio dal tipo", eAudio({ name: "x", mimeType: "audio/ogg" }));
  t.c("un'immagine no", !eAudio({ name: "copertina.jpg", mimeType: "image/jpeg" }));

  // ---- le cartelle intere ----------------------------------------------------
  const cartelle = [{ id: "root", name: "book-companion" }, { id: "mus", name: "Musica", parents: ["root"] }, { id: "amb", name: "Ambient", parents: ["mus"] }, { id: "vuota", name: "Vuota", parents: ["mus"] }];
  const file = [
    { id: "a", name: "Vento.mp3", mimeType: "audio/mpeg", parents: ["amb"] },
    { id: "b", name: "Fuoco.m4a", mimeType: "audio/mp4", parents: ["mus"] },
    { id: "l", name: "Dune.epub", parents: ["mus"] },
    { id: "z", name: "Fuori.mp3", mimeType: "audio/mpeg", parents: ["root"] },
  ];
  const sotto = audioSotto([{ id: "mus", name: "Musica" }, { id: "vuota", name: "Vuota" }], file, cartelle);
  t.eq("la cartella porta dentro la musica, anche nelle sottocartelle", sotto.file.map((f) => f.id).sort().join(), "a,b");
  t.eq("una cartella senza musica si dice", sotto.vuote.join(), "Vuota");
  t.eq("e per i libri si prendono ancora i libri", libriSotto([{ id: "mus" }], file, cartelle).file.map((f) => f.id).join(), "l");

  // ---- le melodie nuove ------------------------------------------------------
  let n = 0;
  const nuovoId = () => `id${++n}`;
  const favs = [
    { id: "f1", name: "Pioggia", trackId: "t1", size: 100 },
    { id: "f2", name: "Vecchia", trackId: "t2", size: 5, deleted: true },
    { id: "y", name: "YouTube", url: "https://youtu.be/x" },
  ];
  const trovati = [
    { id: "d1", name: "Pioggia.mp3", size: "100", mimeType: "audio/mpeg" },
    { id: "d2", name: "Segnata.mp3", size: "7", mimeType: "audio/mpeg", appProperties: { bcTrack: "t1" } },
    { id: "d3", name: "Nuova Traccia.flac", size: "300", mimeType: "audio/flac" },
    { id: "d3", name: "Nuova Traccia.flac", size: "300", mimeType: "audio/flac" },
    { id: "d4", name: "Vecchia.mp3", size: "5", mimeType: "audio/mpeg", appProperties: { bcTrack: "t2" } },
    { id: "d5", name: "Copia.mp3", size: "300", mimeType: "audio/mpeg" },
    { id: "d6", name: "Nuova Traccia.mp3", size: "300", mimeType: "audio/mpeg" },
  ];
  const nuove = melodieDaAggiungere(favs, trovati, { nuovoId, adesso: 42 });
  t.eq("entra solo quel che non c'e'", nuove.map((x) => x.fileId).join(), "d3,d4,d5");
  t.c("…non quella con la stessa misura e lo stesso nome", !nuove.some((x) => x.fileId === "d1"));
  t.c("…non quella col segno di una melodia viva", !nuove.some((x) => x.fileId === "d2"));
  t.c("…ma si' quella col segno di una melodia cancellata", nuove.some((x) => x.fileId === "d4"));
  t.c("…e non due volte lo stesso brano scelto due volte, ne' la sua copia con altra estensione", nuove.filter((x) => x.voce.name === "Nuova Traccia").length === 1);
  const v = nuove[0].voce;
  t.eq("il nome e' quello del file senza estensione", v.name, "Nuova Traccia");
  t.eq("la melodia sta su Drive e viaggia", `${v.drive} ${v.size} ${v.mime}`, "true 300 audio/flac");
  t.c("ha un trackId suo, diverso dall'id della voce", v.trackId && v.trackId !== v.id);
  t.eq("col suo timbro", `${v.addedAt} ${v.updatedAt}`, "42 42");
  t.eq("niente scelto, niente melodie", melodieDaAggiungere(favs, undefined).length, 0);
}

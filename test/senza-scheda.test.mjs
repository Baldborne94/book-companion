// I FILE CHE NESSUN LIBRO USA (segnalato dal lettore: 38 GB di manga e
// fumetti caricati a mano su Drive, che «Sposta sull'HDD» non vedeva): si
// spostano col loro percorso sotto «book-companion», e mai un file di un
// libro o un file fuori dall'app.
import { fileSenzaScheda } from "../src/lib/driveCore.js";
import { perCartella } from "../src/lib/hdd.js";

export default async (t) => {
  const cartelle = [
    { id: "R", name: "Book-Companion" },
    { id: "M", name: "Manga", parents: ["R"] },
    { id: "J", name: "JoJo", parents: ["M"] },
    { id: "P2", name: "Parte 2", parents: ["J"] },
    { id: "F", name: "Fumetti", parents: ["R"] },
    { id: "L", name: "Libri", parents: ["R"] },
    { id: "MU", name: "Musica", parents: ["R"] },
    { id: "A", name: "Archivi", parents: ["R"] },
    { id: "FOTO", name: "Manga" },
  ];
  const file = [
    { id: "j1", name: "JoJo v01.cbz", size: "900", parents: ["P2"] },
    { id: "j2", name: "JoJo v02.cbz", size: "800", parents: ["P2"] },
    { id: "g1", name: "Gachiakuta v04.cbz", size: "7000", parents: ["M"] },
    { id: "usato", name: "Hellboy v01.cbz", size: "500", parents: ["F"] },
    { id: "segnato", name: "Sandman.cbr", size: "400", parents: ["F"] },
    { id: "orfano", name: "Cancellato.epub", size: "40", parents: ["L"] },
    { id: "fuori", name: "Berserk.cbz", size: "300", parents: ["FOTO"] },
    { id: "musica", name: "Album.cbz", size: "30", parents: ["MU"] },
    { id: "arch", name: "schede.cbz", size: "30", parents: ["A"] },
    { id: "vuoto", name: "Vuoto.cbz", size: "0", parents: ["M"] },
    { id: "buttato", name: "Via.cbz", size: "10", parents: ["M"], trashed: true },
    { id: "zip", name: "Hellsing.zip", size: "999", parents: ["M"] },
    { id: "radice", name: "Sciolto.cbz", size: "20", parents: ["R"] },
  ];
  const libri = [{ id: "a" }, { id: "b" }];
  const segni = { segnato: "b", orfano: "morto" };
  for (const f of file) if (segni[f.id]) f.appProperties = { bcId: segni[f.id] };
  const voci = fileSenzaScheda(libri, file, cartelle, { usati: new Set(["usato"]) });
  t.eq("solo i file che nessun libro usa, dentro Libri, Fumetti e Manga", voci.map((v) => v.fileId).join(), "j1,j2,g1,orfano");
  t.eq("col percorso che hanno su Drive sotto book-companion", voci.map((v) => v.cartelle.join("/")).join(), "Manga/JoJo/Parte 2,Manga/JoJo/Parte 2,Manga,Libri");
  t.eq("nome e peso del file, nessuna scheda", `${voci[0].nome} ${voci[0].byte} ${voci[0].bookId} ${voci[0].tieni}`, "JoJo v01.cbz 900 null false");
  t.c("il segno di una scheda che c'è ferma il file", !voci.some((v) => v.fileId === "segnato"));
  t.c("finché la biblioteca può arrivare dal cloud, ogni file segnato resta", !fileSenzaScheda(libri, file, cartelle, { schedeInArrivo: true }).some((v) => v.fileId === "orfano"));
  t.c("un file che un libro usa non si sposta", fileSenzaScheda(libri, file, cartelle).some((v) => v.fileId === "usato"));

  const gruppi = perCartella(voci);
  t.eq("per cartella, le più pesanti prima", gruppi.map((c) => `${c.cartella}:${c.n}:${c.byte}`).join(" "), "Manga:1:7000 Manga / JoJo / Parte 2:2:1700 Libri:1:40");
};

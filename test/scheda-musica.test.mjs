// LA COPERTINA DEL LIBRO SULLA SCHEDA DELLA MUSICA (`lib/schedaMusica.js`).
// Chiesto dal lettore: la copertina di quel che sta leggendo sullo schermo
// anche con l'app in secondo piano, «tipo stile Kindle».
import { libroDellaScheda, metadatiScheda, dentroIlQuadrato } from "../src/lib/schedaMusica.js";

export default async function (t) {
  const libri = [
    { id: "a", title: "The Heroes", author: "Joe Abercrombie" },
    { id: "b", title: "Guards! Guards!", author: "Terry Pratchett" },
  ];
  const stati = { a: "reading", b: "read" };
  const statoDi = (id) => stati[id] || "unread";

  // ---- QUALE LIBRO ------------------------------------------------------
  t.eq("il libro aperto nel lettore", libroDellaScheda({ aperto: libri[1], ultimoId: "a", libri, statoDi })?.id, "b");
  t.eq("a lettore chiuso, l'ultimo aperto", libroDellaScheda({ ultimoId: "a", libri, statoDi })?.id, "a");
  t.eq("ma non uno finito", libroDellaScheda({ ultimoId: "b", libri, statoDi }), null);
  t.eq("né uno abbandonato", libroDellaScheda({ ultimoId: "a", libri, statoDi: () => "abandoned" }), null);
  t.eq("né uno che non c'è più", libroDellaScheda({ ultimoId: "x", libri, statoDi }), null);

  // ---- COSA SI SCRIVE ---------------------------------------------------
  const brano = { name: "Pioggia" };
  const cop = { src: "data:image/jpeg;base64,xx", lato: 512, type: "image/jpeg" };
  const m = metadatiScheda({ brano, libro: libri[0], copertina: cop });
  t.eq("il titolo resta il brano: i tasti sono della musica", m.title, "Pioggia");
  t.eq("sotto, il libro con l'autore", m.artist, "The Heroes — Joe Abercrombie");
  t.eq("l'immagine è la copertina", m.artwork[0]?.src, cop.src);
  t.eq("…quadrata, con la sua misura", m.artwork[0]?.sizes, "512x512");
  t.eq("senza autore, il titolo solo", metadatiScheda({ brano, libro: { title: "Senza nome" } }).artist, "Senza nome");
  const vuota = metadatiScheda({ brano });
  t.eq("senza libro la scheda di prima", vuota.artist, "Book Companion");
  t.eq("…e nessuna immagine", vuota.artwork.length, 0);

  // ---- INTERA NEL QUADRATO ----------------------------------------------
  const r = dentroIlQuadrato(800, 1200, 512);
  t.eq("una copertina in piedi tocca sopra e sotto", r.h, 512);
  t.eq("…e sta stretta in mezzo", [r.w, r.x, r.y].join(), "341,85,0");
  const l = dentroIlQuadrato(1200, 600, 512);
  t.eq("una sdraiata tocca i lati e sta in mezzo", [l.w, l.h, l.x, l.y].join(), "512,256,0,128");
  t.eq("un'immagine senza misura non si disegna", dentroIlQuadrato(0, 100), null);
}

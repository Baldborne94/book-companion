// IL SELETTORE DI GOOGLE: quel che torna dalla finestra di Drive — file e
// cartelle intere — e come diventa una lista di file da aggiungere. Sbaglia in silenzio da tutt'e
// due i lati: un file toccato che non entra sparisce senza una riga, e un
// file che non e' un libro entrerebbe come scheda rotta.
import { sceltaDalPicker, libriSotto, eCartella, chiaveApiValida, ripulisciChiaveApi, idRadice, PERCHE_CHIAVE_STORTA } from "../src/lib/driveCore.js";

export default async function (t) {
  const docs = [
    { id: "a", name: "Piranesi.epub", sizeBytes: "1234", mimeType: "application/epub+zip" },
    { id: "b", name: "note.txt", sizeBytes: 10 },
    { id: "c", name: "Hellboy v03.CBZ", sizeBytes: 5000 },
    { id: "a", name: "Piranesi.epub", sizeBytes: "1234" }, // toccato due volte
    { id: "d", name: "Scan.pdf", size: 77 }, // la misura con l'altro nome
    { id: "e", name: "Berserk v01.cbr" },
    { name: "senza id.epub", sizeBytes: 3 },
    null,
    { id: "f", name: "cartella" },
  ];
  const { sciolti: voci, cartelle: scelte, scartati } = sceltaDalPicker([
    ...docs,
    { id: "k1", name: "Fumetti", mimeType: "application/vnd.google-apps.folder" },
    { id: "k2", name: "Manga", type: "folder" }, // il selettore la dice anche cosi'
    { id: "k1", name: "Fumetti", mimeType: "application/vnd.google-apps.folder" },
  ]);
  t.eq("entrano i soli file che sono un libro, una volta ciascuno", voci.map((v) => v.id).join(","), "a,c,d,e");
  t.eq("la misura e' un numero, da `sizeBytes` o da `size`", voci.map((v) => v.size).join(","), "1234,5000,77,0");
  t.eq("il nome resta com'e' (l'estensione la legge chi importa)", voci[1].name, "Hellboy v03.CBZ");
  t.eq("quel che non entra si dice per nome", scartati.join(","), "note.txt,cartella");
  t.eq("le cartelle si dicono a parte, una volta ciascuna", scelte.map((c) => `${c.id}:${c.name}`).join(","), "k1:Fumetti,k2:Manga");
  t.c("una cartella si riconosce dal tipo di Drive o da quello del selettore", eCartella({ mimeType: "application/vnd.google-apps.folder" }) && eCartella({ type: "folder" }) && !eCartella({ name: "Fumetti" }) && !eCartella(null));
  t.eq("senza documenti, niente", JSON.stringify(sceltaDalPicker(null)), JSON.stringify({ sciolti: [], cartelle: [], scartati: [] }));

  // ---- quel che sta SOTTO le cartelle scelte ----
  {
    const tutte = [
      { id: "R", name: "book-companion" },
      { id: "F", name: "Fumetti", parents: ["R"] },
      { id: "H", name: "Hellboy", parents: ["F"] },
      { id: "L", name: "Libri", parents: ["R"] },
      { id: "V", name: "Vuota", parents: ["R"] },
      { id: "G1", name: "Giro", parents: ["G2"] },
      { id: "G2", name: "Giro bis", parents: ["G1"] }, // un genitore che torna su se stesso
    ];
    const file = [
      { id: "h1", name: "Hellboy v01.cbz", parents: ["H"] },
      { id: "f1", name: "Sciolto.cbr", parents: ["F"] },
      { id: "l1", name: "Mort.epub", parents: ["L"] },
      { id: "x1", name: "copertina.jpg", parents: ["F"] }, // non e' un libro
      { id: "d1", name: "Doppio.epub", parents: ["X", "H"] }, // due genitori: basta uno
      { id: "g1", name: "Nel giro.epub", parents: ["G1"] },
      { name: "senza id.epub", parents: ["F"] },
    ];
    const r = libriSotto([{ id: "F", name: "Fumetti" }], file, tutte);
    t.eq("una cartella porta dentro i libri a qualunque profondita', non gli altri file", r.file.map((f) => f.id).join(","), "h1,f1,d1");
    t.eq("e nessuna cartella vuota", r.vuote.length, 0);
    const insieme = libriSotto([{ id: "F", name: "Fumetti" }, { id: "H", name: "Hellboy" }], file, tutte);
    t.eq("scelte una dentro l'altra, ogni libro una volta sola", insieme.file.map((f) => f.id).join(","), "h1,f1,d1");
    const solo = libriSotto([{ id: "H", name: "Hellboy" }, { id: "F", name: "Fumetti" }], file.filter((f) => f.id !== "f1"), tutte);
    t.eq("una cartella coi libri tutti in una sottocartella scelta non e' vuota", solo.vuote.length, 0);
    const vuota = libriSotto([{ id: "V", name: "Vuota" }, { id: "L", name: "Libri" }], file, tutte);
    t.eq("una cartella senza libri si dice per nome", vuota.vuote.join(","), "Vuota");
    t.eq("e l'altra porta i suoi", vuota.file.map((f) => f.id).join(","), "l1");
    t.eq("un giro chiuso fra cartelle si ferma", libriSotto([{ id: "Z", name: "Z" }], file, tutte).file.length, 0);
    t.eq("dentro un giro chiuso si trova lo stesso", libriSotto([{ id: "G2", name: "Giro bis" }], file, tutte).file.map((f) => f.id).join(","), "g1");
    t.eq("senza scelte, niente", libriSotto([], file, tutte).file.length, 0);
  }

  t.c("una chiave API di Google ha la forma «AIza…»", chiaveApiValida("AIzaSyD-abc_DEF1234567890abcdefghijklmnop"));
  t.c("e si ripulisce dagli spazi e dagli a capo che il tablet incolla", chiaveApiValida(" AIzaSyD-abc_DEF12345678\n90abcdefghijklmnop "));
  t.c("un ID client non e' una chiave API", !chiaveApiValida("1234-abc.apps.googleusercontent.com"));
  t.c("ne' una chiave corta", !chiaveApiValida("AIzaSyD"));
  t.c("ne' il vuoto", !chiaveApiValida("") && !chiaveApiValida(null));
  // una chiave incollata insieme alla riga attorno («key=AIza…;») non e' una
  // chiave: senza le ancore passerebbe, e Google la rifiuterebbe in silenzio
  t.c("ne' una chiave con altro attorno", !chiaveApiValida("key=AIzaSyD-abc_DEF1234567890abcdefghijklmnop;") && !chiaveApiValida("AIzaSyD-abc_DEF1234567890abcdefghijklmnop.json"));
  t.eq("la ripulitura toglie solo gli spazi", ripulisciChiaveApi(" AIza x\ty\n"), "AIzaxy");
  t.c("e la frase dice cosa fare", /AIza/.test(PERCHE_CHIAVE_STORTA) && /copiala/i.test(PERCHE_CHIAVE_STORTA));

  const cartelle = [
    { id: "L", name: "Libri", parents: ["R"] },
    { id: "R", name: "Book-Companion" },
    { id: "X", name: "Altro" },
  ];
  t.eq("il selettore parte dalla radice, cercata senza badare alle maiuscole", idRadice(cartelle), "R");
  t.eq("senza radice parte da tutto il Drive", idRadice([{ id: "X", name: "Altro" }]), null);
  t.eq("e senza cartelle pure", idRadice(null), null);
}

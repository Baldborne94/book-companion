// IL SELETTORE DI GOOGLE: quel che torna dalla finestra di Drive e come
// diventa una lista di file da aggiungere. Sbaglia in silenzio da tutt'e
// due i lati: un file toccato che non entra sparisce senza una riga, e un
// file che non e' un libro entrerebbe come scheda rotta.
import { vociDalPicker, chiaveApiValida, ripulisciChiaveApi, idRadice, PERCHE_CHIAVE_STORTA } from "../src/lib/driveCore.js";

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
  const { voci, scartati } = vociDalPicker(docs);
  t.eq("entrano i soli file che sono un libro, una volta ciascuno", voci.map((v) => v.id).join(","), "a,c,d,e");
  t.eq("la misura e' un numero, da `sizeBytes` o da `size`", voci.map((v) => v.size).join(","), "1234,5000,77,0");
  t.eq("il nome resta com'e' (l'estensione la legge chi importa)", voci[1].name, "Hellboy v03.CBZ");
  t.eq("quel che non entra si dice per nome", scartati.join(","), "note.txt,cartella");
  t.eq("senza documenti, niente", JSON.stringify(vociDalPicker(null)), JSON.stringify({ voci: [], scartati: [] }));

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

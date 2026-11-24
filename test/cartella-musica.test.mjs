// UNA CARTELLA DIVENTA UNA RACCOLTA. Chiesto dal lettore con la foto della
// cartella «Music» del tablet: cinque sottocartelle, una per atmosfera. Le
// regole: ogni sottocartella con della musica e' una raccolta col suo nome,
// i brani nell'ordine dei nomi coi numeri contati da numeri, le cartelle
// nascoste no, e rifarlo non fa doppioni.
import { pianoDaCartella, vociDellaCartella, tipoAudio, nomeMelodia } from "../src/lib/music.js";

const f = (name, size = 1000, type = "audio/mpeg") => ({ name, size, type });
const v = (percorso, file) => ({ percorso: percorso.split("/"), file: file || f(percorso.split("/").pop()) });

export default async function (t) {
  // ---- LA CARTELLA «Music» DEL LETTORE ------------------------------------
  const music = [
    v(".thumbnails/a.jpg", f("a.jpg", 10, "image/jpeg")),
    v(".Trash/vecchio.mp3"),
    v("WARHAMMER 40k/10 - Siege.mp3"),
    v("WARHAMMER 40k/2 - Cadia.mp3"),
    v("Horror playlist/Night.ogg", f("Night.ogg", 500, "")),
    v("Horror playlist/cover.jpg", f("cover.jpg", 50, "image/jpeg")),
    v("Atmosfera - Fantasy epica/Dischi/Tema.mp3"),
    v("sciolto.mp3"),
  ];
  const piano = pianoDaCartella("Music", music);
  t.eq(
    "una raccolta per sottocartella, e i brani sciolti col nome della cartella scelta",
    piano.map((p) => p.nome).join("|"),
    "Atmosfera - Fantasy epica|Horror playlist|Music|WARHAMMER 40k"
  );
  const w40k = piano.find((p) => p.nome === "WARHAMMER 40k");
  t.eq("i brani nell'ordine dei nomi, coi numeri contati da numeri", w40k.nuovi.map((x) => x.name).join("|"), "2 - Cadia.mp3|10 - Siege.mp3");
  t.eq("un file senza tipo e' musica se l'estensione lo dice, un'immagine no", piano.find((p) => p.nome === "Horror playlist").nuovi.map((x) => x.name).join("|"), "Night.ogg");
  t.c("le cartelle nascoste non si guardano, nemmeno con della musica dentro", !piano.some((p) => p.nome.startsWith(".")));
  t.eq("una cartella dentro una sottocartella resta della sottocartella", piano.find((p) => p.nome === "Atmosfera - Fantasy epica").nuovi.length, 1);

  const sola = pianoDaCartella("WARHAMMER 40k", [v("a.mp3"), v("b.mp3")]);
  t.eq("scelta una cartella sola, e' una raccolta col suo nome", sola.map((p) => `${p.nome}:${p.nuovi.length}`).join(), "WARHAMMER 40k:2");

  // ---- RIFARLO NON FA DOPPIONI ---------------------------------------------
  const favs = [
    { id: "m1", name: "2 - Cadia", size: 1000, trackId: "t1" },
    { id: "m2", name: "10 - Siege", size: 999, trackId: "t2" },
    { id: "m3", name: "Night", size: 500, trackId: "t3", deleted: true },
  ];
  const raccolte = [{ id: "r1", name: "warhammer 40K ", brani: ["m1"] }, { id: "r2", name: "Horror playlist", brani: [], deleted: true }];
  const di_nuovo = pianoDaCartella("Music", music, { raccolte, favs });
  const w = di_nuovo.find((p) => p.nome === "WARHAMMER 40k");
  t.eq("la raccolta col nome che c'e' gia' si riempie, non si rifa'", w.id, "r1");
  t.eq("un brano gia' custodito e gia' dentro non si tocca", w.rimessi.length, 0);
  t.eq("uno con lo stesso nome ma un altro peso e' un altro file", w.nuovi.map((x) => x.name).join(), "10 - Siege.mp3");
  const horror = di_nuovo.find((p) => p.nome === "Horror playlist");
  t.c("una raccolta tolta non si riempie, se ne fa una nuova", horror.id === null);
  t.eq("e un brano tolto si custodisce di nuovo", horror.nuovi.length, 1);
  const altrove = pianoDaCartella("X", [v("2 - Cadia.mp3")], { raccolte: [{ id: "r9", name: "X", brani: [] }], favs });
  t.c("un brano custodito altrove si rimette nella raccolta senza ricaricarlo", altrove[0].rimessi.join() === "m1" && !altrove[0].nuovi.length);
  const misti = pianoDaCartella("X", [v("3 - c.mp3"), v("2 - Cadia.mp3"), v("1 - a.mp3")], { favs });
  t.eq("e nella raccolta sta al suo posto fra i nuovi", misti[0].sequenza.map((x) => x.id || x.file.name).join("|"), "1 - a.mp3|m1|3 - c.mp3");

  // ---- IL TIPO E IL NOME ---------------------------------------------------
  t.eq("il tipo dal file, se c'e'", tipoAudio(f("x.bin", 1, "audio/ogg")), "audio/ogg");
  t.eq("se no dall'estensione", tipoAudio(f("Battle.FLAC", 1, "")), "audio/flac");
  t.eq("e niente per quel che non e' musica", tipoAudio(f("note.txt", 1, "")), "");
  t.eq("il tipo generico di chi non sa vale come nessun tipo", tipoAudio(f("Battle.mp3", 1, "application/octet-stream")), "audio/mpeg");
  t.eq("ma un tipo vero che non e' audio resta un no", tipoAudio(f("audio.mp3", 1, "text/plain")), "");
  t.eq("il nome della melodia senza estensione", nomeMelodia("2 - Cadia.mp3"), "2 - Cadia");

  // ---- LA CARTELLA SCELTA COL SELETTORE ------------------------------------
  const dir = (voci) => ({
    kind: "directory",
    async *entries() {
      for (const [nome, x] of Object.entries(voci)) yield [nome, x.kind ? x : { kind: "file", getFile: async () => f(nome) }];
    },
  });
  const scelta = dir({ "WARHAMMER 40k": dir({ "a.mp3": 1, "Atti": dir({ "b.mp3": 1 }) }), ".thumbnails": dir({ "c.jpg": 1 }), "d.mp3": 1 });
  const lette = await vociDellaCartella(scelta);
  t.eq("si leggono le sottocartelle col loro percorso, le nascoste no", lette.map((x) => x.percorso.join("/")).sort().join("|"), "WARHAMMER 40k/Atti/b.mp3|WARHAMMER 40k/a.mp3|d.mp3");
}

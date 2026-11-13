// LA SOVRACCOPERTA APERTA (`fronteDellaSovraccoperta`, `versoDelLibro`),
// segnalato dal lettore con lo scaffale di Kingdom: dal volume 10 in poi la
// prima pagina e' la sovraccoperta giapponese intera, 800×543, e sullo
// scaffale si vedevano il dorso e il codice a barre. Le schede sono le sue:
// manga e' segnato il primo volume e basta, gli altri lo sono per eredita'.
import { fronteDellaSovraccoperta } from "../src/lib/copertina.js";
import { versoDelLibro } from "../src/lib/library.js";
import { caricaCopertina, copertinaCambiata, RITAGLIATA } from "../src/lib/miniature.js";
import { copertinaGrande, dimenticaGrande } from "../src/lib/copertinaGrande.js";

export default async (t) => {
  // ---- IL FRONTE ---------------------------------------------------------------
  const k10 = fronteDellaSovraccoperta(800, 543, "rtl");
  t.eq("in un manga il fronte sta a sinistra, largo quanto un volume", `${k10?.x}|${k10?.w}`, "0|348");
  const occ = fronteDellaSovraccoperta(800, 543, "ltr");
  t.eq("in un fumetto occidentale a destra", `${occ?.x}|${occ?.w}`, "452|348");
  t.eq("una copertina in piedi resta com'e'", fronteDellaSovraccoperta(543, 800, "rtl"), null);
  t.eq("una tavola appena piu' larga che alta pure", fronteDellaSovraccoperta(600, 543, "rtl"), null);
  t.eq("senza misure niente", fronteDellaSovraccoperta(0, 543, "rtl"), null);

  // ---- IL VERSO, COL TIPO EREDITATO DALLA SAGA --------------------------------------
  const scaffale = [
    { id: "k1", title: "Kingdom v01", saga: "Kingdom", sagaOrder: 1, fileType: "cbz", tipo: "manga" },
    { id: "k10", title: "Kingdom v10", saga: "Kingdom", sagaOrder: 10, fileType: "cbz" },
    { id: "k11", title: "Kingdom v11", saga: "Kingdom", sagaOrder: 11, fileType: "cbr", tipo: "fumetti" },
    { id: "s1", title: "Spawn v01", saga: "Spawn", fileType: "cbz" },
    { id: "e1", title: "The Way of Kings", saga: "Stormlight", fileType: "epub" },
  ];
  const v = (id) => versoDelLibro(scaffale.find((b) => b.id === id), scaffale);
  t.eq("Kingdom v10 e' un manga perche' lo e' la sua saga: da destra", v("k10"), "rtl");
  t.eq("…un «fumetti» scelto a mano resta una scelta", v("k11"), "ltr");
  t.eq("Spawn si legge da sinistra", v("s1"), "ltr");
  t.eq("un ePub non ha verso: la sua copertina e' com'e'", v("e1"), null);
  t.eq("il verso scritto nel libro vince", versoDelLibro({ id: "s2", saga: "Spawn", fileType: "cbz", verso: "rtl" }, scaffale), "rtl");
  t.eq("…anche da sinistra in una saga di manga", versoDelLibro({ id: "k13", saga: "Kingdom", fileType: "cbz", verso: "ltr" }, scaffale), "ltr");
  t.eq("un volume non ancora sullo scaffale si conta con la sua saga", versoDelLibro({ id: "k12", saga: "Kingdom", fileType: "cbz" }, scaffale), "rtl");

  // la biblioteca di casa, letta da sola e riletta quando cambia
  const prima = globalThis.localStorage;
  const mem = new Map([["bc_books", JSON.stringify(scaffale)]]);
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, x) => mem.set(k, String(x)), removeItem: (k) => mem.delete(k) };
  try {
    t.eq("dalla biblioteca di casa", versoDelLibro({ id: "k10", saga: "Kingdom", fileType: "cbz" }), "rtl");
    mem.set("bc_books", JSON.stringify(scaffale.filter((b) => b.id !== "k1")));
    t.eq("…e riletta quando cambia (tolto il manga, Kingdom e' un fumetto)", versoDelLibro({ id: "k10", saga: "Kingdom", fileType: "cbz" }), "ltr");
  } finally {
    if (prima === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prima;
  }

  // ---- LA MINIATURA DEL FRONTE SI TIENE ---------------------------------------------
  // la copertina salvata era gia' piccola: il fronte ricodificato pesa di piu',
  // ma l'intera mostrerebbe il retro
  const intera = { size: 100, nome: "intera" };
  const fronte = { size: 120, nome: "fronte", [RITAGLIATA]: true };
  copertinaCambiata("kmin");
  const url = await caricaCopertina("kmin", {
    leggiCover: async () => intera,
    leggiMin: async () => null,
    scriviMin: async () => {},
    riduci: async () => fronte,
    creaUrl: (b) => `url:${b.nome}`,
    revoca: () => {},
  });
  t.eq("la miniatura e' il fronte, anche se pesa di piu'", url, "url:fronte");
  copertinaCambiata("kmin2");
  const url2 = await caricaCopertina("kmin2", {
    leggiCover: async () => intera,
    leggiMin: async () => null,
    scriviMin: async () => {},
    riduci: async () => ({ size: 120, nome: "ridotta" }),
    creaUrl: (b) => `url:${b.nome}`,
    revoca: () => {},
  });
  t.eq("…una miniatura qualunque piu' pesante resta l'intera, come prima", url2, "url:intera");

  // ---- LA COPERTINA GRANDE (schermata di blocco, salvaschermo) ----------------------
  const visti = [];
  const ritaglia = async (b, verso, max) => (visti.push(`${b}|${verso}|${max}`), `fronte di ${b}`);
  dimenticaGrande();
  const dal = await copertinaGrande({ id: "g1" }, { leggiFile: async () => "byte", estrai: async () => "dal file", leggiCover: async () => "salvata", max: 2400, mano: () => false, verso: "rtl", ritaglia });
  t.eq("dal file, col fronte", dal, "fronte di dal file");
  const salvata = await copertinaGrande({ id: "g2" }, { leggiFile: async () => null, leggiCover: async () => "salvata", max: 2400, mano: () => false, verso: "rtl", ritaglia });
  t.eq("…e anche quella salvata, se il file non c'e'", salvata, "fronte di salvata");
  t.eq("col verso e la misura dello schermo", visti.join(), "dal file|rtl|2400,salvata|rtl|2400");
  const libro = await copertinaGrande({ id: "g3" }, { leggiFile: async () => null, leggiCover: async () => "salvata", mano: () => false, ritaglia });
  t.eq("senza verso (un ePub) niente si ritaglia", libro, "salvata");
  const scelta = await copertinaGrande({ id: "g4" }, { leggiFile: async () => "byte", estrai: async () => "dal file", leggiCover: async () => "foto", mano: () => true, verso: "rtl", ritaglia });
  t.eq("una copertina messa a mano resta quella", scelta, "foto");
  dimenticaGrande();
};

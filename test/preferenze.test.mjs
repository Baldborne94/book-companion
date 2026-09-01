// I DEFAULT DEL DISPOSITIVO STANNO SOTTO, MAI SOPRA.
//
// È la lezione 9 di `CLAUDE.md`, scritta a lettere chiare e difesa da
// niente. In codice è una riga sola:
//
//     const fuse = { ...defaults, ...saved };
//
// Scambia i due e ogni impostazione di lettura — corpo, interlinea,
// margine, tema, come volta la pagina — viene silenziosamente riscritta dai
// default del dispositivo a OGNI apertura del libro. Non fallisce niente,
// non si accende niente: semplicemente la sera dopo il libro si riapre come
// appena installato, e chi legge pensa di aver sbagliato lui a salvare.
//
// La funzione tocca solo `localStorage`, quindi si prova con una memoria
// finta e senza browser.
function memoriaFinta() {
  const dati = new Map();
  globalThis.localStorage = {
    getItem: (k) => (dati.has(k) ? dati.get(k) : null),
    setItem: (k, v) => dati.set(k, String(v)),
    removeItem: (k) => dati.delete(k),
  };
  return dati;
}
const dati = memoriaFinta();

const { loadReaderSettings, saveReaderSettings, deviceDefaults, modoSvolta, READER_FONTS, HL_COLORS } =
  await import("../src/lib/readerSettings.js");

// il lato corto dello schermo: sotto 520 il tablet non affianca le pagine
const TELEFONO = 390;
const TABLET = 800;

export default async function (t) {
  // ---- LA REGOLA, nel modo in cui si rompe -----------------------------
  //
  // Non si controlla che «la fusione funzioni»: si controlla che a vincere
  // sia il LETTORE. Ogni valore qui è scelto DIVERSO dal default, o il
  // controllo passerebbe anche a spread invertiti — che è la mutazione da
  // cui questo file esiste.
  dati.clear();
  const mie = {
    fontSize: 130,
    lineHeight: 1.9,
    margin: 40,
    theme: "sepia",
    font: "serif",
    justify: false,
    paragrafi: "stacco",
    terms: false,
    ritaglia: false,
    warmth: 3,
    brightness: 0.7,
  };
  localStorage.setItem("bc_reader", JSON.stringify(mie));
  const s = loadReaderSettings(TABLET);
  const d = deviceDefaults(TABLET);
  for (const [k, v] of Object.entries(mie)) {
    t.eq(`«${k}» resta quello scelto dal lettore`, s[k], v);
    // e il controllo vale qualcosa solo se il default era un altro
    t.c(`e il default di «${k}» era diverso`, d[k] !== v, `default ${JSON.stringify(d[k])}`);
  }

  // ---- quello che NON hai scelto viene dal dispositivo ------------------
  // La fusione serve anche al verso opposto: una preferenza salvata da una
  // versione vecchia dell'app non conosce le voci nate dopo, e quelle
  // devono arrivare intere dai default — non `undefined` dentro uno stile.
  dati.clear();
  localStorage.setItem("bc_reader", JSON.stringify({ fontSize: 120 }));
  const parziale = loadReaderSettings(TABLET);
  t.eq("la voce salvata comanda", parziale.fontSize, 120);
  for (const k of Object.keys(deviceDefaults(TABLET))) {
    t.c(`«${k}» non resta scoperta`, parziale[k] !== undefined, k);
  }

  // ---- il dispositivo decide dove il lettore non ha detto niente --------
  dati.clear();
  t.eq("su un telefono non si affiancano le pagine", loadReaderSettings(TELEFONO).spread, "none");
  t.eq("su un tablet sì", loadReaderSettings(TABLET).spread, "auto");
  // ma se il lettore ha scelto, lo schermo non lo smentisce
  localStorage.setItem("bc_reader", JSON.stringify({ spread: "auto" }));
  t.eq("e una scelta esplicita vale anche sul telefono", loadReaderSettings(TELEFONO).spread, "auto");

  // ---- LA MEMORIA ROTTA NON DEVE PORTARSI VIA IL LIBRO -----------------
  // Un `bc_reader` illeggibile (storage corrotto, scrittura interrotta) non
  // può far esplodere l'apertura: si riparte dai default, che è la cosa
  // peggiore che possa succedere e va benissimo.
  dati.clear();
  localStorage.setItem("bc_reader", "{non è json");
  const rotta = loadReaderSettings(TABLET);
  t.eq("una preferenza illeggibile ripiega sui default", rotta.fontSize, deviceDefaults(TABLET).fontSize);
  t.c("e torna un oggetto intero", Object.keys(rotta).length === Object.keys(deviceDefaults(TABLET)).length);

  // ---- COME VOLTA LA PAGINA: tre modi, non due -------------------------
  // `svolta` passa sempre per `modoSvolta`, anche quando arriva dal
  // salvataggio: nello storage di chi usa l'app da mesi c'è un `false`
  // (quando i modi erano due) e c'è chi ha scritto un valore che non
  // esiste più. Un valore fuori elenco finito dentro il reader non dà un
  // errore: dà una voltata che non succede.
  dati.clear();
  localStorage.setItem("bc_reader", JSON.stringify({ svolta: false }));
  t.eq("il vecchio «false» diventa «nessuna»", loadReaderSettings(TABLET).svolta, "nessuna");
  localStorage.setItem("bc_reader", JSON.stringify({ svolta: "spazzata" }));
  t.eq("una scelta vera resta", loadReaderSettings(TABLET).svolta, "spazzata");
  localStorage.setItem("bc_reader", JSON.stringify({ svolta: "carriola" }));
  t.eq("un modo che non esiste ripiega", loadReaderSettings(TABLET).svolta, modoSvolta("carriola"));
  t.c("e il ripiego è uno dei modi veri", ["nessuna", "dissolvenza", "spazzata"].includes(loadReaderSettings(TABLET).svolta));

  // ---- e quel che si salva si rilegge ----------------------------------
  dati.clear();
  saveReaderSettings({ ...deviceDefaults(TABLET), fontSize: 145, margin: 12 });
  const riletto = loadReaderSettings(TABLET);
  t.eq("il corpo salvato si rilegge", riletto.fontSize, 145);
  t.eq("e il margine pure", riletto.margin, 12);

  // ---- i due elenchi che l'interfaccia offre ---------------------------
  // Se si svuotassero, i pannelli del reader resterebbero senza scelte e
  // nessun errore lo direbbe.
  t.c("i font offerti ci sono", Array.isArray(READER_FONTS) && READER_FONTS.length > 1);
  t.c("e i colori delle evidenziazioni pure", Array.isArray(HL_COLORS) && HL_COLORS.length > 1);
}

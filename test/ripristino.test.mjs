// SI SBIRCIA PRIMA DI APRIRE. L'archivio era un blocco unico: chi voleva
// solo i libri si portava in casa anche le melodie. Qui si prova che
// `sbircia` sa dire cosa c'e' dentro senza estrarre un byte, e che le due
// meta' si prendono davvero una per volta.
//
// Niente IndexedDB: gli archivi di prova non portano i byte dei libri,
// quindi `restoreLibrary` non scrive mai nello store — e `listFileIds`
// fallisce da sola in un `catch` che c'era gia'. Il localStorage invece si
// finge qui, che sono sei righe.

// Le chiavi devono essere ENUMERABILI come nel browser: i glossari si
// raccolgono con `Object.keys(localStorage)`, e un finto localStorage che
// tenesse i valori altrove li farebbe sparire senza far fallire niente.
const memoria = {};
for (const [nome, fn] of Object.entries({
  getItem: (k) => (k in memoria ? memoria[k] : null),
  setItem: (k, v) => {
    memoria[k] = String(v);
  },
  removeItem: (k) => {
    delete memoria[k];
  },
})) {
  Object.defineProperty(memoria, nome, { value: fn, enumerable: false });
}
globalThis.localStorage = memoria;
const quante = () => Object.keys(memoria).length;

const { default: JSZip } = await import("jszip");
const { sbircia, restoreLibrary, planMelodie } = await import("../src/lib/restoreLibrary.js");
const { loadBooks } = await import("../src/lib/library.js");
const { getFavoritesRaw, getListsRaw } = await import("../src/lib/music.js");

// Un archivio come quelli veri, meno i byte: i libri non portano il loro
// file (`findFile` non trova niente e non scrive), le melodie sono
// collegamenti a YouTube. Una traccia da file c'e' lo stesso, con i suoi
// byte nello zip: serve a provare che con le melodie non spuntate quei
// byte non vengono nemmeno guardati.
async function archivio({
  version = 3,
  libri = 2,
  melodie = 2,
  raccolte = 1,
  conTrack = false,
  glossari = null,
} = {}) {
  const zip = new JSZip();
  const data = {
    app: "book-companion",
    version,
    books: Array.from({ length: libri }, (_, i) => ({
      id: `libro-${i}`,
      title: `Tomo ${i}`,
      progress: 0.5,
      status: "reading",
      cfi: `epubcfi(/6/${i})`,
      marks: [{ cfi: "x", label: "un segno" }],
    })),
    melodie: Array.from({ length: melodie }, (_, i) => ({
      id: `mel-${i}`,
      name: `Melodia ${i}`,
      url: "https://www.youtube.com/watch?v=abc",
    })),
    raccolte: Array.from({ length: raccolte }, (_, i) => ({
      id: `rac-${i}`,
      name: `Raccolta ${i}`,
      brani: ["mel-0"],
    })),
  };
  if (glossari) data.glossari = glossari;
  if (conTrack) {
    data.melodie.push({ id: "mel-file", name: "Da file", trackId: "tr-1", track: "melodie/tr-1" });
    zip.file("melodie/tr-1", "finti byte audio");
  }
  zip.file("biblioteca.json", JSON.stringify(data));
  return zip.generateAsync({ type: "nodebuffer" });
}

const pulisci = () => {
  for (const k of Object.keys(memoria)) delete memoria[k];
};
const errore = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e?.message || "";
  }
};

export default async function (t) {
  // ---- sbirciare: dire cosa c'e' dentro, senza toccare niente ------------
  pulisci();
  const dentro = await sbircia(await archivio({ libri: 14, melodie: 23, raccolte: 3 }));
  t.eq("quanti libri", dentro.libri, 14);
  t.eq("quante melodie", dentro.melodie, 23);
  t.eq("quante raccolte", dentro.raccolte, 3);
  t.eq("un archivio recente non e' parziale", dentro.parziale, false);
  // sbirciare non e' ripristinare: nulla dev'essere finito in casa
  t.eq("sbirciare non scrive niente", quante(), 0);

  const vecchio = await sbircia(await archivio({ version: 1 }));
  t.eq("l'archivio v1 si dichiara parziale", vecchio.parziale, true);

  const senzaMusica = await sbircia(await archivio({ melodie: 0, raccolte: 0 }));
  t.eq("nessuna melodia, non `undefined`", senzaMusica.melodie, 0);
  t.eq("nessuna raccolta, non `undefined`", senzaMusica.raccolte, 0);

  // ---- un file che non e' un archivio nostro -----------------------------
  const zipEstraneo = new JSZip();
  zipEstraneo.file("qualcosa.txt", "ciao");
  t.c(
    "uno zip qualunque si rifiuta",
    /archivio di Book Companion/.test(
      await errore(() => sbircia(zipEstraneo.generateAsync({ type: "nodebuffer" })))
    )
  );
  const zipRotto = new JSZip();
  zipRotto.file("biblioteca.json", "{ non e' json");
  t.c(
    "un indice illeggibile si dice",
    /illeggibile/.test(await errore(() => sbircia(zipRotto.generateAsync({ type: "nodebuffer" }))))
  );

  // ---- senza scegliere niente, entra tutto (com'era prima) ---------------
  pulisci();
  const tutto = await restoreLibrary(await archivio());
  t.eq("i libri entrano", tutto.added, 2);
  t.eq("le raccolte entrano", tutto.raccolte, 1);
  t.eq("i libri sono in libreria", loadBooks().length, 2);
  t.eq("le melodie sono nei preferiti", getFavoritesRaw().length, 2);
  t.eq("e le raccolte nel loro elenco", getListsRaw().length, 1);
  // quello che viaggia col libro
  t.eq("col punto di lettura", localStorage.getItem("bc_cfi_libro-0"), "epubcfi(/6/0)");
  t.eq("e coi segnalibri", JSON.parse(localStorage.getItem("bc_marks_libro-0")).length, 1);

  // ---- solo i libri ------------------------------------------------------
  pulisci();
  const soloLibri = await restoreLibrary(await archivio(), {
    cosa: { libri: true, melodie: false },
  });
  t.eq("i libri entrano", soloLibri.added, 2);
  t.eq("le melodie no", getFavoritesRaw().length, 0);
  // LE RACCOLTE SEGUONO LE MELODIE: sono elenchi di id di brani, e senza i
  // brani resterebbero raccolte vuote in mezzo alla sala della musica
  t.eq("e nemmeno le raccolte", getListsRaw().length, 0);
  t.eq("il conto lo conferma", soloLibri.raccolte, 0);
  t.eq("nessun byte di melodia toccato", soloLibri.melodie, 0);

  // ---- solo la musica ----------------------------------------------------
  pulisci();
  const soloMusica = await restoreLibrary(await archivio(), {
    cosa: { libri: false, melodie: true },
  });
  t.eq("nessun libro", soloMusica.added, 0);
  t.eq("la libreria resta vuota", loadBooks().length, 0);
  t.eq("nemmeno un punto di lettura", localStorage.getItem("bc_cfi_libro-0"), null);
  t.eq("le melodie invece entrano", getFavoritesRaw().length, 2);
  t.eq("e le raccolte con loro", getListsRaw().length, 1);

  // ---- niente spuntato: un giro a vuoto, non un mezzo ripristino ---------
  pulisci();
  const niente = await restoreLibrary(await archivio(), {
    cosa: { libri: false, melodie: false },
  });
  t.eq("nessun libro", niente.added, 0);
  t.eq("nessuna raccolta", niente.raccolte, 0);
  t.eq("e la casa resta com'era", quante(), 0);

  // ---- quello che c'e' gia' resta com'e' ---------------------------------
  // due giri di fila non devono raddoppiare niente: e' la regola di sempre
  // del ripristino, e le meta' separate non la cambiano
  pulisci();
  await restoreLibrary(await archivio());
  const secondo = await restoreLibrary(await archivio());
  t.eq("il secondo giro non aggiunge libri", secondo.added, 0);
  t.eq("li dichiara gia' in casa", secondo.kept, 2);
  t.eq("i libri restano due", loadBooks().length, 2);
  t.eq("le melodie restano due", getFavoritesRaw().length, 2);
  t.eq("le raccolte restano una", getListsRaw().length, 1);

  // ---- e la spartizione di sempre ----------------------------------------
  t.eq(
    "una melodia gia' nota non torna dentro",
    planMelodie([{ id: "a" }, { id: "b" }], [{ id: "a" }]).length,
    1
  );
  t.eq("una voce senza id non e' una melodia", planMelodie([{ name: "x" }], []).length, 0);

  // ---- I TERMINI DEL GLOSSARIO SEGUONO I LIBRI --------------------------
  // sono voci di glossario di una saga, non musica: un archivio che li
  // lasciasse fuori sarebbe una trappola, e te ne accorgeresti il giorno
  // che ripristini
  const GLOSS = { "saga:malazan": [{ t: "Warren", d: "i sentieri magici", addedAt: 1 }] };
  pulisci();
  const conGloss = await restoreLibrary(await archivio({ glossari: GLOSS }));
  t.eq("il termine entra", conGloss.termini, 1);
  t.c(
    "e si trova dove deve stare",
    /Warren/.test(localStorage.getItem("bc_gloss_saga:malazan") || "")
  );
  t.eq("sbirciando si contano prima", (await sbircia(await archivio({ glossari: GLOSS }))).termini, 1);

  pulisci();
  const senzaLibri = await restoreLibrary(await archivio({ glossari: GLOSS }), {
    cosa: { libri: false, melodie: true },
  });
  t.eq("senza i libri restano fuori", senzaLibri.termini, 0);
  t.eq("e non c'e' nessun glossario in casa", localStorage.getItem("bc_gloss_saga:malazan"), null);

  // il secondo giro non raddoppia, e non riscrive quello che hai corretto
  pulisci();
  await restoreLibrary(await archivio({ glossari: GLOSS }));
  const dueVolte = await restoreLibrary(await archivio({ glossari: GLOSS }));
  t.eq("il secondo giro non aggiunge termini", dueVolte.termini, 0);

  // un archivio vecchio, senza glossari, non deve esplodere
  pulisci();
  t.eq("nessun glossario, nessun termine", (await restoreLibrary(await archivio())).termini, 0);

  // ---- e i byte non si guardano nemmeno ----------------------------------
  // Con le melodie non spuntate, la traccia da file dev'essere saltata
  // PRIMA di estrarla: qui non c'e' nessuno store dove metterla, quindi se
  // il cancello si aprisse questo giro esploderebbe. Sta in fondo apposta.
  pulisci();
  const conByte = await restoreLibrary(await archivio({ conTrack: true }), {
    cosa: { libri: true, melodie: false },
  });
  t.eq("i libri entrano lo stesso", conByte.added, 2);
  t.eq("e la traccia da file resta nell'archivio", getFavoritesRaw().length, 0);

  pulisci();
}

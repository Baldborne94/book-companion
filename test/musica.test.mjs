// LA MUSICA ERA IL MODULO INTERO SENZA UNA GUARDIA (3 export su 21), e
// quel che fa sbaglia tutto in silenzio: un link letto male si salva e non
// suona mai, una raccolta che perde l'ordine non alza un errore, un timbro
// di sincronizzazione dimenticato fa sparire i preferiti al primo giro fra
// due dispositivi, e un volume lasciato a zero e' un'app muta che sembra
// rotta.
//
// Resta fuori solo quel che vuole IndexedDB davvero — `loadTrack`,
// `dropTrack` e la meta' buona di `addTrackFile` (quella che scrive i byte
// e ricava il nome dal file): lo store si importa staticamente e non si
// passa da fuori come `leggiByte`, quindi da qui non c'e' niente da
// iniettare. Chi un giorno lo inietta scriva anche quei controlli.
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

const M = await import("../src/lib/music.js");

const pulisci = () => {
  for (const k of Object.keys(memoria)) delete memoria[k];
};
const yt = (s) => JSON.stringify(M.parseYouTube(s));

export default async function (t) {
  // ---- IL LINK DI YOUTUBE ---------------------------------------------------
  // le tre forme che il lettore incolla davvero
  t.eq("la pagina di un video", yt("https://www.youtube.com/watch?v=abc123XYZ_-"), '{"kind":"video","video":"abc123XYZ_-"}');
  t.eq("il link corto", yt("https://youtu.be/abc123XYZ_-"), '{"kind":"video","video":"abc123XYZ_-"}');
  t.eq("e il link corto con l'istante", yt("https://youtu.be/abc123XYZ_-?t=42"), '{"kind":"video","video":"abc123XYZ_-"}');
  t.eq("l'incorporato", yt("https://www.youtube.com/embed/abc123XYZ_-"), '{"kind":"video","video":"abc123XYZ_-"}');
  t.eq("uno short", yt("https://www.youtube.com/shorts/abc123XYZ_-"), '{"kind":"video","video":"abc123XYZ_-"}');
  t.eq("una diretta", yt("https://www.youtube.com/live/abc123XYZ_-"), '{"kind":"video","video":"abc123XYZ_-"}');
  t.eq("gli spazi attorno non contano", yt("  https://youtu.be/abc123XYZ_-  "), '{"kind":"video","video":"abc123XYZ_-"}');

  // UNA RACCOLTA VINCE SUL VIDEO, e si tiene il video da cui partire: chi
  // incolla il link di un brano DENTRO una playlist vuole la playlist —
  // sono ore di musica da lettura, ed e' il caso per cui esiste `kind`
  t.eq("la raccolta", yt("https://www.youtube.com/playlist?list=PL123"), '{"kind":"playlist","list":"PL123","video":null}');
  t.eq(
    "e il brano dentro una raccolta resta il punto di partenza",
    yt("https://www.youtube.com/watch?v=abc123XYZ_-&list=PL123"),
    '{"kind":"playlist","list":"PL123","video":"abc123XYZ_-"}'
  );

  // IL DOMINIO SI CONTROLLA FINO IN FONDO. E' la guardia che sbaglia in
  // silenzio nel modo peggiore: un indirizzo che CONTIENE «youtube.com»
  // ma non e' YouTube finirebbe in un iframe della sala della musica.
  t.eq("un dominio che ci somiglia non passa", yt("https://notyoutube.com/watch?v=abc123XYZ_-"), "null");
  t.eq("e nemmeno col nome davanti", yt("https://evil-youtube.com/watch?v=abc123XYZ_-"), "null");
  t.eq("ne' col nome nel mezzo", yt("https://youtube.com.altrove.net/watch?v=abc123XYZ_-"), "null");
  // i sottodomini veri invece SI': l'app di YouTube da' `m.`, la musica
  // `music.`, e il nostro stesso iframe `youtube-nocookie.com`
  t.eq("il sottodominio del telefono", yt("https://m.youtube.com/watch?v=abc123XYZ_-"), '{"kind":"video","video":"abc123XYZ_-"}');
  t.eq("quello della musica", yt("https://music.youtube.com/watch?v=abc123XYZ_-"), '{"kind":"video","video":"abc123XYZ_-"}');
  t.eq("e il dominio senza cookie", yt("https://www.youtube-nocookie.com/embed/abc123XYZ_-"), '{"kind":"video","video":"abc123XYZ_-"}');

  // quel che non e' un link, o e' un link senza niente da suonare
  t.eq("una frase non e' un indirizzo", yt("ciao come stai"), "null");
  t.eq("niente non e' un indirizzo", yt(""), "null");
  t.eq("e nemmeno il nulla", JSON.stringify(M.parseYouTube(undefined)), "null");
  t.eq("YouTube senza video ne' raccolta", yt("https://www.youtube.com/feed/subscriptions"), "null");

  // ---- L'INDIRIZZO DA INCORPORARE -------------------------------------------
  // SEMPRE `youtube-nocookie`, ed e' una promessa scritta nella privacy:
  // e' la modalita' che non piazza cookie di profilazione prima del play
  const emb = (s) => M.embedUrl(M.parseYouTube(s));
  t.c("il video passa dal dominio senza cookie", emb("https://youtu.be/abc123XYZ_-").startsWith("https://www.youtube-nocookie.com/embed/abc123XYZ_-?"));
  t.c("e la raccolta pure", emb("https://www.youtube.com/playlist?list=PL123").startsWith("https://www.youtube-nocookie.com/embed/videoseries?list=PL123"));
  // una raccolta senza video parte da `videoseries`, che e' il modo di
  // YouTube di dire «la playlist dall'inizio»
  t.c("raccolta nuda → videoseries", emb("https://www.youtube.com/playlist?list=PL123").includes("/embed/videoseries?"));
  t.c(
    "raccolta col brano → parte da quel brano",
    emb("https://www.youtube.com/watch?v=abc123XYZ_-&list=PL123").includes("/embed/abc123XYZ_-?list=PL123")
  );
  // `enablejsapi` e' quel che ci lascia comandare pausa e volume da fuori:
  // senza, il lettore non risponde piu' a niente
  for (const p of ["autoplay=1", "enablejsapi=1", "rel=0"]) {
    t.c(`l'indirizzo porta ${p}`, emb("https://youtu.be/abc123XYZ_-").includes(p));
  }

  // ---- LE MELODIE DI UNA RACCOLTA -------------------------------------------
  // Una raccolta tiene ID, mai le melodie: l'ordine e' quello in cui le hai
  // messe, e un id sparito si salta invece di lasciare un buco.
  {
    const favs = [
      { id: "b", name: "Seconda" },
      { id: "a", name: "Prima" },
      { id: "morta", name: "Cancellata", deleted: 900 },
    ];
    const nomi = (r) => M.braniDi(r, favs).map((f) => f.name).join(",");
    t.eq("l'ordine e' quello della raccolta, non dell'elenco", nomi({ brani: ["a", "b"] }), "Prima,Seconda");
    t.eq("un id che non esiste piu' si salta", nomi({ brani: ["a", "sparita", "b"] }), "Prima,Seconda");
    // LA LAPIDE NON SUONA: una melodia cancellata resta nell'elenco grezzo
    // per propagare la cancellazione fra dispositivi, ma in una raccolta
    // sarebbe un brano che riappare da solo
    t.eq("e una cancellata non torna a suonare", nomi({ brani: ["a", "morta"] }), "Prima");
    t.eq("una raccolta vuota", M.braniDi({ brani: [] }, favs).length, 0);
    t.eq("e una raccolta che non c'e'", M.braniDi(null, favs).length, 0);
    t.eq("senza l'elenco dei brani", M.braniDi({}, favs).length, 0);
  }

  // ---- QUANTO MANCA ALLO SPEGNIMENTO ----------------------------------------
  // Sta accanto ai comandi del player, dove lo spazio e' quello che e'.
  t.eq("senza timer non si scrive niente", M.restaDa(null), null);
  t.eq("e nemmeno senza valore", M.restaDa(undefined), null);
  t.eq("sotto il minuto si contano i secondi", M.restaDa(42_000), "42 s");
  // si arrotonda per ECCESSO: un conto alla rovescia che mostra «0 s»
  // mentre la musica suona ancora sembra rotto
  t.eq("un soffio e' un secondo, non zero", M.restaDa(1), "1 s");
  t.eq("il minuto esatto", M.restaDa(60_000), "1 min");
  t.eq("e un secondo in piu' e' gia' due minuti", M.restaDa(61_000), "2 min");
  t.eq("l'ora esatta", M.restaDa(3_600_000), "1 h");
  t.eq("l'ora coi minuti", M.restaDa(3_660_000), "1 h 1");
  // un timer gia' scaduto non scrive un numero negativo
  t.eq("scaduto vale zero", M.restaDa(-5_000), "0 s");

  // ---- IL VOLUME ------------------------------------------------------------
  pulisci();
  // MAI SCRITTO VALE UNO, e non zero: chi aggiorna l'app non deve trovarsi
  // la musica muta senza aver toccato niente
  t.eq("mai scelto → tutto volume", M.getVolume(), 1);
  M.saveVolume(0.4);
  t.eq("scelto → si rilegge", M.getVolume(), 0.4);
  // LO ZERO E' UNA SCELTA VERA e va distinto dal «non scritto»: qui casca
  // chi legge il valore con un `||`, che dello zero fa un uno
  M.saveVolume(0);
  t.eq("zero vuol dire zero", M.getVolume(), 0);
  // i valori fuori scala si tagliano da tutt'e due i lati, in scrittura e
  // in lettura: un archivio vecchio o un dito storto non devono passare
  M.saveVolume(5);
  t.eq("sopra l'uno si taglia scrivendo", M.getVolume(), 1);
  M.saveVolume(-3);
  t.eq("sotto lo zero pure", M.getVolume(), 0);
  memoria.bc_music_vol = "7";
  t.eq("e un valore fuori scala gia' nello storage si taglia leggendo", M.getVolume(), 1);
  memoria.bc_music_vol = "ciao";
  t.eq("quel che non e' un numero torna al volume pieno", M.getVolume(), 1);

  // ---- I PREFERITI, LE RACCOLTE, E IL TIMBRO CHE LI FA VIAGGIARE ------------
  pulisci();
  t.eq("storage vuoto → nessuna melodia", M.getFavoritesRaw().length, 0);
  memoria.bc_music_favs = "{ non e' JSON";
  t.eq("uno storage rotto non esplode", M.getFavoritesRaw().length, 0);
  memoria.bc_music_favs = '{"a":1}';
  t.eq("e quel che non e' un elenco nemmeno", M.getFavoritesRaw().length, 0);

  {
    const vive = [{ id: "a" }, { id: "morta", deleted: 900 }];
    M.writeFavorites(vive);
    // LA LAPIDE RESTA NELL'ELENCO GREZZO: e' cosi' che la cancellazione
    // arriva all'altro dispositivo senza una colonna in piu'
    t.eq("la lapide resta nel grezzo", M.getFavoritesRaw().length, 2);
    t.eq("ma non si mostra", M.getFavorites().map((f) => f.id).join(","), "a");
  }

  // IL TIMBRO DELLE PREFERENZE E' LA RIGA CHE CONTA: senza, la
  // sincronizzazione non sa che c'e' roba nuova e il cloud vince al primo
  // giro — la melodia aggiunta stasera sparisce domani. `write*` NON lo
  // tocca apposta (lo usa chi riceve dal cloud: ritimbrare li' vorrebbe
  // dire rimandare su quel che e' appena sceso), `save*` si'.
  pulisci();
  M.writeFavorites([{ id: "a" }]);
  t.eq("scrivere e basta non timbra", memoria.bc_prefs_upd, undefined);
  M.saveFavorites([{ id: "a" }]);
  t.c("salvare timbra", Number(memoria.bc_prefs_upd) > 0);

  pulisci();
  M.writeLists([{ id: "r1" }]);
  t.eq("e vale anche per le raccolte", memoria.bc_prefs_upd, undefined);
  M.saveLists([{ id: "r1" }]);
  t.c("salvare le raccolte timbra", Number(memoria.bc_prefs_upd) > 0);

  pulisci();
  t.eq("nessuna raccolta", M.getListsRaw().length, 0);
  memoria.bc_music_lists = "rotto[";
  t.eq("raccolte illeggibili → nessuna", M.getListsRaw().length, 0);
  M.writeLists([{ id: "r1" }, { id: "r2", deleted: 900 }]);
  t.eq("anche le raccolte hanno le loro lapidi", M.getListsRaw().length, 2);
  t.eq("e non si mostrano", M.getLists().map((r) => r.id).join(","), "r1");

  // ---- UNA RACCOLTA NUOVA ---------------------------------------------------
  {
    const r = M.nuovaRaccolta("Sera");
    t.eq("il nome scelto", r.name, "Sera");
    t.eq("nasce vuota", r.brani.length, 0);
    t.c("e ha un id suo", typeof r.id === "string" && r.id.length > 10);
    t.c("con le due date", r.addedAt > 0 && r.updatedAt === r.addedAt);
    // un nome vuoto NON lascia una riga senza nome nella sala della musica
    t.eq("senza nome ne prende uno", M.nuovaRaccolta("").name, "Raccolta senza nome");
    t.eq("e nemmeno il nulla lo lascia vuoto", M.nuovaRaccolta().name, "Raccolta senza nome");
  }

  // ---- QUEL CHE ENTRA COME MELODIA ------------------------------------------
  // La guardia sul tipo sta PRIMA di scrivere nello store, quindi si prova
  // senza IndexedDB — ed e' il pezzo che conta: senza, un PDF trascinato
  // nella sala della musica diventerebbe una traccia che non suona.
  t.eq("un PDF non e' una melodia", await M.addTrackFile({ name: "tomo.pdf", type: "application/pdf" }), null);
  t.eq("e nemmeno un file senza tipo", await M.addTrackFile({ name: "boh" }), null);
  t.eq("un video nemmeno", await M.addTrackFile({ name: "film.mp4", type: "video/mp4" }), null);
  t.c("«file» che si spaccia per audio nel nome non basta", (await M.addTrackFile({ name: "audio.mp3", type: "text/plain" })) === null);
  // e il tipo dev'essere `audio/…` DALL'INIZIO: «application/x-pn-realaudio»
  // esiste davvero, nomina l'audio e un `<audio>` non lo suona — senza
  // l'ancora entrerebbe come melodia muta (mutazione provata)
  t.eq("un tipo che nomina l'audio ma non comincia per audio", await M.addTrackFile({ name: "vecchio.ram", type: "application/x-pn-realaudio" }), null);

  // ---- LA MUSICA LEGATA A UN LIBRO ------------------------------------------
  pulisci();
  t.eq("un libro senza musica", M.getBookMusic("b1"), null);
  memoria.bc_music_b1 = "non e' JSON";
  t.eq("una scelta illeggibile non esplode", M.getBookMusic("b1"), null);
  M.setBookMusic("b1", { id: "m1" });
  t.eq("la scelta si rilegge", M.getBookMusic("b1").id, "m1");
  // QUI IL TIMBRO E' QUELLO DEL LIBRO (`bc_upd_<id>`), non quello delle
  // preferenze: la musica di un libro viaggia nella riga di quel libro, e
  // senza timbro `planSync` non se ne accorge mai
  t.c("e timbra il LIBRO", Number(memoria.bc_upd_b1) > 0);
  t.eq("non le preferenze", memoria.bc_prefs_upd, undefined);
  // la scelta di un libro non tocca quella di un altro
  M.setBookMusic("b2", { id: "m2" });
  t.eq("e ogni libro ha la sua", M.getBookMusic("b1").id, "m1");
}

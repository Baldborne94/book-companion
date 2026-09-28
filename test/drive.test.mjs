// GOOGLE DRIVE AL POSTO DEL SECCHIO. Qui si prova quel che sbaglia in
// silenzio: un libro abbinato al file sbagliato (apre il romanzo sbagliato
// su tutti i dispositivi), un libro non riconosciuto (un doppione caricato
// dall'app nella cartella del lettore), un file tolto dal secchio prima di
// avere la sua copia su Drive, e il giro di rete — la sessione di
// caricamento a pezzi, il segno per l'altro dispositivo, la chiave scaduta
// che non deve diventare «errore».
import {
  abbina,
  nomeNudo,
  estensioneDi,
  scegliCartella,
  nomeSuDrive,
  daCaricare,
  daTraslocare,
  daTogliereDalSecchio,
  spazioDrive,
  spartisciDrive,
  pesoDeiLibri,
  ripulisciIdClient,
  idClientValido,
} from "../src/lib/driveCore.js";
import { fmtGoogle } from "../src/lib/bytes.js";

const IMP = "a".repeat(64);
const IMP2 = "b".repeat(64);

export default async (t) => {
  // ---- IL NOME RIDOTTO ------------------------------------------------------
  t.eq("estensione", estensioneDi("Eric.EPUB"), "epub");
  t.eq("senza estensione", estensioneDi("Leggimi"), "");
  t.eq("via estensione, accenti e punteggiatura", nomeNudo("Perché: il Mondo-Disco.epub"), "perche il mondo disco");
  t.eq("via il (1) dei doppioni", nomeNudo("Mort (1).epub"), "mort");
  t.eq("un titolo si riduce uguale", nomeNudo("Mort"), "mort");

  // ---- L'ABBINAMENTO --------------------------------------------------------
  {
    const libri = [
      { id: "segnato", title: "Qualunque" },
      { id: "impronta", title: "Titolo diverso dal file", impronta: IMP },
      { id: "misura", title: "Guards! Guards!" },
      { id: "nome", title: "Small Gods" },
      { id: "niente", title: "Non c'è" },
    ];
    const file = [
      { id: "f1", name: "x.epub", appProperties: { bcId: "segnato" } },
      { id: "f2", name: "Pratchett - 09 - Eric.epub", sha256Checksum: IMP.toUpperCase(), size: "5" },
      { id: "f3", name: "guards.epub", size: "12345" },
      { id: "f4", name: "Small Gods.epub", size: "999" },
      { id: "f5", name: "foto.jpg", size: "12345" },
    ];
    const { mappa, daSegnare } = abbina(libri, file, { misure: new Map([["misura", 12345]]) });
    t.eq("il segno nostro vince", mappa.get("segnato")?.id, "f1");
    // lo SHA-256 di Drive e l'impronta del libro sono lo stesso numero,
    // anche con le maiuscole diverse
    t.eq("l'impronta riconosce il file anche col nome diverso", mappa.get("impronta")?.id, "f2");
    t.eq("la misura, a estensione uguale", mappa.get("misura")?.id, "f3");
    t.eq("il nome ridotto", mappa.get("nome")?.id, "f4");
    t.c("quel che non c'è non si inventa", !mappa.has("niente"));
    // il file gia' segnato non si risegna, quelli riconosciuti si'
    t.eq(
      "si segnano solo i nuovi riconosciuti",
      daSegnare.map((d) => d.bookId).sort().join(","),
      "impronta,misura,nome"
    );
    t.c("un'immagine non è un libro", ![...mappa.values()].some((f) => f.id === "f5"));
  }
  {
    // UN FILE NON SI DA' A DUE LIBRI: due copie della stessa impronta sullo
    // scaffale ne prendono uno solo, e il secondo resta da caricare
    const { mappa } = abbina(
      [{ id: "a", title: "A", impronta: IMP }, { id: "b", title: "B", impronta: IMP }],
      [{ id: "f", name: "a.epub", sha256Checksum: IMP }]
    );
    t.eq("un file, un libro", mappa.size, 1);
  }
  {
    // L'IMPRONTA A CAMPIONI non e' lo SHA-256 del file intero: confrontarla
    // non troverebbe mai niente, e per caso potrebbe trovare la cosa sbagliata
    const { mappa } = abbina(
      [{ id: "a", title: "Hellboy", impronta: `c:${IMP}`, fileType: "cbz" }],
      [{ id: "f", name: "altro.cbz", sha256Checksum: IMP }]
    );
    t.c("l'impronta a campioni non si confronta", !mappa.has("a"));
  }
  {
    // L'ESTENSIONE DEVE COMBACIARE: un PDF con la misura giusta non e' l'ePub
    const { mappa } = abbina(
      [{ id: "a", title: "Mort" }],
      [{ id: "f", name: "Mort.pdf", size: "10" }],
      { misure: new Map([["a", 10]]) }
    );
    t.c("un PDF non è l'ePub", !mappa.has("a"));
    const cbz = abbina([{ id: "h", title: "Hellboy", fileType: "cbz" }], [{ id: "g", name: "hellboy.cbz" }]);
    t.eq("il fumetto cerca il suo tipo", cbz.mappa.get("h")?.id, "g");
  }
  {
    // NEL DUBBIO NON SI ABBINA: due file con la stessa misura e nessun nome
    // che decide — tirare a sorte vorrebbe dire aprire il romanzo sbagliato
    const { mappa, ambigui } = abbina(
      [{ id: "a", title: "Mort" }],
      [
        { id: "f1", name: "uno.epub", size: "10" },
        { id: "f2", name: "due.epub", size: "10" },
      ],
      { misure: new Map([["a", 10]]) }
    );
    t.c("due candidati per misura: si tace", !mappa.has("a"));
    t.eq("e si conta", ambigui, 1);
    // ma il nome decide, se c'e'
    const deciso = abbina(
      [{ id: "a", title: "Mort" }],
      [
        { id: "f1", name: "uno.epub", size: "10" },
        { id: "f2", name: "Mort.epub", size: "10" },
      ],
      { misure: new Map([["a", 10]]) }
    );
    t.eq("il nome scioglie la misura", deciso.mappa.get("a")?.id, "f2");
    // e se anche il nome ne lascia due, si tace lo stesso
    const pari = abbina(
      [{ id: "a", title: "Mort" }],
      [
        { id: "f1", name: "Mort.epub", size: "10" },
        { id: "f2", name: "Mort (1).epub", size: "10" },
      ],
      { misure: new Map([["a", 10]]) }
    );
    t.c("misura e nome pari: si tace", !pari.mappa.has("a"));
    const nomi = abbina([{ id: "a", title: "Mort" }], [
      { id: "f1", name: "Mort.epub" },
      { id: "f2", name: "Mort (1).epub" },
    ]);
    t.c("due file con lo stesso nome: si tace", !nomi.mappa.has("a"));
  }
  {
    // L'ORDINE DEI MODI: la misura (piu' sicura) si prende il file prima che
    // il nome lo dia a un altro libro
    const { mappa } = abbina(
      [
        { id: "perNome", title: "Mort" },
        { id: "perMisura", title: "Altro titolo" },
      ],
      [{ id: "f", name: "Mort.epub", size: "77" }],
      { misure: new Map([["perMisura", 77]]) }
    );
    t.eq("la misura viene prima del nome", mappa.get("perMisura")?.id, "f");
    t.c("e il nome non ruba il file", !mappa.has("perNome"));
  }
  {
    // il segno di un libro che non c'e' piu' non abbina nessuno, e il file
    // resta libero per gli altri modi
    const { mappa } = abbina([{ id: "a", title: "Mort" }], [{ id: "f", name: "Mort.epub", appProperties: { bcId: "sparito" } }]);
    t.eq("il segno di un libro sparito non blocca il file", mappa.get("a")?.id, "f");
    t.eq("senza niente non esplode", abbina(null, null).mappa.size, 0);
  }

  // ---- DOVE VANNO I LIBRI NUOVI --------------------------------------------
  t.eq("nella cartella dei fratelli", scegliCartella("libri", { genitori: ["A", "B", "B"], cartelle: [{ id: "L", name: "Libri" }] }), "B");
  t.eq("senza fratelli, nella cartella col nome", scegliCartella("manga", { cartelle: [{ id: "L", name: "Libri" }, { id: "M", name: "Manga" }] }), "M");
  t.eq("senza niente, da creare", scegliCartella("fumetti", { cartelle: [{ id: "L", name: "Libri" }] }), null);
  t.eq("un tipo ignoto va fra i libri", scegliCartella("strano", { cartelle: [{ id: "L", name: "Libri" }] }), "L");
  t.eq("il nome del file", nomeSuDrive({ title: "Guards! Guards: a/b?", fileType: "pdf" }), "Guards! Guards a b.pdf");
  t.eq("senza titolo", nomeSuDrive({}), "senza titolo.epub");

  // ---- CHI SALE, CHI TRASLOCA, CHI LASCIA IL SECCHIO ------------------------
  {
    const libri = ["a", "b", "c", "d"].map((id) => ({ id, title: id }));
    libri.push({ id: "t", title: "t", fileTolto: true });
    const qui = new Set(["a", "b", "t"]);
    const su = (l) => l.map((b) => b.id).join(",");
    t.eq("sale chi ha i byte qui e non su Drive", su(daCaricare(libri, { qui, lassu: new Set(["b"]) })), "a");
    t.eq("al buio non sale niente", su(daCaricare(libri, { qui, lassu: null })), "");
    t.eq("chi sta per essere cancellato non sale", su(daCaricare(libri, { qui, lassu: new Set(), inUscita: new Set(["a"]) })), "b");

    const secchio = new Set(["a", "c", "d", "t"]);
    const drive = new Set(["d"]);
    // «c» sta solo nel secchio: va portato su Drive. «a» ha i byte qui, e
    // sale dalla strada di `daCaricare`. «d» e' gia' su Drive. L'ebook
    // tolto a mano non trasloca.
    t.eq("trasloca chi sta solo nel secchio", su(daTraslocare(libri, { secchio, drive, qui })), "c");
    t.eq("senza Drive non si trasloca", su(daTraslocare(libri, { secchio, drive: null, qui })), "");
    // IL SECCHIO SI SVUOTA SOLO DI QUEL CHE DRIVE HA: «c» e' ancora l'unica
    // copia fuori dal tablet, e toglierla adesso la perderebbe
    t.eq("dal secchio esce solo quel che è su Drive", daTogliereDalSecchio(secchio, drive).join(","), "d");
    t.eq("senza Drive il secchio resta", daTogliereDalSecchio(secchio, null).length, 0);
  }

  // ---- LO SPAZIO -----------------------------------------------------------
  {
    const s = spazioDrive({ limit: "100000000000", usage: "30000000000", usageInDrive: "20000000000", usageInDriveTrash: "0" });
    t.eq("usati", s.usati, 3e10);
    t.eq("limite", s.limite, 1e11);
    t.eq("liberi", s.liberi, 7e10);
    t.eq("in Drive", s.inDrive, 2e10);
    // SENZA TETTO i liberi non sono zero: zero si leggerebbe «hai finito»
    const senza = spazioDrive({ usage: "5" });
    t.eq("senza tetto: limite nullo", senza.limite, null);
    t.eq("senza tetto: liberi nulli, non zero", senza.liberi, null);
    t.eq("una risposta senza usato non è uno spazio", spazioDrive({ limit: "10" }), null);
    t.eq("niente non è uno spazio", spazioDrive(null), null);
    t.eq("oltre il tetto i liberi sono zero", spazioDrive({ limit: "10", usage: "12" }).liberi, 0);

    const p = spartisciDrive(s, 1e10);
    t.eq("i libri", p.libri, 1e10);
    t.eq("il resto dell'usato", p.altro, 2e10);
    t.eq("la parte si misura sul tetto", p.parte(5e10), "50%");
    // una mappa di ieri su un Drive svuotato oggi non disegna piu' di se'
    t.eq("i libri non superano l'usato", spartisciDrive(s, 9e10).libri, 3e10);
    t.eq("senza tetto niente barra", spartisciDrive(senza, 1).parte, null);
  }
  // il piano da 100 GB di Google e' in potenze di due: scritto in decimale
  // diventava «107.4 GB», un numero che non e' quello comprato
  t.eq("il piano Basic si legge 100 GB", fmtGoogle(107374182400), "100 GB");
  t.eq("i decimali restano", fmtGoogle(1.5 * 2 ** 30), "1.5 GB");
  t.eq("sotto il giga, MB", fmtGoogle(3 * 2 ** 20), "3 MB");
  t.eq("zero è zero", fmtGoogle(0), "0 MB");
  t.eq("peso dei libri", pesoDeiLibri({ a: { byte: 3 }, b: { byte: 4 }, c: {} }).byte, 7);
  t.eq("e quanti", pesoDeiLibri({ a: { byte: 3 }, b: {} }).quanti, 2);
  t.eq("senza mappa", pesoDeiLibri(null).quanti, 0);

  // ---- L'ID DEL CLIENT ---------------------------------------------------
  const ID = "274387944132-52qis27ka9f2nbkg0p4b3r2fvgpc0cjb.apps.googleusercontent.com";
  t.c("l'ID vero ha la forma giusta", idClientValido(ID));
  // la tastiera del tablet: spazi, a capo, uno spazio a meta'
  t.eq("spazi e a capo si tolgono", ripulisciIdClient(` ${ID.slice(0, 20)} ${ID.slice(20)}\n`), ID);
  t.c("… e dopo la ripulitura e' valido", idClientValido(` ${ID}\n`));
  t.c("senza la coda di Google no", !idClientValido(ID.replace(".apps.googleusercontent.com", "")));
  t.c("con la coda tagliata no", !idClientValido(ID.slice(0, -3)));
  t.c("senza il numero davanti no", !idClientValido(ID.replace(/^\d+-/, "")));
  t.c("una maiuscola corretta dalla tastiera no", !idClientValido(ID.replace("52qis", "52Qis")));
  t.c("il client secret incollato al posto dell'ID no", !idClientValido("GOCSPX-abcdefghijklmnop"));
  t.c("niente no", !idClientValido(""));
  t.c("con qualcosa dopo la coda no", !idClientValido(ID + "/x"));

  // ---- IL GIRO CON UN DRIVE FINTO ------------------------------------------
  await giroFinto(t);
};

// Un Drive finto dietro `fetch`, e uno storage finto: il giro vero, con le
// richieste vere, contro un server che si comporta come quello di Google
// per le cinque cose che il giro gli chiede.
async function giroFinto(t) {
  // l'elenco di Drive si tiene in IndexedDB: un finto con le quattro mosse
  // che bookStore fa, se un altro file non ne ha gia' messo uno
  if (!globalThis.indexedDB) {
    const stores = new Map();
    const db = {
      objectStoreNames: { contains: (n) => stores.has(n) },
      createObjectStore: (n) => stores.set(n, new Map()),
      transaction: (nome) => {
        const tx = {};
        const m = stores.get(nome);
        const req = (fai) => {
          const r = {};
          setTimeout(() => {
            r.result = fai();
            r.onsuccess?.();
            tx.oncomplete?.();
          });
          return r;
        };
        tx.objectStore = () => ({
          put: (v, k) => req(() => m.set(k, v)),
          get: (k) => req(() => m.get(k)),
          delete: (k) => req(() => m.delete(k)),
          getAllKeys: () => req(() => [...m.keys()]),
        });
        return tx;
      },
    };
    globalThis.indexedDB = {
      open() {
        const r = {};
        setTimeout(() => {
          r.result = db;
          r.onupgradeneeded?.();
          r.onsuccess?.();
        });
        return r;
      },
    };
  }
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
  const drive = await import("../src/lib/drive.js");
  mem.set("bc_drive_on", "1");
  mem.set("bc_drive_client", "x.apps.googleusercontent.com");
  mem.set("bc_drive_token", JSON.stringify({ chiave: "T", scade: Date.now() + 3600e3 }));

  const file = [
    { id: "fMort", name: "Mort.epub", size: "10", parents: ["LIBRI"] },
    { id: "fFoto", name: "gatto.jpg", size: "10", parents: ["root"] },
    { id: "LIBRI", name: "Libri", mimeType: "application/vnd.google-apps.folder" },
    { id: "fDoc", name: "Appunti", mimeType: "application/vnd.google-apps.document" },
  ];
  // il registro dei cambiamenti di Google: quel che si chiede al secondo giro
  let cambiamenti = [];
  const domande = { elenco: 0, cambi: 0, segni: [] };
  const segni = [];
  const pezzi = [];
  let createCartelle = 0;
  let sessione = null;
  const sessioni = [];
  const PEZZO = 32 * 1024 * 1024;
  let scadi = false;
  const risposta = (corpo, stato = 200, intestazioni = {}) => ({
    ok: stato >= 200 && stato < 300,
    status: stato,
    headers: { get: (k) => intestazioni[k] ?? null },
    json: async () => corpo,
    blob: async () => corpo,
  });
  globalThis.fetch = async (url, opz = {}) => {
    if (opz.headers?.Authorization !== "Bearer T") return risposta({}, 500);
    if (scadi) return risposta({}, 401);
    const u = new URL(url);
    if (u.pathname === "/drive/v3/files" && (opz.method || "GET") === "GET") {
      domande.elenco += 1;
      return risposta({ files: file });
    }
    if (u.pathname === "/drive/v3/changes/startPageToken") return risposta({ startPageToken: "S1" });
    if (u.pathname === "/drive/v3/changes") {
      domande.cambi += 1;
      domande.segni.push(u.searchParams.get("pageToken"));
      if (u.searchParams.get("pageToken") === "VECCHIO") return risposta({}, 410);
      return risposta({ changes: cambiamenti, newStartPageToken: "S2" });
    }
    if (u.pathname === "/drive/v3/files" && opz.method === "POST") {
      createCartelle += 1;
      return risposta({ id: `CART${createCartelle}`, name: JSON.parse(opz.body).name });
    }
    if (u.pathname.startsWith("/drive/v3/files/") && opz.method === "PATCH") {
      segni.push([u.pathname.split("/").pop(), JSON.parse(opz.body).appProperties]);
      return risposta({ id: "ok" });
    }
    if (u.pathname === "/upload/drive/v3/files" && opz.method === "POST") {
      sessione = { meta: JSON.parse(opz.body), totale: Number(opz.headers["X-Upload-Content-Length"]) };
      sessioni.push(sessione);
      return risposta({}, 200, { Location: "https://www.googleapis.com/upload/sessione/1" });
    }
    if (u.pathname === "/upload/sessione/1" && opz.method === "PUT") {
      const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(opz.headers["Content-Range"]);
      pezzi.push([Number(m[1]), Number(m[2]), opz.body.size]);
      // DRIVE PUO' TENERSI MENO DI QUEL CHE GLI SI MANDA: al primo pezzo ne
      // accetta un chilobyte solo, e il pezzo dopo deve ripartire da li'
      if (pezzi.length === 1 && Number(m[2]) + 1 < Number(m[3])) return risposta({}, 308, { Range: "bytes=0-1023" });
      if (Number(m[2]) + 1 < Number(m[3])) return risposta({}, 308, { Range: `bytes=0-${m[2]}` });
      // come Google: i campi chiesti del file appena nato
      return risposta({
        id: `fNuovo${sessioni.length}`,
        size: String(sessione.totale),
        name: sessione.meta.name,
        parents: sessione.meta.parents,
        appProperties: sessione.meta.appProperties,
      });
    }
    return risposta({}, 404);
  };

  t.eq("Drive acceso ma mai guardato: «non so»", drive.idSuDrive(), null);
  const libri = [
    { id: "mort", title: "Mort" },
    { id: "nuovo", title: "Hellboy: v03", fileType: "cbz" },
    { id: "lassu", title: "Solo nel secchio" },
  ];
  const grosso = new Blob([new Uint8Array(PEZZO + 5)]);
  const letti = [];
  const esito = await drive.giroDrive(libri, {
    tipo: (b) => (b.fileType === "cbz" ? "fumetti" : "libri"),
    qui: new Set(["mort", "nuovo"]),
    misure: new Map([["mort", 10]]),
    secchio: new Set(["lassu"]),
    leggiByte: async (id) => {
      letti.push(id);
      return id === "nuovo" ? grosso : new Blob(["x"]);
    },
  });
  t.c("il libro già su Drive si riconosce", esito.mappa.has("mort"));
  t.eq("e si segna per l'altro dispositivo", JSON.stringify(segni[0]), JSON.stringify(["fMort", { bc: "1", bcId: "mort" }]));
  // IL FUMETTO VA IN UNA CARTELLA «Fumetti», e non c'e': si crea
  t.eq("la cartella che manca si crea una volta", createCartelle, 1);
  const perId = (id) => sessioni.find((x) => x.meta.appProperties?.bcId === id);
  t.eq("il fumetto va nella cartella nuova", perId("nuovo")?.meta.parents?.[0], "CART1");
  t.eq("il libro va nella cartella dei suoi fratelli", perId("lassu")?.meta.parents?.[0], "LIBRI");
  t.eq("il nome sul file è il titolo pulito", perId("nuovo")?.meta.name, "Hellboy v03.cbz");
  // IL CARICAMENTO VA A PEZZI e il secondo riparte da dove Drive dice
  t.eq("il primo pezzo parte da zero", pezzi[0][0], 0);
  t.eq("il secondo riparte da dove Drive si è fermato", pezzi[1][0], 1024);
  t.eq("e porta tutto il resto", pezzi[1][2], PEZZO + 5 - 1024);
  t.c("il libro nuovo è su Drive", esito.mappa.has("nuovo"));
  // «lassu» sta solo nel secchio: sale su Drive leggendo dal secchio
  t.c("chi sta solo nel secchio trasloca", esito.mappa.has("lassu") && letti.includes("lassu"));
  t.eq("il file finto non è un libro", [...esito.mappa].includes("fFoto"), false);
  t.eq("la mappa resta sul dispositivo", Object.keys(drive.mappaDrive()).sort().join(","), "lassu,mort,nuovo");
  t.c("e il Drive dice che i libri li ha guardati", drive.idSuDrive()?.size === 3);

  t.eq("il primo giro elenca il Drive una volta sola, per libri e cartelle", domande.elenco, 1);
  t.eq("…e non chiede cambiamenti", domande.cambi, 0);

  // IL SECONDO GIRO CHIEDE SOLO I CAMBIAMENTI: il libro caricato altrove
  // arriva dal registro, il file tolto se ne va, e nessun elenco da capo
  cambiamenti = [
    { fileId: "fAltro", file: { id: "fAltro", name: "Guards.epub", size: "7", parents: ["LIBRI"], appProperties: { bc: "1", bcId: "guards" } } },
    { fileId: "fMort", removed: true },
    { fileId: "fCestino", file: { id: "fCestino", name: "Eric.epub", size: "3", trashed: true } },
  ];
  const secondo = await drive.giroDrive([...libri, { id: "guards", title: "Guards" }], {
    tipo: () => "libri",
    qui: new Set(),
    leggiByte: async () => null,
  });
  t.eq("il secondo giro non elenca il Drive da capo", domande.elenco, 1);
  t.eq("…chiede i cambiamenti dal segno del primo", domande.segni.join(), "S1");
  t.c("il libro caricato altrove si riconosce dal registro", secondo.mappa.has("guards"));
  t.c("…e quello tolto da Drive non c'e' piu'", !secondo.mappa.has("mort"));
  t.c("…e il caricato in questo giro resta, anche se il registro non lo nomina", secondo.mappa.has("nuovo"));
  cambiamenti = [];
  await drive.giroDrive(libri, { tipo: () => "libri", qui: new Set(), leggiByte: async () => null });
  t.eq("il segno dopo e' quello nuovo", domande.segni.join(), "S1,S2");

  // UN SEGNO CHE GOOGLE NON RICONOSCE PIU' NON FERMA IL GIRO: si rifa' da capo
  const { putAux, getAux } = await import("../src/lib/bookStore.js");
  await putAux("drive_elenco", { ...(await getAux("drive_elenco")), segno: "VECCHIO" });
  const rifatto = await drive.giroDrive(libri, { tipo: () => "libri", qui: new Set(), leggiByte: async () => null });
  t.eq("un segno scaduto rifa' l'elenco da capo", domande.elenco, 2);
  t.c("…e il giro va a buon fine", rifatto.mappa instanceof Set && !rifatto.saltato);
  t.eq("…col segno nuovo", (await getAux("drive_elenco")).segno, "S1");

  // SCOLLEGARSI DIMENTICA L'ELENCO: ricollegandosi con un altro account
  // sarebbe il Drive di qualcun altro
  await drive.scollegaDrive();
  await new Promise((r) => setTimeout(r, 20));
  t.eq("scollegato, l'elenco tenuto se ne va", await getAux("drive_elenco"), undefined);
  mem.set("bc_drive_on", "1");
  mem.set("bc_drive_token", JSON.stringify({ chiave: "T", scade: Date.now() + 3600e3 }));
  // fuori da un giro (lo «Scegli su Drive» della Libreria), e subito dopo:
  // nemmeno la memoria di pochi secondi deve sopravvivere
  await drive.elencaFile();
  t.eq("…e la domanda dopo lo rifa' da capo, anche nello stesso momento", domande.elenco, 3);

  // LA CHIAVE SCADUTA NON E' UN ERRORE: il giro aspetta e lo dice
  scadi = true;
  const scaduto = await drive.giroDrive(libri, { tipo: () => "libri", qui: new Set(), leggiByte: async () => null });
  t.eq("un 401 è «scaduto», non un guasto", scaduto.saltato, "scaduto");
  t.c("e la chiave si dimentica", !drive.driveProntoOra());
  const senza = await drive.giroDrive(libri, { tipo: () => "libri", qui: new Set(), leggiByte: async () => null });
  t.eq("senza chiave non si bussa nemmeno", senza.saltato, "scaduto");
  // L'ID STORTO SI FERMA QUI, prima di chiamare Google: niente pagina in
  // inglese col 401, la ragione in italiano (e niente script di Google
  // caricato — in Node non c'e' un document, quindi arrivarci esploderebbe)
  drive.scriviClientId("274387944132-abc.apps.googleusercontent")
  const perche = await drive.collegaDrive().then(() => "collegato", (e) => e.message);
  t.c("l'ID storto si dice prima di chiamare Google", /forma giusta/.test(perche), perche);
  drive.scriviClientId(" 274387944132-abc.apps. googleusercontent.com \n");
  t.eq("l'ID si salva ripulito", mem.get("bc_drive_client"), "274387944132-abc.apps.googleusercontent.com");
  mem.delete("bc_drive_on");
  t.eq("Drive spento: niente giro", (await drive.giroDrive(libri, {})).saltato, "spento");
  t.eq("e nessuna mappa da mostrare", drive.idSuDrive(), null);
}

// L'ARCHIVIO DELLE SCHEDE SU DRIVE (`archivioDovuto`, `archiviDaTogliere`,
// `cartellaArchivi` in `lib/driveCore.js`; `archiviaSuDrive` in
// `lib/drive.js`; `archivioSchede` in `lib/exportLibrary.js`). Chiesto dal
// lettore: un archivio che si fa da solo. Sbaglia in silenzio in tre modi:
// non parte mai (e il giorno che serve non c'e'), parte a ogni giro (Drive
// pieno di copie), o parte e non si ripristina.
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
const pulisci = () => {
  for (const k of Object.keys(memoria)) delete memoria[k];
};

const { archivioDovuto, archiviDaTogliere, piuRecenti, nomeArchivio, cartellaArchivi, TIENI_ARCHIVI, OGNI_ARCHIVIO } = await import("../src/lib/driveCore.js");
const { archivioSchede } = await import("../src/lib/exportLibrary.js");
const { sbircia, restoreLibrary } = await import("../src/lib/restoreLibrary.js");
const { saveBooks, loadBooks, setProgress, getProgress } = await import("../src/lib/library.js");
const { saveMarks, getMarks } = await import("../src/lib/annotations.js");
const { saveFavorites, getFavoritesRaw } = await import("../src/lib/music.js");
const drive = await import("../src/lib/drive.js");

const ORA = Date.parse("2026-09-30T20:00:00Z");
const ORE = 3_600_000;

// Un Drive finto: cartelle, archivi, e il registro di quel che gli si chiede
function driveFinto(file = []) {
  const d = { file: [...file], chieste: [], n: 0 };
  d.fetch = async (url, op = {}) => {
    const u = new URL(url);
    const metodo = op.method || "GET";
    d.chieste.push(`${metodo} ${u.pathname}`);
    const json = (x, stato = 200, testate = {}) => ({
      ok: stato < 400,
      status: stato,
      headers: { get: (k) => testate[k] ?? null },
      json: async () => x,
      blob: async () => x,
    });
    if (u.pathname.endsWith("/changes/startPageToken")) return json({ startPageToken: "1" });
    if (metodo === "GET" && u.pathname.endsWith("/files")) {
      const q = u.searchParams.get("q") || "";
      const vivi = d.file.filter((f) => !f.trashed);
      return json({ files: q.includes("bcArchivio") ? vivi.filter((f) => f.appProperties?.bcArchivio === "1") : vivi });
    }
    if (metodo === "POST" && u.pathname === "/drive/v3/files") {
      const f = { id: `c${++d.n}`, ...JSON.parse(op.body) };
      d.file.push(f);
      return json(f);
    }
    if (metodo === "POST" && u.pathname.startsWith("/upload/")) {
      d.inCarico = JSON.parse(op.body);
      return json({}, 200, { Location: "https://www.googleapis.com/upload/sessione" });
    }
    if (metodo === "PUT") {
      const f = { id: `a${++d.n}`, ...d.inCarico, createdTime: new Date(ORA).toISOString(), byte: op.body.size };
      d.file.push(f);
      return json(f);
    }
    if (metodo === "PATCH") {
      const id = decodeURIComponent(u.pathname.split("/").pop());
      const f = d.file.find((x) => x.id === id);
      Object.assign(f, JSON.parse(op.body));
      return json({ id });
    }
    return json({}, 404);
  };
  return d;
}
const CARTELLA = "application/vnd.google-apps.folder";
const collega = () => {
  memoria.bc_drive_on = "1";
  memoria.bc_drive_client = "123-abc.apps.googleusercontent.com";
  memoria.bc_drive_token = JSON.stringify({ chiave: "k", scade: Date.now() + ORE });
};

export default async function (t) {
  // ---- quando e' dovuto ------------------------------------------------------
  t.eq("mai fatto: si fa", archivioDovuto({ ultimo: 0, ora: ORA, roba: 3 }), true);
  t.eq("fatto un'ora fa: no", archivioDovuto({ ultimo: ORA - ORE, ora: ORA, roba: 3 }), false);
  t.eq("fatto ieri: si'", archivioDovuto({ ultimo: ORA - OGNI_ARCHIVIO, ora: ORA, roba: 3 }), true);
  t.eq("un orologio tornato indietro non lo ferma per sempre", archivioDovuto({ ultimo: ORA + 5 * ORE, ora: ORA, roba: 3 }), true);
  t.eq("una biblioteca vuota non ha niente da archiviare", archivioDovuto({ ultimo: 0, ora: ORA, roba: 0 }), false);

  // ---- quanti se ne tengono ----------------------------------------------------
  const archivi = Array.from({ length: TIENI_ARCHIVI + 2 }, (_, i) => ({ id: `x${i}`, createdTime: new Date(ORA - i * OGNI_ARCHIVIO).toISOString() }));
  const mescolati = [...archivi].reverse();
  t.eq("se ne tolgono i piu' vecchi, in qualunque ordine arrivino", archiviDaTogliere(mescolati).map((a) => a.id).join(), `x${TIENI_ARCHIVI},x${TIENI_ARCHIVI + 1}`);
  t.eq("il piu' recente viene prima", piuRecenti(mescolati)[0].id, "x0");
  t.eq("sotto il tetto non si toglie niente", archiviDaTogliere(archivi.slice(0, 3)).length, 0);
  t.c("il nome dice il giorno", /^book-companion-schede-\d{4}-\d{2}-\d{2}\.zip$/.test(nomeArchivio(ORA)));

  // ---- la cartella --------------------------------------------------------------
  const radice = { id: "r", name: "book-companion", mimeType: CARTELLA };
  const suoi = { id: "s", name: "Archivi", parents: ["r"], mimeType: CARTELLA };
  const altrui = { id: "z", name: "Archivi", parents: ["altrove"], mimeType: CARTELLA };
  t.eq("«Archivi» dentro «book-companion»", cartellaArchivi([altrui, radice, suoi]), "s");
  t.eq("un «Archivi» di un'altra cartella non e' il nostro", cartellaArchivi([altrui, radice]), null);

  // ---- ANDATA E RITORNO: lo zip delle schede si ripristina dalla strada di sempre --
  pulisci();
  saveBooks([
    { id: "L1", title: "Il colore della magia", fileType: "epub", saga: "Mondo Disco", addedAt: 1 },
    { id: "L2", title: "Racconti", fileType: "cbz", addedAt: 2 },
  ]);
  setProgress("L1", 0.42);
  saveMarks("L1", [{ id: "m1", cfi: "epubcfi(/6/4)", label: "qui" }]);
  saveFavorites([
    { id: "f1", name: "Pioggia", trackId: "t1", drive: true },
    { id: "f2", name: "Solo qui", trackId: "t2" },
  ]);
  const zip = await archivioSchede(new Date(ORA));
  t.c("lo zip si fa", zip instanceof Blob && zip.size > 0);
  const dentro = await sbircia(zip);
  t.eq("dice di essere di sole schede", dentro.soloSchede, true);
  t.eq("coi due libri", dentro.libri, 2);
  pulisci();
  const r = await restoreLibrary(dentro);
  t.eq("tornano i libri", loadBooks().map((b) => b.id).sort().join(), "L1,L2");
  t.eq("con la saga", loadBooks().find((b) => b.id === "L1").saga, "Mondo Disco");
  t.eq("col punto di lettura", getProgress("L1"), 0.42);
  t.eq("coi segni", getMarks("L1").length, 1);
  t.eq("e nessun file dichiarato mancante", r.senzaFile, 0);
  t.eq("la melodia di Drive torna (scende quando la suoni)", getFavoritesRaw().map((f) => f.id).join(), "f1");
  pulisci();
  t.eq("a biblioteca vuota non c'e' archivio", await archivioSchede(), null);

  // ---- IL GIRO SU DRIVE -----------------------------------------------------------
  const fetchVero = globalThis.fetch;
  const oraVera = Date.now;
  try {
    pulisci();
    collega();
    const vecchi = Array.from({ length: TIENI_ARCHIVI }, (_, i) => ({
      id: `v${i}`,
      name: `vecchio-${i}.zip`,
      appProperties: { bc: "1", bcArchivio: "1" },
      createdTime: new Date(ORA - (i + 1) * OGNI_ARCHIVIO).toISOString(),
    }));
    const d = driveFinto([radice, ...vecchi]);
    globalThis.fetch = d.fetch;
    let preparati = 0;
    const prepara = async () => {
      preparati += 1;
      return new Blob(["zip"]);
    };
    // prima di ogni chiave buona: il modulo tiene in memoria l'ultima valida
    memoria.bc_drive_token = JSON.stringify({ chiave: "k", scade: Date.now() - 1 });
    const scaduto = await drive.archiviaSuDrive(prepara, { ora: ORA });
    t.eq("a chiave scaduta aspetta, senza finestre di Google", scaduto.saltato, "scaduto");
    t.eq("…e senza chiedere niente", d.chieste.length + preparati, 0);

    collega();
    const esito = await drive.archiviaSuDrive(prepara, { ora: ORA });
    t.eq("il primo giro archivia", esito.fatto, true);
    const cartella = d.file.find((f) => f.name === "Archivi");
    t.c("nella cartella «Archivi» dentro «book-companion»", cartella?.parents?.[0] === "r");
    const nuovo = d.file.find((f) => f.appProperties?.bcArchivio === "1" && f.name.startsWith("book-companion-schede"));
    t.c("l'archivio sta li'", nuovo?.parents?.[0] === cartella?.id);
    t.eq("il piu' vecchio va nel cestino", d.file.filter((f) => f.trashed).map((f) => f.id).join(), `v${TIENI_ARCHIVI - 1}`);
    t.eq("ne restano dieci", d.file.filter((f) => f.appProperties?.bcArchivio === "1" && !f.trashed).length, TIENI_ARCHIVI);
    t.eq("l'ora si ricorda", drive.ultimoArchivioSuDrive(), ORA);

    d.chieste.length = 0;
    const secondo = await drive.archiviaSuDrive(prepara, { ora: ORA + ORE });
    t.eq("il giro dopo, lo stesso giorno, non rifa' niente", secondo.saltato, "fatto");
    t.eq("…non prepara nemmeno lo zip", preparati, 1);
    t.eq("…e non chiede niente a Drive", d.chieste.length, 0);

    const vuoto = await drive.archiviaSuDrive(async () => null, { ora: ORA + 2 * OGNI_ARCHIVIO });
    t.eq("niente da archiviare: non si carica niente", vuoto.saltato, "vuoto");
    t.eq("…e il giorno dopo si riprova", drive.ultimoArchivioSuDrive(), ORA);

    // un Drive senza «book-companion»: si crea, e «Archivi» ci va dentro
    memoria.bc_drive_archivio = "0";
    // l'elenco di Drive vive venti secondi nella pagina: era dell'altro Drive
    Date.now = () => oraVera() + 60_000;
    const nudo = driveFinto([]);
    globalThis.fetch = nudo.fetch;
    await drive.archiviaSuDrive(prepara, { ora: ORA + 3 * OGNI_ARCHIVIO });
    const r2 = nudo.file.find((f) => f.name === "book-companion");
    t.c("senza la radice, la radice si crea", !!r2);
    t.c("…e «Archivi» sta dentro di lei", nudo.file.find((f) => f.name === "Archivi")?.parents?.[0] === r2?.id);
  } finally {
    Date.now = oraVera;
    // la chiave e l'elenco vivono nel modulo: chi gira dopo li troverebbe
    await drive.scollegaDrive();
    globalThis.fetch = fetchVero;
    pulisci();
  }
}

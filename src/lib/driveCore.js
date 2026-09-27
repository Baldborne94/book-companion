// LE DECISIONI DEL GIRO CON GOOGLE DRIVE, senza rete e senza IndexedDB.
//
// Il lettore i suoi libri li ha caricati su Drive A MANO, nelle cartelle
// «Libri», «Fumetti» e «Manga», col nome che il file aveva sul PC — e l'app
// quei file non li ha mai visti. Prima di mandarne su uno, quindi, bisogna
// RICONOSCERE quelli che ci sono gia': ogni libro non riconosciuto e' un
// doppione caricato dall'app, cioe' spazio del piano buttato e due copie
// dello stesso romanzo nella cartella.
//
// Qui stanno le scelte che sbagliano in silenzio — un abbinamento storto non
// alza nessun errore, fa aprire il romanzo sbagliato — e un test le prova con
// dei finti. La rete sta in `drive.js`.

export const EST = ["epub", "pdf", "cbz", "cbr"];

export const estensioneDi = (nome) => {
  const m = /\.([a-z0-9]{2,5})$/i.exec(String(nome || ""));
  return m ? m[1].toLowerCase() : "";
};

// Il nome ridotto a quel che conta per confrontarlo con un titolo: senza
// estensione, senza il «(1)» che Windows e Android aggiungono ai doppioni,
// senza accenti, punteggiatura e maiuscole.
export function nomeNudo(nome) {
  return String(nome || "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const estDelLibro = (b) => (b?.fileType || "epub").toLowerCase();

// UN LIBRO E UN FILE DI DRIVE SONO LA STESSA COSA, e si riconoscono in
// quattro modi, dal piu' sicuro al meno sicuro. Ognuno passa solo sui libri
// e sui file che i modi prima non hanno gia' preso, e un file non si da' a
// due libri.
//
//   1. IL SEGNO NOSTRO (`appProperties.bcId`): un file che l'app ha gia'
//      riconosciuto, su questo dispositivo o su un altro. E' la strada con
//      cui il secondo dispositivo trova quel che il primo ha deciso.
//   2. L'IMPRONTA DEI BYTE: Drive calcola lo SHA-256 di ogni file
//      (`sha256Checksum`) e l'app lo tiene sul libro da quando riconosce i
//      doppioni (`impronta`). Si calcola sui byte ORIGINALI, prima della
//      ricucitura — cioe' esattamente il file che il lettore ha caricato a
//      mano. Un'impronta a campioni («c:», i file oltre 256 MB) non e' uno
//      SHA-256 del file intero, e il prefisso la tiene fuori da se'.
//   3. LA MISURA, con la stessa estensione, se e' UNA sola: due file con la
//      stessa misura al byte non si incontrano per caso. Se sono di piu' si
//      sceglie per nome, e se il nome non decide si tace.
//   4. IL NOME uguale al titolo, una volta ridotti tutt'e due, e anche qui
//      solo se il candidato e' uno.
//
// NEL DUBBIO NON SI ABBINA: un libro non abbinato finisce su Drive una
// seconda volta (spazio sprecato, e si vede), uno abbinato male apre il
// romanzo sbagliato su tutti i dispositivi (e non se ne accorge nessuno).
export function abbina(libri, file, { misure } = {}) {
  const mappa = new Map();
  const daSegnare = [];
  let ambigui = 0;
  const vivi = (libri || []).filter((b) => b?.id);
  const perId = new Map(vivi.map((b) => [b.id, b]));
  const buoni = (file || []).filter((f) => f?.id && EST.includes(estensioneDi(f.name)));
  const usati = new Set();
  const prendi = (b, f, segna) => {
    mappa.set(b.id, f);
    usati.add(f.id);
    if (segna) daSegnare.push({ bookId: b.id, fileId: f.id });
  };
  const liberi = (b) =>
    buoni.filter((f) => !usati.has(f.id) && estensioneDi(f.name) === estDelLibro(b));

  for (const f of buoni) {
    const id = f.appProperties?.bcId;
    const b = id && perId.get(id);
    if (b && !mappa.has(b.id) && !usati.has(f.id)) prendi(b, f, false);
  }
  for (const b of vivi) {
    // un'impronta a campioni porta «c:» davanti, e cosi' non pareggia mai
    // con uno SHA-256 di Drive: non serve una guardia per tenerla fuori
    if (mappa.has(b.id) || !b.impronta) continue;
    const f = liberi(b).find((x) => x.sha256Checksum && x.sha256Checksum.toLowerCase() === b.impronta);
    if (f) prendi(b, f, true);
  }
  for (const b of vivi) {
    if (mappa.has(b.id)) continue;
    const misura = Number(misure?.get?.(b.id));
    if (!(misura > 0)) continue;
    const c = liberi(b).filter((f) => Number(f.size) === misura);
    const scelti = c.length > 1 ? c.filter((f) => nomeNudo(f.name) === nomeNudo(b.title)) : c;
    if (scelti.length === 1) prendi(b, scelti[0], true);
    else if (c.length > 1) ambigui += 1;
  }
  for (const b of vivi) {
    if (mappa.has(b.id)) continue;
    const titolo = nomeNudo(b.title);
    if (!titolo) continue;
    const c = liberi(b).filter((f) => nomeNudo(f.name) === titolo);
    if (c.length === 1) prendi(b, c[0], true);
    else if (c.length > 1) ambigui += 1;
  }
  return { mappa, daSegnare, ambigui };
}

// LE CARTELLE DEL LETTORE HANNO GIA' UN NOME, e i libri nuovi vanno li'.
export const CARTELLE = { libri: "Libri", fumetti: "Fumetti", manga: "Manga" };
export const cartellaDelTipo = (tipo) => CARTELLE[tipo] || CARTELLE.libri;

// Dove mettere un libro nuovo di un certo tipo: nella cartella in cui stanno
// gia' i suoi fratelli riconosciuti — e' quella che il lettore usa davvero,
// anche se di cartelle «Libri» su Drive ce ne fossero due — e se nessun
// fratello e' stato riconosciuto, nella prima cartella con quel nome.
// `null` vuol dire «non c'e': creala».
export function scegliCartella(tipo, { genitori = [], cartelle = [] } = {}) {
  const conta = new Map();
  for (const p of genitori) if (p) conta.set(p, (conta.get(p) || 0) + 1);
  let meglio = null;
  for (const [p, n] of conta) if (!meglio || n > meglio[1]) meglio = [p, n];
  if (meglio) return meglio[0];
  const nome = cartellaDelTipo(tipo);
  const c = (cartelle || []).find((x) => x?.name === nome);
  return c ? c.id : null;
}

// Il nome del file che l'app scrive su Drive: il titolo, senza i caratteri
// che Windows non accetta — il lettore quelle cartelle le apre anche dal PC.
export function nomeSuDrive(b) {
  const t = String(b?.title || "senza titolo")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
  return `${t || "senza titolo"}.${estDelLibro(b)}`;
}

// I LIBRI CHE SALGONO SU DRIVE: quelli che i byte ce li hanno QUI e che
// Drive non ha. E' la stessa regola che valeva per il secchio di Supabase
// — si decide sullo STATO, non su un registro — e per la stessa ragione:
// senza l'elenco di Drive non si manda niente, perche' al buio ogni libro
// sembrerebbe mancante e partirebbero tutti, doppioni compresi.
export function daCaricare(libri, { qui, lassu, inUscita } = {}) {
  if (!lassu) return [];
  const dentro = (s, id) => !!s && s.has(id);
  return (libri || []).filter((b) => {
    if (b?.fileTolto) return false;
    if (!b?.id || !dentro(qui, b.id) || dentro(inUscita, b.id)) return false;
    return !lassu.has(b.id);
  });
}

// IL SECCHIO DI SUPABASE SI SVUOTA, MA SOLO DI QUEL CHE STA SU DRIVE.
//
// Il lettore vuole Supabase libero, e i libri su Drive: un file nel secchio
// che Drive ha gia' e' spazio sprecato del piano gratuito e si toglie. Uno
// che Drive NON ha si toglie solo dopo averlo portato su Drive
// (`daTraslocare`): finche' non c'e' l'altra copia, quella del secchio e'
// l'unica che esiste fuori da questo dispositivo — a volte l'unica in
// assoluto.
export function daTogliereDalSecchio(idSecchio, idDrive) {
  if (!idSecchio || !idDrive) return [];
  return [...idSecchio].filter((id) => idDrive.has(id));
}

// I libri che stanno SOLO nel secchio: niente byte qui, niente copia su
// Drive. Si scaricano dal secchio e si mandano su Drive senza passare dal
// dispositivo — il tablet si voleva libero, non riempito di nuovo.
export function daTraslocare(libri, { secchio, drive, qui } = {}) {
  if (!secchio || !drive) return [];
  return (libri || []).filter(
    (b) => b?.id && !b.fileTolto && secchio.has(b.id) && !drive.has(b.id) && !(qui && qui.has(b.id))
  );
}

// QUANTO SPAZIO C'E' SU DRIVE, dalla risposta di `about.storageQuota`.
// Arriva in stringhe, e il limite puo' mancare (piani senza tetto): li'
// `liberi` e `limite` sono `null`, non zero — uno zero si leggerebbe «hai
// finito», che e' il rovescio di «non c'e' un tetto».
export function spazioDrive(q) {
  if (!q) return null;
  const n = (v) => (v === undefined || v === null || v === "" ? null : Number(v));
  const usati = n(q.usage);
  if (!Number.isFinite(usati)) return null;
  const limite = n(q.limit);
  const tetto = Number.isFinite(limite) && limite > 0 ? limite : null;
  return {
    usati,
    limite: tetto,
    liberi: tetto === null ? null : Math.max(0, tetto - usati),
    // Drive, Gmail e Foto stanno nello stesso piano: «in Drive» e' la parte
    // dei file, il resto e' posta e fotografie
    inDrive: Number.isFinite(n(q.usageInDrive)) ? n(q.usageInDrive) : null,
    cestino: Number.isFinite(n(q.usageInDriveTrash)) ? n(q.usageInDriveTrash) : null,
  };
}

// Quanto pesano, su Drive, i libri che l'app ci ha riconosciuto.
export function pesoDeiLibri(mappa) {
  let quanti = 0;
  let byte = 0;
  for (const v of Object.values(mappa || {})) {
    quanti += 1;
    byte += Number(v?.byte) || 0;
  }
  return { quanti, byte };
}

// IL PIANO DI DRIVE SPARTITO, come il gigabyte di Supabase: i libri
// dell'app, tutto il resto (gli altri file, la posta e le foto stanno nello
// stesso piano di Google), e quel che e' libero. I libri non possono
// superare l'usato — una mappa di ieri su un Drive svuotato oggi non deve
// disegnare una barra piu' lunga di se stessa — e senza un tetto la barra
// non c'e': le parti sono `null`.
export function spartisciDrive(spazio, byteLibri) {
  if (!spazio) return null;
  const libri = Math.max(0, Math.min(Number(byteLibri) || 0, spazio.usati));
  const altro = Math.max(0, spazio.usati - libri);
  if (!spazio.limite) return { libri, altro, liberi: null, parte: null };
  const parte = (n) => `${Math.max(0, Math.min(1, n / spazio.limite)) * 100}%`;
  return { libri, altro, liberi: spazio.liberi, parte };
}

// L'ID DEL CLIENT SI RIPULISCE E SI GUARDA PRIMA DI MANDARLO A GOOGLE.
// Incollato sul tablet arrivava con dentro qualcosa di storto, e Google
// rispondeva con una pagina in inglese, «Errore 401: invalid_client», che
// non dice cosa toccare. Spazi e a capo li mette la tastiera e si tolgono
// da se'; il resto si controlla sulla FORMA — numeri, un trattino, lettere e
// cifre, e la coda di Google — e se non torna lo si dice qui, in italiano.
export const ripulisciIdClient = (v) => String(v || "").replace(/\s+/g, "");
export const idClientValido = (v) => /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(ripulisciIdClient(v));
export const PERCHE_ID_STORTO =
  "L'ID client non ha la forma giusta: sono numeri, un trattino, lettere e cifre, e finisce con .apps.googleusercontent.com. Copialo col tasto accanto all'ID su Google Cloud invece di riscriverlo a mano.";

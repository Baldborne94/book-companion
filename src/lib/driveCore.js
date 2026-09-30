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

// I FILE DI DRIVE CHE NON SONO ANCORA LIBRI: quel che «Aggiungi da Drive»
// propone (chiesto dal lettore: portare i libri sul tablet «ci mette una
// vita», e lassu' ci sono gia'). Le regole di `abbina` al contrario, e
// sempre dal lato del silenzio — un file proposto per sbaglio diventa un
// DOPPIONE in biblioteca, con due punti di lettura e due scaffali di
// evidenziazioni, mentre uno taciuto si vede e si importa a mano:
//   - quel che `abbina` riconosce e' gia' un libro;
//   - un file col segno nostro e' il libro di QUALCUNO: se qui non c'e', e'
//     di un altro dispositivo e scendera' con la sincronizzazione — tranne
//     quando quel libro l'hai cancellato (lapide), e allora e' un file tuo
//     come un altro, e ripescarlo e' una scelta;
//   - la stessa impronta di un libro, o di un file gia' proposto (due copie
//     identiche su Drive fanno un libro solo);
//   - il nome uguale al titolo di un libro con la stessa estensione: e' il
//     caso che `abbina` lascia ambiguo, e ambiguo vuol dire «forse c'e' gia'».
// La cartella «Manga» e' un'organizzazione del lettore: un fumetto che sta
// li' entra gia' col tipo giusto.
// LA CARTELLA DEL LETTORE HA UN NOME: il selettore si apre li'
// (`idRadice`), e la cartella di un file si scrive come percorso da li'
// («Libri», «Fumetti / Hellboy»), che e' quel che dice se un fumetto sta
// fra i manga. Senza nessuna cartella con quel nome il percorso e' intero.
// (La lista «Da Google Drive» che partiva da qui e' stata TOLTA: resta il
// solo selettore, che sceglie anche le cartelle intere.)
export const RADICE = "book-companion";
const nomeRadice = (n) => String(n || "").trim().toLowerCase() === RADICE;

// il percorso di una cartella dalla cima: nomi dal piu' alto al piu' basso.
// Un giro chiuso (un genitore che porta a se stesso) si ferma invece di
// non finire mai.
export function percorsoDi(cartellaId, cartelle) {
  const per = new Map((cartelle || []).map((c) => [c.id, c]));
  const nomi = [];
  const visti = new Set();
  let c = per.get(cartellaId);
  while (c && !visti.has(c.id)) {
    visti.add(c.id);
    nomi.unshift(c.name || "");
    c = per.get(c.parents?.[0]);
  }
  return nomi;
}

// dove sta un file: il percorso sotto la radice se c'e', o quello intero
export function cartellaDi(parentId, cartelle) {
  const nomi = percorsoDi(parentId, cartelle);
  const i = nomi.findIndex(nomeRadice);
  return (i < 0 ? nomi : nomi.slice(i + 1)).join(" / ");
}

// UN SEGNO ORFANO NON FERMA PIU' IL FILE (segnalato: i libri di Anne
// McCaffrey scelti da Drive «già sullo scaffale», e sullo scaffale non
// c'erano). Il segno `bcId` su un file senza una scheda qui voleva dire «e'
// il libro di un altro dispositivo, arrivera' col cloud»: ma resta anche sul
// file di un libro CANCELLATO quando la chiave di Google era scaduta — il
// segno non si toglie (`smarcaSuDrive`) e la lapide se ne va al giro dopo —
// e da li' quel file non si poteva piu' aggiungere, per sempre. Adesso il
// segno di una scheda che qui non c'e' ferma il file solo finche' la
// biblioteca puo' ancora arrivare dal cloud (`schedeInArrivo`: un
// dispositivo che non ha mai sincronizzato). Dopo un giro, quello che
// doveva arrivare e' arrivato: il segno e' orfano, e il file si propone.
export function daAggiungere(libri, file, { lapidi = [], cartelle = [], schedeInArrivo = false } = {}) {
  const vivi = (libri || []).filter((b) => b?.id);
  const { mappa } = abbina(vivi, file);
  const presi = new Set([...mappa.values()].map((f) => f.id));
  const morti = new Set(lapidi || []);
  const impronte = new Set(vivi.map((b) => b.impronta).filter(Boolean));
  const titoli = new Set(vivi.map((b) => `${estDelLibro(b)}|${nomeNudo(b.title)}`));
  const visti = new Set();
  const fuori = [];
  for (const f of file || []) {
    const est = estensioneDi(f?.name);
    if (!f?.id || !EST.includes(est) || presi.has(f.id)) continue;
    const segno = f.appProperties?.bcId;
    if (segno && !morti.has(segno) && schedeInArrivo) continue;
    const sha = String(f.sha256Checksum || "").toLowerCase();
    if (sha && (impronte.has(sha) || visti.has(sha))) continue;
    if (titoli.has(`${est}|${nomeNudo(f.name)}`)) continue;
    if (sha) visti.add(sha);
    const cartella = cartellaDi(f.parents?.[0], cartelle);
    const manga = (est === "cbz" || est === "cbr") && /\bmanga\b/i.test(cartella);
    fuori.push({ id: f.id, name: f.name, size: Number(f.size) || 0, sha256Checksum: sha || null, cartella, ...(manga ? { tipo: "manga" } : {}) });
  }
  return fuori.sort(
    (a, b) =>
      a.cartella.localeCompare(b.cartella, "it") ||
      a.name.localeCompare(b.name, "it", { numeric: true })
  );
}

// LIBERARE IL TABLET SENZA PERDERE NIENTE (chiesto dal lettore: i romanzi
// finiti occupano il tablet, e stanno gia' su Drive). Si propongono i libri
// che hanno i byte QUI e una copia su Drive **identica al byte**, perche'
// dopo, quando lo riapri, il libro scende da li': segnalibri,
// evidenziazioni e punto di lettura sono CFI misurati su QUESTI byte, e un
// file diverso — tipicamente l'originale caricato a mano, mentre qui c'e'
// la versione ricucita — li riaprirebbe su righe che non avevi scelto.
// Quelli si contano a parte (`diversi`) e NON partono spuntati: stanno in
// un gruppo loro («diverso», col `motivo` accanto), e chi li sceglie lo fa
// davanti all'avviso. Erano semplicemente esclusi, e il lettore li ha visti
// restare fra i letti senza una strada per toglierli («diversi libri letti
// li ha tolti, su diversi no»): su un libro FINITO il segno che si sposta
// costa poco, e la scelta e' sua.
//
// Chi si propone, e perche': i LETTI, i LASCIATI, e i FERMI — nessun tocco
// da `FERMO_DA` (tre mesi), qualunque sia lo stato. `toccato` riceve il
// LIBRO e non l'id: un libro mai toccato dopo l'import non ha un'ora sua,
// e contato da zero sembrerebbe fermo da cinquant'anni — il libro appena
// entrato se ne andrebbe dal tablet prima di averlo aperto. Il libro che stai
// leggendo adesso non c'e' mai: e' quello che vuoi aprire in treno.
//
// `lassu` e' Drive guardato ADESSO (id del file → misura): al momento di
// togliere non basta la mappa dell'ultimo giro, perche' un file cancellato
// a mano da Drive nel frattempo lascerebbe il libro perduto. Senza `lassu`
// si risponde con la sola mappa, che va bene per contare, non per togliere.
export const FERMO_DA = 90 * 86_400_000;
export const PERCHE_LIBERARE = ["letto", "lasciato", "fermo", "altri", "diverso"];
// quelli che partono spuntati: il gruppo dei diversi si sceglie a mano
export const LIBERARE_DI_PARTENZA = ["letto", "lasciato", "fermo"];
export function daLiberare(libri, { misureQui, mappa, lassu = null, stato = () => "", toccato = () => 0, adesso = Date.now(), fermoDa = FERMO_DA } = {}) {
  const voci = [];
  let diversi = 0;
  for (const b of libri || []) {
    const qui = Number(misureQui?.get?.(b?.id));
    const f = mappa?.[b?.id];
    if (!b?.id || b.fileTolto || !(qui > 0) || !f?.id) continue;
    const su = lassu ? lassu.get(f.id) : Number(f.byte);
    if (!(Number(su) > 0)) continue;
    const s = stato(b.id);
    // E GLI ALTRI — da leggere, in lettura, appena entrati — sono un gruppo
    // anche loro, non spuntato: e' la situazione pulita chiesta dal lettore
    // («tutti i libri li tieni su Drive»), dove sul tablet resta solo quel
    // che ha scelto. Il libro che ha in mano non c'e' mai: si toglie dalla
    // Libreria, e li' il lettore e' chiuso.
    const perche =
      s === "read" ? "letto" : s === "abandoned" ? "lasciato" : adesso - (Number(toccato(b)) || 0) >= fermoDa ? "fermo" : "altri";
    if (Number(su) !== qui) {
      diversi += 1;
      voci.push({ id: b.id, title: b.title || "", byte: qui, perche: "diverso", motivo: perche });
      continue;
    }
    voci.push({ id: b.id, title: b.title || "", byte: qui, perche });
  }
  voci.sort((a, b) => b.byte - a.byte);
  return { voci, diversi };
}

// LEGGERE DA DRIVE SENZA SCARICARE (chiesto dal lettore: aprire un fumetto
// da un giga voleva dire aspettarlo intero). Un fumetto e' uno zip con una
// pagina per voce e un PDF si lascia leggere a intervalli, quindi di tutti
// e due si puo' chiedere solo la pagina che si guarda. Si fa solo sopra
// `LEGGI_DA_LONTANO`: un romanzo da pochi megabyte scende intero in un
// attimo e poi si legge anche in treno, che e' meglio.
// Fuori restano l'ePub, che epub.js vuole intero, e il CBR: la sua lettura
// a fette cammina di testata in testata per tutto l'archivio, cioe' da
// Drive una richiesta per pagina prima di mostrarne una.
export const LEGGI_DA_LONTANO = 20 * 1024 * 1024;
export function leggereDaLontano(book, voce, soglia = LEGGI_DA_LONTANO) {
  if (!voce?.id || !(Number(voce.byte) > soglia)) return false;
  return book?.fileType === "cbz" || book?.fileType === "pdf";
}

// LE CARTELLE DEL LETTORE HANNO GIA' UN NOME, e i libri nuovi vanno li'.
export const CARTELLE = { libri: "Libri", fumetti: "Fumetti", manga: "Manga", musica: "Musica" };
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

// E GLI AVANZI SE NE VANNO ANCHE SENZA DRIVE: un file nel secchio che non
// appartiene a nessun libro vivo non ha niente da aspettare. Sono i libri
// cancellati quando lo sgombero e' andato storto — la lapide si toglie
// comunque, e da li' nessuno guardava piu' quel file — e gli ebook tolti
// dalla scheda (`fileTolto`), dove il lettore ha gia' detto che il file non
// lo vuole. `daTogliereDalSecchio` non li vede mai, perche' su Drive non ci
// vanno, e restavano a pesare sul piano gratuito per sempre (segnalato:
// «come mai dice che ci sono ancora 5 libri su supabase», a giro finito).
//
// VIVO e' chi c'e' qui O lassu' nella tabella: un libro importato
// sull'altro dispositivo e non ancora sceso e' vivo anche se qui non c'e'.
// E senza nessun vivo non si toglie niente: una biblioteca che risulta
// vuota da tutt'e due i lati e' piu' spesso una lettura andata storta che
// una biblioteca vuota, e nel dubbio il file resta.
export function avanziDelSecchio(idSecchio, { libri = [], righe = [], lapidi = [], inUscita = [] } = {}) {
  if (!idSecchio) return [];
  const morti = new Set([...(lapidi || []), ...(inUscita || [])]);
  const vivi = new Set();
  for (const b of libri || []) if (b?.id && !b.fileTolto && !morti.has(b.id)) vivi.add(b.id);
  for (const r of righe || []) if (r?.id && !r.deleted && !r.file_tolto && !morti.has(r.id)) vivi.add(r.id);
  const tolti = new Set([
    ...(libri || []).filter((b) => b?.fileTolto).map((b) => b.id),
    ...(righe || []).filter((r) => r?.file_tolto && !r.deleted).map((r) => r.id),
  ]);
  if (!vivi.size && !tolti.size) return [];
  return [...idSecchio].filter((id) => !vivi.has(id));
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

// E LA MUSICA SALE SU DRIVE COME I LIBRI, E SCENDE QUANDO LA SUONI.
//
// I file audio non viaggiavano: il secchio di Supabase era un gigabyte, e
// un brano da tenere a schermo spento pesa quanto dieci romanzi (deciso dal
// lettore, allora: «ogni dispositivo ha i suoi file»). Con Drive lo spazio
// non manca piu', e il lettore ha chiesto di portarceli: salgono nella
// cartella «Musica», e sull'altro dispositivo si scaricano solo quando li
// suoni — scaricarli tutti subito riempirebbe il tablet di brani che forse
// non ascolterai mai li'.
//
// La chiave di una melodia su Drive e' il suo `trackId`, cioe' i BYTE: la
// voce dell'elenco si puo' rinominare, i byte sono quelli.
export const melodieFile = (favs) =>
  (favs || []).filter((f) => f?.trackId && !f.deleted);

// RICONOSCERE PRIMA DI MANDARE, come per i libri: chi i brani li ha gia'
// messi su Drive a mano non deve ritrovarseli doppi. Tre modi, dal piu'
// sicuro: il segno nostro (`appProperties.bcTrack`), la MISURA al byte se
// e' di un file solo (se sono di piu' decide il nome), e il NOME se e' di
// uno solo. Nel dubbio non si abbina: un brano caricato due volte si vede,
// uno abbinato male suona la canzone sbagliata.
export function abbinaMelodie(melodie, file) {
  const mappa = new Map();
  const daSegnare = [];
  let ambigui = 0;
  const vive = (melodie || []).filter((m) => m?.trackId);
  const perTrack = new Map(vive.map((m) => [m.trackId, m]));
  const buoni = (file || []).filter((f) => f?.id);
  const usati = new Set();
  const prendi = (m, f, segna) => {
    mappa.set(m.trackId, f);
    usati.add(f.id);
    if (segna) daSegnare.push({ trackId: m.trackId, fileId: f.id });
  };
  const liberi = () => buoni.filter((f) => !usati.has(f.id));

  for (const f of buoni) {
    const m = perTrack.get(f.appProperties?.bcTrack);
    if (m && !mappa.has(m.trackId) && !usati.has(f.id)) prendi(m, f, false);
  }
  for (const m of vive) {
    if (mappa.has(m.trackId) || !(Number(m.size) > 0)) continue;
    const c = liberi().filter((f) => Number(f.size) === Number(m.size));
    const scelti = c.length > 1 ? c.filter((f) => nomeNudo(f.name) === nomeNudo(m.name)) : c;
    if (scelti.length === 1) prendi(m, scelti[0], true);
    else if (c.length > 1) ambigui += 1;
  }
  for (const m of vive) {
    if (mappa.has(m.trackId)) continue;
    const nome = nomeNudo(m.name);
    if (!nome) continue;
    const c = liberi().filter((f) => nomeNudo(f.name) === nome);
    if (c.length === 1) prendi(m, c[0], true);
    else if (c.length > 1) ambigui += 1;
  }
  return { mappa, daSegnare, ambigui };
}

// Salgono le melodie che hanno i byte QUI e che Drive non ha. Al buio —
// senza l'elenco di Drive — non sale niente, per la stessa ragione dei libri.
export function melodieDaCaricare(melodie, { qui, lassu } = {}) {
  if (!lassu) return [];
  return melodieFile(melodie).filter((m) => !!qui && qui.has(m.trackId) && !lassu.has(m.trackId));
}

const EST_MIME = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/webm": "webm",
};
// Il nome del file su Drive: il nome della melodia piu' l'estensione del suo
// tipo, perche' il lettore la cartella la apre anche dal PC
export function nomeMelodiaSuDrive(m) {
  const t = String(m?.name || "Melodia senza nome")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
  return `${t || "Melodia senza nome"}.${EST_MIME[String(m?.mime || "").toLowerCase()] || "mp3"}`;
}

// UNA MELODIA SU DRIVE SI DICE SULLA SUA VOCE (`drive: true`), ed e' quel
// segno che la fa viaggiare nelle preferenze: una voce che l'altro
// dispositivo non potrebbe suonare resta dov'e' nata, come prima — era
// proprio il rumore che il lettore non voleva vedere. Anche le lapidi si
// segnano: la cancellazione di un brano che viaggiava deve arrivare di la'.
// Il timbro si rinnova, o la fusione per ora terrebbe la voce vecchia.
export function segnaSuDrive(favs, suDrive, adesso = Date.now()) {
  let cambiate = 0;
  const lista = (favs || []).map((f) => {
    if (!f?.trackId || f.drive || !suDrive?.has(f.trackId)) return f;
    cambiate += 1;
    return { ...f, drive: true, updatedAt: adesso };
  });
  return { lista, cambiate };
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

// IL SELETTORE DI GOOGLE (chiesto dal lettore: «non puoi mettermi
// direttamente un collegamento al Drive, invece di scrivermi tutto tu, e da
// li' mi fai fare l'import?»). Il Picker di Google e' la finestra di Drive
// stessa, aperta dentro l'app: si sfoglia la cartella «book-companion» come
// su Drive e si toccano i file che si vogliono. Vuole una CHIAVE API oltre
// all'ID del client — un'altra voce da creare su Google Cloud, non un
// segreto: sta scritta in chiaro nella pagina di ogni sito che usa il
// selettore. Quel che il selettore restituisce sono documenti con id, nome
// e misura; qui si tengono i soli file che sono un libro (il selettore non
// sa filtrare per estensione: il tipo MIME di un CBZ caricato a mano e'
// quel che il sistema del lettore gli ha dato) e si dicono per nome gli
// altri, o un file toccato che non entra sparirebbe in silenzio.
export const ripulisciChiaveApi = (v) => String(v || "").replace(/\s+/g, "");
export const chiaveApiValida = (v) => /^AIza[0-9A-Za-z_-]{30,}$/.test(ripulisciChiaveApi(v));
export const PERCHE_CHIAVE_STORTA =
  "La chiave API non ha la forma giusta: comincia con «AIza» ed e' una riga sola di lettere, cifre, trattini e trattini bassi. Copiala col tasto accanto alla chiave su Google Cloud invece di riscriverla a mano.";

// E UNA CARTELLA SI SCEGLIE INTERA (chiesto dal lettore: «tieni solo
// Scegli su Drive e permettimi di scegliere o un'intera cartella o piu'
// elementi assieme»). Il selettore torna cartelle e file mescolati: le
// cartelle si dicono a parte (`cartelle`), perche' quel che contengono il
// selettore non lo dice — si chiede a Drive dopo (`libriSotto`).
const CARTELLA_MIME = "application/vnd.google-apps.folder";
export const eCartella = (d) => d?.mimeType === CARTELLA_MIME || d?.type === "folder";

export function sceltaDalPicker(docs) {
  const sciolti = [];
  const cartelle = [];
  const scartati = [];
  const visti = new Set();
  for (const d of docs || []) {
    if (!d?.id || visti.has(d.id)) continue;
    visti.add(d.id);
    if (eCartella(d)) {
      cartelle.push({ id: d.id, name: String(d.name || "") });
      continue;
    }
    if (!EST.includes(estensioneDi(d.name))) {
      scartati.push(String(d.name || d.id));
      continue;
    }
    sciolti.push({ id: d.id, name: String(d.name || ""), size: Number(d.sizeBytes ?? d.size) || 0 });
  }
  return { sciolti, cartelle, scartati };
}

// i libri che stanno SOTTO le cartelle scelte, a qualunque profondita':
// «Fumetti» scelta intera porta dentro anche «Fumetti / Hellboy». Si risale
// da ogni genitore del file (un file di Drive puo' averne piu' d'uno) fino in
// cima, e un giro chiuso fra cartelle si ferma invece di non finire mai. Una
// cartella senza nessun libro sotto si dice per nome (`vuote`): scelta col
// dito e sparita in silenzio sarebbe il difetto peggiore di questa porta.
export function libriSotto(scelte, file, cartelle) {
  return sottoLeCartelle(scelte, file, cartelle, (f) => EST.includes(estensioneDi(f.name)));
}

function sottoLeCartelle(scelte, file, cartelle, tiene) {
  const ids = new Set((scelte || []).map((c) => c.id));
  const genitore = new Map((cartelle || []).map((c) => [c.id, c.parents?.[0]]));
  const trovate = new Set();
  const sotto = [];
  for (const f of file || []) {
    if (!f?.id || !tiene(f)) continue;
    // si risale fino in cima anche dopo aver trovato una scelta: con
    // «Fumetti» e «Fumetti / Hellboy» scelte insieme, i libri di Hellboy
    // sono anche di Fumetti, e Fumetti non e' una cartella vuota
    const prese = new Set();
    for (const p of f.parents || []) {
      const visti = new Set();
      for (let c = p; c && !visti.has(c); c = genitore.get(c)) {
        visti.add(c);
        if (ids.has(c)) prese.add(c);
      }
    }
    if (!prese.size) continue;
    for (const c of prese) trovate.add(c);
    sotto.push(f);
  }
  return { file: sotto, vuote: (scelte || []).filter((c) => !trovate.has(c.id)).map((c) => c.name || c.id) };
}

// E LA MUSICA SI PRENDE DA DRIVE COME I LIBRI (chiesto dal lettore: «mi
// metti che posso recuperare la musica da Drive come hai fatto per i libri,
// puntando sempre alla cartella book companion?»). Stesso selettore, aperto
// sulla cartella «Musica» di «book-companion»; file e cartelle intere. Un
// brano scelto NON scende: diventa una melodia che sta su Drive, e scende
// quando la suoni (`melodiaDalDrive`), come i brani saliti dall'altro
// dispositivo. Audio si dice dal tipo, e se il tipo manca dall'estensione:
// un file caricato a mano dal PC puo' non averlo.
const EST_AUDIO = ["mp3", "m4a", "aac", "ogg", "oga", "opus", "flac", "wav", "webm"];
export const eAudio = (d) => String(d?.mimeType || "").startsWith("audio/") || EST_AUDIO.includes(estensioneDi(d?.name));

export function sceltaMusicaDalPicker(docs) {
  const sciolti = [];
  const cartelle = [];
  const scartati = [];
  const visti = new Set();
  for (const d of docs || []) {
    if (!d?.id || visti.has(d.id)) continue;
    visti.add(d.id);
    if (eCartella(d)) cartelle.push({ id: d.id, name: String(d.name || "") });
    else if (eAudio(d)) sciolti.push({ id: d.id, name: String(d.name || "") });
    else scartati.push(String(d.name || d.id));
  }
  return { sciolti, cartelle, scartati };
}

export const audioSotto = (scelte, file, cartelle) => sottoLeCartelle(scelte, file, cartelle, eAudio);

// Le melodie nuove per i file scelti. Un file che e' gia' una melodia non
// si raddoppia: il segno nostro (`bcTrack` di una melodia viva), o la stessa
// misura col nome uguale. Il nome della melodia e' quello del file senza
// estensione; `drive: true` la fa viaggiare nelle preferenze fino all'altro
// dispositivo, che la suona scaricandola da Drive.
export function melodieDaAggiungere(favs, trovati, { nuovoId = () => crypto.randomUUID(), adesso = Date.now() } = {}) {
  const vive = melodieFile(favs);
  const tracce = new Set(vive.map((m) => m.trackId));
  const gia = new Set(vive.map((m) => `${Number(m.size) || 0}|${nomeNudo(m.name)}`));
  const out = [];
  for (const f of trovati || []) {
    if (!f?.id || !eAudio(f)) continue;
    if (tracce.has(f.appProperties?.bcTrack)) continue;
    const size = Number(f.size) || 0;
    const chiave = `${size}|${nomeNudo(f.name)}`;
    if (size && gia.has(chiave)) continue;
    gia.add(chiave);
    const nome = String(f.name || "").replace(/\.[a-z0-9]{2,5}$/i, "").trim() || "Melodia senza nome";
    out.push({
      fileId: f.id,
      voce: { id: nuovoId(), name: nome, trackId: nuovoId(), mime: f.mimeType || "", size, drive: true, addedAt: adesso, updatedAt: adesso },
    });
  }
  return out;
}

// la cartella da cui il selettore parte: la radice se c'e', o niente (e
// allora si apre su tutto il Drive)
export const idRadice = (cartelle) => (cartelle || []).find((c) => nomeRadice(c?.name))?.id || null;

// QUANTO PESA «PORTA QUI». Da quando i libri si aggiungono da Drive senza
// scendere, un tomo lassu' e' lo stato normale e non un lavoro che aspetta:
// il tasto serve a chi vuole leggerli senza rete, e chi lo tocca deve sapere
// PRIMA quanta connessione e quanto tablet ci vogliono. La misura la dice la
// mappa di Drive; un tomo che sta solo nel secchio non ha misura qui, e
// allora il conto dice «almeno» (`tutti` falso) invece di fingere un totale.
export function pesoDaScendere(libri, mappa) {
  let byte = 0;
  let noti = 0;
  for (const b of libri || []) {
    const n = Number(mappa?.[b?.id]?.byte);
    if (n > 0) {
      byte += n;
      noti += 1;
    }
  }
  return { byte, tutti: noti === (libri || []).length };
}

// «SCHEDA SENZA EBOOK» HA SENSO SOLO SE IL FILE NON STA DA NESSUNA PARTE
// (chiesto dal lettore: «ad alcuni libri si vede solo la scheda e non c'e'
// l'ebook, non ha molto senso adesso che puntiamo direttamente al Drive»).
// Il segno `fileTolto` e' nato col secchio, dove «togli l'ebook» buttava i
// byte di qui e di lassu': il file spariva davvero. Con Drive il file e'
// l'archivio del lettore, si legge da li' e si riconosce a ogni giro
// (`abbina`): un libro col segno addosso e il suo file nella mappa e' una
// scheda che dice «non c'e'» sopra un file che c'e'. Qui si dice quali sono;
// chi chiama spegne il segno e timbra il libro, cosi' la scelta viaggia.
export function ebookRitrovati(libri, mappa) {
  return (libri || []).filter((b) => b?.id && b.fileTolto && mappa?.[b.id]?.id).map((b) => b.id);
}

// L'ELENCO DI DRIVE SI TIENE, E SI CHIEDONO SOLO I CAMBIAMENTI (chiesto dal
// lettore fra le cose da rendere piu' veloci: «fai tutti e 4 i punti»).
//
// Ogni giro elencava da capo TUTTO il Drive — i file, poi le cartelle, poi
// l'audio: con cinquecento libri sono piu' pagine per ognuna delle tre
// domande, a ogni sincronizzazione, per scoprire quasi sempre che non era
// cambiato niente. Google tiene per ogni utente un registro dei cambiamenti
// (`changes`) con un segno a cui si torna: l'elenco si fa per intero la prima
// volta e si tiene su questo dispositivo, e da li' in poi si chiede a Google
// solo quel che e' successo dall'ultimo segno.
//
// Qui le decisioni pure; la rete sta in `drive.js`.

// i campi che le tre domande guardavano, piu' quel che serve a distinguerle
export const CAMPI_ELENCO = "id,name,size,sha256Checksum,appProperties,parents,mimeType";

// Si tiene quel che le tre domande di prima prendevano, e nient'altro: le
// cartelle, i file audio (per tipo) e i file con un'estensione (per nome).
// Un file cestinato non si tiene: le domande di prima chiedevano
// `trashed=false`.
export function daTenereNellElenco(f) {
  if (!f?.id || f.trashed) return false;
  if (f.mimeType === CARTELLA_MIME) return true;
  if (String(f.mimeType || "").startsWith("audio/")) return true;
  return !!estensioneDi(f.name);
}

// i cambiamenti sull'elenco tenuto, senza toccare quello che arriva:
// un file tolto, cestinato o diventato irrilevante se ne va; uno nuovo o
// cambiato prende il posto di quello di prima
export function applicaCambiamenti(elenco, cambiamenti) {
  const out = { ...(elenco || {}) };
  for (const c of cambiamenti || []) {
    const id = c?.fileId || c?.file?.id;
    if (!id) continue; // un cambiamento di un'unita' condivisa, non di un file
    // un file tolto dal registro arriva SENZA il file, quindi non si tiene:
    // `removed` non ha bisogno di una riga sua
    if (!daTenereNellElenco(c.file)) delete out[id];
    else {
      const { trashed, ...f } = c.file;
      out[id] = f;
    }
  }
  return out;
}

// Una volta a settimana l'elenco si rifa' comunque da capo: il registro dei
// cambiamenti e' la strada veloce, non la verita', e una settimana di
// cambiamenti persi per strada (un giro interrotto a meta', un'altra app che
// ha rimesso a posto le cose) si ricuce da se'.
export const RIFAI_ELENCO = 7 * 24 * 60 * 60 * 1000;
export const VERSIONE_ELENCO = 1;

export function elencoBuono(salvato, ora = Date.now()) {
  return (
    !!salvato &&
    salvato.v === VERSIONE_ELENCO &&
    typeof salvato.segno === "string" &&
    !!salvato.segno &&
    !!salvato.file &&
    typeof salvato.file === "object" &&
    Number.isFinite(salvato.quando) &&
    ora - salvato.quando >= 0 &&
    ora - salvato.quando < RIFAI_ELENCO
  );
}

// un segno che Google non riconosce piu' (troppo vecchio, di un altro
// account) risponde cosi': si rifa' l'elenco da capo invece di fermare il giro
export const segnoScaduto = (e) => [400, 403, 404, 410].includes(e?.status);

// le tre domande di prima, sull'elenco tenuto
export const fileDellElenco = (tutti) =>
  tutti.filter((f) => f.mimeType !== CARTELLA_MIME && estensioneDi(f.name));
export const cartelleDellElenco = (tutti) => tutti.filter((f) => f.mimeType === CARTELLA_MIME);
export const audioDellElenco = (tutti) => tutti.filter((f) => String(f.mimeType || "").startsWith("audio/"));

// L'ARCHIVIO DELLE SCHEDE SU DRIVE (chiesto dal lettore: un archivio che si
// fa da solo). I file dei libri e delle melodie stanno gia' su Drive; quel che
// viveva solo nel browser e su Supabase — schede, saghe, punto di lettura,
// segni, evidenziazioni, raccolte, glossari, diario — scende in un piccolo zip
// nella cartella «Archivi» di «book-companion», una volta al giorno, e se ne
// tengono gli ultimi `TIENI_ARCHIVI`. E' lo stesso zip dell'«Esporta» senza i
// byte: si ripristina dalla strada di sempre.
export const ARCHIVI = "Archivi";
export const TIENI_ARCHIVI = 10;
export const OGNI_ARCHIVIO = 86_400_000;

// un orologio tornato indietro (un «ultimo» nel futuro) non ferma gli
// archivi per sempre
export function archivioDovuto({ ultimo = 0, ora = Date.now(), roba = 0 } = {}) {
  if (!roba) return false;
  const passato = ora - (Number(ultimo) || 0);
  return !(passato >= 0 && passato < OGNI_ARCHIVIO);
}

const quandoDi = (a) => Date.parse(a?.createdTime || "") || 0;
export const piuRecenti = (archivi) => [...(archivi || [])].filter((a) => a?.id).sort((a, b) => quandoDi(b) - quandoDi(a));
export const archiviDaTogliere = (archivi, tieni = TIENI_ARCHIVI) => piuRecenti(archivi).slice(tieni);

export function nomeArchivio(ora = Date.now()) {
  const d = new Date(ora);
  const due = (n) => String(n).padStart(2, "0");
  return `book-companion-schede-${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}.zip`;
}

// la cartella «Archivi» dentro la radice; `null` = da creare
export function cartellaArchivi(cartelle) {
  const radice = idRadice(cartelle);
  return (cartelle || []).find((c) => c?.name === ARCHIVI && c.parents?.[0] === radice)?.id || null;
}

// A CHE PUNTO E' LA DISCESA (chiesto dal lettore: «come mai ci mette cosi'
// tanto ad aprire i file?», davanti a un omnibus CBR fermo su «Apro il
// tomo…»). Un libro che scende intero da Drive puo' pesare un giga, e la
// candela muta non diceva niente. Megabyte interi, e la misura totale se si
// sa; sotto il mega si dice «meno di un MB» invece di uno zero.
const MB = 1024 * 1024;
export function fraseDiscesa({ presi = 0, totale = 0 } = {}, apertura = "Scende da Google Drive:") {
  const mb = (n) => (n < MB ? "meno di un MB" : `${Math.floor(n / MB)} MB`);
  if (totale > 0) return `${apertura} ${Math.floor(presi / MB)} di ${Math.max(1, Math.round(totale / MB))} MB`;
  return `${apertura} ${mb(presi)}`;
}
// lo stesso sul tasto «Tieni sul tablet» (segnalato: «come mai ci mette una
// vita a scaricarmi in locale?», davanti a un «Scarico…» muto)
export const fraseScarico = (p) => (p ? fraseDiscesa(p, "Scarico…") : "Scarico…");

// ogni quanto dirlo: a ogni mega, o in fondo — a ogni pezzo della rete
// sarebbero migliaia di disegni per un file grosso
export const vaDetto = (prima, adesso, totale) => adesso >= totale || Math.floor(adesso / MB) > Math.floor(prima / MB);

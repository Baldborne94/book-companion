// UNO ZIP LETTO A FETTE.
//
// Un CBZ e' uno zip, e JSZip per aprirne uno vuole tutto il file in
// memoria — e poi se ne fa una copia sua. Su un Hellboy da piu' di un giga
// sono due o tre giga, e la scheda del tablet si arrende prima (segnalato
// dal lettore: «il volume 3 di hellboy e' piu' di un gb e non riesco a
// caricarlo»). Ma uno zip e' fatto apposta per non doverlo leggere tutto:
// l'indice sta in FONDO (la directory centrale), dice dove comincia ogni
// file, e ogni file si legge da solo. Qui si legge l'indice con una fetta
// e poi solo la pagina che serve: in memoria sta una pagina alla volta.
//
// Si lavora su un Blob (un File scelto, o il Blob che torna da IndexedDB):
// `slice` non copia niente finche' non si chiede `arrayBuffer`, e un Blob
// di IndexedDB sta sul disco. I metodi sono i due che un CBZ usa davvero —
// memorizzato (0) e deflate (8) — e il deflate lo scioglie il browser
// (`DecompressionStream`), senza librerie.

const EOCD = 0x06054b50;
const ZIP64_LOCATORE = 0x07064b50;
const ZIP64_EOCD = 0x06064b50;
const CENTRALE = 0x02014b50;
const LOCALE = 0x04034b50;
// la coda dello zip: 22 byte di chiusura piu' un commento fino a 64 KB
const CODA = 22 + 0xffff;
const PIENO32 = 0xffffffff;

const fetta = async (blob, da, a) => new DataView(await blob.slice(da, a).arrayBuffer());
// un numero a 64 bit: sotto i 2^53 e' esatto, e nessun file ci arriva
const u64 = (dv, o) => dv.getUint32(o, true) + dv.getUint32(o + 4, true) * 2 ** 32;

const utf8 = new TextDecoder("utf-8");
const latino = new TextDecoder("latin1");

async function chiusura(blob) {
  const da = Math.max(0, blob.size - CODA);
  const dv = await fetta(blob, da, blob.size);
  // si cerca dal fondo: un commento puo' contenere per caso la firma
  for (let i = dv.byteLength - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) !== EOCD) continue;
    let voci = dv.getUint16(i + 10, true);
    let lunghezza = dv.getUint32(i + 12, true);
    let inizio = dv.getUint32(i + 16, true);
    // ZIP64: oltre i 4 GB (o le 65535 voci) i campi valgono «tutti uno» e
    // i numeri veri stanno in un record a parte, indicato dal localizzatore
    // che sta subito prima della chiusura
    if (voci === 0xffff || lunghezza === PIENO32 || inizio === PIENO32) {
      const pos = da + i - 20;
      if (pos < 0) throw new Error("zip64 senza localizzatore");
      const loc = await fetta(blob, pos, pos + 20);
      if (loc.getUint32(0, true) !== ZIP64_LOCATORE) throw new Error("zip64 senza localizzatore");
      const dove = u64(loc, 8);
      const rec = await fetta(blob, dove, dove + 56);
      if (rec.getUint32(0, true) !== ZIP64_EOCD) throw new Error("zip64 illeggibile");
      voci = u64(rec, 32);
      lunghezza = u64(rec, 40);
      inizio = u64(rec, 48);
    }
    return { voci, lunghezza, inizio };
  }
  throw new Error("non e' uno zip");
}

// I campi a «tutti uno» della directory centrale si leggono dal campo
// extra 0x0001, nell'ordine fisso: misura vera, misura compressa, posizione
// — ma SOLO quelli che valevano «tutti uno», gli altri non ci sono.
function zip64Extra(dv, da, lung, voce) {
  let o = da;
  const fine = da + lung;
  while (o + 4 <= fine) {
    const id = dv.getUint16(o, true);
    const n = dv.getUint16(o + 2, true);
    if (id === 0x0001) {
      let p = o + 4;
      if (voce.misura === PIENO32) (voce.misura = u64(dv, p)), (p += 8);
      if (voce.compressa === PIENO32) (voce.compressa = u64(dv, p)), (p += 8);
      if (voce.posizione === PIENO32) voce.posizione = u64(dv, p);
      return;
    }
    o += 4 + n;
  }
}

export async function voci(blob) {
  const { voci: quante, lunghezza, inizio } = await chiusura(blob);
  const dv = await fetta(blob, inizio, inizio + lunghezza);
  const elenco = [];
  let o = 0;
  for (let k = 0; k < quante && o + 46 <= dv.byteLength; k++) {
    if (dv.getUint32(o, true) !== CENTRALE) throw new Error("indice dello zip rotto");
    const flag = dv.getUint16(o + 8, true);
    const lnome = dv.getUint16(o + 28, true);
    const lextra = dv.getUint16(o + 30, true);
    const lcommento = dv.getUint16(o + 32, true);
    const byteNome = new Uint8Array(dv.buffer, dv.byteOffset + o + 46, lnome);
    // il bit 11 dice UTF-8; senza, i nomi sono nella codifica del DOS, che
    // per le lettere semplici coincide — e i nomi delle pagine sono quasi
    // sempre cifre e lettere semplici
    const nome = (flag & 0x800 ? utf8 : latino).decode(byteNome);
    const voce = {
      nome,
      metodo: dv.getUint16(o + 10, true),
      cifrato: !!(flag & 1),
      compressa: dv.getUint32(o + 20, true),
      misura: dv.getUint32(o + 24, true),
      posizione: dv.getUint32(o + 42, true),
    };
    zip64Extra(dv, o + 46 + lnome, lextra, voce);
    voce.dir = nome.endsWith("/");
    elenco.push(voce);
    o += 46 + lnome + lextra + lcommento;
  }
  return elenco;
}

async function sciogli(blob) {
  const flusso = blob.stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(flusso).arrayBuffer());
}

// I byte di UNA voce. La testata locale si rilegge perche' il suo campo
// extra puo' essere lungo diversamente da quello della directory centrale:
// fidarsi del secondo sposterebbe l'inizio dei dati di qualche byte, e la
// pagina uscirebbe rotta senza un errore che lo dica.
async function datiDi(blob, voce) {
  if (voce.cifrato) throw new Error(`pagina cifrata: ${voce.nome}`);
  const t = await fetta(blob, voce.posizione, voce.posizione + 30);
  if (t.getUint32(0, true) !== LOCALE) throw new Error(`testata rotta: ${voce.nome}`);
  const inizio = voce.posizione + 30 + t.getUint16(26, true) + t.getUint16(28, true);
  if (voce.metodo !== 0 && voce.metodo !== 8) throw new Error(`compressione non supportata (${voce.metodo}): ${voce.nome}`);
  return blob.slice(inizio, inizio + voce.compressa);
}

export async function leggiVoce(blob, voce) {
  const dati = await datiDi(blob, voce);
  if (voce.metodo === 0) return new Uint8Array(await dati.arrayBuffer());
  return sciogli(dati);
}

// La voce come Blob. Memorizzata e' una FETTA dell'archivio e non costa
// niente: un libro da un giga dentro un vecchio archivio passa in
// IndexedDB senza entrare nella memoria della pagina. Compressa va sciolta.
export async function blobVoce(blob, voce) {
  const dati = await datiDi(blob, voce);
  if (voce.metodo === 0) return dati;
  return new Blob([await sciogli(dati)]);
}

// L'archivio aperto, con la stessa forma che `apriArchivio` si aspetta:
// l'elenco dei nomi e il modo di leggerne uno.
export async function apriZip(blob) {
  const elenco = await voci(blob);
  const perNome = new Map(elenco.filter((v) => !v.dir).map((v) => [v.nome, v]));
  return {
    nomi: [...perNome.keys()],
    leggi: (nome) => {
      const v = perNome.get(nome);
      if (!v) return Promise.reject(new Error(`voce assente: ${nome}`));
      return leggiVoce(blob, v);
    },
    blob: (nome) => {
      const v = perNome.get(nome);
      if (!v) return Promise.reject(new Error(`voce assente: ${nome}`));
      return blobVoce(blob, v);
    },
  };
}

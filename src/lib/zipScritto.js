// UNO ZIP SCRITTO UNA VOCE ALLA VOLTA, senza compressione (le pagine di un
// fumetto sono JPG e PNG, gia' compresse per conto loro): serve a
// `rarInCbz.js`, che converte un CBR pagina per pagina e non deve mai
// tenere in mano il volume intero. Ogni voce diventa subito un pezzo di un
// Blob (che il browser puo' tenere sul disco), e in memoria resta solo la
// directory centrale. Senza ZIP64: oltre i 4 GB si dice, non si scrive uno
// zip rotto.

const TABELLA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(pezzi) {
  let c = 0xffffffff;
  for (const b of pezzi) for (let i = 0; i < b.length; i++) c = TABELLA[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const TETTO = 0xffffffff;
export const PERCHE_ZIP_ENORME = "il volume supera i 4 GB, troppo per uno zip semplice";

export function nuovoZip({ tipo = "application/zip" } = {}) {
  const parti = [];
  const centrale = [];
  let posto = 0;
  let voci = 0;
  return {
    // `pezzi`: i byte della voce, in uno o piu' Uint8Array
    aggiungi(nome, pezzi) {
      const dati = Array.isArray(pezzi) ? pezzi : [pezzi];
      const misura = dati.reduce((s, b) => s + b.length, 0);
      const n = new TextEncoder().encode(nome);
      if (posto + 30 + n.length + misura > TETTO) throw new Error(PERCHE_ZIP_ENORME);
      const crc = crc32(dati);
      const testa = new DataView(new ArrayBuffer(30));
      testa.setUint32(0, 0x04034b50, true);
      testa.setUint16(4, 20, true);
      // bit 11: il nome e' UTF-8
      testa.setUint16(6, 0x0800, true);
      testa.setUint16(8, 0, true);
      testa.setUint32(14, crc, true);
      testa.setUint32(18, misura, true);
      testa.setUint32(22, misura, true);
      testa.setUint16(26, n.length, true);
      parti.push(new Blob([testa.buffer, n, ...dati]));
      centrale.push({ n, crc, misura, posto });
      posto += 30 + n.length + misura;
      voci += 1;
    },
    get voci() {
      return voci;
    },
    chiudi() {
      const inizio = posto;
      const righe = centrale.map(({ n, crc, misura, posto: p }) => {
        const r = new DataView(new ArrayBuffer(46));
        r.setUint32(0, 0x02014b50, true);
        r.setUint16(4, 20, true);
        r.setUint16(6, 20, true);
        r.setUint16(8, 0x0800, true);
        r.setUint32(16, crc, true);
        r.setUint32(20, misura, true);
        r.setUint32(24, misura, true);
        r.setUint16(28, n.length, true);
        r.setUint32(42, p, true);
        return new Blob([r.buffer, n]);
      });
      const lunga = centrale.reduce((s, { n }) => s + 46 + n.length, 0);
      if (inizio + lunga > TETTO || centrale.length > 0xffff) throw new Error(PERCHE_ZIP_ENORME);
      const fine = new DataView(new ArrayBuffer(22));
      fine.setUint32(0, 0x06054b50, true);
      fine.setUint16(8, centrale.length, true);
      fine.setUint16(10, centrale.length, true);
      fine.setUint32(12, lunga, true);
      fine.setUint32(16, inizio, true);
      return new Blob([...parti, ...righe, fine.buffer], { type: tipo });
    },
  };
}

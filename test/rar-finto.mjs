// DUE ARCHIVI RAR SCRITTI A MANO, 4 e 5, per le prove: validi al punto che
// la libreria RAR vera li accetta (`rar-a-fette.test.mjs` lo controlla).
import zlib from "zlib";

// ---- RAR 4 -------------------------------------------------------------------
const crc16 = (b) => zlib.crc32(b) & 0xffff;
function blocco(tipo, flags, corpo) {
  const testa = Buffer.alloc(5);
  testa.writeUInt8(tipo, 0);
  testa.writeUInt16LE(flags, 1);
  testa.writeUInt16LE(7 + corpo.length, 3);
  const dentro = Buffer.concat([testa, corpo]);
  const crc = Buffer.alloc(2);
  crc.writeUInt16LE(crc16(dentro), 0);
  return Buffer.concat([crc, dentro]);
}
// ogni voce: [nome, dati, {metodo, flags, grande, unicode}]
export function rar4(voci, { principale = 0 } = {}) {
  const pezzi = [Buffer.from("Rar!\x1a\x07\x00", "binary"), blocco(0x73, principale, Buffer.alloc(6))];
  for (const [nome, dati, o = {}] of voci) {
    let n = Buffer.from(nome, "utf8");
    // il nome unicode: la forma leggibile, uno zero, e poi la versione
    // compressa — che qui e' spazzatura apposta, non si deve leggere
    if (o.unicode) n = Buffer.concat([n, Buffer.from([0, 0xff, 0x01, 0x42])]);
    const grande = !!o.grande;
    const corpo = Buffer.alloc(25 + (grande ? 8 : 0) + n.length);
    corpo.writeUInt32LE(dati.length, 0);
    corpo.writeUInt32LE(dati.length, 4);
    corpo.writeUInt8(2, 8);
    corpo.writeUInt32LE(zlib.crc32(dati) >>> 0, 9);
    corpo.writeUInt32LE(0, 13);
    corpo.writeUInt8(20, 17);
    corpo.writeUInt8(o.metodo ?? 0x30, 18);
    corpo.writeUInt16LE(n.length, 19);
    corpo.writeUInt32LE(0x20, 21);
    if (grande) {
      corpo.writeUInt32LE(0, 25);
      corpo.writeUInt32LE(0, 29);
    }
    n.copy(corpo, 25 + (grande ? 8 : 0));
    const flags = 0x8000 | (grande ? 0x0100 : 0) | (o.unicode ? 0x0200 : 0) | (o.flags || 0);
    pezzi.push(blocco(0x74, flags, corpo), Buffer.from(dati));
  }
  pezzi.push(blocco(0x7b, 0x4000, Buffer.alloc(0)));
  return Buffer.concat(pezzi);
}

// ---- RAR 5 -------------------------------------------------------------------
function vint(n) {
  const out = [];
  do {
    let b = n % 128;
    n = Math.floor(n / 128);
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return Buffer.from(out);
}
function testa5(campi) {
  const dentro = Buffer.concat([vint(campi.length), campi]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32LE(zlib.crc32(dentro) >>> 0, 0);
  return Buffer.concat([crc, dentro]);
}
export function rar5(voci, { volume = false } = {}) {
  const pezzi = [
    Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00]),
    testa5(Buffer.concat([vint(1), vint(0), vint(volume ? 1 : 0)])),
  ];
  for (const [nome, dati, o = {}] of voci) {
    const n = Buffer.from(nome, "utf8");
    const extra = o.cifrato ? Buffer.concat([vint(2), vint(1), vint(0)]) : null;
    const crc = Buffer.alloc(4);
    crc.writeUInt32LE(zlib.crc32(dati) >>> 0, 0);
    const campi = Buffer.concat([
      vint(2),
      vint(0x0002 | (extra ? 0x0001 : 0) | (o.spezzato ? 0x0010 : 0)),
      ...(extra ? [vint(extra.length)] : []),
      vint(dati.length),
      vint(0x0004 | (o.cartella ? 0x0001 : 0)),
      vint(dati.length),
      vint(0x20),
      crc,
      // il bit 6 e' «solido»: un file memorizzato in un archivio solido lo ha
      // acceso, e resta memorizzato — il metodo sta nei bit 7-9
      vint(((o.metodo ?? 0) << 7) | (o.solido ? 0x40 : 0)),
      vint(0),
      vint(n.length),
      n,
      ...(extra ? [extra] : []),
    ]);
    pezzi.push(testa5(campi), Buffer.from(dati));
  }
  pezzi.push(testa5(Buffer.concat([vint(5), vint(0), vint(0)])));
  return Buffer.concat(pezzi);
}

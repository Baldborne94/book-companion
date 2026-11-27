// MD5, solo per il gettone di Subsonic (`t = md5(password + sale)`,
// `lib/navidrome.js`): WebCrypto non lo ha, e una dipendenza intera per una
// funzione sola non vale. Il testo si passa in UTF-8, come fa Navidrome.
const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

export function md5(testo) {
  const byte = new TextEncoder().encode(String(testo));
  const lungo = (((byte.length + 8) >> 6) + 1) * 64;
  const m = new Uint8Array(lungo);
  m.set(byte);
  m[byte.length] = 0x80;
  const bit = byte.length * 8;
  const dv = new DataView(m.buffer);
  dv.setUint32(lungo - 8, bit >>> 0, true);
  dv.setUint32(lungo - 4, Math.floor(bit / 2 ** 32), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let o = 0; o < lungo; o += 64) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) [f, g] = [(b & c) | (~b & d), i];
      else if (i < 32) [f, g] = [(d & b) | (~d & c), (5 * i + 1) % 16];
      else if (i < 48) [f, g] = [b ^ c ^ d, (3 * i + 5) % 16];
      else [f, g] = [c ^ (b | ~d), (7 * i) % 16];
      const t = d;
      d = c;
      c = b;
      const x = (a + f + K[i] + dv.getUint32(o + g * 4, true)) >>> 0;
      b = (b + ((x << S[i]) | (x >>> (32 - S[i])))) >>> 0;
      a = t;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }
  const out = new DataView(new ArrayBuffer(16));
  [a0, b0, c0, d0].forEach((v, i) => out.setUint32(i * 4, v, true));
  return [...new Uint8Array(out.buffer)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

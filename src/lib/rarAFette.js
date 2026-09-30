// UN CBR «MEMORIZZATO» SI LEGGE A FETTE, COME UN CBZ.
//
// La libreria RAR per il browser vuole l'archivio INTERO in memoria, e per
// questo un CBR oltre i 300 MB si rifiutava (segnalato: «possibile che i cbr
// troppo grandi li possa gestire direttamente l'applicazione e non debba
// fare sempre io tutto a mano?»). Ma le pagine di un fumetto sono JPG e PNG,
// gia' compresse per conto loro, e chi fa un CBR quasi sempre le mette
// nell'archivio SENZA ricomprimerle — il metodo «store» del RAR. Li' ogni
// pagina sta nel file cosi' com'e', dietro la sua testata: basta leggere le
// testate per sapere dove comincia e quanto e' lunga, e poi `Blob.slice`
// porta la pagina senza toccare il resto. Nessun wasm, nessun limite.
//
// Si leggono le due famiglie: RAR 4 (testate a campi fissi) e RAR 5 (testate
// a numeri di lunghezza variabile). Quel che NON si puo' leggere a fette si
// dice tornando `null` — pagine compresse davvero, archivio cifrato, volumi
// spezzati — e allora resta la strada della libreria, col suo tetto.
//
// Le somme di controllo non si verificano: una pagina rovinata si vede come
// un'immagine rotta, e il lettore la salta; qui conta solo DOVE sono i byte.

const RAR4 = [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00];
const RAR5 = [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00];
const inizia = (u8, firma) => firma.every((b, i) => u8[i] === b);

// Le testate sono piccole: se ne legge un pezzo abbondante e si guarda li'
// dentro, e solo una testata piu' lunga di cosi' si rilegge intera.
const PEZZO = 64 * 1024;
const fetta = async (blob, da, quanto) =>
  new Uint8Array(await blob.slice(da, Math.min(blob.size, da + quanto)).arrayBuffer());

const u16 = (u8, i) => u8[i] | (u8[i + 1] << 8);
const u32 = (u8, i) => (u8[i] | (u8[i + 1] << 8) | (u8[i + 2] << 16) | (u8[i + 3] << 24)) >>> 0;

// il nome: in RAR 4 prima dello zero c'e' la forma leggibile, dopo la
// versione unicode compressa; la prima basta a ordinare e a riconoscere le
// immagini. Le barre di Windows diventano barre e basta.
const nomeDa = (bytes) => {
  const zero = bytes.indexOf(0);
  const puro = zero >= 0 ? bytes.subarray(0, zero) : bytes;
  return new TextDecoder().decode(puro).replace(/\\/g, "/");
};

async function voci4(blob, ferma) {
  const voci = [];
  let pos = RAR4.length;
  while (pos + 7 <= blob.size) {
    let h = await fetta(blob, pos, PEZZO);
    const tipo = h[2];
    const flags = u16(h, 3);
    const lunga = u16(h, 5);
    if (lunga < 7) throw new Error("testata RAR storta");
    if (h.length < lunga) h = await fetta(blob, pos, lunga);
    if (tipo === 0x7b) break; // fine dell'archivio
    if (tipo === 0x73) {
      // archivio a volumi, o con le testate cifrate: a fette non si legge
      if (flags & 0x0001 || flags & 0x0080) return null;
      pos += lunga;
      continue;
    }
    let dati = flags & 0x8000 ? u32(h, 7) : 0;
    if (tipo === 0x74) {
      const grande = flags & 0x0100;
      if (grande) dati += u32(h, 32) * 2 ** 32;
      const metodo = h[25];
      const lungoNome = u16(h, 26);
      const nome = nomeDa(h.subarray(grande ? 40 : 32, (grande ? 40 : 32) + lungoNome));
      const cartella = (flags & 0x00e0) === 0x00e0;
      if (!cartella) {
        voci.push({
          nome,
          da: pos + lunga,
          byte: dati,
          memorizzato: metodo === 0x30 && !(flags & 0x0004) && !(flags & 0x0003),
        });
        if (ferma?.(voci[voci.length - 1])) return voci;
      }
    }
    pos += lunga + dati;
  }
  return voci;
}

// il numero a lunghezza variabile di RAR 5: sette bit per byte, il bit alto
// dice che ne segue un altro
function vint(u8, i) {
  let n = 0;
  let mul = 1;
  for (let k = 0; k < 10; k += 1) {
    const b = u8[i + k];
    if (b === undefined) throw new Error("testata RAR tronca");
    n += (b & 0x7f) * mul;
    mul *= 128;
    if (!(b & 0x80)) return [n, i + k + 1];
  }
  throw new Error("numero RAR storto");
}

async function voci5(blob, ferma) {
  const voci = [];
  let pos = RAR5.length;
  while (pos + 5 <= blob.size) {
    let h = await fetta(blob, pos, PEZZO);
    const [lunga, dopoLunga] = vint(h, 4);
    const tutta = dopoLunga + lunga;
    if (lunga < 2) throw new Error("testata RAR storta");
    if (h.length < tutta) h = await fetta(blob, pos, tutta);
    let i = dopoLunga;
    let tipo;
    let flags;
    [tipo, i] = vint(h, i);
    [flags, i] = vint(h, i);
    let extra = 0;
    let dati = 0;
    if (flags & 0x0001) [extra, i] = vint(h, i);
    if (flags & 0x0002) [dati, i] = vint(h, i);
    if (tipo === 5) break; // fine dell'archivio
    if (tipo === 4) return null; // testate cifrate
    if (tipo === 1) {
      const [archivio] = vint(h, i);
      if (archivio & 0x0001) return null; // un volume di tanti
    }
    if (tipo === 2) {
      let fflags;
      let niente;
      let info;
      let lungoNome;
      [fflags, i] = vint(h, i);
      [niente, i] = vint(h, i); // misura scompattata
      [niente, i] = vint(h, i); // attributi
      if (fflags & 0x0002) i += 4; // ora
      if (fflags & 0x0004) i += 4; // somma di controllo
      [info, i] = vint(h, i);
      [niente, i] = vint(h, i); // sistema
      [lungoNome, i] = vint(h, i);
      const nome = nomeDa(h.subarray(i, i + lungoNome));
      // un record di cifratura nell'area extra vuol dire file cifrato
      let cifrato = false;
      let e = tutta - extra;
      while (e < tutta) {
        const [misura, dopo] = vint(h, e);
        const [tipoRecord] = vint(h, dopo);
        if (tipoRecord === 0x01) cifrato = true;
        e = dopo + misura;
      }
      const metodo = (info >> 7) & 0x07;
      const spezzato = flags & 0x0008 || flags & 0x0010;
      if (!(fflags & 0x0001)) {
        voci.push({ nome, da: pos + tutta, byte: dati, memorizzato: metodo === 0 && !cifrato && !spezzato });
        if (ferma?.(voci[voci.length - 1])) return voci;
      }
    }
    pos += tutta + dati;
  }
  return voci;
}

// Le voci dell'archivio, con dove stanno i loro byte. `null` = non e' un RAR.
export async function vociRar(blob) {
  const testa = await fetta(blob, 0, 8);
  if (inizia(testa, RAR5)) return voci5(blob);
  if (inizia(testa, RAR4)) return voci4(blob);
  return null;
}

// L'ARCHIVIO APERTO A FETTE, con la stessa forma di `apriZip`: i nomi e
// `leggi(nome)` che torna i byte. Si apre SOLO se tutte le pagine sono
// memorizzate: basterebbe una pagina compressa e il volume si leggerebbe a
// meta', che e' peggio di dire subito che serve l'altra strada. Il resto
// (la scheda ComicInfo, che e' testo e spesso e' compressa) si tiene solo
// se si puo' leggere, e se no semplicemente manca.
export async function apriRar(blob, { eImmagine = () => true } = {}) {
  const voci = await vociRar(blob);
  if (!voci) return null;
  const pagine = voci.filter((v) => eImmagine(v.nome));
  if (pagine.some((v) => !v.memorizzato)) return null;
  const leggibili = new Map(voci.filter((v) => v.memorizzato).map((v) => [v.nome, v]));
  return {
    nomi: [...leggibili.keys()],
    leggi: async (nome) => {
      const v = leggibili.get(nome);
      if (!v) throw new Error(`voce non trovata: ${nome}`);
      return new Uint8Array(await blob.slice(v.da, v.da + v.byte).arrayBuffer());
    },
  };
}

// LA PRIMA PAGINA E BASTA (vedi `primaPaginaRar` in `fumetto.js`): da Drive
// ogni testata e' un viaggio in rete, e per la copertina — o per sapere se
// le pagine sono compresse — non serve camminare tutto l'archivio. Ci si
// ferma alla prima immagine: `null` se non ce n'e' o se l'archivio non si
// legge a fette (cifrato, a volumi).
export async function primaImmagineRar(blob, eImmagine = () => true) {
  const testa = await fetta(blob, 0, 8);
  const ferma = (v) => eImmagine(v.nome);
  const voci = inizia(testa, RAR5) ? await voci5(blob, ferma) : inizia(testa, RAR4) ? await voci4(blob, ferma) : null;
  return voci?.find(ferma) || null;
}

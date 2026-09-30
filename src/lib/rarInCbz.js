// UN CBR COMPRESSO SI CONVERTE IN CBZ, A FETTE (chiesto dal lettore: «è
// possibile importare il CBR di grandi dimensioni senza doverlo trasformare
// in cbz?», e poi «fai la 1»: il CBZ va su Drive al posto del CBR).
//
// La libreria RAR del browser (node-unrar-js) non legge l'archivio da se':
// ogni lettura, `seek` e `tell` la CHIEDE a chi la usa, sincrona, e lo
// stesso per le pagine che scrive. La strada di sempre le da' l'archivio
// intero in memoria (`createExtractorFromData`) — e un volume da un giga ne
// diventa due, e la scheda del tablet muore. Qui le si da' invece un
// lettore a finestre (`aFinestre`): in un worker, dove il browser concede
// le letture sincrone (`FileReaderSync` sul disco, `XMLHttpRequest`
// sincrono con `Range` da Drive), l'archivio si attraversa UNA volta, dal
// primo byte all'ultimo, e ogni pagina finita va nello zip
// (`zipScritto.js`) appena la libreria la chiude. In memoria: una finestra
// dell'archivio, una pagina, e il dizionario della libreria.
//
// Qui niente browser: `unrar` ed `Extractor` arrivano da fuori (nei test la
// build Node della libreria, nel worker quella del browser), cosi' la
// conversione si prova in Node su archivi compressi veri.
import { nuovoZip } from "./zipScritto.js";

// letture sincrone a finestre: la libreria chiede pochi byte alla volta
// (una testata, un blocco), e ognuna sarebbe una lettura del disco o un
// viaggio a Drive. `prendi(da, a)` torna i byte di [da, a).
export function aFinestre(prendi, misura, finestra = 1024 * 1024) {
  let da = 0;
  let buf = new Uint8Array(0);
  return (pos, n) => {
    if (pos >= da && pos + n <= da + buf.length) return buf.subarray(pos - da, pos - da + n);
    const a = Math.min(misura, Math.max(pos + n, pos + finestra));
    buf = prendi(pos, a);
    da = pos;
    if (buf.length < n) throw new Error("l'archivio ha dato meno byte di quelli chiesti");
    return buf.subarray(0, n);
  };
}

// L'estrattore: l'archivio e' il file 1, e ogni file che la libreria crea
// e' un'uscita sua, finita quando la libreria la chiude. Letture, `seek` e
// chiusura fanno come la lettura in memoria della libreria (`DataFile`):
// oltre la fine -1, e l'archivio chiuso torna all'inizio.
export function estrattore(Extractor, unrar, leggi, misura) {
  class AFette extends Extractor {
    constructor() {
      super(unrar, "");
      this._filePath = "_bc_.rar";
      this.pos = 0;
      this.uscite = new Map();
      this.prossimo = 2;
      this.finiti = [];
    }
    open(nome) {
      return nome === this._filePath ? 1 : 0;
    }
    create(nome) {
      const fd = this.prossimo++;
      this.uscite.set(fd, { nome, pezzi: [] });
      return fd;
    }
    closeFile(fd) {
      if (fd === 1) {
        this.pos = 0;
        return;
      }
      const u = this.uscite.get(fd);
      if (!u) return;
      this.uscite.delete(fd);
      this.finiti.push(u);
    }
    // come la lettura in memoria della libreria: oltre la fine, -1
    read(fd, dove, n) {
      if (fd !== 1 || this.pos + n > misura) return -1;
      unrar.HEAPU8.set(leggi(this.pos, n), dove);
      this.pos += n;
      return n;
    }
    write(fd, dove, n) {
      const u = this.uscite.get(fd);
      if (!u) return false;
      u.pezzi.push(unrar.HEAPU8.slice(dove, dove + n));
      return true;
    }
    tell(fd) {
      return fd === 1 ? this.pos : -1;
    }
    seek(fd, pos, modo) {
      if (fd !== 1) return false;
      const nuovo = modo === "SET" ? pos : modo === "CUR" ? this.pos + pos : misura - pos;
      if (nuovo < 0 || nuovo > misura) return false;
      this.pos = nuovo;
      return true;
    }
  }
  const e = new AFette();
  unrar.extractor = e;
  return e;
}

// La conversione. `tieni(nome)` dice quali voci entrano (le pagine e la
// scheda ComicInfo: il resto si salta, e in un archivio solido la libreria
// lo scioglie senza scriverlo). I nomi restano quelli del RAR, quindi le
// pagine restano nello stesso ordine e il segno di lettura resta buono.
// `onProgress({ letti, misura, pagine })` dopo ogni voce.
export function rarInCbz({ unrar, Extractor, leggi, misura, tieni = () => true, onProgress, vivo = () => true }) {
  const e = estrattore(Extractor, unrar, leggi, misura);
  const zip = nuovoZip({ tipo: "application/vnd.comicbook+zip" });
  const { files } = e.extract({ files: (h) => !h.flags.directory && tieni(h.name.replace(/\\/g, "/")) });
  let pagine = 0;
  for (const f of files) {
    const u = e.finiti.shift();
    const nome = f.fileHeader.name.replace(/\\/g, "/");
    if (u) {
      zip.aggiungi(nome, u.pezzi);
      if (!/comicinfo\.xml$/i.test(nome)) pagine += 1;
    }
    onProgress?.({ letti: e.pos, misura, pagine });
    if (!vivo()) throw new Error("conversione fermata");
  }
  if (!zip.voci) throw new Error("nel CBR non ci sono pagine da convertire");
  return zip.chiudi();
}

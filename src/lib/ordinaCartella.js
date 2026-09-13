// ORDINA UNA CARTELLA DI LIBRI PER SAGA.
//
// Chiesto dal lettore: «E:\Libri — in questa cartella riesci a crearmi le
// sottocartelle delle saghe e al suo interno metterci i libri corretti?».
// Il disco del lettore non e' raggiungibile da qui, ma il riconoscimento
// della saga e' gia' tutto nell'app, ed e' lo STESSO che decide i ripiani
// della Libreria: la tavola, la collana scritta nel file, il titolo, la
// deduzione dai fratelli. Qui si applica ai file di una cartella invece che
// ai tomi importati, e ne esce un piano di spostamenti che lo script
// `scripts/ordinaLibri.mjs` esegue.
//
// Sta qui e non nello script per la ragione di sempre: e' la parte che
// sbaglia in silenzio — un libro finito nella cartella sbagliata non alza
// nessun errore — e da qui un test la prova con dei record finti senza
// toccare il disco. Lo script fa solo l'I/O: legge gli OPF, sposta i file.
//
// Due regole che sembrano dettagli:
//  - LE CARTELLE CHE CI SONO GIA' NON DICONO NIENTE. Una cartella «Joe
//    Abercrombie» non e' una saga, e prenderla per tale porterebbe dentro
//    tutti i suoi romanzi a se'. Ogni file si riconosce da solo, e resta
//    fermo solo se sta GIA' nella cartella della sua saga.
//  - CHI NON HA SAGA NON SI MUOVE. Spostare un romanzo a se' in una
//    cartella «Volumi soli» sarebbe decidere per il lettore dove tenere i
//    libri che non c'entrano con nessuna saga: quelli restano dove sono, e
//    il resoconto li conta.
import path from "node:path";
import { riconosci, deduciSaghe, unificaSaghe, nomeInBiblioteca } from "./sagaBooks.js";
import { sagaDalTitolo } from "./sagaDalTitolo.js";

// Windows non accetta questi caratteri nei nomi, e un nome che finisce con
// un punto o uno spazio lo tronca in silenzio. Il due punti diventa un
// trattino, perche' «Malazan: Book of the Fallen» si legge ancora.
const VIETATI = /[<>"/\\|?*\u0000-\u001f]/g;
export const CARTELLA_MAX = 80;

export function nomeCartella(saga) {
  const s = String(saga || "")
    .replace(/\s*:\s*/g, " - ")
    .replace(VIETATI, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "")
    .slice(0, CARTELLA_MAX)
    .replace(/[. ]+$/, "");
  return s || null;
}

// La catena e' quella dell'import, nello stesso ordine e con le stesse
// ragioni: la TAVOLA per prima (conosce l'ordine di lettura e il ciclo),
// poi la COLLANA del file, poi il TITOLO, e alla fine la deduzione dai
// fratelli della stessa cartella — che qui fanno da «biblioteca».
export function assegnaSaghe(libri = []) {
  const out = libri.map((b) => ({ ...b, saga: "", sagaOrder: b.sagaOrder ?? null, fonte: null }));
  for (const b of out) {
    const tav = riconosci({ title: b.title, author: b.author, fileName: b.fileName });
    if (tav?.saga) {
      b.saga = tav.saga;
      b.sagaOrder = tav.sagaOrder;
      b.fonte = "tavola";
      continue;
    }
    if (b.collana?.serie) {
      b.saga = nomeInBiblioteca(b.collana.serie, out);
      b.sagaOrder = b.collana.numero ?? null;
      b.fonte = "file";
      continue;
    }
    const nelTitolo = sagaDalTitolo({ title: b.title, fileName: b.fileName, author: b.author });
    if (nelTitolo?.saga) {
      b.saga = nomeInBiblioteca(nelTitolo.saga, out);
      b.sagaOrder = nelTitolo.sagaOrder ?? null;
      b.fonte = "titolo";
    }
  }
  // i fratelli: chi non ha saga la eredita dai libri dello stesso autore
  // che la dichiarano tutti uguale (la regola timida di `sagaDaBiblioteca`)
  const { campi } = deduciSaghe(out);
  for (const b of out) {
    const c = campi[b.id];
    if (!c?.saga || b.saga) continue;
    b.saga = c.saga;
    if (c.sagaOrder != null) b.sagaOrder = c.sagaOrder;
    b.fonte = "fratelli";
  }
  // e due grafie della stessa saga fanno UNA cartella, non due
  const { campi: unite } = unificaSaghe(out);
  for (const b of out) if (unite[b.id]?.saga) b.saga = unite[b.id].saga;
  return out;
}

// Il piano: per ogni libro con saga, la cartella `radice/<saga>`. Chi ci
// sta gia' resta; chi arriverebbe su un nome gia' preso da un altro file si
// ferma e si dichiara, perche' sovrascrivere un libro con un altro e' il
// danno peggiore che questo script possa fare.
export function pianifica(libri = [], radice, p = path) {
  const mosse = [];
  const ferme = [];
  const senza = [];
  const doppioni = [];
  const saghe = new Map();
  const prese = new Set();
  for (const b of libri) {
    const cartella = nomeCartella(b.saga);
    if (!cartella) {
      senza.push(b);
      continue;
    }
    saghe.set(cartella, (saghe.get(cartella) || 0) + 1);
    const dest = p.join(radice, cartella);
    const a = p.join(dest, p.basename(b.path));
    if (p.resolve(p.dirname(b.path)) === p.resolve(dest)) {
      prese.add(a);
      ferme.push({ ...b, cartella });
      continue;
    }
    if (prese.has(a)) {
      doppioni.push({ ...b, cartella, a });
      continue;
    }
    prese.add(a);
    mosse.push({ ...b, cartella, da: b.path, a });
  }
  return { mosse, ferme, senza, doppioni, saghe };
}

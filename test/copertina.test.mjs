// La misura della copertina rimessa a mano. E' l'unico pezzo di
// `copertina.js` che si puo' provare senza un canvas, ed e' anche l'unico
// dove si sbaglia in silenzio: una copertina schiacciata si nota subito,
// ma un errore di un pixel no.
import { misura, LATO, copertinaDaEpub } from "../src/lib/copertina.js";

const rapporto = (m) => m.w / m.h;

export default async function (t) {
  // ---- si rimpicciolisce, e il lato lungo comanda -----------------------
  const alta = misura(1200, 1800);
  t.eq("il lato lungo arriva al tetto", alta.h, LATO);
  t.c("e l'altro scende con lui", alta.w === Math.round(1200 * (LATO / 1800)), String(alta.w));
  const larga = misura(2400, 1000);
  t.eq("vale anche per un'immagine sdraiata", larga.w, LATO);

  // ---- LE PROPORZIONI NON SI TOCCANO MAI --------------------------------
  for (const [w, h] of [[1200, 1800], [2400, 1000], [1000, 1000], [3000, 4000], [901, 1301]]) {
    const m = misura(w, h);
    t.c(
      `${w}×${h} tiene le proporzioni`,
      Math.abs(rapporto(m) - w / h) < 0.01,
      `${m.w}×${m.h} → ${rapporto(m).toFixed(3)} invece di ${(w / h).toFixed(3)}`
    );
  }

  // ---- un'immagine gia' piccola non si gonfia ---------------------------
  // ingrandirla non aggiunge dettaglio, aggiunge solo byte
  const piccola = misura(300, 450);
  t.eq("la larghezza resta la sua", piccola.w, 300);
  t.eq("e l'altezza pure", piccola.h, 450);
  t.eq("nemmeno esattamente al tetto", misura(LATO, LATO).w, LATO);

  // ---- mai un lato a zero ------------------------------------------------
  // un canvas largo zero non disegna niente, e la copertina sparirebbe
  // 4000×1 rimpicciolita di cinque volte darebbe un'altezza di 0,2px, che
  // arrotondata e' ZERO: senza la guardia il canvas sarebbe alto niente
  const striscia = misura(4000, 1);
  t.c("un lato sottilissimo resta almeno uno", striscia.h >= 1, `${striscia.w}×${striscia.h}`);
  t.eq("e il lato lungo e' quello giusto", striscia.w, LATO);

  // ---- quello che non e' una misura -------------------------------------
  t.eq("larghezza zero", misura(0, 100), null);
  t.eq("altezza negativa", misura(100, -5), null);
  t.eq("non numeri", misura(NaN, 100), null);
  t.eq("niente del tutto", misura(), null);
  // un tetto assurdo non deve azzerare l'immagine: meglio tenerla com'e'
  t.eq("un tetto a zero lascia stare", misura(1200, 1800, 0).h, 1800);

  // ---- LA COPERTINA DENTRO L'ePub ---------------------------------------
  // `copertinaDaEpub` prende un libro GIA' aperto, quindi qui basta un
  // finto: le due strade, il ripiego e la chiusura si provano tutte senza
  // tirarsi dietro epub.js e un romanzo vero.
  const DENTRO = { finto: "dai byte dell'archivio" };
  const DA_URL = { finto: "scaricata dall'url" };
  globalThis.fetch = async () => ({ blob: async () => DA_URL });

  const libro = (opts = {}) => {
    const eb = {
      chiuso: false,
      loaded: { cover: opts.percorso ?? null },
      archive: opts.archivio === false ? null : { getBlob: async () => opts.blob ?? null },
      coverUrl: async () => opts.url ?? null,
      destroy() {
        eb.chiuso = true;
      },
    };
    return eb;
  };

  // la strada normale: il percorso c'è e l'archivio lo consegna
  let eb = libro({ percorso: "OEBPS/cover.jpg", blob: DENTRO });
  t.c("la copertina viene dall'archivio", (await copertinaDaEpub(eb)) === DENTRO);
  t.c("e il libro si chiude", eb.chiuso);

  // il ripiego: nessun percorso dichiarato, ma `coverUrl` risponde
  eb = libro({ url: "blob:qualcosa" });
  t.c("senza percorso si ripiega su coverUrl", (await copertinaDaEpub(eb)) === DA_URL);

  // percorso dichiarato ma archivio muto: si ripiega lo stesso, non ci si
  // ferma — è un ePub scritto male, non un ePub senza copertina
  eb = libro({ percorso: "OEBPS/cover.jpg", blob: null, url: "blob:qualcosa" });
  t.c("un archivio che tace non blocca il ripiego", (await copertinaDaEpub(eb)) === DA_URL);

  // il libro che una copertina non ce l'ha davvero: `null`, e allora il
  // dorso disegnato è lo stato di partenza
  eb = libro({});
  t.eq("nessuna copertina, nessun ripiego", await copertinaDaEpub(eb), null);
  t.c("e si chiude comunque", eb.chiuso);

  // IL LIBRO SI CHIUDE ANCHE SE QUALCOSA ESPLODE: un ePub aperto e non
  // chiuso resta in memoria, e su un tablet è proprio quello che non serve
  eb = libro({ percorso: "x" });
  eb.archive = {
    getBlob: async () => {
      throw new Error("archivio rotto");
    },
  };
  let esploso = false;
  try {
    await copertinaDaEpub(eb);
  } catch {
    esploso = true;
  }
  t.c("l'errore risale a chi sa cosa farne", esploso);
  t.c("ma il libro è stato chiuso lo stesso", eb.chiuso);

  t.eq("niente libro, niente copertina", await copertinaDaEpub(null), null);
  // un finto senza i metodi non deve buttare giù la scheda
  t.eq("un libro monco non esplode", await copertinaDaEpub({}), null);
}

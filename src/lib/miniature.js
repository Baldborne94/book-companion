// LE COPERTINE SULLO SCAFFALE SONO MINIATURE, E SI RICORDANO.
//
// Chiesto dal lettore: «la ricerca e la visualizzazione delle copertine
// sono lente». Misurato con 400 libri e il processore rallentato quattro
// volte: la Libreria mostrava la prima copertina dopo ~6 secondi, perche'
// all'apertura leggeva e decodificava TUTTE le copertine insieme — anche
// quelle fuori dallo schermo — e ognuna a piena misura (fino a 800×1200
// per un riquadro di un centinaio di pixel). E a ogni lettera della ricerca
// i libri che rientravano sullo scaffale la rileggevano da capo.
//
// Tre regole, e sono quelle che sbagliano in silenzio:
//
// 1. LA MINIATURA SI FA UNA VOLTA, dalla copertina intera, e si tiene su
//    disco accanto a lei — CON LA MISURA DELLA COPERTINA DA CUI VIENE.
//    E' quel segno a dire se e' ancora buona: una copertina cambiata a
//    mano, scesa dal cloud o ritrovata nel file ha un'altra misura, e la
//    miniatura vecchia si rifa' invece di mostrare il libro di prima.
//    Nessun registro da tenere in pari: la verita' e' la copertina.
// 2. L'INDIRIZZO SI RICORDA per tutta la vita della pagina, cosi' la
//    ricerca e il cambio di sezione non rileggono niente; e una richiesta
//    gia' in volo per lo stesso libro si aspetta invece di rifarla.
// 3. UNA COPERTINA CAMBIATA SI DIMENTICA (`copertinaCambiata`, chiamata
//    da chi la scrive): senza, lo scaffale mostrerebbe per sempre quella
//    ricordata, e un errore non lo direbbe nessuno.
//
// Le dipendenze si passano da fuori come `leggiByte` altrove: qui non si
// tocca IndexedDB ne' un canvas, cosi' la regola si prova in Node.

// il lato LUNGO della miniatura: sullo scaffale un dorso e' largo un
// centinaio di pixel CSS, che con la scrittura ingrandita e uno schermo
// fitto diventano due o trecento veri — 480 li copre senza sprecare
export const LATO_MIN = 480;

export const chiaveMin = (id) => `min_${id}`;

const viste = new Map(); // id -> { url, revoca }
const inVolo = new Map(); // id -> { gen, p }
const gen = new Map(); // id -> numero
const ascolti = new Set();

export const generazione = (id) => gen.get(id) || 0;

// quel che si sa GIA', senza aspettare niente: `undefined` = non lo so,
// `null` = nessuna copertina, stringa = l'indirizzo. Serve a chi si
// ridisegna (la ricerca) per non passare nemmeno un fotogramma dal vuoto.
// (niente confronto di generazione qui: `copertinaCambiata` toglie la voce,
// e una risposta vecchia non la scrive mai — misurato, la guardia non
// guardava niente)
export function giaVista(id) {
  return viste.has(id) ? viste.get(id).url : undefined;
}

export function copertinaCambiata(id) {
  gen.set(id, generazione(id) + 1);
  const v = viste.get(id);
  viste.delete(id);
  inVolo.delete(id);
  if (v?.url) v.revoca?.(v.url);
  for (const f of ascolti) f(id);
}

export function ascoltaCopertine(f) {
  ascolti.add(f);
  return () => ascolti.delete(f);
}

// la miniatura su disco e' buona solo se viene da QUESTA copertina
export const minBuona = (min, intera) =>
  !!(min?.blob && intera && Number(min.di) === Number(intera.size));

export function caricaCopertina(id, deps) {
  const g = generazione(id);
  if (viste.has(id)) return Promise.resolve(viste.get(id).url);
  const volo = inVolo.get(id);
  if (volo && volo.gen === g) return volo.p;
  const p = (async () => {
    const intera = await Promise.resolve()
      .then(() => deps.leggiCover(id))
      .catch(() => null);
    let blob = null;
    if (intera) {
      const min = await Promise.resolve()
        .then(() => deps.leggiMin?.(id))
        .catch(() => null);
      if (minBuona(min, intera)) blob = min.blob;
      else {
        const ridotta = await Promise.resolve()
          .then(() => deps.riduci?.(intera))
          .catch(() => null);
        // una miniatura piu' pesante dell'originale non e' una miniatura:
        // la copertina era gia' piccola, e si usa lei
        if (ridotta && ridotta.size < intera.size) {
          blob = ridotta;
          // si scrive solo se nel frattempo la copertina non e' cambiata,
          // o si terrebbe su disco la miniatura del libro di prima
          if (generazione(id) === g)
            Promise.resolve()
              .then(() => deps.scriviMin?.(id, { blob: ridotta, di: intera.size }))
              .catch(() => {});
        } else blob = intera;
      }
    }
    // cambiata mentre si leggeva: questa risposta e' gia' vecchia
    if (generazione(id) !== g) return caricaCopertina(id, deps);
    const url = blob ? deps.creaUrl(blob) : null;
    viste.set(id, { url, revoca: deps.revoca });
    inVolo.delete(id);
    return url;
  })();
  inVolo.set(id, { gen: g, p });
  return p;
}

// solo per i test: la memoria vive quanto la pagina
export function dimenticaTutto() {
  viste.clear();
  inVolo.clear();
  gen.clear();
  ascolti.clear();
}

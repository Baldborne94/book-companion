const DB_NAME = "bc_library";

let dbPromise;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 3);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("files")) d.createObjectStore("files");
        if (!d.objectStoreNames.contains("covers")) d.createObjectStore("covers");
        if (!d.objectStoreNames.contains("aux")) d.createObjectStore("aux");
        // le tracce audio stanno per conto loro: cancellare un libro non
        // deve portarsi via la musica, e viceversa
        if (!d.objectStoreNames.contains("tracks")) d.createObjectStore("tracks");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function withStore(name, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(name, mode);
    const req = fn(tx.objectStore(name));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const putFile = (id, blob) => withStore("files", "readwrite", (s) => s.put(blob, id));
export const getFile = (id) => withStore("files", "readonly", (s) => s.get(id));
export const putCover = (id, blob) => withStore("covers", "readwrite", (s) => s.put(blob, id));
export const getCover = (id) => withStore("covers", "readonly", (s) => s.get(id));
// togliere la copertina scelta a mano non e' cancellare il libro: si torna
// al dorso disegnato, che e' quello che c'era prima
export const removeCover = (id) => withStore("covers", "readwrite", (s) => s.delete(id));

export const putTrack = (id, blob) => withStore("tracks", "readwrite", (s) => s.put(blob, id));
export const getTrack = (id) => withStore("tracks", "readonly", (s) => s.get(id));
export const removeTrack = (id) => withStore("tracks", "readwrite", (s) => s.delete(id));

export const listFileIds = () => withStore("files", "readonly", (s) => s.getAllKeys());
export const putAux = (key, value) => withStore("aux", "readwrite", (s) => s.put(value, key));
export const getAux = (key) => withStore("aux", "readonly", (s) => s.get(key));

export async function removeBookData(id) {
  await withStore("files", "readwrite", (s) => s.delete(id));
  await withStore("covers", "readwrite", (s) => s.delete(id));
  await withStore("aux", "readwrite", (s) => s.delete(`loc_${id}`));
}

// LA PERSISTENZA SI CHIEDE, MA SOPRATTUTTO SI GUARDA.
//
// Senza, i byte dei libri, le evidenziazioni, il diario e i punti di
// lettura stanno in una memoria che il browser puo' sfrattare quando gli
// serve spazio. Android la concede a certe condizioni (PWA installata,
// abbastanza uso) e la nega senza dire niente: buttare via la risposta
// voleva dire lasciare il lettore convinto di essere al sicuro.
//
// Prende `navigator.storage` invece di andarselo a prendere da solo, cosi'
// un test puo' passargli le cinque situazioni che capitano davvero senza
// bisogno di un browser (`test/persistenza.test.mjs`).
export async function persistenza(storage, chiedi = true) {
  // niente API: browser vecchio o contesto non sicuro. Non e' un «no», e'
  // un «non si sa» — e va detto diversamente, perche' non c'e' niente da
  // riprovare e allarmare a vuoto sarebbe peggio del silenzio
  if (!storage?.persist) return "sconosciuta";
  try {
    // gia' concessa: non si richiede due volte
    if (storage.persisted && (await storage.persisted())) return "concessa";
    // solo lettura, e il browser non sa nemmeno dire com'e' messo: non si
    // spaccia per un «negata», che manderebbe in pagina un avviso inventato
    if (!chiedi) return storage.persisted ? "negata" : "sconosciuta";
    return (await storage.persist()) ? "concessa" : "negata";
  } catch {
    /* alcuni browser lanciano invece di rispondere: per noi e' un non-so */
    return "sconosciuta";
  }
}

const suoStorage = () => (typeof navigator === "undefined" ? null : navigator.storage);

// all'avvio si CHIEDE; in Libreria si GUARDA soltanto, o il solo aprire lo
// scaffale farebbe comparire un permesso a sorpresa
export const requestPersistence = () => persistenza(suoStorage(), true);
export const statoPersistenza = () => persistenza(suoStorage(), false);

export async function storageEstimate() {
  try {
    if (navigator.storage?.estimate) return await navigator.storage.estimate();
  } catch {
    /* come sopra */
  }
  return null;
}

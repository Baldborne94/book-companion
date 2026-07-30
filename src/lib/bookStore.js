const DB_NAME = "bc_library";

let dbPromise;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("files")) d.createObjectStore("files");
        if (!d.objectStoreNames.contains("covers")) d.createObjectStore("covers");
        if (!d.objectStoreNames.contains("aux")) d.createObjectStore("aux");
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

export const listFileIds = () => withStore("files", "readonly", (s) => s.getAllKeys());
export const putAux = (key, value) => withStore("aux", "readwrite", (s) => s.put(value, key));
export const getAux = (key) => withStore("aux", "readonly", (s) => s.get(key));

export async function removeBookData(id) {
  await withStore("files", "readwrite", (s) => s.delete(id));
  await withStore("covers", "readwrite", (s) => s.delete(id));
  await withStore("aux", "readwrite", (s) => s.delete(`loc_${id}`));
}

export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* alcuni browser lanciano senza permesso: non è un errore per noi */
  }
  return false;
}

export async function storageEstimate() {
  try {
    if (navigator.storage?.estimate) return await navigator.storage.estimate();
  } catch {
    /* come sopra */
  }
  return null;
}

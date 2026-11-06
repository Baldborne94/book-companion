// LA RETE DEL GUSCIO (vedi `SA_RETE` e `chiediAllaRete` in
// `android/SchermataDiBlocco.java`). MangaDex respinge le pagine web con
// una sfida anti-bot e lascia passare le app: nel guscio Android la pagina
// chiede l'indirizzo al guscio, che lo prende col nome dell'app e rimanda
// il corpo a pezzi in base64 sulla porta della copertina. Qui la meta' della
// pagina: una `fetch` con la stessa forma di quella del browser (ok,
// status, headers.get, json, text, arrayBuffer), cosi' `lib/mangadex.js`
// non sa da dove arrivano i byte.
export const SA_RETE = "grimorio:sa:rete";
// OGNI ATTESA HA UN TETTO: si azzera a ogni pezzo che arriva, cosi' una
// pagina grande e lenta non cade, e una porta morta non tiene appeso niente
export const ATTESA_RETE = 30_000;
export const SENZA_GUSCIO = "il guscio non ha risposto: chiudi l'app del tutto e riaprila dall'icona";

const daBase64 = (s) => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export function rispostaFinta({ stato = 0, tipo = "", cache = null, byte = new Uint8Array(0) } = {}) {
  const testo = () => new TextDecoder().decode(byte);
  return {
    ok: stato >= 200 && stato < 300,
    status: stato,
    headers: { get: (k) => (/^content-type$/i.test(k) ? tipo || null : /^x-cache$/i.test(k) ? cache : null) },
    text: async () => testo(),
    json: async () => JSON.parse(testo()),
    arrayBuffer: async () => byte.buffer.slice(byte.byteOffset, byte.byteOffset + byte.byteLength),
  };
}

// `posta(stringa)` manda al guscio; `ricevi(dato)` va chiamata con ogni
// messaggio della porta e dice se era della rete. I tempi si iniettano.
export function nuovaReteGuscio(posta, { attesa = ATTESA_RETE, aspetta = setTimeout, smetti = clearTimeout } = {}) {
  let prossimo = 1;
  const inVolo = new Map();
  const scade = (id) => {
    const v = inVolo.get(id);
    if (!v) return;
    smetti(v.timer);
    v.timer = aspetta(() => {
      inVolo.delete(id);
      v.ko(new Error(SENZA_GUSCIO));
    }, attesa);
  };
  function ricevi(dato) {
    if (typeof dato !== "string" || !dato.startsWith('{"rete"')) return false;
    let r;
    try {
      r = JSON.parse(dato).rete;
    } catch {
      return true;
    }
    const v = r && inVolo.get(r.id);
    if (!v) return true;
    if (r.errore != null) {
      smetti(v.timer);
      inVolo.delete(r.id);
      v.ko(new Error(String(r.errore) || "il guscio non ha potuto chiedere"));
      return true;
    }
    const n = Number(r.n) || 1;
    const i = Number(r.i) || 0;
    if (!v.pezzi || v.pezzi.length !== n) v.pezzi = new Array(n).fill(null);
    v.pezzi[i] = String(r.dati || "");
    v.stato = Number(r.stato) || 0;
    v.tipo = r.tipo || "";
    v.cache = r.cache ?? null;
    if (v.pezzi.some((p) => p == null)) {
      scade(r.id);
      return true;
    }
    smetti(v.timer);
    inVolo.delete(r.id);
    try {
      v.ok(rispostaFinta({ stato: v.stato, tipo: v.tipo, cache: v.cache, byte: daBase64(v.pezzi.join("")) }));
    } catch (e) {
      v.ko(e);
    }
    return true;
  }
  function chiedi(url, opzioni = {}) {
    const id = prossimo++;
    const metodo = String(opzioni.method || "GET").toUpperCase();
    const corpo = typeof opzioni.body === "string" ? opzioni.body : undefined;
    const tipoCorpo = opzioni.headers?.["content-type"] || opzioni.headers?.["Content-Type"];
    return new Promise((ok, ko) => {
      inVolo.set(id, { ok, ko, pezzi: null, timer: null });
      scade(id);
      try {
        posta(JSON.stringify({ rete: { id, url: String(url), metodo, ...(corpo !== undefined ? { corpo } : {}), ...(tipoCorpo ? { tipoCorpo } : {}) } }));
      } catch (e) {
        smetti(inVolo.get(id)?.timer);
        inVolo.delete(id);
        ko(new Error(SENZA_GUSCIO));
      }
    });
  }
  return { fetch: chiedi, ricevi, get inVolo() {
    return inVolo.size;
  } };
}

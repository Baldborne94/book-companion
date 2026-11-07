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

// QUANTE INSIEME: il guscio chiede con due fili (`fila` in
// `SchermataDiBlocco.java`), e il resto aspetta in fila da lui. Sul tablet
// la stanza mandava insieme le copertine di tutte le serie e il feed dei
// capitoli: il feed aspettava dietro le copertine piu' del tetto della
// pagina, e la pagina diceva «il guscio non ha risposto» a un guscio che
// lavorava. La fila sta qui: al guscio ne arrivano al piu' `INSIEME`, e il
// tetto parte quando la richiesta parte davvero.
export const INSIEME = 2;

// `posta(stringa)` manda al guscio; `ricevi(dato)` va chiamata con ogni
// messaggio di ogni porta e dice se era della rete. UNA RETE PER TUTTE LE
// PORTE (`porta(posta)` cambia solo la strada): il guscio rinnova il canale
// quando la scheda torna davanti, e risponde sul canale di adesso. Con una
// rete per porta la risposta arrivava a una rete che non la conosceva, e
// i numeri ripartivano da 1 (una risposta vecchia poteva finire a una
// richiesta nuova). Le figure (`priorita: "bassa"`) aspettano dietro
// le richieste dell'API. Una richiesta che scade senza un pezzo si rimanda una
// volta sola, col numero nuovo, sulla porta di adesso.
// I tempi si iniettano.
export function nuovaReteGuscio(posta, { attesa = ATTESA_RETE, insieme = INSIEME, aspetta = setTimeout, smetti = clearTimeout } = {}) {
  let prossimo = 1;
  let strada = posta;
  const inVolo = new Map();
  const coda = [];
  let partite = 0;
  const finisci = (id) => {
    const v = inVolo.get(id);
    if (!v) return null;
    smetti(v.timer);
    inVolo.delete(id);
    if (v.partita) partite--;
    avanti();
    return v;
  };
  const scade = (id) => {
    const v = inVolo.get(id);
    if (!v) return;
    smetti(v.timer);
    v.timer = aspetta(() => {
      if (!inVolo.has(id)) return;
      if (!v.pezzi && !v.rimandata) {
        inVolo.delete(id);
        const nuovo = prossimo++;
        inVolo.set(nuovo, { ...v, id: nuovo, rimandata: true, timer: null });
        manda(nuovo);
        return;
      }
      finisci(id);
      v.ko(new Error(SENZA_GUSCIO));
    }, attesa);
  };
  function manda(id) {
    const v = inVolo.get(id);
    if (!v) return;
    v.partita = true;
    scade(id);
    try {
      strada(JSON.stringify({ rete: { id, ...v.messaggio } }));
    } catch {
      finisci(id);
      v.ko(new Error(SENZA_GUSCIO));
    }
  }
  function avanti() {
    while (partite < insieme && coda.length) {
      const id = coda.shift();
      if (!inVolo.has(id)) continue;
      partite++;
      manda(id);
    }
  }
  function ricevi(dato) {
    if (typeof dato !== "string" || !dato.startsWith('{"rete"')) return false;
    let r;
    try {
      r = JSON.parse(dato).rete;
    } catch {
      return true;
    }
    const v = r && inVolo.get(r.id);
    if (!v || !v.partita) return true;
    if (r.errore != null) {
      finisci(r.id);
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
    finisci(r.id);
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
    const messaggio = { url: String(url), metodo, ...(corpo !== undefined ? { corpo } : {}), ...(tipoCorpo ? { tipoCorpo } : {}) };
    return new Promise((ok, ko) => {
      const bassa = opzioni.priorita === "bassa";
      inVolo.set(id, { ok, ko, messaggio, pezzi: null, timer: null, partita: false, bassa });
      // le copertine dopo: il feed e la ricerca non aspettano le figure
      const dove = bassa ? -1 : coda.findIndex((x) => inVolo.get(x)?.bassa);
      if (dove < 0) coda.push(id);
      else coda.splice(dove, 0, id);
      avanti();
    });
  }
  return {
    fetch: chiedi,
    ricevi,
    porta(nuova) {
      strada = nuova;
    },
    get inVolo() {
      return inVolo.size;
    },
    get partite() {
      return partite;
    },
  };
}

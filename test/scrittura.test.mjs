// UNA SCRITTURA E' FATTA QUANDO LA TRANSAZIONE SI CHIUDE. IndexedDB dice di
// si' alla richiesta e puo' abortire la transazione DOPO — su un file grosso
// e' proprio li' che arriva «spazio esaurito». Risolvendo sulla richiesta
// l'import diceva «nuovo tomo sullo scaffale» sopra un volume che su disco
// non c'era (preso al banco con un CBZ da un giga). Qui si prova con una
// transazione finta, perche' in Node IndexedDB non c'e'.
import { attendi, spazioEsaurito } from "../src/lib/bookStore.js";

const finta = () => ({ tx: {}, req: { result: "ok" } });
const esito = (p) => p.then((v) => ({ v }), (e) => ({ e }));

export default async (t) => {
  // ---- la richiesta dice si', la transazione abortisce ---------------------
  {
    const { tx, req } = finta();
    const p = esito(attendi(tx, req, "readwrite"));
    req.onsuccess?.();
    tx.error = Object.assign(new Error("quota"), { name: "QuotaExceededError" });
    tx.onabort();
    const r = await p;
    t.c("una transazione abortita e' un errore, anche se la richiesta aveva risposto", !!r.e);
    t.c("e l'errore e' quello della transazione", spazioEsaurito(r.e));
  }
  // ---- la scrittura riuscita si risolve alla chiusura ----------------------
  {
    const { tx, req } = finta();
    let fatto = false;
    const p = attendi(tx, req, "readwrite").then((v) => ((fatto = true), v));
    await null;
    t.c("prima della chiusura non e' ancora fatta", !fatto);
    tx.oncomplete();
    t.eq("alla chiusura si', col risultato della richiesta", await p, "ok");
  }
  // ---- la lettura resta sulla risposta della richiesta ---------------------
  {
    const { tx, req } = finta();
    const p = attendi(tx, req, "readonly");
    req.onsuccess();
    t.eq("una lettura risponde alla richiesta", await p, "ok");
  }
  // ---- lo spazio esaurito ha un nome suo ------------------------------------
  t.c("QuotaExceededError e' spazio esaurito", spazioEsaurito({ name: "QuotaExceededError" }));
  t.c("anche detto a parole", spazioEsaurito(new Error("The quota has been exceeded.")));
  t.c("un altro guasto no", !spazioEsaurito(new Error("rete")));
  t.c("niente non e' spazio esaurito", !spazioEsaurito(null));
};

// UNA MELODIA DI DRIVE CHE SUONA MENTRE SCENDE: l'indirizzo di casa che
// l'<audio> chiede (`indirizzoMelodia` in `lib/drive.js`) e il service
// worker che lo gira a Drive con la chiave e lo stesso pezzo
// (`public/melodia-sw.js`). La prova nel browser vero e' la scena «una
// melodia di Drive suona mentre scende» in `e2e/run.mjs`.
import { readFileSync } from "fs";
import vm from "vm";
import { indirizzoMelodia } from "../src/lib/drive.js";

function memoria() {
  const m = {};
  return { getItem: (x) => (x in m ? m[x] : null), setItem: (x, v) => (m[x] = String(v)), removeItem: (x) => delete m[x] };
}

// il service worker, con un `self` e un `fetch` finti
function lavoratore() {
  const ascolti = [];
  const chieste = [];
  const ctx = {
    self: { addEventListener: (tipo, f) => tipo === "fetch" && ascolti.push(f) },
    URL,
    fetch: (url, op) => {
      chieste.push({ url, testate: op?.headers || {} });
      return Promise.resolve("risposta");
    },
  };
  vm.runInNewContext(readFileSync(new URL("../public/melodia-sw.js", import.meta.url), "utf8"), ctx);
  const chiedi = (url, range = null) => {
    let data = null;
    const evento = { request: { url, headers: { get: (k) => (k.toLowerCase() === "range" ? range : null) } }, respondWith: (p) => (data = p) };
    for (const f of ascolti) f(evento);
    return data;
  };
  return { chiedi, chieste };
}

export default async function (t) {
  // ---- il service worker -------------------------------------------------------
  const w = lavoratore();
  const r = w.chiedi("https://app.example/__melodia/abc%2Fd?k=ya29.chiave", "bytes=1998848-");
  t.c("risponde lui alla melodia", r !== null);
  t.eq("e chiede a Drive il file giusto", w.chieste[0]?.url, "https://www.googleapis.com/drive/v3/files/abc%2Fd?alt=media");
  t.eq("con la chiave nella testata", w.chieste[0]?.testate.Authorization, "Bearer ya29.chiave");
  t.eq("e lo stesso pezzo chiesto dall'<audio>", w.chieste[0]?.testate.Range, "bytes=1998848-");
  w.chiedi("https://app.example/__melodia/abc?k=x");
  t.c("senza pezzo, nessun Range inventato", !("Range" in (w.chieste[1]?.testate || {})));
  t.eq("il resto dell'app non lo tocca", w.chiedi("https://app.example/assets/index.js", null), null);
  t.eq("e nemmeno Drive chiesto dalla pagina", w.chieste.length, 2);

  // ---- l'indirizzo ---------------------------------------------------------------
  const vecchio = globalThis.localStorage;
  globalThis.localStorage = memoria();
  try {
    localStorage.setItem("bc_drive_on", "1");
    localStorage.setItem("bc_drive_client", "123-abc.apps.googleusercontent.com");
    localStorage.setItem("bc_drive_token", JSON.stringify({ chiave: "ya29.a b", scade: Date.now() + 3600000 }));
    localStorage.setItem("bc_drive_melodie", JSON.stringify({ T1: { id: "f/1" } }));
    const sw = { controller: {} };
    t.eq("l'indirizzo di casa, con file e chiave", await indirizzoMelodia("T1", { sw }), "/__melodia/f%2F1?k=ya29.a%20b");
    t.eq("senza un service worker che comanda, la melodia scende intera", await indirizzoMelodia("T1", { sw: { controller: null } }), null);
    t.eq("senza service worker del tutto, anche", await indirizzoMelodia("T1", { sw: undefined }), null);
    localStorage.setItem("bc_drive_on", "0");
    t.eq("con Drive spento, niente", await indirizzoMelodia("T1", { sw }), null);
  } finally {
    globalThis.localStorage = vecchio;
  }
}

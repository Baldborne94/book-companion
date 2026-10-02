// IL REGISTRO DEGLI ERRORI (`lib/registro.js`). Sbaglia in silenzio in tre
// modi: un rapporto che porta via una chiave o un indirizzo, un guasto che
// si ripete e spinge fuori tutti gli altri, un registro che esplode lui e
// diventa un secondo guasto.
import { pulisci, annotaErrore, erroriAnnotati, svuotaErrori, rapporto, ascoltaErrori, eRumore, TENUTI } from "../src/lib/registro.js";

function storage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

export default async function (t) {
  // ---- niente dati personali -----------------------------------------------------------
  t.eq("l'indirizzo", pulisci("login fallito per mario.rossi+x@gmail.com"), "login fallito per [email]");
  t.eq("la chiave dell'Oracolo", pulisci("401 con sk-ant-api03-AbC_d-9"), "401 con [chiave]");
  t.eq("la chiave di Google", pulisci("key AIzaSyA1234567890abcdefghijklmnop"), "key [chiave]");
  t.eq("il gettone di Google", pulisci("token ya29.a0Af-xyz.123"), "token [gettone]");
  t.eq("un Bearer", pulisci("Authorization: Bearer abc.def-ghi"), "Authorization: Bearer [gettone]");
  t.eq("il gettone di Supabase", pulisci("jwt eyJhbGci.eyJzdWIi.c2lnbg"), "jwt [gettone]");
  t.eq("una chiave in un indirizzo", pulisci("GET https://x.io/a?key=segreta&b=1"), "GET https://x.io/a?key=[…]&b=1");
  t.eq("la chiave nell'indirizzo di una melodia", pulisci("GET /__melodia/abc?k=ya2-x9"), "GET /__melodia/abc?k=[…]");
  t.eq("un messaggio qualunque resta com'è", pulisci("Cannot read properties of null (reading 'cfi')"), "Cannot read properties of null (reading 'cfi')");

  // ---- si annota, e le ripetizioni si contano -------------------------------------------
  const st = storage();
  const e = new Error("Cannot read properties of null (reading 'cfi') per a@b.it");
  annotaErrore(e, { dove: "disegno", ora: 1000, st });
  annotaErrore(e, { dove: "disegno", ora: 2000, st });
  annotaErrore(new Error("altro"), { dove: "sincronizzazione", ora: 3000, st });
  const r = erroriAnnotati(st);
  t.eq("due righe, non tre", r.length, 2);
  t.eq("la ripetizione si conta", r[0].n, 2);
  t.eq("…e l'ora e' dell'ultima volta", r[0].q, 2000);
  t.c("l'indirizzo non arriva nel registro", !JSON.stringify(r).includes("a@b.it"));
  t.c("la pila si tiene, corta", r[0].s.split("\n").length <= 8 && r[0].s.length > 0);
  annotaErrore(new Error("pila"), { ora: 1, st, pila: Array.from({ length: 20 }, (_, i) => `at f${i}`).join("\n") });
  t.eq("una pila lunga si tiene corta", erroriAnnotati(st).at(-1).s.split("\n").length, 8);
  annotaErrore("x".repeat(1000), { ora: 1, st });
  t.eq("un messaggio lunghissimo si accorcia", erroriAnnotati(st).at(-1).m.length, 300);
  for (let i = 0; i < 50; i++) annotaErrore(new Error(`guasto ${i}`), { ora: i, st });
  t.eq(`se ne tengono ${TENUTI}`, erroriAnnotati(st).length, TENUTI);
  t.eq("…gli ultimi", erroriAnnotati(st).at(-1).m, "guasto 49");
  svuotaErrori(st);
  t.eq("svuotato", erroriAnnotati(st).length, 0);

  // ---- un registro rotto non e' un secondo guasto ----------------------------------------
  const rotto = { getItem: () => "{rotto", setItem: () => { throw new Error("pieno"); }, removeItem: () => {} };
  let esploso = false;
  try {
    annotaErrore(new Error("x"), { st: rotto });
  } catch {
    esploso = true;
  }
  t.eq("uno storage pieno non fa esplodere niente", esploso, false);
  t.eq("…e uno rotto vale nessun guasto", erroriAnnotati(rotto).length, 0);
  const storto = storage();
  storto.setItem("bc_errori", '{"a":1}');
  t.eq("…e uno che non e' un elenco anche", erroriAnnotati(storto).length, 0);

  // ---- il rapporto ----------------------------------------------------------------------------
  const st2 = storage();
  annotaErrore(new Error("primo"), { dove: "pagina", ora: Date.UTC(2026, 8, 30, 8), st: st2 });
  annotaErrore(new Error("secondo"), { dove: "sincronizzazione", ora: Date.UTC(2026, 8, 30, 9), st: st2 });
  const testo = rapporto({ errori: erroriAnnotati(st2), versione: "1.0.0 · 30/09", ambiente: { navigatore: "Chrome", schermo: "1280×800", guscio: "app Android" }, ora: Date.UTC(2026, 8, 30, 10) });
  t.c("dice la versione e il dispositivo", /Versione: 1\.0\.0/.test(testo) && /1280×800/.test(testo) && /app Android/.test(testo) && /Browser: Chrome/.test(testo));
  t.c("il piu' recente prima", testo.indexOf("secondo") < testo.indexOf("primo"));
  t.c("…con dove e' successo", testo.includes("· sincronizzazione"));
  t.eq("senza guasti lo dice", rapporto({ errori: [] }).split("\n").at(-1), "Nessun guasto annotato.");

  // ---- in ascolto ------------------------------------------------------------------------------
  const ascolti = {};
  const finestra = { addEventListener: (k, f) => (ascolti[k] = f), removeEventListener: (k) => delete ascolti[k] };
  const presi = [];
  const smetti = ascoltaErrori(finestra, (err, o) => presi.push(`${o.dove}:${err?.message || err}`));
  ascolti.error({ error: new Error("boom") });
  ascolti.error({ message: "ResizeObserver loop completed with undelivered notifications." });
  ascolti.unhandledrejection({ reason: new Error("rete") });
  ascolti.error({ message: "Script error." });
  ascolti.unhandledrejection({ reason: new Error("ResizeObserver loop completed") });
  t.eq("guasti presi, rumore lasciato", presi.join(","), "pagina:boom,promessa:rete");
  smetti();
  t.eq("e smette", Object.keys(ascolti).length, 0);
  t.eq("il rumore", eRumore("ResizeObserver loop limit exceeded"), true);
}

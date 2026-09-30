// UN ACCESSO SOLO, E GOOGLE CHE NON CHIEDE PIU' (chiesto dal lettore: il
// login «non mi convince» — due accessi separati, Google che chiede di nuovo
// ogni ora, il pannello confuso). «Entra con Google» fa entrare nella
// biblioteca (Supabase) e insieme chiede il permesso per Drive, a lungo
// termine (`access_type=offline`): Supabase consegna, una volta sola, la
// chiave di Drive del momento (`provider_token`) e il permesso per averne
// altre (`provider_refresh_token`). La chiave va a `drive.js`; il permesso
// si custodisce nel Supabase del lettore (`google_refresh`, una riga sua,
// protetta dalle regole RLS), e da li' la funzione su Vercel
// (`rinnovoGoogle.js`) ne ricava una chiave nuova quando serve.
//
// Le decisioni stanno in funzioni con la rete passata da fuori: si provano
// in Node (per questo `supabase.js`, che legge le variabili della build, si
// carica solo quando serve).
const client = async (sb) => sb || (await import("./supabase.js")).getClient();
import { accettaChiave, impostaRinnovo } from "./drive.js";

export const SCOPE_DRIVE = "https://www.googleapis.com/auth/drive";
// l'esito dell'ultimo rinnovo: «nessuno» (mai entrato con Google) e
// «revocato» fermano i tentativi finche' non si rientra con Google
const STATO_KEY = "bc_google_rinnovo";
// la chiave consegnata all'ingresso si prende una volta: la sessione
// salvata la ripete a ogni avvio, ma dopo un'ora e' vecchia
const VISTA_KEY = "bc_google_vista";

const leggi = (st, k) => {
  try {
    return st.getItem(k);
  } catch {
    return null;
  }
};
const scrivi = (st, k, v) => {
  try {
    if (v == null) st.removeItem(k);
    else st.setItem(k, v);
  } catch {
    /* senza memoria si ritenta, e basta */
  }
};

export const statoRinnovo = (st = globalThis.localStorage) => leggi(st, STATO_KEY) || "";

export async function entraConGoogle({ sb = null, origine = globalThis.location?.origin } = {}) {
  const c = await client(sb);
  if (!c) throw new Error("sync non configurata");
  const { error } = await c.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: origine,
      scopes: SCOPE_DRIVE,
      // `prompt=consent` perche' Google consegni il permesso a lungo termine
      // anche a chi l'aveva gia' dato: senza, lo da' solo la prima volta
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
  if (error) throw error;
}

// All'ingresso con Google: la chiave a Drive, il permesso nel Supabase.
// Torna cosa e' successo, per dirlo: { chiave, permesso: "salvato" |
// "non salvato" | null }.
export async function custodisciGoogle(sessione, { sb = null, st = globalThis.localStorage, accetta = accettaChiave, ora = Date.now() } = {}) {
  const chiave = sessione?.provider_token;
  if (!chiave || leggi(st, VISTA_KEY) === chiave.slice(-16)) return { chiave: false, permesso: null };
  scrivi(st, VISTA_KEY, chiave.slice(-16));
  // un minuto di meno: la chiave e' nata quando Google ha risposto, non ora
  accetta({ chiave, scade: ora + 59 * 60_000 });
  const rt = sessione.provider_refresh_token;
  if (!rt || !sessione.user?.id) return { chiave: true, permesso: null };
  const c = await client(sb);
  const { error } = (await c?.from("google_refresh").upsert({ user_id: sessione.user.id, token: rt, aggiornato: new Date(ora).toISOString() })) || { error: new Error("sync non configurata") };
  if (error) return { chiave: true, permesso: "non salvato", errore: error };
  scrivi(st, STATO_KEY, null);
  return { chiave: true, permesso: "salvato" };
}

// La chiave nuova dal server, o null. Chi non ha un permesso salvato
// («nessuno») o l'ha perso («revocato») non si richiede a ogni avvio: si
// aspetta il prossimo ingresso con Google.
export function rinnovoDalServer({ sessione, fetch: rete = globalThis.fetch, st = globalThis.localStorage, indirizzo = "/api/google-token" } = {}) {
  return async () => {
    const fermo = statoRinnovo(st);
    if (fermo === "nessuno" || fermo === "revocato") return null;
    const s = await sessione();
    if (!s?.access_token) return null;
    const r = await rete(indirizzo, { method: "POST", headers: { Authorization: `Bearer ${s.access_token}` } });
    const corpo = await r.json().catch(() => ({}));
    if (corpo?.chiave) {
      scrivi(st, STATO_KEY, "ok");
      return { chiave: corpo.chiave, scade: Number(corpo.scade) };
    }
    if (corpo?.motivo === "nessuno" || corpo?.motivo === "revocato") scrivi(st, STATO_KEY, corpo.motivo);
    return null;
  };
}

// Uscendo, QUESTO dispositivo smette di usare il permesso. La riga nel
// Supabase resta: e' dell'account, non del tablet, e cancellarla uscendo
// dal PC toglierebbe il rinnovo anche al tablet che sta leggendo.
export function lasciaGoogleQui({ st = globalThis.localStorage, imposta = impostaRinnovo } = {}) {
  scrivi(st, STATO_KEY, null);
  scrivi(st, VISTA_KEY, null);
  imposta(null);
}

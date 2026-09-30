// LA CHIAVE DI DRIVE RINNOVATA DAL SERVER (`rinnovaChiave`, per la funzione
// `api/google-token.js`). Sbaglia in silenzio nei modi che contano: dare la
// chiave di un altro (il server deve leggere la riga CON la sessione di chi
// chiede, non con una chiave che vede tutto), darla a chi non ha una
// sessione, o scambiare il permesso tolto per un guasto.
import { rinnovaChiave } from "../src/lib/rinnovoGoogle.js";

const ENV = { VITE_SUPABASE_URL: "https://progetto.supabase.co/", VITE_SUPABASE_ANON_KEY: "anon", VITE_GOOGLE_CLIENT_ID: "id.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "segreto" };

function mondo({ utente = { id: "u1" }, righe = [{ token: "rt-1" }], google = { access_token: "ya29.nuova", expires_in: 3599 }, googleOk = true, rigaOk = true } = {}) {
  const chieste = [];
  const fetch = async (url, op = {}) => {
    chieste.push({ url, op });
    const r = (ok, corpo, status = ok ? 200 : 400) => ({ ok, status, json: async () => corpo });
    if (url.endsWith("/auth/v1/user")) return op.headers?.Authorization === "Bearer jwt-buono" && utente ? r(true, utente) : r(false, {}, 401);
    if (url.includes("/rest/v1/google_refresh")) return rigaOk ? r(true, righe) : r(false, {}, 404);
    if (url.startsWith("https://oauth2.googleapis.com/token")) return r(googleOk, google);
    throw new Error(`inatteso: ${url}`);
  };
  return { fetch, chieste };
}

export default async (t) => {
  const m = mondo();
  const ok = await rinnovaChiave({ jwt: "jwt-buono", env: ENV, fetch: m.fetch, ora: 1000 });
  t.eq("una chiave nuova, e quando scade", JSON.stringify(ok), JSON.stringify({ stato: 200, corpo: { chiave: "ya29.nuova", scade: 1000 + 3599 * 1000 } }));
  const riga = m.chieste.find((c) => c.url.includes("google_refresh"));
  t.eq("la riga si legge con la sessione di chi chiede", riga.op.headers.Authorization, "Bearer jwt-buono");
  t.c("…e solo la sua", riga.url.includes("user_id=eq.u1") && riga.url.startsWith("https://progetto.supabase.co/rest/v1/"));
  const g = m.chieste.find((c) => c.url.startsWith("https://oauth2"));
  const corpo = new URLSearchParams(g.op.body);
  t.eq("a Google il permesso, il client e il segreto", [corpo.get("refresh_token"), corpo.get("client_id"), corpo.get("client_secret"), corpo.get("grant_type")].join(), "rt-1,id.apps.googleusercontent.com,segreto,refresh_token");

  t.eq("senza sessione niente", (await rinnovaChiave({ jwt: "", env: ENV, fetch: mondo().fetch })).stato, 401);
  const intruso = mondo();
  t.eq("una sessione che Supabase non riconosce, niente", (await rinnovaChiave({ jwt: "jwt-falso", env: ENV, fetch: intruso.fetch })).stato, 401);
  t.c("…e non si arriva a leggere nessuna riga", !intruso.chieste.some((c) => c.url.includes("google_refresh")));
  t.eq("un utente senza id, niente", (await rinnovaChiave({ jwt: "jwt-buono", env: ENV, fetch: mondo({ utente: {} }).fetch })).stato, 401);

  const nessuno = await rinnovaChiave({ jwt: "jwt-buono", env: ENV, fetch: mondo({ righe: [] }).fetch });
  t.eq("chi non e' mai entrato con Google non ha niente da rinnovare", `${nessuno.stato} ${nessuno.corpo.motivo}`, "404 nessuno");
  t.eq("la tabella che manca (lo schema non aggiornato) si dice", (await rinnovaChiave({ jwt: "jwt-buono", env: ENV, fetch: mondo({ rigaOk: false }).fetch })).corpo.motivo, "supabase");

  const tolto = await rinnovaChiave({ jwt: "jwt-buono", env: ENV, fetch: mondo({ googleOk: false, google: { error: "invalid_grant" } }).fetch });
  t.eq("il permesso tolto non e' un guasto: si torna a chiedere l'accesso", `${tolto.stato} ${tolto.corpo.motivo}`, "401 revocato");
  const giu = await rinnovaChiave({ jwt: "jwt-buono", env: ENV, fetch: mondo({ googleOk: false, google: { error: "server_error" } }).fetch });
  t.eq("Google che non risponde e' un'altra cosa", `${giu.stato} ${giu.corpo.motivo}`, "502 google");
  t.eq("senza la chiave nella risposta non si inventa niente", (await rinnovaChiave({ jwt: "jwt-buono", env: ENV, fetch: mondo({ google: {} }).fetch })).stato, 502);
  t.eq("la durata che manca vale un'ora", (await rinnovaChiave({ jwt: "jwt-buono", env: ENV, fetch: mondo({ google: { access_token: "x" } }).fetch, ora: 0 })).corpo.scade, 3600 * 1000);

  for (const k of Object.keys(ENV)) {
    const env = { ...ENV, [k]: "" };
    t.eq(`senza ${k} il server lo dice invece di tentare`, (await rinnovaChiave({ jwt: "jwt-buono", env, fetch: mondo().fetch })).corpo.motivo, "configurazione");
  }
  const rete = await rinnovaChiave({ jwt: "jwt-buono", env: ENV, fetch: async () => { throw new Error("giu'"); } });
  t.eq("la rete che cade non fa esplodere la funzione", rete.stato, 401);
  const soloGoogle = mondo();
  const giuGoogle = await rinnovaChiave({ jwt: "jwt-buono", env: ENV, fetch: (url, op) => (url.startsWith("https://oauth2") ? Promise.reject(new Error("giu'")) : soloGoogle.fetch(url, op)) });
  t.eq("…neanche quando cade solo Google", `${giuGoogle.stato} ${giuGoogle.corpo.motivo}`, "502 google");
};

// LA CHIAVE DI GOOGLE DRIVE CHE SI RINNOVA DA SOLA (chiesto dal lettore: il
// login «non mi convince» — due accessi separati, e Google che chiede di
// nuovo ogni ora). La chiave di Drive dura un'ora; per averne una nuova
// senza aprire la finestra di Google serve il permesso a lungo termine
// (`refresh_token`) E il segreto del client, che in una pagina web non puo'
// stare. Qui la parte che gira sul server (`api/google-token.js`, su
// Vercel): verifica chi chiede con la sua sessione di Supabase, legge il
// SUO permesso dalla tabella `google_refresh` con la sua stessa sessione
// (le regole RLS lasciano leggere a ognuno solo la propria riga: il server
// non ha una chiave che veda di piu'), e chiede a Google una chiave nuova.
// La rete si passa da fuori: si prova in Node.

const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

const risposta = (stato, corpo) => ({ stato, corpo });

export async function rinnovaChiave({ jwt, env = {}, fetch: rete = globalThis.fetch, ora = Date.now() } = {}) {
  const url = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/+$/, "");
  const anon = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  const clientId = env.VITE_GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID;
  const segreto = env.GOOGLE_CLIENT_SECRET;
  if (!url || !anon || !clientId || !segreto) return risposta(500, { motivo: "configurazione" });
  const comeLui = { apikey: anon, Authorization: `Bearer ${jwt}` };

  const chi = await rete(`${url}/auth/v1/user`, { headers: comeLui }).catch(() => null);
  if (!chi?.ok) return risposta(401, { motivo: "sessione" });
  const utente = await chi.json().catch(() => null);
  if (!utente?.id) return risposta(401, { motivo: "sessione" });

  const riga = await rete(`${url}/rest/v1/google_refresh?select=token&user_id=eq.${encodeURIComponent(utente.id)}&limit=1`, { headers: comeLui }).catch(() => null);
  if (!riga?.ok) return risposta(502, { motivo: "supabase", stato: riga?.status || 0 });
  const token = (await riga.json().catch(() => []))?.[0]?.token;
  if (!token) return risposta(404, { motivo: "nessuno" });

  const g = await rete(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: segreto, refresh_token: token, grant_type: "refresh_token" }).toString(),
  }).catch(() => null);
  if (!g) return risposta(502, { motivo: "google" });
  const d = await g.json().catch(() => ({}));
  // il permesso tolto dal lettore (o scaduto: un'app lasciata «in prova» su
  // Google Cloud lo perde dopo sette giorni) non e' un guasto del server:
  // si dice, e l'app torna a chiedere l'accesso con Google
  if (d?.error === "invalid_grant") return risposta(401, { motivo: "revocato" });
  if (!g.ok || !d?.access_token) return risposta(502, { motivo: "google", errore: d?.error || g.status });
  return risposta(200, { chiave: d.access_token, scade: ora + (Number(d.expires_in) || 3600) * 1000 });
}

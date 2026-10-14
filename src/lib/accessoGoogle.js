// «ENTRA CON GOOGLE» fa entrare nella biblioteca (Supabase) e basta: Google
// Drive non c'e' piu' (lasciato dal lettore), e Google non chiede altri
// permessi. Si prova in Node: `supabase.js`, che legge le variabili della
// build, si carica solo quando serve.
const client = async (sb) => sb || (await import("./supabase.js")).getClient();

export async function entraConGoogle({ sb = null, origine = globalThis.location?.origin } = {}) {
  const c = await client(sb);
  if (!c) throw new Error("sync non configurata");
  const { error } = await c.auth.signInWithOAuth({ provider: "google", options: { redirectTo: origine } });
  if (error) throw error;
}

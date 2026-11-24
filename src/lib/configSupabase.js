// SUPABASE DALLA BUILD O DAL POSTO DOVE GIRA L'APP. Su Vercel le chiavi
// entrano nella build; sul NAS l'immagine e' una sola, pubblica e uguale per
// tutti (la costruisce GitHub), e indirizzo e chiave anon li scrive nginx
// all'avvio in /config.js dal .env del NAS (deploy/nas). Vince la build.
export function configSupabase(build, sulPosto) {
  const url = build?.VITE_SUPABASE_URL || sulPosto?.supabaseUrl || "";
  const key = build?.VITE_SUPABASE_ANON_KEY || sulPosto?.supabaseAnonKey || "";
  return { url, key };
}

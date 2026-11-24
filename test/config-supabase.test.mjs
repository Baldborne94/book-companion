// SUPABASE DALLA BUILD O DAL POSTO. Sul NAS l'immagine dell'app la costruisce
// GitHub, una per tutti e pubblica: indirizzo e chiave anon arrivano a
// runtime da /config.js (deploy/nas/config.sh). Su Vercel restano nella
// build, e la build vince.
import { configSupabase } from "../src/lib/configSupabase.js";

export default async function (t) {
  const posto = { supabaseUrl: "https://nas.ts.net", supabaseAnonKey: "anon-nas" };
  const build = { VITE_SUPABASE_URL: "https://x.supabase.co", VITE_SUPABASE_ANON_KEY: "anon-build" };
  t.eq("dal posto quando la build non li ha: indirizzo", configSupabase({}, posto).url, "https://nas.ts.net");
  t.eq("dal posto quando la build non li ha: chiave", configSupabase({}, posto).key, "anon-nas");
  t.eq("la build vince sul posto", configSupabase(build, posto).url, "https://x.supabase.co");
  t.eq("e la sua chiave", configSupabase(build, posto).key, "anon-build");
  t.eq("niente da nessuna parte: vuoto, quindi niente sincronizzazione", configSupabase({}, null).url, "");
  t.eq("il config.js vuoto di Vercel non toglie la build", configSupabase(build, {}).url, "https://x.supabase.co");
}

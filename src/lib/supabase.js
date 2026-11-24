import { configSupabase } from "./configSupabase.js";

const { url, key } = configSupabase(
  { VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY },
  typeof window !== "undefined" ? window.__BC_CONFIG__ : null
);

let clientPromise = null;

export const isSyncConfigured = () => !!(url && key);

export function getClient() {
  if (!isSyncConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    );
  }
  return clientPromise;
}

export const BUCKET = "books";

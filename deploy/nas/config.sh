#!/bin/sh
# Scrive /config.js all'avvio di nginx con il Supabase del NAS, preso
# dall'ambiente del container (SUPABASE_URL, SUPABASE_ANON_KEY dal .env).
# Senza valori resta il file vuoto della build.
set -e
[ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_ANON_KEY" ] || exit 0
pulito() { printf '%s' "$1" | tr -d '"\\\n\r'; }
printf 'window.__BC_CONFIG__ = {"supabaseUrl":"%s","supabaseAnonKey":"%s"};\n' \
  "$(pulito "$SUPABASE_URL")" "$(pulito "$SUPABASE_ANON_KEY")" > /usr/share/nginx/html/config.js

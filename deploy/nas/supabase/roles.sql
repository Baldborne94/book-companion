-- dal self-hosting ufficiale di Supabase (docker/volumes/db/roles.sql): le password dei ruoli di servizio
-- (senza supabase_functions_admin: lo crea webhooks.sql, delle Edge Functions, che qui non ci sono)
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER pgbouncer WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';

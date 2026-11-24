# Gli script del database entrano nell'immagine invece di essere montati: sulle
# cartelle condivise di UGOS (permessi ACL, il «+» di ls -la) l'utente postgres
# del container non li leggeva («99-jwt.sql: Permission denied») e
# l'inizializzazione si fermava a meta'. COPY + chmod: il builder classico di
# UGOS non conosce COPY --chmod.
FROM supabase/postgres:17.6.1.136
COPY deploy/nas/supabase/roles.sql /docker-entrypoint-initdb.d/init-scripts/99-roles.sql
COPY deploy/nas/supabase/jwt.sql /docker-entrypoint-initdb.d/init-scripts/99-jwt.sql
COPY supabase/schema.sql /schema.sql
RUN chmod 644 /docker-entrypoint-initdb.d/init-scripts/99-roles.sql /docker-entrypoint-initdb.d/init-scripts/99-jwt.sql /schema.sql

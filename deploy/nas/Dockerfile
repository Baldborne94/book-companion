FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:stable-alpine
# I processi di nginx leggono la Biblioteca come root: la cartella condivisa di
# UGOS (permessi ACL) all'utente «nginx» del container rispondeva 403. Il
# montaggio resta in sola lettura (:ro nel compose).
RUN sed -i 's/^user .*;/user root;/' /etc/nginx/nginx.conf && grep -q '^user root;' /etc/nginx/nginx.conf
COPY deploy/nas/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# l'immagine e' una sola per tutti: Supabase lo dice il .env del NAS all'avvio
COPY deploy/nas/config.sh /docker-entrypoint.d/40-config.sh
RUN chmod 755 /docker-entrypoint.d/40-config.sh

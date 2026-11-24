FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build

FROM nginx:stable-alpine
# I processi di nginx leggono la Biblioteca come root: la cartella condivisa di
# UGOS (permessi ACL) all'utente «nginx» del container rispondeva 403. Il
# montaggio resta in sola lettura (:ro nel compose).
RUN sed -i 's/^user .*;/user root;/' /etc/nginx/nginx.conf && grep -q '^user root;' /etc/nginx/nginx.conf
COPY deploy/nas/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

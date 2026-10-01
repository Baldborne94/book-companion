// UN SUPABASE FINTO, CON MEMORIA: la tabella `books`, le preferenze e il
// secchio delle copertine, quel tanto che serve a far parlare due
// dispositivi fra loro come fa il servizio vero. La sessione si finge dal
// lato del browser (`sessioneFinta`): questo server non controlla chi entra.
import http from "node:http";

// COME IL SERVIZIO VERO, UNA RICHIESTA DA' AL PIU' MILLE RIGHE (il «Max rows»
// di PostgREST, mille di partenza in ogni progetto Supabase): chi ne vuole di
// piu' le chiede a pagine (`offset`, `limit`). Un finto che le dava tutte ha
// nascosto per mesi una biblioteca di 1070 libri che arrivava a meta'.
export const MAX_RIGHE = 1000;

export function avviaSupabase(porta = 4599) {
  const books = new Map();
  let salite = 0;
  const oggetti = new Map();
  let prefs = null;
  // «Entra con Google»: le richieste d'accesso ricevute e i permessi salvati
  const accessi = [];
  const permessi = new Map();
  const ora = () => Math.floor(Date.now() / 1000);
  const UTENTE = { id: "u1", aud: "authenticated", role: "authenticated", email: "prova@esempio.it", app_metadata: { provider: "google", providers: ["email", "google"] } };
  // la sessione come la consegna Supabase al ritorno da Google: con la
  // chiave di Drive e il permesso a lungo termine
  const SESSIONE = () => ({ access_token: "a.b.c", refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: ora() + 3600, provider_token: "ya29.dal-google", provider_refresh_token: "rt-google", user: UTENTE });
  const server = http.createServer((req, res) => {
    const pezzi = [];
    req.on("data", (c) => pezzi.push(c));
    req.on("end", () => {
      const corpo = Buffer.concat(pezzi);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Access-Control-Allow-Methods", "*");
      res.setHeader("Access-Control-Expose-Headers", "*");
      if (req.method === "OPTIONS") return res.end();
      const u = new URL(req.url, "http://x");
      const json = (x, stato = 200) => {
        res.statusCode = stato;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(x));
      };
      if (u.pathname === "/auth/v1/authorize") {
        accessi.push(Object.fromEntries(u.searchParams));
        const torna = u.searchParams.get("redirect_to");
        // PKCE: un codice da scambiare; senza, la sessione nel frammento
        const dove = u.searchParams.get("code_challenge")
          ? `${torna}${torna.includes("?") ? "&" : "?"}code=codice-finto`
          : `${torna}#${new URLSearchParams(Object.entries(SESSIONE()).filter(([k]) => k !== "user").map(([k, v]) => [k, String(v)]))}`;
        res.statusCode = 302;
        res.setHeader("Location", dove);
        return res.end();
      }
      if (u.pathname === "/auth/v1/token" && u.searchParams.get("grant_type") === "pkce") return json(SESSIONE());
      if (u.pathname === "/auth/v1/user") return json(UTENTE);
      if (u.pathname === "/rest/v1/google_refresh") {
        if (req.method === "GET") return json([...permessi.values()]);
        const arr = JSON.parse(corpo.toString() || "[]");
        for (const r of Array.isArray(arr) ? arr : [arr]) permessi.set(r.user_id, r);
        return json([], 201);
      }
      if (u.pathname === "/rest/v1/books") {
        if (req.method === "GET") {
          const colonne = (u.searchParams.get("select") || "*").split(",");
          let righe = [...books.values()];
          const ids = u.searchParams.get("id");
          if (ids?.startsWith("in.(")) {
            const voluti = new Set(ids.slice(4, -1).split(",").map((x) => x.replace(/"/g, "")));
            righe = righe.filter((r) => voluti.has(r.id));
          }
          // senza `order` Postgres non promette nessun ordine, e due pagine
          // possono accavallarsi: qui l'ordine cambia a ogni richiesta
          if (/^id\./.test(u.searchParams.get("order") || "")) righe.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
          else righe.sort(() => Math.random() - 0.5);
          const da = Number(u.searchParams.get("offset") || 0);
          const quante = Math.min(MAX_RIGHE, Number(u.searchParams.get("limit") || MAX_RIGHE));
          righe = righe.slice(da, da + quante);
          if (colonne[0] !== "*") righe = righe.map((r) => Object.fromEntries(colonne.map((k) => [k, r[k] ?? null])));
          return json(righe);
        }
        const arr = JSON.parse(corpo.toString() || "[]");
        for (const r of Array.isArray(arr) ? arr : [arr]) {
          books.set(r.id, { ...(books.get(r.id) || {}), ...r });
          salite += 1;
        }
        return json([], 201);
      }
      if (u.pathname === "/rest/v1/prefs") {
        if (req.method === "GET") return json(prefs ? [prefs] : []);
        const arr = JSON.parse(corpo.toString() || "[]");
        prefs = Array.isArray(arr) ? arr[0] : arr;
        return json([], 201);
      }
      // il secchio: elenco, caricamento, scaricamento, rimozione
      const lista = /^\/storage\/v1\/object\/list\/([^/]+)$/.exec(u.pathname);
      if (lista) {
        const { prefix = "" } = JSON.parse(corpo.toString() || "{}");
        const dentro = [...oggetti.entries()]
          .filter(([k]) => k.startsWith(`${lista[1]}/${prefix ? `${prefix}/` : ""}`))
          .map(([k, v]) => ({ name: k.split("/").pop(), id: k, metadata: { size: v.length } }));
        return json(dentro);
      }
      const ogg = /^\/storage\/v1\/object\/(?:public\/|authenticated\/)?(.+)$/.exec(u.pathname);
      if (ogg) {
        const chiave = decodeURIComponent(ogg[1]);
        if (req.method === "GET") {
          if (!oggetti.has(chiave)) return json({ statusCode: "404", error: "not_found", message: "Object not found" }, 400);
          res.setHeader("Content-Type", "application/octet-stream");
          return res.end(oggetti.get(chiave));
        }
        if (req.method === "DELETE") {
          const { prefixes = [] } = JSON.parse(corpo.toString() || "{}");
          const secchio = chiave.split("/")[0];
          for (const p of prefixes) oggetti.delete(`${secchio}/${p}`);
          return json([]);
        }
        oggetti.set(chiave, corpo);
        return json({ Key: chiave });
      }
      return json([]);
    });
  });
  return new Promise((ok) =>
    server.listen(porta, () =>
      ok({
        righe: () => [...books.values()],
        salite: () => salite,
        accessi: () => [...accessi],
        permessi: () => [...permessi.values()],
        chiudi: () =>
          new Promise((c) => {
            server.closeAllConnections?.();
            server.close(c);
          }),
      })
    )
  );
}

// la sessione come la lascia la libreria di Supabase: un gettone che scade
// domani, e un utente
export function sessioneFinta() {
  if (localStorage.getItem("sb-localhost-auth-token")) return;
  const ora = Math.floor(Date.now() / 1000);
  localStorage.setItem(
    "sb-localhost-auth-token",
    JSON.stringify({
      access_token: "a.b.c",
      refresh_token: "r",
      token_type: "bearer",
      expires_in: 86400,
      expires_at: ora + 86400,
      user: { id: "u1", aud: "authenticated", role: "authenticated", email: "prova@esempio.it" },
    })
  );
}

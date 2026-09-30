// UN SUPABASE FINTO, CON MEMORIA: la tabella `books`, le preferenze e il
// secchio delle copertine, quel tanto che serve a far parlare due
// dispositivi fra loro come fa il servizio vero. La sessione si finge dal
// lato del browser (`sessioneFinta`): questo server non controlla chi entra.
import http from "node:http";

export function avviaSupabase(porta = 4599) {
  const books = new Map();
  const oggetti = new Map();
  let prefs = null;
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
      if (u.pathname === "/rest/v1/books") {
        if (req.method === "GET") {
          const colonne = (u.searchParams.get("select") || "*").split(",");
          let righe = [...books.values()];
          const ids = u.searchParams.get("id");
          if (ids?.startsWith("in.(")) {
            const voluti = new Set(ids.slice(4, -1).split(",").map((x) => x.replace(/"/g, "")));
            righe = righe.filter((r) => voluti.has(r.id));
          }
          if (colonne[0] !== "*") righe = righe.map((r) => Object.fromEntries(colonne.map((k) => [k, r[k] ?? null])));
          return json(righe);
        }
        const arr = JSON.parse(corpo.toString() || "[]");
        for (const r of Array.isArray(arr) ? arr : [arr]) books.set(r.id, { ...(books.get(r.id) || {}), ...r });
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

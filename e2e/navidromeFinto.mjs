// UN NAVIDROME FINTO per le prove: l'API Subsonic che usa BaldMusic, con le
// raccolte delle cartelle come playlist commentate, CORS aperto come il vero,
// e lo streaming di un WAV. Il gettone si controlla davvero.
import http from "node:http";
import { createHash } from "node:crypto";

export function avviaNavidrome(porta, { utente = "lettore", password = "segreta", playlist = [], brani = {}, audio }) {
  const viste = [];
  const cors = { "access-control-allow-origin": "*", "access-control-allow-private-network": "true" };
  const json = (res, corpo) => {
    res.writeHead(200, { ...cors, "content-type": "application/json" });
    res.end(JSON.stringify({ "subsonic-response": { version: "1.16.1", ...corpo } }));
  };
  const server = http.createServer((req, res) => {
    viste.push(`${req.method} ${req.url}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    const u = new URL(req.url, "http://navidrome");
    const q = u.searchParams;
    const giusto = q.get("u") === utente && q.get("t") === createHash("md5").update(password + q.get("s")).digest("hex");
    if (!giusto) return json(res, { status: "failed", error: { code: 40, message: "Wrong username or password" } });
    const metodo = u.pathname.replace(/^\/rest\//, "");
    if (metodo === "ping") return json(res, { status: "ok" });
    if (metodo === "getPlaylists") return json(res, { status: "ok", playlists: { playlist } });
    if (metodo === "getPlaylist") return json(res, { status: "ok", playlist: { id: q.get("id"), entry: brani[q.get("id")] || [] } });
    if (metodo === "stream") {
      res.writeHead(200, { ...cors, "content-type": "audio/wav", "content-length": audio.length, "accept-ranges": "none" });
      return res.end(audio);
    }
    res.writeHead(404, cors);
    res.end();
  });
  return new Promise((ok) =>
    server.listen(porta, "127.0.0.1", () => ok({ viste, chiudi: () => new Promise((fatto) => { server.closeAllConnections?.(); server.close(() => fatto()); }) }))
  );
}

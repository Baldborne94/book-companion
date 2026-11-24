// UN NAS FINTO, COME IL NGINX DI `docs/NAS.md`: le cartelle in JSON
// (`autoindex_format json`), i file interi o a pezzi (Range), e le
// intestazioni che lasciano entrare l'app da un'altra origine (CORS, e la
// rete privata nella risposta alla domanda preliminare).
import http from "node:http";

// `file`: { "book-companion/Libri/La nebbia.epub": Buffer }
export function avviaNas(porta, { file = {}, radice = "/libri/" } = {}) {
  const viste = [];
  const cors = (req) => ({
    "access-control-allow-origin": req.headers.origin || "*",
    "access-control-allow-headers": "Range, Accept",
    "access-control-expose-headers": "Content-Length, Content-Range, Accept-Ranges",
    "access-control-allow-private-network": "true",
    vary: "Origin",
  });
  const server = http.createServer((req, res) => {
    viste.push(`${req.method} ${req.url}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors(req));
      return res.end();
    }
    const url = new URL(req.url, "http://nas");
    if (!url.pathname.startsWith(radice)) {
      res.writeHead(404, cors(req));
      return res.end();
    }
    const via = decodeURIComponent(url.pathname.slice(radice.length));
    if (via === "" || via.endsWith("/")) {
      const dentro = new Map();
      for (const [p, b] of Object.entries(file)) {
        if (!p.startsWith(via)) continue;
        const resto = p.slice(via.length).split("/");
        if (resto.length > 1) dentro.set(resto[0], { name: resto[0], type: "directory", mtime: "Wed, 12 Nov 2026 08:00:00 GMT" });
        else dentro.set(resto[0], { name: resto[0], type: "file", mtime: "Wed, 12 Nov 2026 08:00:00 GMT", size: b.length });
      }
      if (!dentro.size && via) {
        res.writeHead(404, cors(req));
        return res.end();
      }
      res.writeHead(200, { ...cors(req), "content-type": "application/json" });
      return res.end(JSON.stringify([...dentro.values()]));
    }
    const b = file[via];
    if (!b) {
      res.writeHead(404, cors(req));
      return res.end();
    }
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || "");
    if (range) {
      const da = Number(range[1]);
      const a = range[2] ? Math.min(Number(range[2]), b.length - 1) : b.length - 1;
      res.writeHead(206, { ...cors(req), "content-type": "application/octet-stream", "accept-ranges": "bytes", "content-range": `bytes ${da}-${a}/${b.length}`, "content-length": a - da + 1 });
      return res.end(b.subarray(da, a + 1));
    }
    res.writeHead(200, { ...cors(req), "content-type": "application/octet-stream", "accept-ranges": "bytes", "content-length": b.length });
    res.end(b);
  });
  return new Promise((ok) =>
    server.listen(porta, () =>
      ok({
        viste,
        chiudi: () => new Promise((fatto) => (server.closeAllConnections?.(), server.close(fatto))),
      })
    )
  );
}

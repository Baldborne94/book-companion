// UN GOOGLE DRIVE FINTO, quel tanto che serve a leggere un file: il file
// intero o un pezzo (`Range`), con le richieste contate. La chiave di Google
// e la mappa dei libri su Drive si mettono nel browser (`driveNelBrowser`), e
// le chiamate a googleapis si girano qui: la rete esterna delle scene resta
// chiusa.
import http from "node:http";

export function avviaDrive(porta, file) {
  const d = { pezzi: 0, interi: 0 };
  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Expose-Headers", "*");
    if (req.method === "OPTIONS") return res.end();
    const bytes = file[new URL(req.url, "http://x").pathname.split("/").pop()];
    if (!bytes) {
      res.statusCode = 404;
      return res.end("{}");
    }
    const m = /bytes=(\d+)-(\d+)/.exec(req.headers.range || "");
    if (m) d.pezzi += 1;
    else d.interi += 1;
    const buf = m ? bytes.subarray(Number(m[1]), Number(m[2]) + 1) : bytes;
    res.statusCode = m ? 206 : 200;
    res.setHeader("Content-Length", String(buf.length));
    res.end(buf);
  });
  return new Promise((ok) =>
    server.listen(porta, () =>
      ok({
        conti: () => ({ ...d }),
        chiudi: () =>
          new Promise((c) => {
            server.closeAllConnections?.();
            server.close(c);
          }),
      })
    )
  );
}

// nel browser: Drive acceso, una chiave che scade fra un'ora, i libri
// lassu' ({bookId: {id, byte}}), e googleapis girato sul Drive finto
export function driveNelBrowser({ porta, libri, mappa }) {
  if (!localStorage.getItem("bc_books")) {
    localStorage.setItem("bc_books", JSON.stringify(libri));
    localStorage.setItem("bc_drive_on", "1");
    localStorage.setItem("bc_drive_libri", JSON.stringify(mappa));
  }
  localStorage.setItem("bc_drive_token", JSON.stringify({ chiave: "k", scade: Date.now() + 3600000 }));
  const vero = window.fetch.bind(window);
  window.fetch = (url, op) => {
    const u = String(url?.url || url);
    if (u.startsWith("https://www.googleapis.com/drive/v3/files/")) return vero(u.replace("https://www.googleapis.com", `http://localhost:${porta}`), op);
    return vero(url, op);
  };
}

// UN GOOGLE DRIVE FINTO, quel tanto che serve a leggere un file (il file
// intero o un pezzo, `Range`, con le richieste contate) e a sceglierne
// dal selettore: l'elenco, i dettagli, i segni. La chiave di Google
// e la mappa dei libri su Drive si mettono nel browser (`driveNelBrowser`), e
// le chiamate a googleapis si girano qui: la rete esterna delle scene resta
// chiusa.
import http from "node:http";

// `elenco`: le voci di Drive (file e cartelle) per chi chiede l'elenco, i
// cambiamenti o i dettagli di un file; `latenza`: ms prima di ogni risposta
export function avviaDrive(porta, file, { elenco = [], latenza = 0 } = {}) {
  const d = { pezzi: 0, interi: 0, scesi: new Set() };
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "*");
    res.setHeader("Access-Control-Expose-Headers", "*");
    if (req.method === "OPTIONS") return res.end();
    if (latenza) await new Promise((r) => setTimeout(r, latenza));
    const u = new URL(req.url, "http://x");
    const id = decodeURIComponent(u.pathname.split("/").pop());
    const json = (o) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(o));
    };
    if (u.pathname.endsWith("/changes/startPageToken")) return json({ startPageToken: "1" });
    if (u.pathname.endsWith("/changes")) return json({ newStartPageToken: "1", changes: [] });
    if (u.pathname.endsWith("/files") && req.method === "GET") return json({ files: elenco });
    // il segno che l'app scrive resta sul file, come su Drive: senza, un
    // file appena segnato tornava «di nessuno» alla scelta dopo
    if (req.method === "PATCH") {
      const pezzi = [];
      for await (const c of req) pezzi.push(c);
      const corpo = JSON.parse(Buffer.concat(pezzi).toString() || "{}");
      const voce = elenco.find((f) => f.id === id);
      if (voce && corpo.appProperties) voce.appProperties = { ...(voce.appProperties || {}), ...corpo.appProperties };
      return json({ id, appProperties: voce?.appProperties });
    }
    const bytes = u.searchParams.get("alt") === "media" ? file[id] : null;
    const voce = elenco.find((f) => f.id === id);
    if (!bytes && voce) return json(voce);
    if (!bytes) {
      res.statusCode = 404;
      return res.end("{}");
    }
    const m = /bytes=(\d+)-(\d+)/.exec(req.headers.range || "");
    d.scesi.add(id);
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
        conti: () => ({ pezzi: d.pezzi, interi: d.interi }),
        scesi: () => [...d.scesi].sort(),
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
export function driveNelBrowser({ porta, libri, mappa, scelta = null }) {
  if (!localStorage.getItem("bc_books")) {
    localStorage.setItem("bc_books", JSON.stringify(libri));
    localStorage.setItem("bc_drive_on", "1");
    localStorage.setItem("bc_drive_libri", JSON.stringify(mappa));
  }
  localStorage.setItem("bc_drive_token", JSON.stringify({ chiave: "k", scade: Date.now() + 3600000 }));
  const vero = window.fetch.bind(window);
  window.fetch = (url, op) => {
    const u = String(url?.url || url);
    if (u.startsWith("https://www.googleapis.com/drive/v3/")) return vero(u.replace("https://www.googleapis.com", `http://localhost:${porta}`), op);
    return vero(url, op);
  };
  if (!scelta) return;
  // IL SELETTORE DI GOOGLE, finto: risponde subito con i `docs` di `scelta`
  localStorage.setItem("bc_drive_api_key", "AIza" + "x".repeat(35));
  const catena = (nomi) => {
    function F() {}
    for (const k of nomi) F.prototype[k] = function () { return this; };
    return F;
  };
  const Builder = catena(["setOAuthToken", "setDeveloperKey", "setLocale", "setOrigin", "setTitle", "enableFeature", "addView"]);
  Builder.prototype.setCallback = function (f) { this.f = f; return this; };
  Builder.prototype.build = function () {
    return { setVisible: () => setTimeout(() => this.f({ action: "picked", docs: scelta }), 50) };
  };
  const DocsView = catena(["setIncludeFolders", "setSelectFolderEnabled", "setMode", "setParent"]);
  window.google = { picker: { PickerBuilder: Builder, DocsView, ViewId: { DOCS: 1 }, DocsViewMode: { LIST: 1 }, Feature: { MULTISELECT_ENABLED: 1 }, Action: { PICKED: "picked", CANCEL: "cancel" } } };
}

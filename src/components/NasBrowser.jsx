import { useEffect, useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { NAS_ROOT, listNasDir, fetchNasFile, nasSegments, metaFromNasPath } from "../lib/nas.js";
import { importFiles } from "../lib/importBook.js";

const ICON = { epub: "📖", pdf: "📄", cbz: "🗯️" };
const extOf = (name) => name.split(".").pop().toLowerCase();
const mb = (n) => (n > 0 ? `${(n / 1048576).toFixed(n > 104857600 ? 0 : 1)} MB` : "");

export default function NasBrowser({ books, updateBooks, onClose, notify, onImported, onRead }) {
  const [path, setPath] = useState(NAS_ROOT);
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let alive = true;
    setEntries(null);
    setError(null);
    listNasDir(path)
      .then((list) => alive && setEntries(list))
      .catch((e) => alive && setError(e.message || "errore"));
    return () => {
      alive = false;
    };
  }, [path]);

  const byPath = new Map(books.filter((b) => b.nasPath).map((b) => [b.nasPath, b]));
  // nasPath vive solo su questo dispositivo: i volumi arrivati dalla sync si
  // riconoscono dal titolo, che all'import e' il nome del file
  const byName = new Map(books.map((b) => [`${b.title}.${b.fileType}`.toLowerCase(), b]));
  const known = (e) => byPath.get(e.path) || byName.get(e.name.toLowerCase());
  const segs = nasSegments(path);
  const files = (entries || []).filter((e) => !e.isDir);
  const missing = files.filter((f) => !known(f));

  async function importEntries(list) {
    if (busy || !list.length) return;
    const added = [];
    const errors = [];
    try {
      for (let i = 0; i < list.length; i++) {
        const entry = list[i];
        setBusy(list.length > 1 ? `Scarico ${i + 1} di ${list.length}…` : `Scarico «${entry.name}»…`);
        try {
          const file = await fetchNasFile(entry);
          const res = await importFiles([file], () => metaFromNasPath(entry.path));
          added.push(...res.added);
          errors.push(...res.errors);
        } catch (e) {
          errors.push({ name: entry.name, reason: e.message || "download fallito" });
        }
      }
    } finally {
      setBusy(null);
    }
    if (added.length) {
      updateBooks([...books, ...added]);
      onImported?.();
    }
    const parts = [];
    if (added.length) parts.push(added.length === 1 ? "Un nuovo volume sullo scaffale ✨" : `${added.length} nuovi volumi sullo scaffale ✨`);
    errors.forEach((e) => parts.push(`«${e.name}»: ${e.reason}`));
    notify(parts.join(" · ") || "Nessun file importato");
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: "#08061199",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        animation: "bc-fade-in 0.25s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(100%, 720px)",
          height: "min(86%, 760px)",
          display: "flex",
          flexDirection: "column",
          background: C.surface,
          borderTop: `1px solid ${C.border}`,
          borderRadius: "18px 18px 0 0",
          boxShadow: "0 -12px 44px #000000aa",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 8px" }}>
          <span style={{ flex: 1, fontFamily: FONT_TITLE, fontSize: 20, fontWeight: 600, color: C.text }}>
            🗄️ Biblioteca del NAS
          </span>
          <button onClick={onClose} style={{ width: 40, height: 40, fontSize: 19, color: C.text }} aria-label="Chiudi">
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", padding: "0 16px 10px", fontSize: 14 }}>
          <button onClick={() => setPath(NAS_ROOT)} style={{ color: segs.length ? C.accent : C.text }}>
            Biblioteca
          </button>
          {segs.map((s, i) => {
            const to = NAS_ROOT + segs.slice(0, i + 1).map(encodeURIComponent).join("/") + "/";
            const last = i === segs.length - 1;
            return (
              <span key={to} style={{ display: "flex", gap: 4, color: C.muted }}>
                ›
                <button onClick={() => !last && setPath(to)} style={{ color: last ? C.text : C.accent }}>
                  {s}
                </button>
              </span>
            );
          })}
        </div>

        {missing.length > 1 && (
          <div style={{ padding: "0 16px 10px" }}>
            <button
              onClick={() => importEntries(missing)}
              disabled={!!busy}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: `1px solid ${C.accent}`,
                color: C.accent,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Importa tutta la cartella ({missing.length})
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", borderTop: `1px solid ${C.border}` }}>
          {error && (
            <div style={{ padding: 24, color: C.muted, textAlign: "center" }}>
              Non raggiungo il NAS ({error}). Tailscale è acceso su questo dispositivo?
            </div>
          )}
          {!error && !entries && <div style={{ padding: 24, color: C.muted, textAlign: "center" }}>🕯️ Sfoglio gli scaffali…</div>}
          {entries && entries.length === 0 && (
            <div style={{ padding: 24, color: C.muted, textAlign: "center" }}>Cartella vuota (o senza EPUB, PDF, CBZ)</div>
          )}
          {entries?.map((e) => {
            const have = !e.isDir && known(e);
            return (
              <button
                key={e.path}
                disabled={!!busy && !e.isDir}
                onClick={() => {
                  if (e.isDir) return setPath(e.path);
                  if (have) {
                    onClose();
                    return onRead(have.id);
                  }
                  importEntries([e]);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  textAlign: "left",
                  borderBottom: `1px solid ${C.border}66`,
                  color: C.text,
                }}
              >
                <span style={{ fontSize: 20, width: 26, textAlign: "center" }}>{e.isDir ? "📁" : ICON[extOf(e.name)] || "📄"}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 15 }}>
                  {e.name}
                </span>
                {!e.isDir && (
                  <span style={{ fontSize: 12.5, color: have ? C.accent : C.muted, whiteSpace: "nowrap" }}>
                    {have ? "✓ Leggi" : mb(e.size)}
                  </span>
                )}
                {e.isDir && <span style={{ color: C.muted }}>›</span>}
              </button>
            );
          })}
        </div>

        {busy && (
          <div style={{ padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", borderTop: `1px solid ${C.border}`, color: C.accent, fontSize: 14 }}>
            {busy}
          </div>
        )}
      </div>
    </div>
  );
}

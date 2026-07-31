import { useEffect, useRef, useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { getProgress, getStatus } from "../lib/library.js";
import { storageEstimate } from "../lib/bookStore.js";
import { importFiles } from "../lib/importBook.js";
import { exportLibrary } from "../lib/exportLibrary.js";
import BookCover from "./BookCover.jsx";
import EmptyState from "./EmptyState.jsx";

const FILTERS = [
  { id: "all", label: "Tutti" },
  { id: "unread", label: "Da leggere" },
  { id: "reading", label: "In lettura" },
  { id: "read", label: "Letti" },
];

const SORTS = [
  { id: "recent", label: "Recenti" },
  { id: "title", label: "Titolo" },
  { id: "author", label: "Autore" },
];

const GROUPS = [
  { id: "none", label: "Scaffale" },
  { id: "genre", label: "Genere", empty: "Senza genere" },
  { id: "saga", label: "Saga", empty: "Fuori saga" },
];

const fmtBytes = (n) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1e6))} MB`;

function Shelf({ books, onOpenBook, localIds }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))",
        gap: "20px 16px",
      }}
    >
      {books.map((b) => {
        const status = getStatus(b.id);
        const pct = Math.round(getProgress(b.id) * 100);
        return (
          <button
            key={b.id}
            onClick={() => onOpenBook(b.id)}
            style={{
              display: "block",
              textAlign: "center",
              animation: "bc-fade-in 0.4s ease-out",
            }}
          >
            <div style={{ position: "relative" }}>
              <BookCover book={b} />
              {status === "reading" && pct > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    padding: "2px 7px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 600,
                    background: `${C.bg}cc`,
                    border: `1px solid ${C.accent}88`,
                    color: C.accent,
                  }}
                >
                  {pct}%
                </span>
              )}
              {status === "read" && (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    padding: "2px 7px",
                    borderRadius: 10,
                    fontSize: 12,
                    background: `${C.bg}cc`,
                    border: `1px solid ${C.green}88`,
                    color: C.green,
                  }}
                >
                  ✓
                </span>
              )}
              {localIds && !localIds.has(b.id) && (
                <span
                  title="Nel cloud — si scarica quando lo apri"
                  style={{
                    position: "absolute",
                    bottom: 6,
                    left: 6,
                    padding: "1px 6px",
                    borderRadius: 10,
                    fontSize: 12,
                    background: `${C.bg}cc`,
                    border: `1px solid ${C.arcane}77`,
                    color: C.arcane,
                  }}
                >
                  ☁
                </span>
              )}
            </div>
            <div
              style={{
                height: 5,
                margin: "0 4px",
                borderRadius: "0 0 4px 4px",
                background: `linear-gradient(180deg, ${C.accent}55, #3a2b1466)`,
              }}
            />
            <div
              style={{
                marginTop: 7,
                fontSize: 14,
                lineHeight: 1.25,
                color: C.text,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {b.title}
            </div>
            {b.author && (
              <div
                style={{
                  fontSize: 12.5,
                  color: C.muted,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {b.author}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Grouped({ books, group, onOpenBook, localIds }) {
  if (group === "none") return <Shelf books={books} onOpenBook={onOpenBook} localIds={localIds} />;

  const cfg = GROUPS.find((g) => g.id === group);
  const buckets = new Map();
  for (const b of books) {
    const key = (b[group] || "").trim();
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(b);
  }
  // i libri senza etichetta chiudono la fila
  const names = [...buckets.keys()].filter(Boolean).sort((a, b) => a.localeCompare(b, "it"));
  if (buckets.has("")) names.push("");

  return names.map((name) => (
    <section key={name || "_"} style={{ marginBottom: 26 }}>
      <h3
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          fontFamily: FONT_TITLE,
          fontWeight: 600,
          fontSize: 19,
          color: name ? C.accent : C.muted,
          marginBottom: 10,
          paddingBottom: 5,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <span>{name || cfg.empty}</span>
        <span style={{ fontSize: 13, color: C.muted, fontFamily: "inherit" }}>
          {buckets.get(name).length}
        </span>
      </h3>
      <Shelf books={buckets.get(name)} onOpenBook={onOpenBook} localIds={localIds} />
    </section>
  ));
}

export default function Library({ books, updateBooks, onOpenBook, notify, localIds, onImported }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [group, setGroup] = useState("none");
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    storageEstimate().then(setEstimate);
  }, [books]);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length || importing) return;
    setImporting(true);
    try {
      const { added, errors } = await importFiles(files);
      if (added.length) {
        updateBooks([...books, ...added]);
        onImported?.();
      }
      const parts = [];
      if (added.length)
        parts.push(added.length === 1 ? "Un nuovo tomo sullo scaffale ✨" : `${added.length} nuovi tomi sullo scaffale ✨`);
      errors.forEach((e) => parts.push(`«${e.name}»: ${e.reason}`));
      notify(parts.join(" · ") || "Nessun file importato");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleExport() {
    if (!books.length) return;
    notify("Preparo il backup…");
    try {
      const n = await exportLibrary();
      notify(`Backup scaricato: ${n} ${n === 1 ? "libro" : "libri"} al sicuro 🕯️`);
    } catch {
      notify("Esportazione fallita, riprova");
    }
  }

  const q = query.trim().toLowerCase();
  const visible = books
    .filter((b) => !q || b.title.toLowerCase().includes(q) || (b.author || "").toLowerCase().includes(q))
    .filter((b) => filter === "all" || getStatus(b.id) === filter)
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "it")
        : sort === "author"
          ? (a.author || "~").localeCompare(b.author || "~", "it")
          : b.addedAt - a.addedAt
    );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      style={{
        borderRadius: 16,
        outline: dragOver ? `2px dashed ${C.accent}` : "2px dashed transparent",
        outlineOffset: 6,
        transition: "outline-color 0.2s ease-out",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".epub,.pdf"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={importing}
          style={{
            padding: "10px 20px",
            borderRadius: 12,
            background: importing ? C.dim : `linear-gradient(180deg, ${C.accent}, #b8893a)`,
            color: importing ? C.muted : "#241c0a",
            fontWeight: 600,
            fontSize: 15,
            boxShadow: importing ? "none" : `0 0 20px ${C.accent}2e`,
          }}
        >
          {importing ? "Sto rilegando i tomi…" : "＋ Aggiungi libri"}
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per titolo o autore…"
          style={{
            flex: 1,
            minWidth: 180,
            padding: "10px 14px",
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.text,
            fontSize: 15,
            outline: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: 14,
                border: `1px solid ${active ? C.accent : C.border}`,
                color: active ? C.accent : C.muted,
                background: active ? `${C.accent}14` : "transparent",
                transition: "color 0.2s ease-out, border-color 0.2s ease-out",
              }}
            >
              {f.label}
            </button>
          );
        })}
        <span style={{ flex: 1 }} />
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: `1px solid ${group === "none" ? C.border : C.accent}`,
            background: C.surface,
            color: group === "none" ? C.muted : C.accent,
            fontSize: 14,
            fontFamily: "inherit",
          }}
        >
          {GROUPS.map((g) => (
            <option key={g.id} value={g.id}>
              Raggruppa: {g.label}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.muted,
            fontSize: 14,
            fontFamily: "inherit",
          }}
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              Ordina: {s.label}
            </option>
          ))}
        </select>
      </div>

      {books.length === 0 ? (
        <EmptyState
          emoji="📜"
          title="Il tuo grimorio è ancora vuoto…"
          text="Porta qui i tuoi EPUB e PDF: appariranno come tomi su uno scaffale incantato, con le loro copertine. Puoi anche trascinarli direttamente in questa pagina."
          action="Aggiungi il primo libro"
          onAction={() => inputRef.current?.click()}
        />
      ) : visible.length === 0 ? (
        <p style={{ textAlign: "center", color: C.muted, padding: "32px 0" }}>
          Nessun tomo risponde all'appello con questi filtri…
        </p>
      ) : (
        <Grouped books={visible} group={group} onOpenBook={onOpenBook} localIds={localIds} />
      )}

      {books.length > 0 && (
        <div
          style={{
            marginTop: 32,
            paddingTop: 14,
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 13.5,
            color: C.muted,
          }}
        >
          <span>
            {books.length} {books.length === 1 ? "libro custodito" : "libri custoditi"}
            {estimate?.usage ? ` · ${fmtBytes(estimate.usage)} usati` : ""}
            {estimate?.quota ? ` di ${fmtBytes(estimate.quota)}` : ""}
          </span>
          <button
            onClick={handleExport}
            style={{
              padding: "7px 16px",
              borderRadius: 10,
              border: `1px solid ${C.arcane}66`,
              color: C.arcane,
              fontSize: 14,
            }}
          >
            📦 Esporta biblioteca
          </button>
        </div>
      )}
    </div>
  );
}

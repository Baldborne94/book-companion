import { useRef, useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { getFavoritesRaw, saveFavorites, parseYouTube, isFile, addTrackFile, dropTrack } from "../lib/music.js";
import EmptyState from "./EmptyState.jsx";

const SLEEP_CHOICES = [
  { min: 0, label: "∞" },
  { min: 15, label: "15 min" },
  { min: 30, label: "30 min" },
  { min: 60, label: "1 ora" },
  { min: 90, label: "1 h 30" },
  { min: 120, label: "2 ore" },
  { min: 150, label: "2 h 30" },
  { min: 180, label: "3 ore" },
];

const fmtLeft = (min) => {
  if (min < 60) return `~${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `~${h} h ${r} min` : `~${h} h`;
};

const inputStyle = {
  flex: 1,
  minWidth: 160,
  padding: "10px 14px",
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.text,
  fontSize: 15,
  outline: "none",
};

export default function MusicRoom({ music, playerRef, notify }) {
  const [link, setLink] = useState("");
  const [favs, setFavs] = useState(() => getFavoritesRaw());
  const [favName, setFavName] = useState("");
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const fileRef = useRef(null);
  const [caricando, setCaricando] = useState(false);

  const { current, playing, timerEnd, sleepMin, queue } = music;
  const sleepLeft = timerEnd ? Math.max(0, Math.ceil((timerEnd - Date.now()) / 60000)) : null;

  function playLink() {
    const url = link.trim();
    if (!url) return;
    if (playerRef.current?.play(url)) setLink("");
  }

  function commit(next) {
    setFavs(next);
    saveFavorites(next);
  }

  function saveCurrentAsFav() {
    if (!current) return;
    const now = Date.now();
    const name = favName.trim() || "Melodia senza nome";
    commit([...favs, { id: crypto.randomUUID(), name, url: current.url, addedAt: now, updatedAt: now }]);
    setFavName("");
    notify(`«${name}» custodita tra le tue melodie ✨`);
  }

  function removeFav(f) {
    // la lapide resta (serve a propagare l'eliminazione), ma i byte se ne
    // vanno subito: sono la cosa pesante
    if (isFile(f)) dropTrack(f.trackId);
    commit(favs.map((x) => (x.id === f.id ? { ...x, deleted: true, updatedAt: Date.now() } : x)));
  }

  async function addFiles(lista) {
    const scelti = [...(lista || [])];
    if (!scelti.length) return;
    setCaricando(true);
    const nuovi = [];
    let scartati = 0;
    for (const file of scelti) {
      const voce = await addTrackFile(file).catch(() => null);
      if (voce) nuovi.push(voce);
      else scartati++;
    }
    setCaricando(false);
    if (nuovi.length) {
      commit([...favs, ...nuovi]);
      notify(
        nuovi.length === 1
          ? `«${nuovi[0].name}» custodita ✨ Questa suona anche a tablet spento.`
          : `${nuovi.length} melodie custodite ✨ Queste suonano anche a tablet spento.`
      );
    }
    if (scartati) notify(`${scartati} file non sono audio e li ho lasciati fuori 🎵`);
  }

  function addMelody() {
    const url = newUrl.trim();
    if (!parseYouTube(url)) {
      notify("Questo non sembra un link YouTube… incolla un video o una playlist 🎵");
      return;
    }
    const now = Date.now();
    const name = newName.trim() || "Melodia senza nome";
    commit([...favs, { id: crypto.randomUUID(), name, url, addedAt: now, updatedAt: now }]);
    setNewUrl("");
    setNewName("");
    setAdding(false);
    notify(`«${name}» custodita tra le tue melodie ✨`);
  }

  function startRename(f) {
    setEditing(f.id);
    setDraft(f.name);
  }

  function commitRename() {
    const name = draft.trim();
    if (!name) {
      setEditing(null);
      return;
    }
    commit(favs.map((x) => (x.id === editing ? { ...x, name, updatedAt: Date.now() } : x)));
    setEditing(null);
    notify(`Ora si chiama «${name}» ✨`);
  }

  const liveFavs = favs.filter((f) => !f.deleted);
  const alreadySaved =
    current &&
    liveFavs.some((f) => (current.trackId ? f.trackId === current.trackId : f.url === current.url));

  return (
    <div style={{ animation: "bc-fade-in 0.4s ease-out" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && playLink()}
          placeholder="Incolla un link YouTube (video o playlist)…"
          style={inputStyle}
        />
        <button
          onClick={playLink}
          style={{
            padding: "10px 22px",
            borderRadius: 12,
            background: `linear-gradient(180deg, ${C.accent}, #b8893a)`,
            color: "#241c0a",
            fontWeight: 600,
            fontSize: 15,
            boxShadow: `0 0 20px ${C.accent}2e`,
          }}
        >
          ▶ Suona
        </button>
      </div>

      {current && (
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            border: `1px solid ${C.arcane}55`,
            background: `linear-gradient(135deg, ${C.arcane}14, ${C.card})`,
            boxShadow: `0 0 30px ${C.arcane}1a`,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                fontSize: 30,
                animation: playing ? "bc-flicker 3s ease-in-out infinite" : "none",
                opacity: playing ? 1 : 0.5,
                filter: `drop-shadow(0 0 12px ${C.arcane}88)`,
              }}
            >
              🎶
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT_TITLE, fontWeight: 600, fontSize: 18, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {current.name || "Musica di sottofondo"}
              </div>
              {queue && (
                <div style={{ fontSize: 12.5, color: C.arcane }}>
                  {queue.shuffle ? "🔀 casuale" : "▶ in ordine"} · {queue.index + 1} di {queue.total}
                </div>
              )}
              <div style={{ fontSize: 12.5, color: current.trackId ? C.accent : C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {current.trackId ? "♫ dal tuo archivio · suona anche a schermo spento" : current.url}
              </div>
            </div>
            <button
              onClick={() => (playing ? playerRef.current?.pause() : playerRef.current?.resume())}
              aria-label={playing ? "Pausa" : "Riprendi"}
              style={{ fontSize: 26, color: C.accent, width: 44, height: 44 }}
            >
              {playing ? "⏸" : "▶"}
            </button>
            <button onClick={() => playerRef.current?.stop()} aria-label="Spegni" style={{ fontSize: 18, color: C.muted, width: 36, height: 36 }}>
              ✕
            </button>
          </div>

          {!alreadySaved && (
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <input
                value={favName}
                onChange={(e) => setFavName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveCurrentAsFav()}
                placeholder="Un nome per questa melodia… («Pioggia e camino»)"
                style={{ ...inputStyle, background: C.bg }}
              />
              <button
                onClick={saveCurrentAsFav}
                style={{ padding: "9px 16px", borderRadius: 10, border: `1px solid ${C.accent}88`, color: C.accent, fontSize: 14 }}
              >
                ☆ Custodisci
              </button>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, color: C.muted }}>🌙 Si spegne da sola:</span>
            {SLEEP_CHOICES.map((s) => {
              const active = s.min === 0 ? !timerEnd : (sleepMin || 0) === s.min;
              return (
                <button
                  key={s.min}
                  onClick={() => playerRef.current?.setSleep(s.min)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 999,
                    fontSize: 13.5,
                    border: `1px solid ${active ? C.accent : C.border}`,
                    color: active ? C.accent : C.muted,
                  }}
                >
                  {s.label}
                </button>
              );
            })}
            {sleepLeft !== null && (
              <span style={{ fontSize: 13, color: C.arcane }}>{fmtLeft(sleepLeft)}</span>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0 12px", flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: FONT_TITLE, fontWeight: 600, fontSize: 21, color: C.text }}>
          <span style={{ color: C.arcane, marginRight: 6 }}>✦</span>
          Le tue melodie
        </h2>
        <span style={{ flex: 1 }} />
        {liveFavs.length > 1 && (
          <>
            <button
              onClick={() => playerRef.current?.playQueue(liveFavs, false)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: 14,
                border: `1px solid ${queue && !queue.shuffle ? C.accent : C.border}`,
                color: queue && !queue.shuffle ? C.accent : C.muted,
              }}
            >
              ▶ Tutte
            </button>
            <button
              onClick={() => playerRef.current?.playQueue(liveFavs, true)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: 14,
                border: `1px solid ${queue?.shuffle ? C.accent : C.border}`,
                color: queue?.shuffle ? C.accent : C.muted,
              }}
            >
              🔀 Casuale
            </button>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          multiple
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
          style={{ display: "none" }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={caricando}
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 14,
            border: `1px solid ${C.accent}88`,
            color: C.accent,
            background: `${C.accent}14`,
            opacity: caricando ? 0.6 : 1,
          }}
        >
          {caricando ? "…custodisco" : "♫ Dai tuoi file"}
        </button>
        <button
          onClick={() => setAdding((v) => !v)}
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 14,
            border: `1px solid ${adding ? C.accent : C.border}`,
            color: adding ? C.accent : C.muted,
            background: adding ? `${C.accent}14` : "transparent",
          }}
        >
          {adding ? "Annulla" : "＋ Da YouTube"}
        </button>
      </div>
      <p style={{ fontSize: 12.5, color: C.muted, margin: "-4px 0 14px", lineHeight: 1.5 }}>
        ♫ Le melodie dai tuoi file continuano a suonare a tablet spento, fino allo scadere del timer.
        ♪ Quelle da YouTube no: il loro lettore si mette in pausa da solo quando lo schermo si spegne, e non è in nostro potere.
      </p>

      {adding && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 16,
            padding: 14,
            borderRadius: 14,
            border: `1px solid ${C.accent}55`,
            background: `linear-gradient(135deg, ${C.accent}0d, ${C.card})`,
          }}
        >
          <input
            autoFocus
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMelody()}
            placeholder="Link YouTube della melodia…"
            style={{ ...inputStyle, flexBasis: "100%" }}
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMelody()}
            placeholder="Nome («Pioggia e camino»)"
            style={inputStyle}
          />
          <button
            onClick={addMelody}
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              background: `linear-gradient(180deg, ${C.accent}, #b8893a)`,
              color: "#241c0a",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            ☆ Custodisci
          </button>
        </div>
      )}

      {liveFavs.length === 0 ? (
        <EmptyState
          emoji="🎼"
          title="La sala della musica attende"
          text="Porta qui i tuoi file audio — pioggia e camino, arpe celtiche, cori lontani — e ti accompagneranno anche a tablet spento, fino allo scadere del timer. Oppure incolla un link YouTube, se ti basta ascoltare a schermo acceso."
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {liveFavs.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "13px 14px",
                borderRadius: 14,
                border: `1px solid ${editing === f.id ? C.accent : C.border}`,
                background: `linear-gradient(135deg, ${C.card}, ${C.surface})`,
              }}
            >
              {editing === f.id ? (
                <>
                  <span style={{ fontSize: 22, color: C.accent }}>♪</span>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setEditing(null);
                    }}
                    onBlur={commitRename}
                    placeholder="Come la chiami?"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      background: C.bg,
                      color: C.text,
                      fontSize: 15,
                      outline: "none",
                    }}
                  />
                </>
              ) : (
                <>
                  <button
                    onClick={() => playerRef.current?.play(f)}
                    style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, textAlign: "left", minWidth: 0 }}
                    title={isFile(f) ? "Dal tuo archivio: suona anche a schermo spento" : "Da YouTube: solo a schermo acceso"}
                  >
                    <span
                      style={{
                        fontSize: 22,
                        filter: `drop-shadow(0 0 8px ${isFile(f) ? C.accent : C.arcane}66)`,
                        color: isFile(f) ? C.accent : "inherit",
                      }}
                    >
                      {isFile(f) ? "♫" : "♪"}
                    </span>
                    <span style={{ flex: 1, fontSize: 15, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.name}
                    </span>
                  </button>
                  <button onClick={() => startRename(f)} aria-label={`Rinomina ${f.name}`} style={{ color: C.muted, padding: 4, fontSize: 15 }}>
                    ✎
                  </button>
                  <button onClick={() => removeFav(f)} aria-label={`Dimentica ${f.name}`} style={{ color: C.muted, padding: 4 }}>
                    🗑
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

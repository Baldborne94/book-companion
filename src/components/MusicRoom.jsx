import { useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { getFavorites, saveFavorites } from "../lib/music.js";
import EmptyState from "./EmptyState.jsx";

const SLEEP_CHOICES = [
  { min: 0, label: "∞" },
  { min: 15, label: "15 min" },
  { min: 30, label: "30 min" },
  { min: 60, label: "1 ora" },
];

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
  const [favs, setFavs] = useState(() => getFavorites());
  const [favName, setFavName] = useState("");

  const { current, playing, timerEnd } = music;
  const sleepLeft = timerEnd ? Math.max(0, Math.ceil((timerEnd - Date.now()) / 60000)) : null;

  function playLink() {
    const url = link.trim();
    if (!url) return;
    if (playerRef.current?.play(url)) setLink("");
  }

  function saveCurrentAsFav() {
    if (!current) return;
    const name = favName.trim() || "Melodia senza nome";
    const next = [...favs, { id: crypto.randomUUID(), name, url: current.url, addedAt: Date.now() }];
    setFavs(next);
    saveFavorites(next);
    setFavName("");
    notify(`«${name}» custodita tra le tue melodie ✨`);
  }

  function removeFav(f) {
    const next = favs.filter((x) => x.id !== f.id);
    setFavs(next);
    saveFavorites(next);
  }

  const alreadySaved = current && favs.some((f) => f.url === current.url);

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
              <div style={{ fontSize: 12.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {current.url}
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
              const active = s.min === 0 ? !timerEnd : sleepLeft !== null && Math.abs(sleepLeft - s.min) <= s.min * 0.1;
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
              <span style={{ fontSize: 13, color: C.arcane }}>~{sleepLeft} min</span>
            )}
          </div>
        </div>
      )}

      <h2 style={{ fontFamily: FONT_TITLE, fontWeight: 600, fontSize: 21, color: C.text, margin: "6px 0 12px" }}>
        <span style={{ color: C.arcane, marginRight: 6 }}>✦</span>
        Le tue melodie
      </h2>

      {favs.length === 0 ? (
        <EmptyState
          emoji="🎼"
          title="La sala della musica attende"
          text="Incolla un link YouTube qui sopra — pioggia e camino, arpe celtiche, cori lontani — poi custodiscilo con un nome tutto tuo: lo ritroverai qui, pronto ad accompagnare la lettura."
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {favs.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "13px 14px",
                borderRadius: 14,
                border: `1px solid ${C.border}`,
                background: `linear-gradient(135deg, ${C.card}, ${C.surface})`,
              }}
            >
              <button
                onClick={() => playerRef.current?.play(f.url, f.name)}
                style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, textAlign: "left", minWidth: 0 }}
              >
                <span style={{ fontSize: 22, filter: `drop-shadow(0 0 8px ${C.arcane}66)` }}>♪</span>
                <span style={{ flex: 1, fontSize: 15, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.name}
                </span>
              </button>
              <button onClick={() => removeFav(f)} aria-label="Dimentica melodia" style={{ color: C.muted, padding: 4 }}>
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

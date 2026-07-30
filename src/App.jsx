import { useMemo, useState } from "react";
import { C, FONT_TITLE, SECTIONS } from "./data/constants.js";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Stardust() {
  const stars = useMemo(() => {
    if (reducedMotion()) return [];
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 7 + Math.random() * 6,
      duration: 20 + Math.random() * 16,
      delay: -Math.random() * 30,
      color: i % 3 === 0 ? C.accent : C.arcane,
    }));
  }, []);

  if (stars.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      {stars.map((s) => (
        <span
          key={s.id}
          style={{
            position: "absolute",
            left: `${s.left}%`,
            bottom: "-5vh",
            fontSize: s.size,
            color: s.color,
            opacity: 0,
            animation: `bc-rise ${s.duration}s linear ${s.delay}s infinite`,
            willChange: "transform, opacity",
          }}
        >
          ✦
        </span>
      ))}
    </div>
  );
}

function Header() {
  return (
    <header
      style={{
        position: "relative",
        zIndex: 2,
        padding: "26px 20px 14px",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontFamily: FONT_TITLE,
          fontWeight: 700,
          fontSize: 30,
          letterSpacing: "0.04em",
          color: C.text,
          textShadow: `0 0 18px ${C.accent}55, 0 0 42px ${C.accent}22`,
        }}
      >
        <span style={{ animation: "bc-flicker 6s ease-in-out infinite", display: "inline-block" }}>
          🕯️
        </span>{" "}
        Book Companion
      </h1>
      <p
        style={{
          marginTop: 2,
          fontSize: 15,
          fontStyle: "italic",
          color: C.muted,
        }}
      >
        La tua biblioteca, di notte ✦
      </p>
    </header>
  );
}

function EmptyState({ emoji, title, text, action, onAction }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "48px 24px",
        animation: "bc-fade-in 0.6s ease-out",
      }}
    >
      <div
        style={{
          fontSize: 64,
          marginBottom: 16,
          filter: `drop-shadow(0 0 22px ${C.arcane}66)`,
        }}
      >
        {emoji}
      </div>
      <h2
        style={{
          fontFamily: FONT_TITLE,
          fontWeight: 600,
          fontSize: 24,
          color: C.text,
          marginBottom: 8,
        }}
      >
        {title}
      </h2>
      <p style={{ color: C.muted, maxWidth: 420, margin: "0 auto 24px" }}>{text}</p>
      {action && (
        <button
          onClick={onAction}
          style={{
            padding: "12px 28px",
            borderRadius: 12,
            background: `linear-gradient(180deg, ${C.accent}, #b8893a)`,
            color: "#241c0a",
            fontWeight: 600,
            fontSize: 16,
            boxShadow: `0 0 24px ${C.accent}33`,
            transition: "transform 0.2s ease-out, box-shadow 0.2s ease-out",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 0 34px ${C.accent}55`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = `0 0 24px ${C.accent}33`;
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

function Home({ goTo }) {
  return (
    <EmptyState
      emoji="🔮"
      title="Benvenuto nel tuo regno"
      text="Qui ritroverai il libro che stai leggendo e gli ultimi arrivati sul tuo scaffale. Tutto comincia portando il primo tomo in Libreria."
      action="Vai alla Libreria"
      onAction={() => goTo("library")}
    />
  );
}

function Library() {
  return (
    <EmptyState
      emoji="📜"
      title="Il tuo grimorio è ancora vuoto…"
      text="Presto potrai caricare i tuoi EPUB e PDF: appariranno qui come tomi su uno scaffale incantato, con copertine, ricerca e segnalibri. L'importazione arriva con la prossima fase."
    />
  );
}

function Music() {
  return (
    <EmptyState
      emoji="🎼"
      title="La sala della musica è silenziosa"
      text="Qui incollerai un link YouTube — pioggia e camino, arpe celtiche, cori lontani — e la musica ti accompagnerà mentre leggi. In arrivo in una fase dedicata."
    />
  );
}

function BottomNav({ section, goTo }) {
  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        display: "flex",
        justifyContent: "space-around",
        background: `${C.surface}f2`,
        backdropFilter: "blur(8px)",
        borderTop: `1px solid ${C.border}`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {SECTIONS.map((s) => {
        const active = s.id === section;
        return (
          <button
            key={s.id}
            onClick={() => goTo(s.id)}
            aria-current={active ? "page" : undefined}
            style={{
              flex: 1,
              padding: "10px 0 12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              color: active ? C.accent : C.muted,
              transition: "color 0.2s ease-out",
            }}
          >
            <span
              style={{
                fontSize: 22,
                filter: active ? `drop-shadow(0 0 8px ${C.accent}88)` : "none",
                transition: "filter 0.2s ease-out",
              }}
            >
              {s.icon}
            </span>
            <span style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default function App() {
  const [section, setSection] = useState("home");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(ellipse 120% 80% at 50% 0%, #1a1530 0%, ${C.bg} 55%, #0b0914 100%)`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stardust />
      <Header />
      <main
        key={section}
        style={{
          position: "relative",
          zIndex: 2,
          flex: 1,
          width: "100%",
          maxWidth: 960,
          margin: "0 auto",
          padding: "8px 16px 96px",
          animation: "bc-fade-in 0.35s ease-out",
        }}
      >
        {section === "home" && <Home goTo={setSection} />}
        {section === "library" && <Library />}
        {section === "music" && <Music />}
      </main>
      <BottomNav section={section} goTo={setSection} />
    </div>
  );
}

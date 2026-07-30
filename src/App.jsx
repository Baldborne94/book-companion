import { useEffect, useMemo, useRef, useState } from "react";
import { C, FONT_TITLE, SECTIONS } from "./data/constants.js";
import { loadBooks, saveBooks, removeBookMeta } from "./lib/library.js";
import { removeBookData, requestPersistence } from "./lib/bookStore.js";
import Home from "./components/Home.jsx";
import Library from "./components/Library.jsx";
import BookSheet from "./components/BookSheet.jsx";
import EmptyState from "./components/EmptyState.jsx";

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

function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 86,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        maxWidth: "min(92vw, 480px)",
        padding: "11px 18px",
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        background: `${C.card}f5`,
        color: C.text,
        fontSize: 14.5,
        textAlign: "center",
        boxShadow: `0 0 30px ${C.arcane}22, 0 8px 24px #00000066`,
        animation: "bc-fade-in 0.25s ease-out",
      }}
    >
      {message}
    </div>
  );
}

export default function App() {
  const [section, setSection] = useState("home");
  const [books, setBooks] = useState(() => loadBooks());
  const [openId, setOpenId] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    requestPersistence();
  }, []);

  function notify(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }

  function updateBooks(next) {
    saveBooks(next);
    setBooks(next);
  }

  function handleSaveMeta(patch) {
    updateBooks(books.map((b) => (b.id === patch.id ? { ...b, ...patch } : b)));
  }

  async function handleDelete(id) {
    setOpenId(null);
    removeBookMeta(id);
    setBooks(loadBooks());
    try {
      await removeBookData(id);
    } catch {
      /* i metadati sono già rimossi: i bytes orfani non sono raggiungibili dalla UI */
    }
    notify("Il tomo è tornato alla polvere 🕯️");
  }

  const openBook = books.find((b) => b.id === openId);

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
        {section === "home" && <Home books={books} goTo={setSection} onOpenBook={setOpenId} />}
        {section === "library" && (
          <Library books={books} updateBooks={updateBooks} onOpenBook={setOpenId} notify={notify} />
        )}
        {section === "music" && <Music />}
      </main>
      <BottomNav section={section} goTo={setSection} />
      {openBook && (
        <BookSheet
          key={openBook.id}
          book={openBook}
          onClose={() => setOpenId(null)}
          onSaveMeta={handleSaveMeta}
          onDelete={handleDelete}
          notify={notify}
        />
      )}
      <Toast message={toast} />
    </div>
  );
}

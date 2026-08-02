import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";
import { C, FONT_TITLE, SECTIONS, THEMES, DEFAULT_THEME, applyAppTheme } from "./data/constants.js";
import Foliage from "./components/Foliage.jsx";
import Scrolls from "./components/Scrolls.jsx";
import { CandleIcon, BooksIcon, MusicIcon, LeafIcon, ScrollIcon, CloudIcon } from "./components/Icons.jsx";

import { loadReaderSettings, saveReaderSettings } from "./lib/readerSettings.js";
import { loadBooks, saveBooks, removeBookMeta, setLastOpened, getStatus, setStatus, touchBook, getProgress } from "./lib/library.js";
import { removeBookData, requestPersistence } from "./lib/bookStore.js";
import Home from "./components/Home.jsx";
import Library from "./components/Library.jsx";
import BookSheet from "./components/BookSheet.jsx";
import QuoteGarden from "./components/QuoteGarden.jsx";
import ReadingDiary from "./components/ReadingDiary.jsx";
import MusicPlayer from "./components/MusicPlayer.jsx";
import MusicRoom from "./components/MusicRoom.jsx";
import SyncPanel from "./components/SyncPanel.jsx";
import { getBookMusic, setBookMusic } from "./lib/music.js";
import { getJump, clearJump } from "./lib/annotations.js";
import { nextInSaga } from "./lib/saga.js";
import { isSyncConfigured } from "./lib/supabase.js";
import { getSession, syncNow, localFileIds } from "./lib/sync.js";
import { useViewport } from "./lib/viewport.js";
import { greeting } from "./lib/greeting.js";

// L'ingresso porta l'insegna dell'atmosfera scelta: candela di notte,
// foglia nel boschetto, pergamena nell'archivio.
const THEME_ICON = { night: CandleIcon, grove: LeafIcon, citadel: ScrollIcon };
const themeIcon = (id) => THEME_ICON[id] || CandleIcon;
const navIcon = (sectionId, themeId) =>
  sectionId === "home" ? themeIcon(themeId) : sectionId === "library" ? BooksIcon : MusicIcon;

const Reader = lazy(() => import("./components/Reader.jsx"));
const PdfReader = lazy(() => import("./components/PdfReader.jsx"));

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Stardust({ theme }) {
  const m = theme.motes;
  const stars = useMemo(() => {
    if (reducedMotion()) return [];
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: m.size[0] + Math.random() * (m.size[1] - m.size[0]),
      duration: 20 + Math.random() * 16,
      delay: -Math.random() * 30,
      gold: i % 3 === 0,
    }));
  }, [theme.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
            [m.from === "top" ? "top" : "bottom"]: "-6vh",
            fontSize: s.size,
            color: s.gold ? C.accent : C.arcane,
            opacity: 0,
            animation: `${m.anim} ${s.duration}s linear ${s.delay}s infinite`,
            willChange: "transform, opacity",
          }}
        >
          {m.char}
        </span>
      ))}
    </div>
  );
}

function CompactHeader({ onSync, signedIn, syncing, theme, onTheme }) {
  const I = themeIcon(theme.id);
  return (
    <header
      style={{
        position: "relative",
        zIndex: 2,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px 6px",
      }}
    >
      <span
        style={{
          color: C.accent,
          flexShrink: 0,
          animation: "bc-flicker 6s ease-in-out infinite",
          filter: `drop-shadow(0 0 10px ${C.accent}66)`,
        }}
      >
        <I size={26} active />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: FONT_TITLE, fontSize: 23, fontWeight: 600, color: C.text }}>
          {greeting()}, eccoti.
        </span>
        <span style={{ display: "block", fontSize: 12.5, color: C.muted, letterSpacing: "0.04em" }}>
          Book Companion
        </span>
      </span>
      <button
        onClick={onTheme}
        aria-label="Cambia atmosfera"
        style={{ width: 40, height: 40, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}
      >
        <I size={21} />
      </button>
      <button
        onClick={onSync}
        aria-label="Sincronizzazione"
        style={{
          width: 40,
          height: 40,
          borderRadius: 11,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: signedIn ? C.accent : C.muted,
          opacity: syncing ? 0.6 : 1,
          animation: syncing ? "bc-flicker 1.6s ease-in-out infinite" : "none",
        }}
      >
        <CloudIcon size={21} active={signedIn} />
      </button>
    </header>
  );
}

function Header({ onSync, syncing, signedIn, theme, onTheme }) {
  return (
    <header
      style={{
        position: "relative",
        zIndex: 2,
        padding: "26px 20px 14px",
        textAlign: "center",
      }}
    >
      <button
        onClick={onTheme}
        aria-label="Cambia atmosfera"
        style={{
          position: "absolute",
          top: 16,
          left: 14,
          width: 42,
          height: 42,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: C.muted,
        }}
      >
        {(() => {
          const I = themeIcon(theme.id);
          return <I size={22} />;
        })()}
      </button>
      <button
        onClick={onSync}
        aria-label="Sincronizzazione"
        style={{
          position: "absolute",
          top: 16,
          right: 14,
          width: 42,
          height: 42,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: signedIn ? C.accent : C.muted,
          opacity: syncing ? 0.6 : 1,
          animation: syncing ? "bc-flicker 1.6s ease-in-out infinite" : "none",
        }}
      >
        <CloudIcon size={22} active={signedIn} />
      </button>
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
        <span
          style={{
            display: "inline-block",
            verticalAlign: "-3px",
            marginRight: 8,
            color: C.accent,
            animation: "bc-flicker 6s ease-in-out infinite",
            filter: `drop-shadow(0 0 10px ${C.accent}66)`,
          }}
        >
          {(() => {
            const I = themeIcon(theme.id);
            return <I size={26} active />;
          })()}
        </span>
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
        {theme.tagline}
      </p>
    </header>
  );
}

function BottomNav({ section, goTo, themeId }) {
  return (
    <nav
      style={{
        position: "relative",
        zIndex: 10,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "stretch",
        height: 40,
        flexShrink: 0,
        boxSizing: "content-box",
        background: `${C.surface}f2`,
        backdropFilter: "blur(8px)",
        borderTop: `1px solid ${C.border}`,
        // il margine di sistema su Android arriva a decine di px e
        // raddoppiava la barra: se ne prende quel tanto che basta
        paddingBottom: "min(env(safe-area-inset-bottom, 0px), 8px)",
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              color: active ? C.accent : C.muted,
              transition: "color 0.2s ease-out",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 27,
                borderRadius: 8,
                background: active ? `${C.accent}1c` : "transparent",
                filter: active ? `drop-shadow(0 0 7px ${C.accent}66)` : "none",
                transition: "background 0.2s ease-out, filter 0.2s ease-out",
              }}
            >
              {(() => {
                const I = navIcon(s.id, themeId);
                return <I size={20} active={active} />;
              })()}
            </span>
            <span style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Toast({ toast, onDismiss }) {
  if (!toast) return null;
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
      {toast.message}
      {toast.action && (
        <button
          onClick={() => {
            toast.action.onClick();
            onDismiss();
          }}
          style={{
            marginLeft: 12,
            padding: "5px 14px",
            borderRadius: 999,
            border: `1px solid ${C.accent}`,
            color: C.accent,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

function ThemePicker({ current, onPick, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 55,
        background: "#08061199",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        animation: "bc-fade-in 0.25s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          borderRadius: 18,
          border: `1px solid ${C.border}`,
          background: `linear-gradient(180deg, ${C.card}, ${C.surface})`,
          boxShadow: `0 0 60px ${C.arcane}22, 0 20px 50px #00000088`,
          padding: 22,
        }}
      >
        <h2 style={{ fontFamily: FONT_TITLE, fontSize: 23, fontWeight: 600, color: C.text, marginBottom: 14 }}>
          Dove vuoi leggere?
        </h2>
        {Object.values(THEMES).map((t) => {
          const active = t.id === current;
          return (
            <button
              key={t.id}
              onClick={() => onPick(t.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 14,
                textAlign: "left",
                padding: "13px 15px",
                marginBottom: 10,
                borderRadius: 14,
                border: `1px solid ${active ? t.colors.accent : C.border}`,
                background: t.gradient,
              }}
            >
              <span style={{ color: t.colors.accent, flexShrink: 0 }}>
                {(() => {
                  const I = themeIcon(t.id);
                  return <I size={26} active={active} />;
                })()}
              </span>
              <span style={{ flex: 1 }}>
                <span
                  style={{
                    display: "block",
                    fontFamily: FONT_TITLE,
                    fontWeight: 600,
                    fontSize: 18,
                    color: t.colors.text,
                  }}
                >
                  {t.label}
                </span>
                <span style={{ display: "block", fontSize: 13.5, color: t.colors.muted }}>{t.hint}</span>
              </span>
              {active && <span style={{ color: t.colors.accent, fontSize: 18 }}>✓</span>}
            </button>
          );
        })}
        <div style={{ marginTop: 8, textAlign: "right" }}>
          <button onClick={onClose} style={{ color: C.muted, fontSize: 14.5 }}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [section, setSection] = useState("home");
  const [focusSaga, setFocusSaga] = useState(null);
  const { tall } = useViewport();
  // la saga vale solo per il salto dalla home: tornando dal menu la
  // libreria deve ritrovarsi intera
  const navigate = (id) => {
    setFocusSaga(null);
    setSection(id);
  };
  const [books, setBooks] = useState(() => loadBooks());
  const [openId, setOpenId] = useState(null);
  const [readingId, setReadingId] = useState(null);
  const [readingStart, setReadingStart] = useState(null);
  const [gardenOpen, setGardenOpen] = useState(false);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [music, setMusic] = useState({ current: null, playing: false, timerEnd: null });
  const [syncOpen, setSyncOpen] = useState(false);
  const [sync, setSync] = useState({ busy: false, message: null, at: 0, signedIn: false });
  const [localIds, setLocalIds] = useState(null);
  const [themeId, setThemeId] = useState(() => {
    const saved = loadReaderSettings(Math.min(window.innerWidth, window.innerHeight)).appTheme;
    const id = THEMES[saved] ? saved : DEFAULT_THEME;
    applyAppTheme(id);
    return id;
  });
  const [themeOpen, setThemeOpen] = useState(false);
  const theme = THEMES[themeId];

  function pickTheme(id) {
    applyAppTheme(id);
    setThemeId(id);
    setThemeOpen(false);
    const s = loadReaderSettings(Math.min(window.innerWidth, window.innerHeight));
    saveReaderSettings({ ...s, appTheme: id });
  }
  const toastTimer = useRef(null);
  const playerRef = useRef(null);
  const swUpdate = useRef(null);
  const [updateReady, setUpdateReady] = useState(false);
  const flags = useRef({ reading: false, updateReady: false });

  useEffect(() => {
    requestPersistence();
    try {
      swUpdate.current = registerSW({
        onNeedRefresh: () => {
          flags.current.updateReady = true;
          setUpdateReady(true);
        },
      });
    } catch {
      /* service worker non disponibile (dev / browser antico): l'app funziona uguale */
    }
    const onVis = () => {
      if (
        document.visibilityState === "hidden" &&
        flags.current.updateReady &&
        !flags.current.reading
      ) {
        swUpdate.current?.(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  function notify(message, action = null) {
    setToast({ message, action });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), action ? 8000 : 4500);
  }

  function updateBooks(next) {
    saveBooks(next);
    setBooks(next);
  }

  const runSync = useRef(() => {});
  runSync.current = async (quiet = false) => {
    if (!isSyncConfigured() || sync.busy) return;
    if (!(await getSession())) return;
    setSync((s) => ({ ...s, busy: true, message: quiet ? s.message : "Sincronizzo…" }));
    try {
      const res = await syncNow({
        onProgress: (message) => setSync((s) => ({ ...s, message })),
      });
      if (res.books) setBooks(res.books);
      setLocalIds(await localFileIds());
      const moved = (res.pulled || 0) + (res.pushed || 0) + (res.removed || 0);
      setSync({
        busy: false,
        message: moved ? `Aggiornati ${moved} elementi` : "Tutto già allineato",
        at: Date.now(),
        signedIn: true,
      });
      if (!quiet && moved) notify("Biblioteca sincronizzata ✨");
    } catch (e) {
      setSync((s) => ({ ...s, busy: false, message: `Sincronizzazione fallita: ${e?.message || "errore"}` }));
      if (!quiet) notify("Sincronizzazione fallita — riprovo più tardi");
    }
  };

  useEffect(() => {
    if (!isSyncConfigured()) return;
    let alive = true;
    getSession().then((s) => {
      if (!alive || !s) return;
      setSync((v) => ({ ...v, signedIn: true }));
      runSync.current(true);
    });
    localFileIds().then((ids) => alive && setLocalIds(ids));
    const onOnline = () => runSync.current(true);
    const onVis = () => document.visibilityState === "visible" && runSync.current(true);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  function handleSaveMeta(patch) {
    touchBook(patch.id);
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
    runSync.current(true);
  }

  function handleRead(id, startCfi = null) {
    const b = books.find((x) => x.id === id);
    if (!b) return;
    setLastOpened(id);
    if (getStatus(id) === "unread") setStatus(id, "reading");
    setOpenId(null);
    setReadingStart(startCfi);
    setReadingId(id);

    const jump = getJump(id);
    if (jump && !startCfi) {
      clearJump(id);
      if ((jump.progress || 0) > getProgress(id) + 0.02) {
        notify(
          `Su un altro dispositivo eri al ${Math.round(jump.progress * 100)}%`,
          { label: "Vai lì", onClick: () => handleRead(id, jump.cfi) }
        );
        return;
      }
    }

    if (music.playing && music.current) {
      setBookMusic(id, { url: music.current.url, name: music.current.name });
    } else {
      const pair = getBookMusic(id);
      if (pair) {
        notify(`Questo libro suona con «${pair.name || "la sua melodia"}»`, {
          label: "▶ Riprendi",
          onClick: () => playerRef.current?.play(pair.url, pair.name),
        });
      }
    }
  }

  const openBook = books.find((b) => b.id === openId);
  const readingBook = books.find((b) => b.id === readingId);
  const nextBook = readingBook ? nextInSaga(readingBook, books) : null;
  flags.current.reading = !!readingBook;

  useEffect(() => {
    if (readingId && music.current) {
      setBookMusic(readingId, { url: music.current.url, name: music.current.name });
    }
  }, [music.current, readingId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="bc-shell"
      style={{
        background: theme.gradient,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {theme.decor === "foliage" && <Foliage />}
      {theme.decor === "scrolls" && <Scrolls />}
      <Stardust theme={theme} />
      <div className="bc-scroll">
      {tall ? (
        <Header
          onSync={() => setSyncOpen(true)}
          syncing={sync.busy}
          signedIn={sync.signedIn}
          theme={theme}
          onTheme={() => setThemeOpen(true)}
        />
      ) : (
        <CompactHeader
          onSync={() => setSyncOpen(true)}
          syncing={sync.busy}
          signedIn={sync.signedIn}
          theme={theme}
          onTheme={() => setThemeOpen(true)}
        />
      )}
      <main
        key={section}
        style={{
          position: "relative",
          zIndex: 2,
          flex: 1,
          width: "100%",
          maxWidth: 960,
          margin: "0 auto",
          padding: "8px 16px 26px",
          animation: "bc-fade-in 0.35s ease-out",
        }}
      >
        {section === "home" && (
          <Home
            books={books}
            goTo={navigate}
            onOpenBook={setOpenId}
            onRead={handleRead}
            onGarden={() => setGardenOpen(true)}
            onDiary={() => setDiaryOpen(true)}
            onSaga={(name) => {
              setFocusSaga(name);
              setSection("library");
            }}
          />
        )}
        {section === "library" && (
          <Library
            books={books}
            updateBooks={updateBooks}
            onOpenBook={setOpenId}
            notify={notify}
            localIds={localIds}
            onImported={() => runSync.current(true)}
            focusSaga={focusSaga}
          />
        )}
        {section === "music" && <MusicRoom music={music} playerRef={playerRef} notify={notify} />}
      </main>
      </div>
      <BottomNav section={section} goTo={navigate} themeId={themeId} />
      {openBook && (
        <BookSheet
          key={openBook.id}
          book={openBook}
          books={books}
          onClose={() => setOpenId(null)}
          onSaveMeta={handleSaveMeta}
          onDelete={handleDelete}
          onRead={handleRead}
          notify={notify}
        />
      )}
      {themeOpen && (
        <ThemePicker current={themeId} onPick={pickTheme} onClose={() => setThemeOpen(false)} />
      )}
      {syncOpen && (
        <SyncPanel
          status={sync}
          onClose={() => setSyncOpen(false)}
          onSync={() => runSync.current(false)}
          notify={notify}
        />
      )}
      {gardenOpen && (
        <QuoteGarden
          books={books}
          onClose={() => setGardenOpen(false)}
          onReadAt={(id, cfi) => handleRead(id, cfi)}
        />
      )}
      {diaryOpen && (
        <ReadingDiary books={books} onClose={() => setDiaryOpen(false)} onOpenBook={setOpenId} />
      )}
      {readingBook && (
        <Suspense
          fallback={
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 45,
                background: C.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: C.muted,
                fontFamily: FONT_TITLE,
                fontSize: 18,
              }}
            >
              🕯️ Apro il tomo…
            </div>
          }
        >
          {readingBook.fileType === "epub" ? (
            <Reader
              key={`${readingBook.id}:${readingStart || ""}`}
              book={readingBook}
              startCfi={readingStart}
              nextBook={nextBook}
              onReadNext={handleRead}
              music={music}
              onMusicToggle={() => (music.playing ? playerRef.current?.pause() : playerRef.current?.resume())}
              onMusicStop={() => playerRef.current?.stop()}
              onClose={() => {
                setReadingId(null);
                setReadingStart(null);
                localFileIds().then(setLocalIds);
                runSync.current(true);
              }}
              notify={notify}
            />
          ) : (
            <PdfReader
              key={`${readingBook.id}:${readingStart || ""}`}
              book={readingBook}
              startCfi={readingStart}
              nextBook={nextBook}
              onReadNext={handleRead}
              music={music}
              onMusicToggle={() => (music.playing ? playerRef.current?.pause() : playerRef.current?.resume())}
              onMusicStop={() => playerRef.current?.stop()}
              onClose={() => {
                setReadingId(null);
                setReadingStart(null);
                localFileIds().then(setLocalIds);
                runSync.current(true);
              }}
              notify={notify}
            />
          )}
        </Suspense>
      )}
      <MusicPlayer
        ref={playerRef}
        onInfo={setMusic}
        hideMini={section === "music" || !!readingBook}
        notify={notify}
      />
      {updateReady && !readingBook && (
        <div
          style={{
            position: "fixed",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            gap: 12,
            maxWidth: "min(94vw, 460px)",
            padding: "10px 16px",
            borderRadius: 12,
            border: `1px solid ${C.accent}66`,
            background: `${C.card}f8`,
            color: C.text,
            fontSize: 14.5,
            boxShadow: `0 0 30px ${C.accent}22, 0 8px 24px #00000066`,
            animation: "bc-fade-in 0.3s ease-out",
          }}
        >
          <span>✨ Una nuova versione della biblioteca è pronta</span>
          <button
            onClick={() => swUpdate.current?.(true)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: `1px solid ${C.accent}`,
              color: C.accent,
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: "nowrap",
            }}
          >
            Aggiorna
          </button>
        </div>
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

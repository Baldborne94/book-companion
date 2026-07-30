import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { C } from "../data/constants.js";
import { parseYouTube, embedUrl } from "../lib/music.js";

const MusicPlayer = forwardRef(function MusicPlayer({ onInfo, hideMini, notify }, ref) {
  const iframeRef = useRef(null);
  const sleepRef = useRef(null);
  const [current, setCurrent] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [timerEnd, setTimerEnd] = useState(null);

  useEffect(() => {
    onInfo({ current, playing, timerEnd });
  }, [current, playing, timerEnd, onInfo]);

  useEffect(() => () => clearTimeout(sleepRef.current), []);

  function command(func) {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args: [] }),
        "*"
      );
    } catch {
      /* iframe non ancora pronto: lo stato UI resta la fonte di verità */
    }
  }

  function play(url, name = "") {
    const src = parseYouTube(url);
    if (!src) {
      notify("Questo non sembra un link YouTube… incolla un video o una playlist 🎵");
      return false;
    }
    setCurrent({ url, name, embed: embedUrl(src) });
    setPlaying(true);
    return true;
  }

  function pause() {
    command("pauseVideo");
    setPlaying(false);
  }

  function resume() {
    command("playVideo");
    setPlaying(true);
  }

  function clearSleep() {
    clearTimeout(sleepRef.current);
    setTimerEnd(null);
  }

  function stop() {
    setCurrent(null);
    setPlaying(false);
    clearSleep();
  }

  function setSleep(minutes) {
    clearTimeout(sleepRef.current);
    if (!minutes) {
      setTimerEnd(null);
      return;
    }
    sleepRef.current = setTimeout(() => {
      stop();
      notify("🌙 La musica si è addormentata. Buona lettura.");
    }, minutes * 60000);
    setTimerEnd(Date.now() + minutes * 60000);
  }

  useImperativeHandle(ref, () => ({ play, pause, resume, stop, setSleep }));

  return (
    <>
      {current && (
        <iframe
          ref={iframeRef}
          key={current.embed}
          src={current.embed}
          title="Musica di sottofondo"
          allow="autoplay; encrypted-media"
          style={{
            position: "fixed",
            bottom: 0,
            right: 0,
            width: 2,
            height: 2,
            opacity: 0,
            pointerEvents: "none",
            border: 0,
            zIndex: 1,
          }}
        />
      )}
      {current && !hideMini && (
        <div
          style={{
            position: "fixed",
            left: 12,
            right: 12,
            bottom: "calc(68px + env(safe-area-inset-bottom))",
            zIndex: 11,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 14px",
            borderRadius: 14,
            background: `${C.card}f5`,
            border: `1px solid ${C.border}`,
            boxShadow: `0 0 24px ${C.arcane}22, 0 6px 24px #00000066`,
            animation: "bc-fade-in 0.25s ease-out",
          }}
        >
          <span
            style={{
              fontSize: 20,
              animation: playing ? "bc-flicker 3s ease-in-out infinite" : "none",
              opacity: playing ? 1 : 0.5,
            }}
          >
            🎶
          </span>
          <span
            style={{
              flex: 1,
              fontSize: 14.5,
              color: C.text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {current.name || "Musica di sottofondo"}
          </span>
          <button
            onClick={playing ? pause : resume}
            aria-label={playing ? "Pausa" : "Riprendi"}
            style={{ fontSize: 20, color: C.accent, width: 34, height: 34 }}
          >
            {playing ? "⏸" : "▶"}
          </button>
          <button onClick={stop} aria-label="Spegni la musica" style={{ fontSize: 16, color: C.muted, width: 30, height: 30 }}>
            ✕
          </button>
        </div>
      )}
    </>
  );
});

export default MusicPlayer;

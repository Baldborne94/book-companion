import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { C } from "../data/constants.js";
import { parseYouTube, embedUrl } from "../lib/music.js";

const MusicPlayer = forwardRef(function MusicPlayer({ onInfo, hideMini, notify }, ref) {
  const iframeRef = useRef(null);
  const sleepRef = useRef(null);
  const queueRef = useRef({ list: [], i: 0, shuffle: false });
  const advanceRef = useRef(() => {});
  const [current, setCurrent] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [timerEnd, setTimerEnd] = useState(null);
  const [sleepMin, setSleepMin] = useState(0);
  const [queue, setQueue] = useState(null);

  useEffect(() => {
    onInfo({ current, playing, timerEnd, sleepMin, queue });
  }, [current, playing, timerEnd, sleepMin, queue, onInfo]);

  useEffect(() => () => clearTimeout(sleepRef.current), []);

  // Lo stato vivo per i gestori che vivono fuori da React (visibilita',
  // ronda del timer): leggere le variabili di stato li' dentro darebbe
  // sempre quelle del primo montaggio.
  const vivo = useRef({ playing: false, timerEnd: null, current: null });
  vivo.current = { playing, timerEnd, current };

  // A SCHERMO SPENTO. Due cose diverse, e conviene distinguerle.
  //
  // La riproduzione in se' non e' in nostro potere: l'audio esce da un
  // iframe di YouTube, e browser e YouTube decidono loro se sospenderlo
  // quando la pagina va in background. Non esiste una chiamata che lo
  // impedisca — il tentativo tipico (Wake Lock) tiene acceso lo SCHERMO,
  // cioe' l'opposto di quel che serve.
  //
  // Quello che possiamo garantire e' che la musica non muoia PER COLPA
  // NOSTRA e che il timer sia rispettato lo stesso:
  // - il conto alla rovescia sta sull'orologio da muro, non sul setTimeout
  //   (che i browser congelano in background: al risveglio la musica
  //   sarebbe andata avanti oltre il tempo chiesto);
  // - riaccendendo il tablet, se il tempo non e' scaduto e il lettore non
  //   aveva messo in pausa a mano, si rida' il comando di riprendere.
  useEffect(() => {
    const scaduto = () => {
      const t = vivo.current.timerEnd;
      return t != null && Date.now() >= t;
    };
    const controlla = () => {
      if (!vivo.current.current) return;
      if (scaduto()) {
        stopRef.current();
        return;
      }
      if (document.visibilityState === "visible" && vivo.current.playing) {
        command("playVideo");
      }
    };
    document.addEventListener("visibilitychange", controlla);
    // la ronda copre anche il caso in cui il sistema non mandi mai l'evento
    const ronda = setInterval(() => { if (scaduto()) stopRef.current(); }, 15000);
    return () => {
      document.removeEventListener("visibilitychange", controlla);
      clearInterval(ronda);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handshake con l'iframe di YouTube: senza "listening" non manda eventi
  useEffect(() => {
    if (!current) return;
    let n = 0;
    const t = setInterval(() => {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
          "*"
        );
      } catch {
        /* iframe non ancora pronto */
      }
      if (++n > 10) clearInterval(t);
    }, 400);
    return () => clearInterval(t);
  }, [current?.embed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onMsg = (e) => {
      if (!String(e.origin).includes("youtube")) return;
      let d = e.data;
      if (typeof d === "string") {
        try {
          d = JSON.parse(d);
        } catch {
          return;
        }
      }
      const ended =
        (d?.event === "onStateChange" && d.info === 0) ||
        (d?.event === "infoDelivery" && d?.info?.playerState === 0);
      if (ended) advanceRef.current();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

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

  function start(url, name = "") {
    const src = parseYouTube(url);
    if (!src) {
      notify("Questo non sembra un link YouTube… incolla un video o una playlist 🎵");
      return false;
    }
    setCurrent({ url, name, embed: embedUrl(src) });
    setPlaying(true);
    return true;
  }

  function play(url, name = "") {
    queueRef.current = { list: [], i: 0, shuffle: false };
    setQueue(null);
    return start(url, name);
  }

  const shuffled = (list) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  function playQueue(list, shuffle = false) {
    const clean = (list || []).filter((f) => f?.url);
    if (!clean.length) return false;
    const order = shuffle ? shuffled(clean) : clean;
    queueRef.current = { list: order, i: 0, shuffle };
    setQueue({ total: order.length, shuffle, index: 0 });
    return start(order[0].url, order[0].name);
  }

  function advance() {
    const q = queueRef.current;
    if (!q.list.length) return;
    let i = q.i + 1;
    if (i >= q.list.length) {
      // a fine giro rimescola, cosi' l'ordine casuale non si ripete uguale
      q.list = q.shuffle ? shuffled(q.list) : q.list;
      i = 0;
    }
    q.i = i;
    setQueue({ total: q.list.length, shuffle: q.shuffle, index: i });
    start(q.list[i].url, q.list[i].name);
  }
  advanceRef.current = advance;

  const stopRef = useRef(() => {});

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
    setSleepMin(0);
  }

  function stop() {
    queueRef.current = { list: [], i: 0, shuffle: false };
    setQueue(null);
    setCurrent(null);
    setPlaying(false);
    clearSleep();
  }

  function setSleep(minutes) {
    clearTimeout(sleepRef.current);
    if (!minutes) {
      setTimerEnd(null);
      setSleepMin(0);
      return;
    }
    // il setTimeout serve solo col tablet acceso: in background i browser
    // lo congelano, ed e' la ronda sull'orologio da muro a fermare la
    // musica all'ora giusta
    sleepRef.current = setTimeout(() => stopRef.current(), minutes * 60000);
    setTimerEnd(Date.now() + minutes * 60000);
    setSleepMin(minutes);
  }

  stopRef.current = () => {
    stop();
    notify("🌙 La musica si è addormentata. Buona lettura.");
  };

  // Il tastierino del sistema (schermata di blocco, notifica) sa che qui
  // c'e' della musica: non obbliga il browser a tenerla viva, ma quando la
  // tiene viva da' i comandi giusti invece di lasciare il lettore a
  // riaccendere il tablet per fermarla.
  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!ms) return;
    try {
      if (current) {
        ms.metadata = new window.MediaMetadata({
          title: current.name || "Musica di sottofondo",
          artist: "Book Companion",
        });
        ms.playbackState = playing ? "playing" : "paused";
        ms.setActionHandler("play", () => resume());
        ms.setActionHandler("pause", () => pause());
        ms.setActionHandler("stop", () => stop());
        ms.setActionHandler("nexttrack", queueRef.current.list.length ? () => advanceRef.current() : null);
      } else {
        ms.metadata = null;
        ms.playbackState = "none";
      }
    } catch { /* niente sessione multimediale: si resta ai comandi in app */ }
  }, [current, playing]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({ play, playQueue, pause, resume, stop, setSleep }));

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
            bottom: "calc(47px + min(env(safe-area-inset-bottom, 0px), 8px))",
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

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { C } from "../data/constants.js";
import { parseYouTube, embedUrl, isFile, loadTrack, getVolume, saveVolume, restaDa } from "../lib/music.js";

// Gli ultimi trenta secondi prima dello scadere del timer la musica scende
// fino a spegnersi. L'ora chiesta resta quella: a quel minuto c'e' silenzio,
// non l'inizio di una discesa.
const DISSOLVENZA = 30000;

const MusicPlayer = forwardRef(function MusicPlayer({ onInfo, hideMini, notify }, ref) {
  const iframeRef = useRef(null);
  const audioRef = useRef(null);
  const urlRef = useRef(null);
  const queueRef = useRef({ list: [], i: 0, shuffle: false });
  const advanceRef = useRef(() => {});
  const [current, setCurrent] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [timerEnd, setTimerEnd] = useState(null);
  const [sleepMin, setSleepMin] = useState(0);
  const [queue, setQueue] = useState(null);
  const [manca, setManca] = useState(null);
  const [volume, setVolumeStato] = useState(() => getVolume());
  // il volume scelto dal lettore e la dissolvenza del timer sono due cose
  // distinte che si moltiplicano: la seconda non deve riscrivere la prima,
  // o allo scadere del timer il volume salvato resterebbe a zero
  const volRef = useRef(volume);
  const dissRef = useRef(1);

  useEffect(() => {
    onInfo({ current, playing, timerEnd, sleepMin, queue, volume, manca });
  }, [current, playing, timerEnd, sleepMin, queue, volume, manca, onInfo]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  // Lo stato vivo per i gestori che vivono fuori da React (visibilita',
  // ronda del timer): leggere le variabili di stato li' dentro darebbe
  // sempre quelle del primo montaggio.
  const vivo = useRef({ playing: false, timerEnd: null, current: null });
  vivo.current = { playing, timerEnd, current };

  // A SCHERMO SPENTO.
  //
  // Quel che suona dal nostro <audio> — un file o un flusso diretto —
  // continua da solo: e' il browser a tenere viva una scheda che sta
  // riproducendo. Qui non c'e' niente da fare, e infatti non facciamo
  // niente: il richiamo sotto le passa accanto.
  //
  // Quel che suona da YouTube non e' in nostro potere: quel lettore si mette
  // in pausa da solo in secondo piano. Il tentativo tipico (Wake Lock) tiene
  // acceso lo SCHERMO, cioe' l'opposto di quel che serve. Per YouTube
  // possiamo solo non peggiorare le cose e rispettare il timer lo stesso:
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
      // il richiamo serve solo a YouTube, che si mette in pausa da solo
      // quando la pagina va in secondo piano; l'audio nostro non si e' mai
      // fermato e svegliarlo qui gli farebbe solo perdere il filo
      if (vivo.current.current?.src) return;
      if (document.visibilityState === "visible" && vivo.current.playing) {
        command("playVideo");
      }
    };
    document.addEventListener("visibilitychange", controlla);
    return () => document.removeEventListener("visibilitychange", controlla);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // LA RONDA DEL TIMER, CHE E' ANCHE LA DISSOLVENZA.
  //
  // Un solo battito per due lavori, perche' sono lo stesso lavoro: guardare
  // l'orologio da muro. Il ritmo si adatta — un colpo ogni quindici secondi
  // finche' la fine e' lontana, uno ogni frazione di secondo dentro la
  // dissolvenza — e il volume si ricalcola sempre dall'ora, mai a passi:
  // se il tablet in secondo piano congela i timer, al risveglio la musica
  // e' al punto giusto invece che indietro di tutti i colpi persi.
  useEffect(() => {
    if (timerEnd == null) {
      setManca(null);
      if (dissRef.current !== 1) {
        dissRef.current = 1;
        applicaVolume();
      }
      return;
    }
    let acceso = true;
    let h;
    const battito = () => {
      if (!acceso) return;
      const resta = timerEnd - Date.now();
      if (resta <= 0) {
        stopRef.current();
        return;
      }
      // il battito da' anche il conto alla rovescia da mostrare: React lascia
      // cadere il re-render quando l'etichetta non e' cambiata, e per quasi
      // tutto il timer non cambia
      setManca(restaDa(resta));
      const g = resta >= DISSOLVENZA ? 1 : resta / DISSOLVENZA;
      if (g !== dissRef.current) {
        dissRef.current = g;
        applicaVolume();
      }
      h = setTimeout(battito, resta > DISSOLVENZA ? Math.min(15000, resta - DISSOLVENZA) : 400);
    };
    battito();
    return () => {
      acceso = false;
      clearTimeout(h);
    };
  }, [timerEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  // L'attributo autoplay vale al primo caricamento; cambiando traccia in
  // coda non c'e' nessun tocco del lettore a coprirci, e la riproduzione
  // va chiesta a mano. Il permesso c'e' comunque — la scheda sta gia'
  // suonando — ma se il browser dice di no bisogna dirlo, non restare muti
  // con la musica ferma.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !current?.src || !playing) return;
    applicaVolume();
    a.play().catch(() => {
      setPlaying(false);
      notify("Il browser ha fermato la musica: toccala di nuovo per riprendere 🎵");
    });
  }, [current?.src, playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handshake con l'iframe di YouTube: senza "listening" non manda eventi
  useEffect(() => {
    if (!current || current.src) return;
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
      // il volume va ridetto a ogni lettore nuovo: l'iframe nasce al massimo
      applicaVolume();
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

  function command(func, args = []) {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }),
        "*"
      );
    } catch {
      /* iframe non ancora pronto: lo stato UI resta la fonte di verità */
    }
  }

  // Un solo posto da cui esce il volume vero, per tutt'e due le sorgenti:
  // il nostro <audio> lo vuole da 0 a 1, YouTube da 0 a 100.
  function applicaVolume() {
    const v = Math.min(1, Math.max(0, volRef.current * dissRef.current));
    if (audioRef.current) audioRef.current.volume = v;
    command("setVolume", [Math.round(v * 100)]);
  }

  function setVolume(v) {
    const n = Math.min(1, Math.max(0, Number(v) || 0));
    volRef.current = n;
    setVolumeStato(n);
    saveVolume(n);
    applicaVolume();
  }

  // L'indirizzo temporaneo del blob vive quanto la traccia che suona: sono
  // i BYTE a stare in archivio, mai l'indirizzo (che vale solo per questa
  // sessione e perde ogni senso al ricaricamento).
  function liberaUrl() {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }

  function spegniAudio() {
    const a = audioRef.current;
    if (a) {
      try { a.pause(); } catch { /* mai partito */ }
      a.removeAttribute("src");
      try { a.load(); } catch { /* niente da scaricare */ }
    }
    liberaUrl();
  }

  async function suonaFile(voce) {
    const blob = await loadTrack(voce.trackId).catch(() => null);
    if (!blob) {
      // succede alle melodie arrivate dalla sincronizzazione: il preferito
      // viaggia, i byte no
      notify(`«${voce.name}» sta solo sull'altro dispositivo: ricaricala da qui 🎵`);
      return false;
    }
    liberaUrl();
    urlRef.current = URL.createObjectURL(blob);
    setCurrent({ trackId: voce.trackId, name: voce.name, src: urlRef.current });
    setPlaying(true);
    return true;
  }

  // `voce` e' un preferito intero (file, flusso o YouTube) oppure un
  // semplice indirizzo incollato al volo
  function start(voce, name = "") {
    if (isFile(voce)) {
      spegniAudio();
      suonaFile(voce);
      return true;
    }
    const url = typeof voce === "string" ? voce.trim() : voce?.url;
    const comeSiChiama = (typeof voce === "string" ? name : voce?.name) || name;
    const src = parseYouTube(url || "");
    if (src) {
      spegniAudio();
      setCurrent({ url, name: comeSiChiama, embed: embedUrl(src) });
      setPlaying(true);
      return true;
    }
    notify("Questo non sembra un link YouTube… incolla un video o una playlist 🎵");
    return false;
  }

  function play(voce, name = "") {
    queueRef.current = { list: [], i: 0, shuffle: false };
    setQueue(null);
    return start(voce, name);
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
    const clean = (list || []).filter((f) => f?.url || f?.trackId);
    if (!clean.length) return false;
    const order = shuffle ? shuffled(clean) : clean;
    queueRef.current = { list: order, i: 0, shuffle };
    setQueue({ total: order.length, shuffle, index: 0 });
    return start(order[0]);
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
    start(q.list[i]);
  }
  advanceRef.current = advance;

  const stopRef = useRef(() => {});

  function pause() {
    if (audioRef.current && vivo.current.current?.src) {
      try { audioRef.current.pause(); } catch { /* mai partito */ }
    } else command("pauseVideo");
    setPlaying(false);
  }

  function resume() {
    if (audioRef.current && vivo.current.current?.src) {
      audioRef.current.play().catch(() => {});
    } else command("playVideo");
    setPlaying(true);
  }

  function clearSleep() {
    setTimerEnd(null);
    setSleepMin(0);
  }

  function stop() {
    queueRef.current = { list: [], i: 0, shuffle: false };
    setQueue(null);
    spegniAudio();
    setCurrent(null);
    setPlaying(false);
    clearSleep();
  }

  function setSleep(minutes) {
    if (!minutes) {
      clearSleep();
      return;
    }
    // qui si scrive solo l'ora della fine: a fermare la musica — e a farla
    // sfumare prima — ci pensa la ronda, che guarda l'orologio da muro
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
    if (!current) {
      try {
        ms.metadata = null;
        ms.playbackState = "none";
      } catch { /* niente sessione multimediale */ }
      return;
    }
    // Tre pezzi, tre try distinti. Prima erano in blocco, e su un browser
    // dove MediaMetadata non si costruisce saltavano anche lo stato e i
    // comandi — cioe' proprio le cose che dicono al sistema "qui c'e'
    // musica viva", che a schermo spento e' quel che tiene su tutto.
    try {
      ms.metadata = new window.MediaMetadata({
        title: current.name || "Musica di sottofondo",
        artist: "Book Companion",
      });
    } catch { /* niente scheda: pazienza, i comandi contano di piu' */ }
    try {
      ms.playbackState = playing ? "playing" : "paused";
    } catch { /* stato non impostabile */ }
    try {
      ms.setActionHandler("play", () => resume());
      ms.setActionHandler("pause", () => pause());
      ms.setActionHandler("stop", () => stop());
      ms.setActionHandler("nexttrack", queueRef.current.list.length ? () => advanceRef.current() : null);
    } catch { /* si resta ai comandi in app */ }
  }, [current, playing]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({ play, playQueue, pause, resume, stop, setSleep, setVolume }));

  return (
    <>
      {/* IL LETTORE CHE REGGE LO SCHERMO SPENTO. Sta in cima alla pagina,
          non dentro un iframe altrui: i browser tengono viva la scheda che
          ha un <audio> in riproduzione, ed e' cosi' che suonano radio e
          podcast sul web. Resta montato sempre, come il resto del player. */}
      <audio
        ref={audioRef}
        src={current?.src || undefined}
        autoPlay={!!current?.src}
        // una melodia sola gira all'infinito: e' sottofondo, non un disco
        // da ascoltare fino in fondo. In coda invece si passa alla
        // prossima, e ci pensa onEnded.
        loop={!!current?.src && !queue}
        onEnded={() => advanceRef.current()}
        preload="auto"
        playsInline
        onError={() => {
          if (current?.src) notify("Questa traccia non si riesce a suonare 🎵");
        }}
        // NON display:none. Un elemento tolto dal disegno e' un elemento che
        // il browser puo' trattare da fantasma, e a schermo spento e'
        // esattamente quando non vogliamo sorprese: sta a schermo come
        // l'iframe della musica, due pixel invisibili in un angolo.
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: 2,
          height: 2,
          opacity: 0,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      {current?.embed && (
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
          {/* da dove esce l'audio, a colpo d'occhio: e' l'unica cosa che
              dice se questa musica reggera' lo schermo spento o no */}
          <span
            title={current.src ? "Lo suona l'app: regge lo schermo spento" : "Da YouTube: solo a schermo acceso"}
            style={{ fontSize: 15, color: current.src ? C.accent : C.muted, opacity: 0.9 }}
          >
            {current.src ? "♫" : "♪"}
          </span>
          {manca && (
            <span
              title="Quanto manca allo spegnimento"
              style={{ fontSize: 12.5, color: C.muted, whiteSpace: "nowrap" }}
            >
              🌙 {manca}
            </span>
          )}
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

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { C, F, R } from "../data/constants.js";
import { driveAcceso } from "../lib/drive.js";
import {
  parseYouTube, embedUrl, isFile, loadTrack, portaQuiMelodia, getVolume, saveVolume, restaDa, getFavorites,
  puntoDi, segnaPunto, dimenticaPunto, daDoveRiprendere, segnaDove, indietroDa, getLists,
} from "../lib/music.js";
import { Faccia, Avanzamento, Comandi, sottotitolo } from "./Ascolto.jsx";

// il nome della raccolta che suona: la coda ne tiene solo la chiave
const nomeRaccolta = (queue) => (queue?.raccolta ? getLists().find((r) => r.id === queue.raccolta)?.name : null);

// Gli ultimi trenta secondi prima dello scadere del timer la musica scende
// fino a spegnersi. L'ora chiesta resta quella: a quel minuto c'e' silenzio,
// non l'inizio di una discesa.
const DISSOLVENZA = 30000;

const MusicPlayer = forwardRef(function MusicPlayer({ onInfo, hideMini, onOpen, notify }, ref) {
  const iframeRef = useRef(null);
  const audioRef = useRef(null);
  const urlRef = useRef(null);
  const queueRef = useRef({ list: [], i: 0, shuffle: false, raccolta: null });
  // il punto della melodia che suona (`segnaPunto`): YouTube lo dice nei
  // suoi messaggi, il file lo dice l'<audio>
  const ytTempo = useRef(null);
  const ultimoPunto = useRef(0);
  const advanceRef = useRef(() => {});
  const nextRef = useRef(() => {});
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
  // e la voce che legge il libro: la musica si fa da parte finché parla, e
  // anche questo e' un fattore a se', mai il volume salvato
  const sottoRef = useRef(1);

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
      if (document.visibilityState === "hidden") salvaRef.current();
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
    const via = () => salvaRef.current();
    document.addEventListener("visibilitychange", controlla);
    window.addEventListener("pagehide", via);
    return () => {
      document.removeEventListener("visibilitychange", controlla);
      window.removeEventListener("pagehide", via);
    };
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
      if (d?.event === "infoDelivery" && Number.isFinite(d?.info?.currentTime)) {
        ytTempo.current = { t: d.info.currentTime, d: d.info.duration ?? ytTempo.current?.d };
        segnaOgniTanto(d.info.currentTime, ytTempo.current.d);
      }
      const ended =
        (d?.event === "onStateChange" && d.info === 0) ||
        (d?.event === "infoDelivery" && d?.info?.playerState === 0);
      if (ended) {
        const c = vivo.current.current;
        if (c) dimenticaPunto(c);
        advanceRef.current();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // il punto si scrive ogni tanto mentre suona, e sempre quando si
  // smette: un'app chiusa dal sistema in secondo piano non avvisa
  function segnaOgniTanto(t, durata) {
    const c = vivo.current.current;
    if (!c || Date.now() - ultimoPunto.current < 5000) return;
    ultimoPunto.current = Date.now();
    segnaPunto(c, t, durata);
  }
  function salva() {
    const c = vivo.current.current;
    if (!c) return;
    const a = audioRef.current;
    if (c.src && a) segnaPunto(c, a.currentTime, a.duration);
    else if (!c.src && ytTempo.current) segnaPunto(c, ytTempo.current.t, ytTempo.current.d);
  }
  const salvaRef = useRef(salva);
  salvaRef.current = salva;

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
    const v = Math.min(1, Math.max(0, volRef.current * dissRef.current * sottoRef.current));
    if (audioRef.current) audioRef.current.volume = v;
    command("setVolume", [Math.round(v * 100)]);
  }

  function sottovoce(si) {
    sottoRef.current = si ? 0.3 : 1;
    applicaVolume();
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
    let blob = await loadTrack(voce.trackId).catch(() => null);
    if (!blob && voce.drive && !driveAcceso()) {
      // la melodia c'e', lassu': e' questo dispositivo a non avere la porta
      notify(`«${voce.name}» sta su Google Drive: collegalo dal pannello della nuvola per ascoltarla qui 🎵`);
      return false;
    }
    if (!blob && voce.drive) {
      // i byte stanno su Google Drive: scendono adesso, e poi restano qui
      notify(`Scarico «${voce.name}» da Google Drive… 🎵`);
      try {
        blob = await portaQuiMelodia(voce);
      } catch {
        notify(`Non riesco a scaricare «${voce.name}» da Google Drive: controlla la connessione e riprova 🎵`);
        return false;
      }
    }
    if (!blob) {
      notify(
        voce.drive
          ? `«${voce.name}» non è più su Google Drive: ricaricala dal dispositivo dove ce l'hai 🎵`
          : `«${voce.name}» non è su questo dispositivo, e su Google Drive non è ancora salita: sale alla prossima sincronizzazione del dispositivo dove l'hai caricata 🎵`
      );
      return false;
    }
    liberaUrl();
    urlRef.current = URL.createObjectURL(blob);
    setCurrent({ trackId: voce.trackId, name: voce.name, src: urlRef.current, inizio: puntoDi(voce) });
    setPlaying(true);
    return true;
  }

  // `voce` e' un preferito intero (file, flusso o YouTube) oppure un
  // semplice indirizzo incollato al volo
  function start(voce, name = "") {
    salva();
    ytTempo.current = null;
    const q = queueRef.current;
    if (q.raccolta && voce?.id) segnaDove(q.raccolta, voce.id);
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
      setCurrent({ url, name: comeSiChiama, embed: embedUrl(src, { inizio: puntoDi({ url }) }) });
      setPlaying(true);
      return true;
    }
    notify("Questo non sembra un link YouTube… incolla un video o una playlist 🎵");
    return false;
  }

  function play(voce, name = "") {
    queueRef.current = { list: [], i: 0, shuffle: false, raccolta: null };
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

  // `da`: il brano scelto nella raccolta, o quello a cui si era; in
  // ordine casuale si parte da un brano a caso e la raccolta non ricorda
  function playQueue(list, shuffle = false, { da = 0, raccolta = null } = {}) {
    const clean = (list || []).filter((f) => f?.url || f?.trackId);
    if (!clean.length) return false;
    const order = shuffle ? shuffled(clean) : clean;
    const i = shuffle ? 0 : Math.min(Math.max(0, da), order.length - 1);
    queueRef.current = { list: order, i, shuffle, raccolta: shuffle ? null : raccolta };
    setQueue({ total: order.length, shuffle, index: i, raccolta: shuffle ? null : raccolta, elenco: order.map(voceInCoda) });
    return start(order[i]);
  }

  // la coda come la vede chi guarda: nome e chiave, mai i byte
  const voceInCoda = (f) => ({ id: f.id, name: f.name, trackId: f.trackId, url: f.url });

  function vaiA(i) {
    const q = queueRef.current;
    if (!q.list[i]) return false;
    q.i = i;
    setQueue({ total: q.list.length, shuffle: q.shuffle, index: i, raccolta: q.raccolta, elenco: q.list.map(voceInCoda) });
    return start(q.list[i]);
  }

  function tempo() {
    const c = vivo.current.current;
    const a = audioRef.current;
    if (c?.src && a) return { t: a.currentTime || 0, d: Number.isFinite(a.duration) ? a.duration : 0 };
    if (c && ytTempo.current) return { t: ytTempo.current.t || 0, d: ytTempo.current.d || 0 };
    return { t: 0, d: 0 };
  }

  function seek(t) {
    const c = vivo.current.current;
    if (!c) return;
    const a = audioRef.current;
    if (c.src && a) {
      try { a.currentTime = Math.max(0, t); } catch { /* non ancora caricato */ }
    } else {
      command("seekTo", [Math.max(0, t), true]);
      if (ytTempo.current) ytTempo.current = { ...ytTempo.current, t };
    }
  }

  function prev() {
    const q = queueRef.current;
    const mossa = indietroDa({ i: q.list.length ? q.i : 0, t: tempo().t });
    if (mossa.riavvolgi) seek(0);
    else vaiA(mossa.i);
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
    setQueue({ total: q.list.length, shuffle: q.shuffle, index: i, raccolta: q.raccolta, elenco: q.list.map(voceInCoda) });
    start(q.list[i]);
  }
  advanceRef.current = advance;

  // «CAMBIA CANZONE» da qualunque parte tu sia, anche a libro aperto.
  //
  // Con una raccolta in corso e' la prossima della coda. Con una melodia
  // sola in ripetizione una coda non c'e', ma un ordine si': quello del tuo
  // elenco. Si riparte da li' senza aprire una coda vera, cosi' la melodia
  // che arriva continua a girare da sola come faceva quella prima.
  function next() {
    if (queueRef.current.list.length) {
      advance();
      return true;
    }
    const elenco = getFavorites();
    if (elenco.length < 2) {
      notify("Hai una melodia sola: portane altre nella sala della musica 🎵");
      return false;
    }
    const ora = vivo.current.current;
    const dove = elenco.findIndex((f) =>
      ora?.trackId ? f.trackId === ora.trackId : !!ora?.url && f.url === ora.url
    );
    return start(elenco[(dove + 1) % elenco.length]);
  }
  nextRef.current = next;

  const stopRef = useRef(() => {});

  function pause() {
    salva();
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
    salva();
    queueRef.current = { list: [], i: 0, shuffle: false, raccolta: null };
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
      // il tasto «avanti» del sistema vale sempre: fuori da una raccolta
      // l'ordine e' quello del tuo elenco di melodie
      ms.setActionHandler("nexttrack", () => nextRef.current());
      ms.setActionHandler("previoustrack", () => prevRef.current());
      ms.setActionHandler("seekto", (d) => d?.seekTime != null && seekRef.current(d.seekTime));
    } catch { /* si resta ai comandi in app */ }
  }, [current, playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // per la barra del punto una funzione sola per tutta la vita del player
  const tempoRef = useRef(tempo);
  tempoRef.current = tempo;
  const tempoFisso = useRef(() => tempoRef.current()).current;

  const prevRef = useRef(prev);
  prevRef.current = prev;
  const seekRef = useRef(seek);
  seekRef.current = seek;

  useImperativeHandle(ref, () => ({ play, playQueue, pause, resume, stop, setSleep, setVolume, sottovoce, next, prev, seek, vaiA, tempo }));

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
        onLoadedMetadata={(e) => {
          const t = daDoveRiprendere(current?.inizio || 0, e.currentTarget.duration);
          if (t) e.currentTarget.currentTime = t;
        }}
        onTimeUpdate={(e) => segnaOgniTanto(e.currentTarget.currentTime, e.currentTarget.duration)}
        onEnded={() => {
          if (current) dimenticaPunto(current);
          advanceRef.current();
        }}
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
            borderRadius: R.medio,
            background: `${C.card}f7`,
            border: `1px solid ${C.border}`,
            boxShadow: `0 0 24px ${C.arcane}22, 0 6px 24px #00000066`,
            animation: "bc-fade-in 0.25s ease-out",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 8px 8px" }}>
            {/* copertina, nome e da dove viene sono un solo bersaglio che
                porta alla sala della musica: i tasti restano fuori, o
                cambiare traccia diventerebbe un salto di sezione */}
            <button
              onClick={onOpen}
              aria-label="Vai alla sala della musica"
              style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, minWidth: 0, textAlign: "left" }}
            >
              <Faccia nome={current.name || ""} misura={46} viva={playing} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: F.corpo, color: C.text, lineHeight: 1.25, overflowWrap: "break-word" }}>
                  {current.name || "Musica di sottofondo"}
                </span>
                <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted, marginTop: 2, overflowWrap: "break-word" }}>
                  {sottotitolo({ current, queue, nomeRaccolta: nomeRaccolta(queue) })}
                  {manca ? ` · 🌙 ${manca}` : ""}
                </span>
              </span>
            </button>
            <Comandi playing={playing} onPrev={prev} onToggle={playing ? pause : resume} onNext={() => next()} />
            <button onClick={stop} aria-label="Spegni la musica" style={{ fontSize: F.corpo, color: C.muted, width: 40, height: 44 }}>
              ✕
            </button>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
            <Avanzamento tempo={tempoFisso} sottile />
          </div>
        </div>
      )}
    </>
  );
});

export default MusicPlayer;

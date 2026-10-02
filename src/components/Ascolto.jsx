// IL LETTORE DELLA MUSICA COME QUELLI CHE SI CONOSCONO (chiesto dal lettore:
// «un mini player fatto come si deve, come se avessi YouTube o Spotify»).
// I pezzi stanno qui e li usano in due: la barretta in fondo a ogni sezione
// (`MusicPlayer`) e il pannello «In ascolto» della sala della musica.
import { useEffect, useRef, useState } from "react";
import { C, F, R, FONT_TITLE, px } from "../data/constants.js";
import { facciaDi, minuti, tempoAl, prossimi } from "../lib/music.js";

export const SLEEP_CHOICES = [
  { min: 0, label: "∞" },
  { min: 15, label: "15 min" },
  { min: 30, label: "30 min" },
  { min: 60, label: "1 ora" },
  { min: 90, label: "1 h 30" },
  { min: 120, label: "2 ore" },
  { min: 150, label: "2 h 30" },
  { min: 180, label: "3 ore" },
];

// i glifi dei comandi disegnati, non presi da un carattere: un «⏮» su
// Android diventa un'emoji colorata, e i tre tasti non sembrerebbero una
// famiglia
const ICONE = {
  play: "M8 5.5v13l11-6.5z",
  pausa: "M7 5h4v14H7zM13 5h4v14h-4z",
  prima: "M6 5h2.5v14H6zM19 5v14L9 12z",
  dopo: "M15.5 5H18v14h-2.5zM5 5l10 7-10 7z",
};
export function Icona({ nome, misura = 22, colore = "currentColor" }) {
  return (
    <svg width={misura} height={misura} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
      <path d={ICONE[nome]} fill={colore} />
    </svg>
  );
}

// la copertina che un file audio non ha (`facciaDi`): stessa faccia per
// lo stesso nome, sempre
export function Faccia({ nome = "", misura = 44, viva = false }) {
  const f = facciaDi(nome);
  const [a, b] = f.verso ? [C.arcane, C.accent] : [C.accent, C.arcane];
  return (
    <span
      aria-hidden="true"
      style={{
        flexShrink: 0,
        width: misura,
        height: misura,
        borderRadius: misura > 100 ? R.grande : R.piccolo,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(${f.angolo}deg, ${a}55, ${C.card} 55%, ${b}40)`,
        border: `1px solid ${C.border}`,
        boxShadow: viva ? `0 0 ${Math.round(misura / 4)}px ${C.arcane}33` : "none",
        color: C.text,
        fontSize: Math.round(misura * 0.42),
        lineHeight: 1,
      }}
    >
      <span style={{ opacity: 0.85, animation: viva ? "bc-flicker 3s ease-in-out infinite" : "none" }}>{f.glifo}</span>
    </span>
  );
}

// IL PUNTO DEL BRANO, letto dal lettore quattro volte al secondo e solo
// qui dentro: passarlo per lo stato di App ridisegnerebbe l'app intera a
// ogni quarto di secondo. Sottile: la riga in fondo alla barretta, senza
// tocchi. Altrimenti si tocca e si trascina, e le frecce spostano di 5 s.
export function Avanzamento({ tempo, onSeek, sottile = false }) {
  const [ora, setOra] = useState(() => tempo?.() || { t: 0, d: 0 });
  const [presa, setPresa] = useState(null);
  const pista = useRef(null);
  useEffect(() => {
    const h = setInterval(() => {
      if (document.visibilityState === "visible") setOra(tempo?.() || { t: 0, d: 0 });
    }, 250);
    return () => clearInterval(h);
  }, [tempo]);
  const d = ora.d || 0;
  const frazione = presa != null ? presa : d > 0 ? Math.min(1, ora.t / d) : 0;
  const al = (e) => {
    const r = pista.current.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  const riga = (alta) => (
    <div style={{ position: "relative", height: alta, borderRadius: R.minimo, background: `${C.muted}33`, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(90deg, ${C.arcane}, ${C.accent})`,
          transform: `scaleX(${frazione})`,
          transformOrigin: "left",
        }}
      />
    </div>
  );
  if (sottile) return riga(3);
  const tocca = !!onSeek && d > 0;
  return (
    <div>
      <div
        ref={pista}
        role="slider"
        tabIndex={tocca ? 0 : -1}
        aria-label="Punto del brano"
        aria-valuemin={0}
        aria-valuemax={Math.round(d)}
        aria-valuenow={Math.round(frazione * d)}
        aria-valuetext={`${minuti(frazione * d)} di ${minuti(d)}`}
        onPointerDown={(e) => {
          if (!tocca) return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setPresa(al(e));
        }}
        onPointerMove={(e) => presa != null && setPresa(al(e))}
        onPointerUp={(e) => {
          if (presa == null) return;
          const t = tempoAl(al(e), d);
          setPresa(null);
          setOra({ t, d });
          onSeek(t);
        }}
        onPointerCancel={() => setPresa(null)}
        onKeyDown={(e) => {
          if (!tocca) return;
          const passo = e.key === "ArrowRight" ? 5 : e.key === "ArrowLeft" ? -5 : 0;
          if (!passo) return;
          e.preventDefault();
          const t = tempoAl((ora.t + passo) / d, d);
          setOra({ t, d });
          onSeek(t);
        }}
        style={{ position: "relative", padding: "12px 0", cursor: tocca ? "pointer" : "default", touchAction: "none" }}
      >
        {riga(presa != null ? 6 : 4)}
        {tocca && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, pointerEvents: "none", transform: `translateX(${(frazione - 1) * 100}%)` }}>
            <span
              style={{
                position: "absolute",
                right: -7,
                top: "50%",
                width: 14,
                height: 14,
                marginTop: -7,
                borderRadius: R.tondo,
                background: C.text,
                boxShadow: `0 0 8px ${C.arcane}88`,
              }}
            />
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: F.minuscolo, color: C.muted, fontVariantNumeric: "tabular-nums" }}>
        <span>{minuti(frazione * d)}</span>
        <span>{d > 0 ? minuti(d) : "—"}</span>
      </div>
    </div>
  );
}

const tastoTondo = (misura, pieno) => ({
  width: misura,
  height: misura,
  borderRadius: R.tondo,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  ...(pieno
    ? { background: `linear-gradient(180deg, ${C.accent}, ${C.accentDeep})`, color: C.onAccent, boxShadow: `0 4px 18px ${C.accent}33` }
    : { color: C.text }),
});

// ⏮ ⏯ ⏭: i tre tasti di sempre, il centrale pieno
export function Comandi({ playing, onPrev, onToggle, onNext, grande = false }) {
  const m = grande ? 64 : 44;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: grande ? 18 : 2 }}>
      <button onClick={onPrev} aria-label="Brano prima" style={tastoTondo(44, false)}>
        <Icona nome="prima" misura={grande ? 26 : 20} />
      </button>
      <button onClick={onToggle} aria-label={playing ? "Pausa" : "Riprendi"} style={tastoTondo(m, true)}>
        <Icona nome={playing ? "pausa" : "play"} misura={grande ? 30 : 20} />
      </button>
      <button onClick={onNext} aria-label="Brano dopo" style={tastoTondo(44, false)}>
        <Icona nome="dopo" misura={grande ? 26 : 20} />
      </button>
    </div>
  );
}

// da dove viene quel che suona, in una riga
export function sottotitolo({ current, queue, nomeRaccolta }) {
  if (!current) return "";
  const dove = queue ? `${nomeRaccolta || "Le tue melodie"} · ${queue.index + 1} di ${queue.total}${queue.shuffle ? " · 🔀" : ""}` : "";
  const fonte = current.src ? "♫ dal tuo archivio" : "♪ da YouTube";
  return dove ? `${dove}` : fonte;
}

// IL PANNELLO «IN ASCOLTO» della sala della musica: copertina, nome intero,
// il punto del brano da trascinare, i tre tasti, volume, timer e i brani
// che vengono dopo
export function InAscolto({ music, playerRef, nomeRaccolta, vuoto = null, children = null }) {
  const { current, playing, queue, volume = 1, timerEnd, sleepMin, manca } = music;
  const p = () => playerRef.current;
  const tempo = useRef(() => p()?.tempo?.() || { t: 0, d: 0 }).current;
  const pannello = {
    padding: 18,
    borderRadius: R.grande,
    border: `1px solid ${C.border}`,
    background: `linear-gradient(160deg, ${C.arcane}14, ${C.card} 45%, ${C.surface})`,
    boxShadow: `0 0 30px ${C.arcane}14`,
  };
  if (!current) {
    return (
      <div style={pannello}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <Faccia nome="" misura={px(160)} />
        </div>
        <div style={{ fontFamily: FONT_TITLE, fontSize: F.titolo, color: C.text, textAlign: "center" }}>Niente in ascolto</div>
        <p style={{ fontSize: F.nota, color: C.muted, textAlign: "center", lineHeight: 1.45, margin: "6px 0 14px" }}>
          Scegli una raccolta o una melodia: suona qui, e ti segue in tutta l'app.
        </p>
        {vuoto}
      </div>
    );
  }
  const vol = Math.round(volume * 100);
  const dopo = queue?.elenco ? prossimi(queue.elenco, queue.index, 5) : [];
  return (
    <div style={pannello}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <Faccia nome={current.name || ""} misura={px(200)} viva={playing} />
      </div>
      <div style={{ fontFamily: FONT_TITLE, fontWeight: 600, fontSize: F.titolo, color: C.text, lineHeight: 1.25, overflowWrap: "break-word" }}>
        {current.name || "Musica di sottofondo"}
      </div>
      <div style={{ fontSize: F.piccolo, color: C.arcane, marginTop: 4, lineHeight: 1.4, overflowWrap: "break-word" }}>
        {sottotitolo({ current, queue, nomeRaccolta })}
      </div>
      {queue && (
        <div style={{ fontSize: F.minuscolo, color: current.src ? C.accent : C.muted, marginTop: 2 }}>
          {current.src ? "♫ dal tuo archivio · va avanti a schermo spento" : "♪ da YouTube · solo a schermo acceso"}
        </div>
      )}
      <div style={{ margin: "10px 0 4px" }}>
        <Avanzamento tempo={tempo} onSeek={(t) => p()?.seek(t)} />
      </div>
      <Comandi
        grande
        playing={playing}
        onPrev={() => p()?.prev()}
        onToggle={() => (playing ? p()?.pause() : p()?.resume())}
        onNext={() => p()?.next()}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
        <span style={{ fontSize: F.corpo, color: C.muted, width: 22 }} aria-hidden="true">
          {vol === 0 ? "🔇" : vol < 45 ? "🔉" : "🔊"}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={vol}
          onChange={(e) => p()?.setVolume(parseInt(e.target.value, 10) / 100)}
          aria-label="Volume della musica"
          style={{ flex: 1, minWidth: 0, accentColor: C.accent }}
        />
        <span style={{ fontSize: F.piccolo, color: C.muted, width: 40, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{vol}%</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: F.piccolo, color: C.muted, marginRight: 2 }}>🌙 Si spegne da sola</span>
        {SLEEP_CHOICES.map((s) => {
          const attivo = s.min === 0 ? !timerEnd : (sleepMin || 0) === s.min;
          return (
            <button
              key={s.min}
              onClick={() => p()?.setSleep(s.min)}
              style={{
                padding: "4px 10px",
                borderRadius: R.tondo,
                fontSize: F.minuscolo,
                border: `1px solid ${attivo ? C.accent : C.border}`,
                color: attivo ? C.accent : C.muted,
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      {manca && <div style={{ fontSize: F.piccolo, color: C.arcane, marginTop: 6 }}>manca {manca} · sfuma piano sul finire</div>}
      {children}
      {dopo.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: F.piccolo, color: C.muted, letterSpacing: 0.4, marginBottom: 4 }}>Prossimi</div>
          {dopo.map((b) => (
            <button
              key={`${b.indice}:${b.id}`}
              onClick={() => p()?.vaiA(b.indice)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 44, padding: "4px 6px", borderRadius: R.piccolo, textAlign: "left" }}
            >
              <Faccia nome={b.name || ""} misura={32} />
              <span style={{ flex: 1, minWidth: 0, fontSize: F.nota, color: C.text, lineHeight: 1.3, overflowWrap: "break-word" }}>{b.name}</span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => p()?.stop()}
        style={{ marginTop: 14, padding: "6px 12px", borderRadius: R.tondo, fontSize: F.piccolo, color: C.muted, border: `1px solid ${C.border}` }}
      >
        ✕ Spegni la musica
      </button>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { C, F, FONT_TITLE, R, px } from "../data/constants.js";

// I TASTI DELLE BARRE DEI READER HANNO UN NOME, DOVE CI STA.
//
// Chiesto dal lettore («c'è modo di rendere più user friendly
// l'applicazione?») dopo sei segnalazioni che dicevano tutte la stessa
// cosa. È la lezione della foglia grigia di «Aspetto» portata dentro il
// libro: **un glifo che riconosci solo se sai già cos'è non è un comando**,
// e la cura non è renderlo più vistoso ma dargli un NOME. Il caso che
// conta è la bussola: 🧭 apre «Dove eravamo rimasti» — il riassunto della
// storia fin dove sei — e non lo indovina nessuno.
//
// **LA BARRA PUÒ CRESCERE PERCHÉ COPRE, NON RESTRINGE** (`position:
// absolute`, `zIndex: 25`): la pagina si impagina su `HEAD`/`FOOT`, 8px,
// che non si toccano mai. Una barra più alta non reimpagina un bel niente
// — copre un po' di più **solo mentre è aperta**, e mentre è aperta non
// stai leggendo: stai cercando un comando. È il momento esatto in cui le
// parole servono e il prezzo è zero. Misurato: 57 → 69px, dodici pixel.
//
// **STA IN UN FILE SOLO** perché i due reader hanno due barre gemelle: una
// cura scritta due volte diverge, e si finisce con metà app curata. (I due
// `barBtn` locali erano già identici: questo è il terzo, e l'ultimo.)
export const SOGLIA_NOMI = 720;

// Quanto ci vuole perché le parole ci stiano. Sotto, restano i soli glifi:
// la barra tiene anche il titolo e i comandi della musica, e più stretta di
// così le parole manderebbero tutto a capo — una barra alta due righe
// copre mezza pagina, e il rimedio sarebbe peggio del difetto.
//
// **È UNA LARGHEZZA, NON UN ORIENTAMENTO**: la domanda è «ci stanno», e
// quella la risponde solo la larghezza. Misurato in Chromium sulla barra
// vera, con un libro aperto: a 720 le parole stanno su una riga sola e al
// titolo restano 206px; a 700 spariscono e la barra torna 57.
export function useNomiNeiTasti() {
  const [ci, setCi] = useState(() => window.innerWidth >= SOGLIA_NOMI);
  useEffect(() => {
    const guarda = () => setCi(window.innerWidth >= SOGLIA_NOMI);
    window.addEventListener("resize", guarda);
    window.addEventListener("orientationchange", guarda);
    return () => {
      window.removeEventListener("resize", guarda);
      window.removeEventListener("orientationchange", guarda);
    };
  }, []);
  return ci;
}

export const barBtn = (active) => ({
  width: px(40),
  height: px(40),
  borderRadius: R.piccolo,
  fontSize: F.titoletto,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: active ? C.accent : C.text,
  background: active ? `${C.accent}1a` : "transparent",
});

// **I NOMI SONO QUELLI DEI PANNELLI CHE APRONO**, non nomi nuovi: due
// parole diverse per la stessa cosa nella stessa schermata si leggono come
// due cose diverse (la regola delle parole degli stati in `ripiani.js`).
// Un tasto senza `nome` non esiste: `aria-label` lo legge comunque, e un
// comando senza nome è il difetto da cui tutto questo nasce.
export default function TastoBarra({ nome, conNome, attivo = false, glifo, stile, ...resto }) {
  const base = barBtn(attivo);
  return (
    <button
      aria-label={nome}
      {...resto}
      style={{
        ...base,
        ...(conNome
          ? {
              width: "auto",
              minWidth: px(46),
              height: px(52),
              padding: "0 7px",
              flexDirection: "column",
              justifyContent: "center",
              gap: 2,
            }
          : null),
        ...stile,
      }}
    >
      <span
        style={{
          fontSize: stile?.fontSize || base.fontSize,
          lineHeight: 1,
          ...(stile?.fontFamily ? { fontFamily: stile.fontFamily } : null),
        }}
      >
        {glifo}
      </span>
      {conNome && (
        <span
          style={{
            fontSize: F.minuscolo,
            lineHeight: 1,
            color: attivo ? C.accent : C.muted,
            whiteSpace: "nowrap",
          }}
        >
          {nome}
        </span>
      )}
    </button>
  );
}

// LA BARRA HA UNA RIGA O DUE, E LO DECIDE LO SPAZIO CHE C'E'.
//
// Segnalato dal lettore col tablet in piedi: «la barra in alto delle
// impostazioni sembra un po' sacrificata quando metto il reader in
// modalita' verticale». Misurato a 800×1280 con la scala automatica del
// suo tablet (×1,3): una riga sola, sette tasti con la parola sotto e al
// titolo restavano 156 pixel — «Between Two Fires» non ci sta, e i tasti
// si toccano l'un l'altro. Non e' che manchi spazio per i tasti: manca
// spazio per i tasti E il titolo sulla stessa riga.
//
// Su due righe il titolo ha la riga intera e i tasti si distribuiscono
// sulla loro: la barra e' piu' alta, ma copre e non restringe (vedi in
// cima), e sta aperta solo mentre cerchi un comando. LA SOGLIA E' UNA
// LARGHEZZA NORMALIZZATA: i tasti crescono con la scala (`px`), quindi
// 800 pixel a scala 1,3 sono 615 «veri» — si divide per il fattore vivo,
// e cosi' lo stesso tablet in piedi va a due righe con la scrittura
// grande e ci resta anche a scala normale (768 < 850), mentre sdraiato
// (1280 / 1,3 = 985) tiene la riga sola.
export const SOGLIA_UNA_RIGA = 850;

export function useDueRighe() {
  const conta = () => window.innerWidth < SOGLIA_UNA_RIGA * px(1);
  const [due, setDue] = useState(conta);
  useEffect(() => {
    const guarda = () => setDue(conta());
    window.addEventListener("resize", guarda);
    window.addEventListener("orientationchange", guarda);
    return () => {
      window.removeEventListener("resize", guarda);
      window.removeEventListener("orientationchange", guarda);
    };
  }, []);
  return due;
}

// Cosa sta suonando, e la via per andare a sceglierne un'altra. Stava
// copiato in tre barre (ePub, PDF, fumetto) ed era gia' diverso in una:
// il tasto del brano alto 40 in un file e `px(40)` nell'altro. Il libro
// si chiude passando dalla porta di sempre (`onClose`), non sparendo: il
// punto di lettura va salvato come per ogni altra uscita.
export function MusicaInBarra({ music, onMusicToggle, onMusicNext, onMusicVolume, onMusicStop, onMusicRoom, onClose }) {
  if (!music?.current) return null;
  return (
    <>
      {music.manca && (
        <span title="Quanto manca allo spegnimento della musica" style={{ fontSize: F.minuscolo, color: C.muted, whiteSpace: "nowrap" }}>
          🌙 {music.manca}
        </span>
      )}
      <button
        onClick={() => { onClose(); onMusicRoom?.(); }}
        title={`${music.current.name || "Musica di sottofondo"} — vai alla sala della musica`}
        style={{
          maxWidth: px(150),
          padding: "0 8px",
          height: px(40),
          borderRadius: R.piccolo,
          fontSize: F.piccolo,
          color: C.muted,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: music.current.src ? C.accent : C.arcane, marginRight: 5 }}>
          {music.current.src ? "♫" : "♪"}
        </span>
        {music.current.name || "Musica di sottofondo"}
      </button>
      <button onClick={onMusicToggle} style={barBtn(false)} aria-label={music.playing ? "Pausa musica" : "Riprendi musica"}>
        {music.playing ? "⏸" : "▶"}
      </button>
      <button onClick={onMusicNext} style={{ ...barBtn(false), fontSize: F.corpo }} aria-label="Melodia successiva">
        ⏭
      </button>
      {/* il volume qui e' quello della sola musica: sotto la lettura si
          abbassa lei, non le notifiche e la sveglia del tablet */}
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round((music.volume ?? 1) * 100)}
        onChange={(e) => onMusicVolume?.(parseInt(e.target.value, 10) / 100)}
        aria-label="Volume della musica"
        style={{ width: 64, flexShrink: 0, accentColor: C.accent }}
      />
      <button onClick={onMusicStop} style={{ ...barBtn(false), fontSize: F.corpo, color: C.muted }} aria-label="Spegni musica">
        🔇
      </button>
    </>
  );
}

// LA BARRA IN CIMA AL LIBRO, in un file solo per le tre barre gemelle.
// `tasti` sono i comandi con nome del reader, `coda` quel che sta in
// fondo a destra («Aa», «Notte»), `linguetta` la maniglia dell'ePub.
// `onAltezza` dice quanto e' alta: chi si appoggia sotto di lei — il menu
// della selezione, la scheda del dizionario — non puo' piu' supporre un
// numero, perche' con due righe l'altezza dipende da cosa c'e' dentro.
export function BarraDelLibro({ titolo, onClose, linguetta, musica, tasti, coda, conNome, dueRighe, onAltezza }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !onAltezza) return;
    const dai = () => onAltezza(el.getBoundingClientRect().height);
    dai();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(dai);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onAltezza, dueRighe]);
  const fondo = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 25,
    padding: "8px 10px",
    background: `${C.surface}f2`,
    backdropFilter: "blur(8px)",
    borderBottom: `1px solid ${C.border}`,
    animation: "bc-fade-in 0.2s ease-out",
  };
  const chiudi = (
    <button onClick={onClose} style={barBtn(false)} aria-label="Chiudi il libro">
      ✕
    </button>
  );
  const nome = (
    <span
      style={{
        flex: 1,
        fontFamily: FONT_TITLE,
        fontSize: F.rilievo,
        fontWeight: 600,
        color: C.text,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {titolo}
    </span>
  );
  if (!dueRighe) {
    return (
      // LA RETE DI SICUREZZA VA ACCESA SOLO COLLE PAROLE, e l'ha detto la
      // misura, non il ragionamento: senza `wrap` a stringersi non sono i
      // tasti ma il TITOLO, che ha `flex: 1` e arriva a zero lasciandoli
      // a 40 (misurato a 412px: una riga, barra 57). Col `wrap` sempre
      // acceso lo stesso telefono passava a DUE righe e 101px senza
      // averne bisogno. Serve invece colle parole accese E la musica che
      // suona: li' i tasti hanno un `minWidth` e andrebbero FUORI dalla
      // barra, e un comando fuori dallo schermo e' peggio di una barra a
      // due righe.
      <div ref={ref} style={{ ...fondo, display: "flex", alignItems: "center", flexWrap: conNome ? "wrap" : "nowrap", gap: 4 }}>
        {linguetta}
        {chiudi}
        {nome}
        {musica}
        {tasti}
        {coda}
      </div>
    );
  }
  return (
    <div ref={ref} style={{ ...fondo, display: "flex", flexDirection: "column", gap: 6 }}>
      {linguetta}
      {/* LA MUSICA STA NELLA RIGA DEL TITOLO (misurato sul tablet del
          lettore, 902×1503 a densita' 1,33 e scrittura ×1,5: con la musica
          nella riga dei comandi la barra di un fumetto andava su tre righe,
          261 px, e «Schermo» restava solo in fondo). Il titolo ha
          `flex: 1` e cede lui, coi puntini */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {chiudi}
        {nome}
        {musica}
        {coda}
      </div>
      {/* i tasti si spartiscono la riga: stretti insieme a sinistra
          sembrerebbero avanzati, ed e' l'aspetto «sacrificato» da cui si
          parte; `wrap` qui e' gratis, perche' quando ci stanno non fa
          niente e quando non ci stanno e' l'unica alternativa a un comando
          fuori dallo schermo */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", justifyContent: "space-evenly", gap: 4 }}>
        {tasti}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { C, F, R, FONT_TITLE, px } from "../data/constants.js";
import { leggiSalvaschermo, scriviSalvaschermo, SCELTE_COPERTINA, SCELTE_SPEGNI, fraseMinuti } from "../lib/salvaschermo.js";
import { nelGuscio, fraseEsito } from "../lib/sfondo.js";
import { getCover } from "../lib/bookStore.js";
import { getProgress } from "../lib/library.js";

// La copertina intera su fondo nero, come un quadro appeso: le copertine
// illustrate sono il punto, e ritagliarle per riempire lo schermo ne
// taglierebbe proprio l'arte. Il nero e non il colore del tema perché è
// la cornice che non litiga con nessuna copertina.
//
// Il tocco lo prende tutto lui: sparisce senza voltare niente, e si torna
// dove si era (la scena e2e tocca dove di solito si volta e guarda il segno).
export default function Salvaschermo({ libro, onTocco, onSenza }) {
  const [url, setUrl] = useState(null);
  const [pronta, setPronta] = useState(false);
  const id = libro?.id;

  useEffect(() => {
    let vivo = true;
    let mio = null;
    getCover(id)
      .then((blob) => {
        if (!vivo) return;
        // senza copertina non c'e' niente da appendere: resta solo lo
        // spegnimento dello schermo, che non ha bisogno di un quadro
        if (!blob) return onSenza?.();
        mio = URL.createObjectURL(blob);
        setUrl(mio);
      })
      .catch(() => vivo && onSenza?.());
    return () => {
      vivo = false;
      if (mio) URL.revokeObjectURL(mio);
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // finche' la copertina non c'e' non si mostra niente: un libro senza
  // copertina farebbe lampeggiare lo schermo nero prima di farsi da parte
  if (!url) return null;
  const pct = Math.round((getProgress(id) || 0) * 100);
  const titolo = libro?.title || "";
  return (
    <div
      role="button"
      aria-label={`Salvaschermo: ${titolo}. Tocca per tornare`}
      onClick={onTocco}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 85,
        background: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: px(14),
        padding: px(24),
        cursor: "pointer",
        animation: "bc-fade-in 1.2s ease-out",
      }}
    >
      {url && (
        <img
          src={url}
          alt={`Copertina di ${titolo}`}
          onLoad={() => setPronta(true)}
          // tutto lo spazio che c'e', e la copertina intera dentro: una
          // copertina piccola cresce fino al bordo invece di restare un
          // francobollo in mezzo al nero
          style={{
            flex: "1 1 0",
            minHeight: 0,
            width: "100%",
            objectFit: "contain",
            opacity: pronta ? 1 : 0,
            transition: "opacity 1.2s ease-out",
          }}
        />
      )}
      <div style={{ flexShrink: 0, textAlign: "center", color: C.muted, fontSize: F.piccolo, lineHeight: 1.4 }}>
        <span style={{ fontFamily: FONT_TITLE, fontSize: F.nota, color: C.text }}>{titolo}</span>
        {pct > 0 && <span> · al {pct}%</span>}
      </div>
    </div>
  );
}

// I due tempi nelle Impostazioni. Valgono per questo dispositivo: il
// telefono e il tablet si lasciano in mano in modi diversi. Il conto in
// `App.jsx` li rilegge a ogni segno di vita, e la scelta stessa e' un tocco.
export function SezioneSalvaschermo() {
  const [v, setV] = useState(leggiSalvaschermo);
  const scegli = (cambi) => setV(scriviSalvaschermo(cambi));
  const fila = (etichetta, scelte, chiave, spento = false) => (
    <div style={{ marginBottom: 10, opacity: spento ? 0.45 : 1 }}>
      <div style={{ fontSize: F.piccolo, color: C.muted, marginBottom: 6 }}>{etichetta}</div>
      <div role="group" aria-label={etichetta} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {scelte.map((m) => {
          const attivo = v[chiave] === m;
          return (
            <button
              key={m}
              disabled={spento}
              aria-pressed={attivo}
              onClick={() => scegli({ [chiave]: m })}
              style={{
                minHeight: 44,
                padding: "8px 14px",
                borderRadius: R.tondo,
                border: `1px solid ${attivo ? C.accent : C.border}`,
                background: attivo ? `${C.accent}22` : "transparent",
                color: attivo ? C.accent : C.muted,
                fontSize: F.nota,
              }}
            >
              {fraseMinuti(m)}
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <>
      <p style={{ fontSize: F.piccolo, color: C.muted, marginBottom: 10, lineHeight: 1.45 }}>
        Quando non tocchi niente per un po', la copertina del libro che stai leggendo prende lo
        schermo, come sul Kindle. Un tocco ti riporta dov'eri. Vale per questo dispositivo.
      </p>
      {fila("Mostra la copertina dopo", SCELTE_COPERTINA, "copertina")}
      {fila("Poi lascia spegnere lo schermo dopo", SCELTE_SPEGNI, "spegni", !(v.copertina > 0))}
    </>
  );
}

// LA COPERTINA ANCHE A TABLET SPENTO: lo sfondo della schermata di blocco,
// che solo il guscio Android sa cambiare (`lib/sfondo.js`). Fuori dal guscio
// la riga non c'e': un tasto non promette cio' che non puo' dare. Nel
// guscio senza il saluto — l'APK vecchio, o un processo riaperto dai
// recenti — si dice cosa fare, senza tasto.
export function SezioneSfondo({ pronto, info = null, acceso, onCambia }) {
  if (!nelGuscio()) return null;
  // il guscio nuovo c'e' ma non ha salutato: si dice fin dove e' arrivato
  // l'ultima volta (`infoDalLancio`), o come farglielo raccontare
  const ultima = fraseEsito(info?.esito);
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
      <div style={{ fontSize: F.piccolo, color: C.muted, marginBottom: 6 }}>Anche a tablet spento</div>
      {pronto ? (
        <>
          <button
            role="switch"
            aria-checked={acceso}
            onClick={() => onCambia(!acceso)}
            style={{
              minHeight: 44,
              padding: "8px 14px",
              borderRadius: R.tondo,
              border: `1px solid ${acceso ? C.accent : C.border}`,
              background: acceso ? `${C.accent}22` : "transparent",
              color: acceso ? C.accent : C.muted,
              fontSize: F.nota,
            }}
          >
            🔒 Copertina sulla schermata di blocco · {acceso ? "sì" : "no"}
          </button>
          <p style={{ fontSize: F.piccolo, color: C.muted, marginTop: 8, lineHeight: 1.45 }}>
            Lo sfondo della schermata di blocco diventa la copertina del libro che hai in mano, e cambia
            quando cambi libro. Spegnendolo, lo sfondo di prima lo rimetti tu dalle impostazioni di Android.
          </p>
        </>
      ) : (
        <p style={{ fontSize: F.piccolo, color: C.muted, lineHeight: 1.45 }}>
          {info?.versione
            ? `L'app Android installata è la ${info.versione}, ma il suo saluto non è arrivato. ${
                ultima ? `L'ultima volta: ${ultima}.` : "Chiudi l'app del tutto e riaprila dall'icona: al secondo avvio qui si legge dove si è fermata."
              }`
            : "Per la copertina sulla schermata di blocco serve l'app Android più recente (le Releases su GitHub), installata sopra questa. Se ce l'hai già, chiudi l'app e riaprila dall'icona."}
        </p>
      )}
    </div>
  );
}

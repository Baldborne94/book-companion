// SE QUALCOSA NON VA (vedi `lib/registro.js`): quanti guasti ha annotato
// questo tablet, e un tocco che copia il rapporto da mandare. Il rapporto si
// vede anche aperto, perche' dove la copia non riesce resta da fotografare.
import { useState } from "react";
import { C, F, R, px } from "../data/constants.js";
import { erroriAnnotati, rapporto, svuotaErrori } from "../lib/registro.js";
import { voltateAnnotate, svuotaVoltate } from "../lib/voltate.js";

function ambiente() {
  const n = globalThis.navigator;
  const s = globalThis.screen;
  const installata = globalThis.matchMedia?.("(display-mode: standalone)")?.matches;
  return {
    navigatore: n?.userAgent || "",
    schermo: s ? `${s.width}×${s.height} · densità ${globalThis.devicePixelRatio || 1}` : "",
    guscio: String(globalThis.document?.referrer || "").startsWith("android-app://") ? "app Android" : installata ? "app installata" : "browser",
  };
}

async function copia(testo) {
  try {
    await globalThis.navigator.clipboard.writeText(testo);
    return true;
  } catch {
    // il guscio Android a volte nega gli appunti: la vecchia strada
    try {
      const t = document.createElement("textarea");
      t.value = testo;
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand("copy");
      t.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export default function SezioneGuasti() {
  const [errori, setErrori] = useState(erroriAnnotati);
  const [voltate, setVoltate] = useState(voltateAnnotate);
  const [esito, setEsito] = useState("");
  const [aperto, setAperto] = useState(false);
  const versione = typeof __BC_VERSIONE__ !== "undefined" ? __BC_VERSIONE__ : "?";
  const testo = rapporto({ errori, versione, ambiente: ambiente(), voltate });
  const ultimo = errori[errori.length - 1];
  const tasto = {
    minHeight: 44,
    padding: "8px 14px",
    borderRadius: R.piccolo,
    border: `1px solid ${C.border}`,
    color: C.text,
    fontSize: F.corpo,
  };
  return (
    <>
      <p style={{ fontSize: F.piccolo, color: C.muted, marginBottom: 10, lineHeight: 1.45 }}>
        {errori.length
          ? `${errori.length === 1 ? "Un guasto annotato" : `${errori.length} guasti annotati`} su questo dispositivo, l'ultimo il ${new Date(ultimo.q).toLocaleString("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}. `
          : "Nessun guasto annotato su questo dispositivo. "}
        {voltate.length ? `Dentro ci sono anche i tempi di ${voltate.length === 1 ? "una voltata" : `${voltate.length} voltate`} dei fumetti, solo numeri. ` : ""}
        Il rapporto resta qui: lo copi tu e lo mandi a chi ripara l'app. Niente indirizzi né chiavi dentro.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={async () => {
            setErrori(erroriAnnotati());
            setVoltate(voltateAnnotate());
            const ok = await copia(rapporto({ errori: erroriAnnotati(), versione, ambiente: ambiente(), voltate: voltateAnnotate() }));
            setEsito(ok ? "Rapporto copiato: incollalo in un messaggio ✓" : "Non riesco a copiare: apri il rapporto qui sotto e fotografalo");
            if (!ok) setAperto(true);
          }}
          style={{ ...tasto, borderColor: `${C.accent}88`, color: C.accent }}
        >
          📋 Copia il rapporto
        </button>
        <button onClick={() => setAperto((a) => !a)} style={tasto}>
          {aperto ? "Chiudi il rapporto" : "Vedi il rapporto"}
        </button>
        {(errori.length > 0 || voltate.length > 0) && (
          <button
            onClick={() => {
              svuotaErrori();
              svuotaVoltate();
              setErrori([]);
              setVoltate([]);
              setEsito("Registro svuotato");
            }}
            style={{ ...tasto, color: C.muted }}
          >
            Svuota
          </button>
        )}
      </div>
      {esito && <p style={{ fontSize: F.piccolo, color: C.arcane, marginTop: 8 }}>{esito}</p>}
      {aperto && (
        <pre
          style={{
            marginTop: 10,
            padding: 10,
            maxHeight: px(260),
            overflow: "auto",
            borderRadius: R.piccolo,
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.muted,
            fontSize: F.minuscolo,
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
          }}
        >
          {testo}
        </pre>
      )}
    </>
  );
}

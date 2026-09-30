import { useEffect, useState } from "react";
import { C, F, R } from "../data/constants.js";
import {
  clientId,
  scriviClientId,
  apiKey,
  scriviApiKey,
  driveConfigurato,
  driveAcceso,
  driveProntoOra,
  collegaDrive,
  scollegaDrive,
  mappaDrive,
  spazioSuDrive,
} from "../lib/drive.js";
import { pesoDeiLibri } from "../lib/driveCore.js";
import { statoRinnovo } from "../lib/accessoGoogle.js";
import { BarraDrive } from "./BarraCloud.jsx";

// GOOGLE DRIVE NEL PANNELLO DELLA NUVOLA: e' la stessa domanda — dove stanno
// i miei libri fuori da questo tablet — e sta accanto alla risposta di
// Supabase invece che in una stanza sua.
//
// Tre stati, e ognuno dice cosa fare: manca l'ID del client (si crea una
// volta su Google Cloud), c'e' ma Drive non e' collegato, o e' collegato —
// e allora dice quanti libri ha riconosciuto e quanto spazio resta.
const tasto = (colore) => ({
  minHeight: 44,
  padding: "0 16px",
  borderRadius: R.piccolo,
  border: `1px solid ${colore}88`,
  color: colore,
  fontSize: F.nota,
});

export default function SezioneDrive({ onCollegato, notify }) {
  const [, ridisegna] = useState(0);
  const [id, setId] = useState(clientId());
  const [chiave, setChiave] = useState(apiKey());
  const [busy, setBusy] = useState(false);
  const [guaio, setGuaio] = useState(null);
  const [spazio, setSpazio] = useState(null);
  const acceso = driveAcceso();
  const pronto = driveProntoOra();
  const daBuild = !!import.meta.env?.VITE_GOOGLE_CLIENT_ID;
  const chiaveDaBuild = !!import.meta.env?.VITE_GOOGLE_API_KEY;

  useEffect(() => {
    if (!acceso || !pronto) return setSpazio(null);
    let vivo = true;
    spazioSuDrive()
      .then((d) => vivo && setSpazio(d))
      .catch(() => {});
    return () => { vivo = false; };
  }, [acceso, pronto]);

  async function collega() {
    if (busy) return;
    setBusy(true);
    setGuaio(null);
    try {
      if (!daBuild) scriviClientId(id);
      await collegaDrive();
      notify?.("Google Drive collegato: cerco i tuoi libri 🗂");
      onCollegato?.();
    } catch (e) {
      setGuaio(e?.message || "Collegamento non riuscito.");
    } finally {
      setBusy(false);
      ridisegna((n) => n + 1);
    }
  }

  async function scollega() {
    await scollegaDrive();
    notify?.("Google Drive scollegato. I file su Drive restano dove sono.");
    ridisegna((n) => n + 1);
  }

  const libri = pesoDeiLibri(mappaDrive());

  // LA CHIAVE API SERVE AL SOLO SELETTORE («Scegli su Drive» in Libreria):
  // e' un'altra voce di Google Cloud, non un segreto, e si salva da sola
  // appena la si incolla — senza un tasto, perche' un campo con un tasto
  // «salva» accanto a un altro campo con «Collega» e' due gesti per una
  // cosa che ne vuole uno
  function scriviChiave(v) {
    setChiave(v);
    scriviApiKey(v);
  }
  const campo = {
    display: "block",
    width: "100%",
    marginTop: 6,
    padding: "10px 14px",
    borderRadius: R.piccolo,
    border: `1px solid ${C.border}`,
    background: C.bg,
    color: C.text,
    fontSize: F.nota,
    outline: "none",
  };
  const campoChiave = !chiaveDaBuild && (
    <label style={{ display: "block", marginTop: 12, fontSize: F.minuscolo, color: C.muted }}>
      Chiave API di Google (comincia con AIza) · serve solo a «Scegli su Drive», la finestra di Drive dentro l'app
      <input
        value={chiave}
        onChange={(e) => scriviChiave(e.target.value)}
        placeholder="AIza…"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Chiave API di Google"
        style={campo}
      />
    </label>
  );

  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
      <div style={{ fontSize: F.corpo, color: C.text, marginBottom: 6 }}>🗂 Google Drive</div>
      <p style={{ color: C.muted, fontSize: F.nota, lineHeight: 1.5, margin: 0 }}>
        I file dei libri stanno sul tuo Drive, non qui sopra: l'app riconosce quelli che hai già caricato nelle
        cartelle Libri, Fumetti e Manga, manda su i nuovi, e li riporta sul tablet quando li apri.
      </p>

      {acceso ? (
        <>
          <p style={{ margin: "10px 0 0", fontSize: F.nota, color: pronto ? C.accent : C.text }}>
            {pronto
              ? `Collegato · ${libri.quanti} ${libri.quanti === 1 ? "libro riconosciuto" : "libri riconosciuti"} su Drive`
              : statoRinnovo() === "ok"
                ? "Collegato · rinnovo la chiave…"
                : "Collegato, ma Google chiede un tocco per continuare. Entra con Google qui sopra e non lo chiederà più."}
          </p>
          {spazio && <BarraDrive spazio={spazio} libri={libri} compatta />}
          {campoChiave}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {!pronto && (
              <button onClick={collega} disabled={busy} style={tasto(C.arcane)}>
                {busy ? "…" : "🔑 Ricollega"}
              </button>
            )}
            <button onClick={scollega} disabled={busy} style={tasto(C.muted)}>
              Scollega Drive
            </button>
          </div>
        </>
      ) : (
        <>
          {(!daBuild || campoChiave) && (
          <details open={!driveConfigurato()} style={{ marginTop: 10 }}>
            <summary style={{ color: C.muted, fontSize: F.nota, cursor: "pointer", padding: "12px 0" }}>
              Impostazioni di Google (una volta sola)
            </summary>
          {!daBuild && (
            <label style={{ display: "block", marginTop: 12, fontSize: F.minuscolo, color: C.muted }}>
              ID client di Google (finisce con .apps.googleusercontent.com)
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="1234…apps.googleusercontent.com"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                style={campo}
              />
            </label>
          )}
          {campoChiave}
          </details>
          )}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={collega}
              disabled={busy || (!daBuild && !id.trim())}
              style={{ ...tasto(C.accent), opacity: !daBuild && !id.trim() ? 0.5 : 1 }}
            >
              {busy ? "…" : "Collega Google Drive"}
            </button>
          </div>
          {!driveConfigurato() && !id.trim() && (
            <p style={{ margin: "8px 0 0", fontSize: F.minuscolo, color: C.muted, lineHeight: 1.45 }}>
              L'ID si crea una volta sola su console.cloud.google.com: è la chiave che dice a Google che questa app
              può chiederti il permesso di entrare nel tuo Drive.
            </p>
          )}
        </>
      )}
      {guaio && <p style={{ marginTop: 10, color: C.red, fontSize: F.nota, lineHeight: 1.45 }}>{guaio}</p>}
    </div>
  );
}

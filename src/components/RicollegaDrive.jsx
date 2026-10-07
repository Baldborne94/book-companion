import { useState } from "react";
import { C, F, R, px } from "../data/constants.js";
import { collegaDrive, permessoDriveMancante } from "../lib/drive.js";

// UN LIBRO LETTO DA DRIVE A META' STRADA SENZA CHIAVE. La chiave di Google
// dura un'ora e si rinnova solo da un tocco: leggendo un fumetto lontano per
// piu' di un'ora la pagina dopo non arriva, e senza questa riga il lettore
// vedrebbe una pagina che non si apre senza sapere perche'. Il tasto E' il
// tocco che serve a Google, e a chiave tornata la pagina si richiede.
export default function RicollegaDrive({ onFatto, alto = 0 }) {
  const [provo, setProvo] = useState(false);
  const [errore, setErrore] = useState("");
  return (
    <div
      style={{
        position: "absolute",
        top: alto + 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 30,
        width: `min(92%, ${px(460)}px)`,
        padding: "12px 14px",
        borderRadius: R.medio,
        border: `1px solid ${C.arcane}66`,
        background: C.card,
        color: C.text,
        fontSize: F.nota,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <span style={{ flex: 1, minWidth: 180 }}>
        {errore ||
          (permessoDriveMancante()
            ? "Questo libro si legge da Google Drive, ma Google non ha dato il permesso per Drive: ricollega e lascia spuntata la casella di Google Drive."
            : "Questo libro si legge da Google Drive, e Google aspetta un tocco per continuare.")}
      </span>
      <button
        disabled={provo}
        onClick={async () => {
          setProvo(true);
          setErrore("");
          try {
            await collegaDrive();
            onFatto?.();
          } catch (e) {
            setErrore(e?.message || "Google Drive non ha risposto");
          } finally {
            setProvo(false);
          }
        }}
        style={{ padding: "8px 16px", minHeight: 44, borderRadius: R.piccolo, border: `1px solid ${C.arcane}88`, color: C.arcane, fontSize: F.nota }}
      >
        {provo ? "Un attimo…" : "Ricollega"}
      </button>
    </div>
  );
}

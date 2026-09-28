// I LIBRI IN LETTURA E IL SEGUITO CHE SCENDONO DA SE', nella stanza delle impostazioni
// (`lib/anticipo.js`). Sta sul dispositivo come il volume della musica: dice
// che rete ha QUESTO tablet, non come leggi tu.
import { useState } from "react";
import { C, F, R } from "../data/constants.js";
import { SCELTE_ANTICIPO, leggiAnticipo, scriviAnticipo, fraseAnticipo, ANTICIPO_DA, IN_LETTURA_MAX } from "../lib/anticipo.js";

export default function SezioneAnticipo() {
  const [scelta, setScelta] = useState(leggiAnticipo);
  const scegli = (id) => {
    scriviAnticipo(id);
    setScelta(leggiAnticipo());
  };
  return (
    <>
      <p style={{ fontSize: F.piccolo, color: C.muted, marginBottom: 10, lineHeight: 1.45 }}>
        I libri che stai leggendo (gli ultimi {IN_LETTURA_MAX} toccati) restano sul tablet, e quando sei a{" "}
        {Math.round(ANTICIPO_DA * 100)}% di un volume scende anche il prossimo della saga: così li apri senza
        rete. Scendono da Google Drive o dal cloud; un ebook che hai tolto non scende, e quelli finiti li
        toglie «Libera spazio».
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {SCELTE_ANTICIPO.map((s) => {
          const attivo = s.id === scelta;
          return (
            <button
              key={s.id}
              onClick={() => scegli(s.id)}
              style={{
                minHeight: 44,
                padding: "8px 14px",
                borderRadius: R.tondo,
                border: `1px solid ${attivo ? C.accent : C.border}`,
                background: attivo ? `${C.accent}22` : "transparent",
                color: attivo ? C.accent : C.muted,
                fontSize: F.corpo,
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: F.piccolo, color: C.muted, marginTop: 8, lineHeight: 1.45 }}>
        {fraseAnticipo(scelta, globalThis.navigator?.connection)}
      </p>
    </>
  );
}

// LE STELLE, a mezze stelle: quelle della scheda del libro e quelle del voto
// di una raccolta (`lib/votiRaccolte.js`). Toccare il voto che c'e' lo toglie.
import { C, F } from "../data/constants.js";

export default function Stars({ value, onChange, misura = 32 }) {
  const half = (n) => Math.min(1, Math.max(0, value - (n - 1)));
  const set = (v) => onChange(v === value ? 0 : v);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = half(n);
        const star = (color) => (
          <span
            style={{
              display: "block",
              width: misura,
              fontSize: misura >= 32 ? F.grande : F.titolo,
              lineHeight: `${misura}px`,
              textAlign: "center",
              color,
              filter: color === C.accent ? `drop-shadow(0 0 6px ${C.accent}66)` : "none",
            }}
          >
            ★
          </span>
        );
        return (
          <span key={n} style={{ position: "relative", width: misura, height: misura }}>
            {star(C.dim)}
            <span
              style={{
                position: "absolute",
                inset: 0,
                width: `${fill * 100}%`,
                overflow: "hidden",
                pointerEvents: "none",
              }}
            >
              {star(C.accent)}
            </span>
            <button
              onClick={() => set(n - 0.5)}
              aria-label={`${n - 0.5} stelle`}
              style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%" }}
            />
            <button
              onClick={() => set(n)}
              aria-label={`${n} stelle`}
              style={{ position: "absolute", right: 0, top: 0, width: "50%", height: "100%" }}
            />
          </span>
        );
      })}
      <span style={{ marginLeft: 8, fontSize: F.nota, color: C.muted }}>
        {value ? String(value).replace(".", ",") : "—"}
      </span>
    </div>
  );
}

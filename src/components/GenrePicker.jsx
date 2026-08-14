import { useState } from "react";
import { C } from "../data/constants.js";
import { FAMIGLIE, SEP, famigliaDi } from "../data/generi.js";

// L'elenco dei generi da toccare col dito. Sta DENTRO la scheda, sotto la
// casella, e non prende il fuoco: toccarlo non apre la tastiera, che su un
// tablet copre mezza scheda — ed e' tutto il punto di averlo.
//
// Due tocchi invece di uno perche' i sottogeneri sono un centinaio: prima
// la famiglia, poi il suo elenco. La famiglia e' anche una scelta, per chi
// vuole fermarsi a «Fantasy».

// 44px di altezza: sotto, il dito su un tablet manca il bersaglio e prende
// il tasto accanto — sono chip attaccati, e sbagliare genere e' silenzioso
const chip = (attivo, tono) => ({
  padding: "12px 16px",
  borderRadius: 999,
  fontSize: 14.5,
  lineHeight: 1.25,
  cursor: "pointer",
  border: `1px solid ${attivo ? tono : C.border}`,
  background: attivo ? `${tono}22` : "transparent",
  color: attivo ? tono : C.text,
});

export default function GenrePicker({ value, onChange, miei = [] }) {
  const scelto = String(value || "").trim();
  const [aperta, setAperta] = useState(() => famigliaDi(scelto) || null);

  // i generi che ci sono gia' in biblioteca e che il nostro elenco non
  // conosce: sono parole tue, e restano a portata di dito
  const tuoi = miei.filter((g) => !FAMIGLIE.some((f) => f.nome === famigliaDi(g)));
  const famiglia = FAMIGLIE.find((f) => f.nome === aperta);

  return (
    <div
      style={{
        marginTop: -4,
        marginBottom: 12,
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        background: C.surface,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {FAMIGLIE.map((f) => (
          <button
            key={f.nome}
            onClick={() => setAperta(aperta === f.nome ? null : f.nome)}
            style={chip(aperta === f.nome || famigliaDi(scelto) === f.nome, C.accent)}
          >
            {f.nome}
          </button>
        ))}
      </div>

      {famiglia && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${C.dim}`,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <button
            onClick={() => onChange(famiglia.nome)}
            style={chip(scelto === famiglia.nome, C.arcane)}
          >
            Solo «{famiglia.nome}»
          </button>
          {famiglia.sotto.map((s) => {
            const intero = famiglia.nome + SEP + s;
            return (
              <button key={s} onClick={() => onChange(intero)} style={chip(scelto === intero, C.arcane)}>
                {s}
              </button>
            );
          })}
        </div>
      )}

      {tuoi.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.dim}` }}>
          <span style={{ display: "block", fontSize: 12.5, color: C.muted, marginBottom: 6 }}>
            I tuoi
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {tuoi.map((g) => (
              <button key={g} onClick={() => onChange(g)} style={chip(scelto === g, C.accent)}>
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {scelto && (
        <button
          onClick={() => onChange("")}
          style={{
            marginTop: 12,
            padding: "11px 16px",
            borderRadius: 999,
            fontSize: 13.5,
            border: `1px solid ${C.border}`,
            color: C.muted,
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Togli il genere
        </button>
      )}
    </div>
  );
}

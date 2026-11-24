import { C, FONT_TITLE, F, R, px } from "../data/constants.js";
import { fmtBytes } from "../lib/bytes.js";

// IL PANNELLO DEI PEZZI. Una biblioteca coi fumetti pesa giga, e uno zip
// solo costruito in memoria fa chiudere la scheda del tablet: qui l'archivio
// esce un pezzo per volta, col tasto accanto a ognuno. Non si scaricano
// tutti con un tocco solo apposta — il browser blocca una raffica di
// scaricamenti e ne lascia passare uno — e un tocco per pezzo dice anche
// quali sono partiti davvero.
const plurale = (n, uno, tanti) => `${n} ${n === 1 ? uno : tanti}`;

function cosaPorta(p) {
  if (p.tipo === "grezzo") {
    const v = p.voci[0];
    return `${v.nome || "senza titolo"}${v.ext ? ` · .${v.ext}` : ""}`;
  }
  const conta = (s) => p.voci.filter((v) => v.specie === s).length;
  const parti = [
    conta("libro") ? plurale(conta("libro"), "libro", "libri") : null,
    conta("copertina") ? plurale(conta("copertina"), "copertina", "copertine") : null,
    conta("melodia") ? plurale(conta("melodia"), "melodia", "melodie") : null,
  ].filter(Boolean);
  // il primo pezzo porta sempre l'indice, anche quando non porta altro
  return parti.length ? `indice, ${parti.join(", ")}` : "l'indice della biblioteca";
}

export default function PezziArchivio({ piano, nome, fatti, lavora, onScarica, onChiudi }) {
  const prossimo = piano.pezzi.find((p) => !fatti.has(p.n));
  return (
    <div
      onClick={onChiudi}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 55,
        background: "#080611cc",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        animation: "bc-fade-in 0.25s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: px(480),
          maxHeight: "100%",
          overflowY: "auto",
          borderRadius: R.grande,
          border: `1px solid ${C.border}`,
          background: `linear-gradient(180deg, ${C.card}, ${C.surface})`,
          boxShadow: `0 0 60px ${C.arcane}22, 0 20px 50px #00000088`,
          padding: 22,
        }}
      >
        <h2 style={{ fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text }}>
          📦 L'archivio in {piano.di} pezzi
        </h2>
        <p style={{ color: C.muted, fontSize: F.piccolo, marginTop: 6, marginBottom: 14 }}>
          La biblioteca pesa {fmtBytes(piano.totale)}: tutta insieme non ci sta nella memoria del tablet, quindi
          esce a pezzi. Scaricali tutti e tienili nella stessa cartella — per ripristinare li scegli insieme.
        </p>

        {piano.pezzi.map((p) => {
          const fatto = fatti.has(p.n);
          const ora = lavora === p.n;
          return (
            <div
              key={p.n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 0",
                borderTop: `1px solid ${C.border}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontSize: F.corpo }}>
                  Pezzo {p.n} · {fmtBytes(p.byte)}
                </div>
                <div
                  style={{
                    color: C.muted,
                    fontSize: F.minuscolo,
                    marginTop: 2,
                    overflowWrap: "anywhere",
                  }}
                  title={nome(p.n)}
                >
                  {cosaPorta(p)}
                </div>
              </div>
              <button
                onClick={() => onScarica(p.n)}
                disabled={!!lavora}
                style={{
                  minHeight: 44,
                  minWidth: px(110),
                  padding: "0 14px",
                  borderRadius: R.piccolo,
                  border: `1px solid ${fatto ? C.border : `${C.accent}88`}`,
                  background: fatto ? "transparent" : `${C.accent}18`,
                  color: fatto ? C.muted : C.accent,
                  fontSize: F.nota,
                  opacity: lavora && !ora ? 0.5 : 1,
                }}
              >
                {ora ? "Preparo…" : fatto ? "✓ Scaricato" : "Scarica"}
              </button>
            </div>
          );
        })}

        <p style={{ color: fatti.size === piano.di ? C.accent : C.muted, fontSize: F.minuscolo, marginTop: 12 }}>
          {fatti.size === piano.di
            ? "Tutti i pezzi sono partiti: l'archivio è completo."
            : prossimo
              ? `${fatti.size} di ${piano.di} scaricati · ${
                  piano.di - fatti.size === 1 ? `manca ancora il pezzo ${prossimo.n}` : `ne mancano ancora ${piano.di - fatti.size}`
                }. Un archivio a metà non vale come archivio.`
              : ""}
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button
            onClick={onChiudi}
            disabled={!!lavora}
            style={{
              minHeight: 44,
              padding: "0 18px",
              borderRadius: R.piccolo,
              border: `1px solid ${C.border}`,
              color: C.muted,
              fontSize: F.nota,
            }}
          >
            {fatti.size === piano.di ? "Fatto" : "Chiudi"}
          </button>
        </div>
      </div>
    </div>
  );
}

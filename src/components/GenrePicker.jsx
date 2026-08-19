import { useState } from "react";
import { C, F, R } from "../data/constants.js";
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
  borderRadius: R.tondo,
  fontSize: F.nota,
  lineHeight: 1.25,
  cursor: "pointer",
  border: `1px solid ${attivo ? tono : C.border}`,
  background: attivo ? `${tono}22` : "transparent",
  color: attivo ? tono : C.text,
});

export default function GenrePicker({ value, onChange, miei = [] }) {
  const scelto = String(value || "").trim();
  const [aperta, setAperta] = useState(() => famigliaDi(scelto) || null);
  const [nuovo, setNuovo] = useState(null);

  // i generi che ci sono gia' in biblioteca e che il nostro elenco non
  // conosce: sono parole tue, e restano a portata di dito
  const tuoi = miei.filter((g) => !FAMIGLIE.some((f) => f.nome === famigliaDi(g)));
  const famiglia = FAMIGLIE.find((f) => f.nome === aperta);

  // IL SOTTOGENERE NON E' OBBLIGATORIO: toccare la famiglia sceglie gia',
  // e l'elenco che si apre sotto e' un'offerta, non un secondo passo da
  // fare per forza. Ma su una famiglia gia' scelta il tocco non riscrive
  // niente — si sta solo riaprendo l'elenco per curiosare, e buttare via
  // il sottogenere che avevi messo sarebbe un dispetto.
  function tocca(nome) {
    setNuovo(null);
    if (famigliaDi(scelto) === nome) {
      setAperta(aperta === nome ? null : nome);
      return;
    }
    onChange(nome);
    setAperta(nome);
  }

  // i tuoi sottogeneri dentro questa famiglia: una volta scritti, tornano
  // qui come tutti gli altri
  const mieiQui = famiglia
    ? miei.filter((g) => famigliaDi(g) === famiglia.nome && g !== famiglia.nome && !famiglia.sotto.includes(g.slice(famiglia.nome.length + SEP.length)))
    : [];

  return (
    <div
      style={{
        marginTop: -4,
        marginBottom: 12,
        padding: 12,
        borderRadius: R.piccolo,
        border: `1px solid ${C.border}`,
        background: C.surface,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {FAMIGLIE.map((f) => (
          <button
            key={f.nome}
            onClick={() => tocca(f.nome)}
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
          {[...famiglia.sotto.map((s) => famiglia.nome + SEP + s), ...mieiQui].map((intero) => (
            <button key={intero} onClick={() => onChange(intero)} style={chip(scelto === intero, C.arcane)}>
              {intero.slice(famiglia.nome.length + SEP.length)}
            </button>
          ))}

          {/* il sottogenere tuo si scrive qui dentro, non nella casella
              grande: il separatore lo mette l'app, o dovresti scovare il
              «·» sulla tastiera del tablet */}
          {nuovo === null ? (
            <button onClick={() => setNuovo("")} style={chip(false, C.arcane)}>
              + Il mio
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const t = nuovo.trim();
                if (t) onChange(famiglia.nome + SEP + t);
                setNuovo(null);
              }}
              style={{ display: "flex", gap: 8, alignItems: "center" }}
            >
              <input
                autoFocus
                value={nuovo}
                onChange={(e) => setNuovo(e.target.value)}
                placeholder={`Sottogenere di ${famiglia.nome}…`}
                style={{
                  padding: "11px 14px",
                  borderRadius: R.tondo,
                  border: `1px solid ${C.arcane}`,
                  background: C.card,
                  color: C.text,
                  fontSize: F.nota,
                  minWidth: 0,
                  width: 210,
                }}
              />
              <button type="submit" style={chip(true, C.arcane)}>
                Aggiungi
              </button>
            </form>
          )}
        </div>
      )}

      {tuoi.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.dim}` }}>
          <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted, marginBottom: 6 }}>
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
            borderRadius: R.tondo,
            fontSize: F.piccolo,
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

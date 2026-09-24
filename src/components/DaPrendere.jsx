import { useMemo, useState } from "react";
import { C, TEMA, FONT_TITLE, F, R, px } from "../data/constants.js";
import {
  IN_VISTA,
  aggiungi,
  arrivato,
  leggiDaPrendere,
  nomeVoce,
  proposte,
  scarta,
  scriviDaPrendere,
  testoLista,
  tieni,
  togli,
  vive,
} from "../lib/daPrendere.js";

const campo = () => ({
  flex: 1,
  minWidth: 0,
  minHeight: 44,
  padding: "10px 14px",
  borderRadius: R.piccolo,
  border: `1px solid ${C.border}`,
  background: C.card,
  color: C.text,
  fontSize: F.nota,
});

const tasto = (colore) => ({
  minHeight: 44,
  padding: "8px 14px",
  borderRadius: R.tondo,
  border: `1px solid ${colore}66`,
  color: colore,
  fontSize: F.piccolo,
  whiteSpace: "nowrap",
});

// Una saga fra le proposte: le prime in vista, il resto dietro un tasto col
// conto — una guida da settantun tappe ne proporrebbe venti in fila.
function GruppoProposte({ gruppo, onTieni, onScarta }) {
  const [tutte, setTutte] = useState(false);
  const mostrate = tutte ? gruppo.voci : gruppo.voci.slice(0, IN_VISTA);
  const altre = gruppo.voci.length - mostrate.length;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: F.nota, fontWeight: 600, color: C.text }}>{gruppo.nome}</div>
      {gruppo.dopo?.title && (
        <div style={{ fontSize: F.minuscolo, color: C.muted, marginBottom: 6 }}>dopo «{gruppo.dopo.title}»</div>
      )}
      {mostrate.map((v) => (
        <div
          key={v.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
            padding: "8px 12px",
            borderRadius: R.piccolo,
            border: `1px dashed ${C.border}`,
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: F.nota, color: C.text }}>{nomeVoce(v)}</span>
            {(v.autore || (v.titolo && v.numero != null)) && (
              <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted }}>
                {[v.autore, v.titolo && v.numero != null ? `n° ${v.numero}` : ""].filter(Boolean).join(" · ")}
              </span>
            )}
          </span>
          <button onClick={() => onTieni(v)} style={tasto(C.accent)}>
            ＋ Tieni
          </button>
          <button onClick={() => onScarta(v)} aria-label="Non mi serve" style={{ minHeight: 44, padding: "8px 10px", color: C.muted }}>
            ✕
          </button>
        </div>
      ))}
      {altre > 0 && (
        <button onClick={() => setTutte(true)} style={{ ...tasto(C.muted), border: "none", padding: "6px 0" }}>
          altre {altre} ▾
        </button>
      )}
    </div>
  );
}

export default function DaPrendere({ books, onClose }) {
  const [lista, setLista] = useState(leggiDaPrendere);
  const [titolo, setTitolo] = useState("");
  const [autore, setAutore] = useState("");
  const [copiata, setCopiata] = useState(null);

  const salva = (nuova) => {
    scriviDaPrendere(nuova);
    setLista(nuova);
  };
  const gruppi = useMemo(() => proposte(books, lista), [books, lista]);
  // gli arrivati in fondo: sono quelli da togliere, non da cercare
  const voci = useMemo(
    () =>
      vive(lista)
        .map((v) => ({ v, arr: arrivato(v, books) }))
        .sort((a, b) => Number(!!a.arr) - Number(!!b.arr) || (b.v.aggiunta || 0) - (a.v.aggiunta || 0)),
    [lista, books]
  );

  function aggiungiMia(e) {
    e.preventDefault();
    if (!titolo.trim()) return;
    salva(aggiungi(leggiDaPrendere(), { titolo, autore }));
    setTitolo("");
    setAutore("");
  }

  async function copia() {
    const testo = testoLista(lista, books);
    try {
      await navigator.clipboard.writeText(testo);
      setCopiata("si");
    } catch {
      setCopiata("no");
    }
    setTimeout(() => setCopiata(null), 2200);
  }

  const daCopiare = voci.some((x) => !x.arr);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        overflowY: "auto",
        background: TEMA.gradient,
        animation: "bc-fade-in 0.35s ease-out",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          padding: "12px 14px",
          background: `${C.surface}f2`,
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={onClose}
            aria-label="Chiudi la lista"
            style={{ width: 40, height: 40, borderRadius: R.piccolo, fontSize: F.titoletto, color: C.text }}
          >
            ✕
          </button>
          <h2 style={{ flex: 1, minWidth: 0, fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text }}>
            🛒 Da prendere
          </h2>
          {daCopiare && (
            <button onClick={copia} style={tasto(copiata === "si" ? C.green : C.arcane)}>
              {copiata === "si" ? "✓ Copiata" : "⧉ Copia la lista"}
            </button>
          )}
        </div>
        {copiata === "no" && (
          <div style={{ marginTop: 8, fontSize: F.piccolo, color: C.accent }}>
            Gli appunti non si lasciano scrivere qui: tieni aperta questa pagina in libreria.
          </div>
        )}
      </div>

      <div style={{ maxWidth: px(720), margin: "0 auto", padding: "18px 16px 48px" }}>
        {/* un form vero: l'invio della tastiera aggiunge, senza cercare il tasto */}
        <form onSubmit={aggiungiMia} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          <input value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Titolo" style={campo()} />
          <input value={autore} onChange={(e) => setAutore(e.target.value)} placeholder="Autore (facoltativo)" style={campo()} />
          <button type="submit" disabled={!titolo.trim()} style={{ ...tasto(C.accent), opacity: titolo.trim() ? 1 : 0.5 }}>
            ＋ Aggiungi
          </button>
        </form>

        <h3 style={{ fontFamily: FONT_TITLE, fontSize: F.titoletto, color: C.accent, marginBottom: 10 }}>La tua lista</h3>
        {voci.length === 0 ? (
          <p style={{ color: C.muted, marginBottom: 24 }}>
            Ancora vuota. Scrivi qui sopra un titolo, o tieni una delle proposte che vengono dalle tue saghe.
          </p>
        ) : (
          <div style={{ marginBottom: 26 }}>
            {voci.map(({ v, arr }) => (
              <div
                key={v.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                  padding: "10px 14px",
                  borderRadius: R.piccolo,
                  border: `1px solid ${arr ? `${C.green}66` : C.border}`,
                  background: `linear-gradient(135deg, ${C.card}, ${C.surface})`,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: F.corpo, color: C.text, fontWeight: 600 }}>{nomeVoce(v)}</span>
                  <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted }}>
                    {[v.autore, v.titolo && v.saga ? `${v.saga}${v.numero != null ? ` n° ${v.numero}` : ""}` : "", v.nota]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {arr && (
                    <span style={{ display: "block", fontSize: F.minuscolo, color: C.green, marginTop: 2 }}>
                      ✓ è arrivato in biblioteca{arr.title && arr.title !== v.titolo ? ` («${arr.title}»)` : ""}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => salva(togli(leggiDaPrendere(), v.id))}
                  aria-label="Togli dalla lista"
                  style={arr ? tasto(C.green) : { minHeight: 44, padding: 8, color: C.muted }}
                >
                  {arr ? "Togli" : "🗑"}
                </button>
              </div>
            ))}
          </div>
        )}

        {gruppi.length > 0 && (
          <>
            <h3 style={{ fontFamily: FONT_TITLE, fontSize: F.titoletto, color: C.arcane, marginBottom: 4 }}>Dalle tue saghe</h3>
            <p style={{ fontSize: F.piccolo, color: C.muted, marginBottom: 12, lineHeight: 1.45 }}>
              I volumi che ti mancano per andare avanti, dopo l'ultimo che hai letto. Dove la saga non la conosco
              dico solo il numero.
            </p>
            {gruppi.map((g) => (
              <GruppoProposte
                key={`${g.saga}|${g.nome}`}
                gruppo={g}
                onTieni={(v) => salva(tieni(leggiDaPrendere(), v))}
                onScarta={(v) => salva(scarta(leggiDaPrendere(), v.id))}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

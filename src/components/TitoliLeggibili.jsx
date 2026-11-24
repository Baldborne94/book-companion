import { useState } from "react";
import { C, F, R } from "../data/constants.js";
import { chiaveHardcover, domandaHardcover, serieHardcover, ChiaveRifiutata } from "../lib/hardcover.js";
import { daRileggere, titoliDaProporre } from "../lib/titoliLeggibili.js";

// I TITOLI IN UN ALTRO ALFABETO DELLA RACCOLTA APERTA (`lib/titoliLeggibili.js`):
// c'e' solo se ce n'e'; prima l'elenco, tutto spuntato, poi il tasto.
export default function TitoliLeggibili({ r, onRinomina }) {
  const [stato, setStato] = useState(null);
  const quanti = daRileggere(r?.libri || []).length;
  if (!quanti) return null;
  const tasto = (attivo) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    padding: "0 14px",
    borderRadius: R.tondo,
    border: `1px solid ${attivo ? C.accent : C.border}`,
    background: attivo ? `${C.accent}1f` : "transparent",
    color: attivo ? C.accent : C.muted,
    fontSize: F.nota,
  });
  const riquadro = { display: "flex", flexDirection: "column", gap: 10, padding: "10px 14px", marginBottom: 14, borderRadius: R.medio, border: `1px solid ${C.border}`, background: `linear-gradient(135deg, ${C.card}, ${C.surface})` };

  async function cerca() {
    setStato({ fase: "cerco" });
    const chiave = chiaveHardcover();
    let volumi = [];
    let avviso = chiave ? null : "senza";
    if (chiave) {
      try {
        volumi = (await serieHardcover(r.nome, domandaHardcover(chiave)))?.volumi || [];
      } catch (e) {
        avviso = e instanceof ChiaveRifiutata ? "chiave" : "guasto";
      }
    }
    const proposte = titoliDaProporre(r.libri, r.nome, volumi);
    setStato({ fase: "elenco", proposte, avviso, scelti: new Set(proposte.map((p) => p.id)) });
  }

  if (!stato)
    return (
      <div style={{ display: "flex", marginBottom: 14 }}>
        <button onClick={cerca} style={tasto(false)}>
          🔤 {quanti === 1 ? "Un titolo in un altro alfabeto" : `${quanti} titoli in un altro alfabeto`}
        </button>
      </div>
    );
  if (stato.fase === "cerco") return <div style={{ ...riquadro, color: C.muted, fontSize: F.nota }}>Cerco i titoli leggibili…</div>;

  const { proposte, scelti, avviso } = stato;
  const giraSpunta = (id) =>
    setStato((s) => {
      const n = new Set(s.scelti);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return { ...s, scelti: n };
    });
  const metti = () => {
    const nuovi = new Map(proposte.filter((p) => scelti.has(p.id)).map((p) => [p.id, p.a]));
    setStato(null);
    if (nuovi.size) onRinomina?.(nuovi);
  };
  if (!proposte.length)
    return (
      <div style={{ ...riquadro, flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: C.muted, fontSize: F.nota }}>Non ho un titolo leggibile da proporre: né Hardcover né il nome della raccolta lo danno.</span>
        <button onClick={() => setStato(null)} style={tasto(false)}>
          Ok
        </button>
      </div>
    );
  const daHC = proposte.filter((p) => p.fonte === "hardcover").length;
  const frase = {
    senza: "Senza la chiave di Hardcover (Impostazioni, «Le serie da Hardcover») propongo il nome della raccolta col numero.",
    chiave: "Hardcover non accetta la chiave salvata: propongo il nome della raccolta col numero.",
    guasto: "Hardcover non risponde adesso: propongo il nome della raccolta col numero.",
  }[avviso];
  return (
    <div style={riquadro}>
      <span style={{ color: C.text, fontSize: F.nota }}>
        {daHC ? `${daHC === 1 ? "Un titolo viene" : `${daHC} titoli vengono`} da un'edizione latina su Hardcover; ` : ""}
        {proposte.length > daHC ? `${daHC ? "gli altri" : "I titoli"} sono il nome della raccolta col numero, perché Hardcover ha solo quello in un altro alfabeto. ` : ""}
        Togli la spunta a quel che vuoi lasciare com'è.
      </span>
      {frase && <span style={{ color: C.muted, fontSize: F.piccolo }}>{frase}</span>}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: "50vh", overflowY: "auto" }}>
        {proposte.map((p) => (
          <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: F.piccolo, color: C.text }}>
            <input type="checkbox" checked={scelti.has(p.id)} onChange={() => giraSpunta(p.id)} style={{ width: 22, height: 22, flex: "none" }} />
            <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span style={{ color: C.muted, overflowWrap: "anywhere" }}>{p.da}</span>
              <span style={{ overflowWrap: "anywhere" }}>→ {p.a}</span>
            </span>
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {scelti.size > 0 && (
          <button onClick={metti} style={tasto(true)}>
            {scelti.size === 1 ? "🔤 Cambia il titolo" : `🔤 Cambia ${scelti.size} titoli`}
          </button>
        )}
        <button onClick={() => setStato(null)} style={tasto(false)}>
          {scelti.size ? "Annulla" : "Chiudi"}
        </button>
      </div>
    </div>
  );
}

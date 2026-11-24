import { useState } from "react";
import { C, F, R } from "../data/constants.js";
import { sceltePerCopertina } from "../lib/copertineSerie.js";
import CopertineDalCatalogo from "./CopertineDalCatalogo.jsx";

// «🖼 COPERTINA DAL CATALOGO» NELLA MANUTENZIONE (chiesto dal lettore: «un
// tasto in cui scelgo la raccolta o il libro e gli chiedo di mettermi la
// copertina corretta»): si scrive un pezzo del nome, si tocca la raccolta o
// il libro (`sceltePerCopertina`), e da li' e' lo stesso elenco della
// raccolta aperta (`CopertineDalCatalogo`): prima si guarda, poi si mette.
export default function CopertinaGiusta({ books = [], notify }) {
  const [cercato, setCercato] = useState("");
  const [scelta, setScelta] = useState(null);
  const scelte = scelta ? [] : sceltePerCopertina(books, cercato);
  const riga = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    padding: "0 12px",
    borderRadius: R.piccolo,
    border: `1px solid ${C.border}`,
    color: C.text,
    fontSize: F.nota,
    textAlign: "left",
  };
  return (
    <div style={{ flexBasis: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
      {scelta ? (
        <CopertineDalCatalogo
          key={scelta.tipo === "libro" ? scelta.libro.id : `saga:${scelta.nome}`}
          r={scelta.tipo === "raccolta" ? { id: `saga:${scelta.nome}`, nome: scelta.nome, libri: scelta.libri } : null}
          libro={scelta.tipo === "libro" ? scelta.libro : null}
          notify={notify}
          subito
          onChiudi={() => setScelta(null)}
        />
      ) : (
        <>
          <input
            type="search"
            value={cercato}
            onChange={(e) => setCercato(e.target.value)}
            placeholder="Scrivi il nome di una raccolta o di un libro"
            aria-label="Raccolta o libro di cui cercare la copertina"
            style={{ minHeight: 44, padding: "0 12px", borderRadius: R.piccolo, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: F.nota }}
          />
          {cercato.trim() && !scelte.length && <span style={{ fontSize: F.piccolo, color: C.muted }}>Nessuna raccolta e nessun libro con queste parole.</span>}
          {scelte.map((s) =>
            s.tipo === "raccolta" ? (
              <button key={`r:${s.nome}`} onClick={() => setScelta(s)} style={riga}>
                📚 {s.nome} <span style={{ color: C.muted, fontSize: F.piccolo }}>· {s.libri.length === 1 ? "un volume" : `${s.libri.length} volumi`}</span>
              </button>
            ) : (
              <button key={`l:${s.libro.id}`} onClick={() => setScelta(s)} style={riga}>
                📖 {s.libro.title}
                {s.libro.author ? <span style={{ color: C.muted, fontSize: F.piccolo }}>· {s.libro.author}</span> : null}
              </button>
            )
          )}
        </>
      )}
    </div>
  );
}

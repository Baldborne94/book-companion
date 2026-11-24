import { C, F, R } from "../data/constants.js";
import { fraseNovita, nomiSerie } from "../lib/novita.js";

// LE NOVITA' NELLE IMPOSTAZIONI (`lib/novita.js`): cosa si segue, lo stato
// delle notifiche come lo dice il guscio, e un tocco per smettere. Si
// comincia a seguire dalla raccolta di una saga o di un autore in Libreria.
export default function SezioneNovita({ lista = [], stato = null, nelGuscio = false, onSmetti }) {
  return (
    <div style={{ marginTop: 14 }}>
      <p style={{ fontSize: F.piccolo, color: stato === "no" || stato === "guasto" ? C.accent : C.muted, lineHeight: 1.45, marginBottom: lista.length ? 8 : 0 }}>
        {fraseNovita(stato, { nelGuscio, quante: lista.length })}
      </p>
      {lista.map((x) => (
        <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, borderTop: `1px solid ${C.border}` }}>
          <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", fontSize: F.nota, color: C.text }}>
            {x.nome}
            <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted }}>
              {x.tipo === "manga" ? "capitoli nuovi · MangaDex" : x.tipo === "serie" ? `volumi nuovi di ${nomiSerie(x)} · Wikidata${(x.autori || []).length ? `; libri nuovi di ${x.autori.join(", ")} · Open Library` : ""}` : `libri nuovi di ${(x.autori || []).join(", ")} · Open Library`}
            </span>
          </span>
          <button
            onClick={() => onSmetti?.(x.id)}
            aria-label={`Smetti di seguire ${x.nome}`}
            style={{ minHeight: 44, minWidth: 44, padding: "0 12px", borderRadius: R.tondo, border: `1px solid ${C.border}`, color: C.muted, fontSize: F.nota }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

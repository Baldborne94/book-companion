import { useState } from "react";
import { C, F, R } from "../data/constants.js";
import { chiaveHardcover, salvaChiaveHardcover } from "../lib/hardcover.js";

// LA CHIAVE DI HARDCOVER NELLE IMPOSTAZIONI (`lib/hardcover.js`): con lei
// «📥 Senza file» cerca le serie anche su Hardcover, piu' completo di
// Wikidata. Sta sul dispositivo e viaggia sugli altri con la
// sincronizzazione, come quella dell'Oracolo (`chiaviInViaggio.js`).
export default function SezioneHardcover() {
  const [salvata, setSalvata] = useState(() => !!chiaveHardcover());
  const [bozza, setBozza] = useState("");
  const salva = () => {
    if (!bozza.trim()) return;
    salvaChiaveHardcover(bozza);
    setBozza("");
    setSalvata(true);
  };
  const togli = () => {
    salvaChiaveHardcover("");
    setSalvata(false);
  };
  return (
    <div>
      <p style={{ fontSize: F.piccolo, color: C.muted, lineHeight: 1.45 }}>
        {salvata
          ? "✓ Chiave salvata: in «📥 Senza file» le saghe e le saghe di un autore si cercano prima su Hardcover, poi su Wikidata."
          : "Con una chiave di Hardcover, in «📥 Senza file» le saghe si cercano anche lì: ha le serie più complete di Wikidata, coi numeri, e le novelle a parte."}
      </p>
      {!salvata && (
        <p style={{ fontSize: F.piccolo, color: C.muted, lineHeight: 1.45, marginTop: 6 }}>
          Su{" "}
          <a href="https://hardcover.app/account/api" target="_blank" rel="noreferrer" style={{ color: C.accent }}>
            hardcover.app → API
          </a>{" "}
          crea una chiave col solo permesso <code>read:catalog</code> e incollala qui. Con la sincronizzazione accesa arriva da sola sugli altri tuoi dispositivi; a Hardcover arrivano i nomi delle saghe e degli autori che cerchi.
        </p>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        {!salvata ? (
          <>
            <input
              type="password"
              value={bozza}
              onChange={(e) => setBozza(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salva()}
              placeholder="hc_pat_…"
              aria-label="Chiave di Hardcover"
              style={{ flex: "1 1 200px", minWidth: 0, minHeight: 44, background: "transparent", border: `1px solid ${C.border}`, borderRadius: R.piccolo, padding: "7px 10px", fontSize: F.nota, color: C.text }}
            />
            <button onClick={salva} disabled={!bozza.trim()} aria-label="Salva la chiave di Hardcover" style={{ minHeight: 44, flexShrink: 0, fontSize: F.piccolo, color: C.accent, border: `1px solid ${C.accent}55`, borderRadius: R.tondo, padding: "5px 14px", opacity: bozza.trim() ? 1 : 0.5 }}>
              Salva
            </button>
          </>
        ) : (
          <button onClick={togli} style={{ minHeight: 44, fontSize: F.piccolo, color: C.muted, border: `1px solid ${C.border}`, borderRadius: R.tondo, padding: "5px 14px" }}>
            Togli la chiave
          </button>
        )}
      </div>
    </div>
  );
}

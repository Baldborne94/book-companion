import { useState } from "react";
import { C, F, R } from "../data/constants.js";
import { indirizzoNas, salvaIndirizzoNas, provaNas, guardaIlNas, salvaLibriSulNas, leggiLibriSulNas, fraseNas, fraseRapportoNas, nasDelPosto } from "../lib/nas.js";

// IL NAS NELLE IMPOSTAZIONI (`lib/nas.js`): l'indirizzo, sul dispositivo
// come le chiavi, la prova del collegamento e il controllo, che dice quali
// libri il NAS ha. Da li' in poi «Apri» su un libro senza file qui lo
// prende dal NAS (App, `prendiDalNasEApri`).
export default function SezioneNas({ libri = [] }) {
  const [scritto, setScritto] = useState(() => indirizzoNas() || "");
  const delPosto = nasDelPosto();
  const [stato, setStato] = useState(null); // { frase, ok }
  const [guardo, setGuardo] = useState(null); // { letti, totale }
  const [noti, setNoti] = useState(() => leggiLibriSulNas());

  async function salvaEProva() {
    const url = salvaIndirizzoNas(scritto);
    if (!url) {
      setStato({ ok: false, frase: scritto.trim() ? "Questo non è un indirizzo: scrivilo come «nas.tuarete.ts.net/libri»." : delPosto ? "Torna il NAS da cui è arrivata l'app." : "Indirizzo tolto: i libri non si prendono più dal NAS." });
      if (delPosto && !scritto.trim()) setScritto(delPosto);
      if (!scritto.trim()) salvaLibriSulNas({}, 0);
      setNoti(leggiLibriSulNas());
      return;
    }
    setScritto(url);
    setStato({ ok: null, frase: "Busso al NAS…" });
    setStato(await provaNas(url));
  }

  async function guarda() {
    const url = indirizzoNas();
    if (!url || guardo) return;
    setGuardo({ letti: 0, totale: 0 });
    try {
      const esito = await guardaIlNas(libri, url, { onFile: (letti, totale) => (letti % 25 === 0 || letti === totale) && setGuardo({ letti, totale }) });
      setNoti(leggiLibriSulNas());
      setStato({ ok: true, frase: fraseRapportoNas(esito) });
    } catch (e) {
      setStato({ ok: false, frase: fraseNas(e) });
    } finally {
      setGuardo(null);
    }
  }

  const quanti = Object.keys(noti.libri || {}).length;
  const tasto = { minHeight: 44, padding: "0 14px", borderRadius: R.piccolo, border: `1px solid ${C.border}`, color: C.text, fontSize: F.nota };
  return (
    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontSize: F.piccolo, color: C.muted, lineHeight: 1.45 }}>
        {delPosto
          ? "L'app arriva dal NAS: l'indirizzo è già il suo, e una volta al giorno guarda da sola quali libri ci sono. Fuori casa serve Tailscale acceso su questo dispositivo."
          : "L'indirizzo della cartella dei libri sul NAS (quella che contiene «book-companion»). Fuori casa serve Tailscale acceso su questo dispositivo. Come preparare il NAS: docs/NAS.md."}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          aria-label="Indirizzo del NAS"
          value={scritto}
          onChange={(e) => setScritto(e.target.value)}
          placeholder="nas.tuarete.ts.net/libri"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{ flex: 1, minWidth: 220, minHeight: 44, padding: "0 12px", borderRadius: R.piccolo, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: F.nota }}
        />
        <button onClick={salvaEProva} style={tasto}>
          Salva e prova
        </button>
      </div>
      {stato && (
        <p role="status" style={{ fontSize: F.piccolo, color: stato.ok === false ? C.accent : C.muted, lineHeight: 1.45 }}>
          {stato.frase}
        </p>
      )}
      {indirizzoNas() && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={guarda} disabled={!!guardo} style={tasto}>
            {guardo ? `Guardo il NAS… ${guardo.totale ? `${guardo.letti} di ${guardo.totale}` : ""}` : "🔍 Guarda cosa c'è sul NAS"}
          </button>
          {quanti > 0 && !guardo && (
            <span style={{ fontSize: F.minuscolo, color: C.muted }}>
              {quanti === 1 ? "un libro" : `${quanti} libri`} sul NAS, guardati il {new Date(noti.quando).toLocaleDateString("it-IT")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

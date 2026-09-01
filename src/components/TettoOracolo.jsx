import { useState } from "react";
import { C, F, R } from "../data/constants.js";
import { SCALINI, leggiTetto, scriviTetto, scalinoSopra, soldi, soldiTetto } from "../lib/spesa.js";
import { setOracleKey, hasOracle } from "../lib/oracle.js";

// IL TETTO DEL MESE, DA CAMBIARE COL DITO.
//
// Sta qui, in un file suo, perche' lo mostrano in due: la scheda dell'Oracolo
// e la scheda del dizionario. Sono due pannelli caricati pigramente e
// indipendenti, e farne importare uno dall'altro li incollerebbe nello stesso
// pezzo di bundle per un paio di bottoni.
//
// SI SCEGLIE A TASTI, non scrivendo. Sul tablet un campo numerico vuol dire
// aprire la tastiera, che copre mezza scheda — la stessa ragione per cui i
// generi hanno un pannello di chip invece di una casella di testo. E i
// bersagli stanno a 44px: sotto, il dito prende il tasto accanto, e qui
// sbagliare vuol dire darsi un tetto che non si voleva.

const chip = (attivo) => ({
  minWidth: 56,
  height: 44,
  padding: "0 12px",
  borderRadius: R.tondo,
  border: `1px solid ${attivo ? C.arcane : C.border}`,
  background: attivo ? `${C.arcane}22` : "transparent",
  color: attivo ? C.arcane : C.muted,
  fontSize: F.corpo,
});

// L'etichetta di un gradino. Lo zero non e' «$0», che si leggerebbe come
// «non puoi spendere niente» — e' l'esatto contrario.
export const nomeScalino = (v) => (v > 0 ? soldiTetto(v) : "Nessuno");

// Il comando discreto: dice a quanto sei, e aperto mostra i gradini. Chiuso
// e' una riga di servizio, perche' quasi sempre non c'e' niente da fare.
//
// IL VALORE SI RILEGGE A OGNI GIRO invece di essere copiato in uno stato:
// il tasto «Alza a $N» qui accanto scrive lo stesso numero, e un valore
// copiato al montaggio resterebbe indietro — l'etichetta direbbe $5 mentre
// il tetto e' gia' $10. Lo stato serve solo a far girare il render.
export function Tetto({ onCambia }) {
  const [aperto, setAperto] = useState(false);
  const [, setGiro] = useState(0);
  const ora = leggiTetto();
  const scegli = (v) => {
    scriviTetto(v);
    setGiro((n) => n + 1);
    setAperto(false);
    onCambia?.(v);
  };
  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setAperto((v) => !v)}
        style={{
          fontSize: F.minuscolo,
          color: C.muted,
          border: `1px solid ${C.border}`,
          borderRadius: R.tondo,
          padding: "4px 10px",
        }}
      >
        Tetto del mese: {nomeScalino(ora)} {aperto ? "⌃" : "⌄"}
      </button>
      {aperto && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {SCALINI.map((v) => (
            <button key={v} onClick={() => scegli(v)} style={chip(v === ora)}>
              {nomeScalino(v)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// QUANDO IL TETTO È FINITO. Non e' un errore dell'Oracolo e non si scrive
// come tale: e' una decisione del lettore che sta funzionando. Percio' la
// scheda dice i due numeri veri — quanto hai speso e quanto ti eri dato — e
// offre l'unica strada che c'e', che e' spostare il tetto.
//
// «Hai speso $5,12 di $5» non e' un errore di conto: il costo di una domanda
// si sa solo dopo averla fatta, quindi l'ultima puo' aver passato il segno.
// Dirlo com'e' e' meglio che arrotondare a un pareggio che non c'e' stato.
export function TettoFinito({ speso, tetto, onRiprova }) {
  const [su, setSu] = useState(() => scalinoSopra(tetto));
  return (
    <div>
      <p style={{ color: C.muted, fontSize: F.nota, lineHeight: 1.55, margin: 0 }}>
        Il tetto di questo mese è finito: hai speso {soldi(speso)} di {soldiTetto(tetto)}. L'Oracolo
        riprende da solo il primo del mese.
      </p>
      {su !== null && (
        <button
          onClick={() => {
            scriviTetto(su);
            setSu(null);
            onRiprova?.();
          }}
          style={{ ...chip(true), height: 40, marginTop: 10 }}
        >
          Alza a {soldiTetto(su)} e riprova
        </button>
      )}
      <Tetto onCambia={onRiprova} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// LA CHIAVE SI CAMBIA ANCHE QUANDO FUNZIONA.
//
// Il campo per la chiave compariva SOLO quando l'Oracolo rispondeva
// «chiave» — cioe' quando non ce n'era una, o quando l'API l'aveva appena
// rifiutata. Finche' la vecchia funzionava non c'era nessun posto dove
// sostituirla: e le chiavi di Anthropic hanno una SCADENZA, quindi «devo
// cambiarla prima che smetta» e' il caso normale, non un guasto. L'unico
// modo era aspettare che si rompesse (segnalato: «come aggiorno la
// chiave?», con la sua a un giorno dalla scadenza).
//
// Sta sotto la riga della spesa, accanto al tetto, per la stessa ragione per
// cui ci sta il tetto: e' li' che si guarda quanto costa l'Oracolo, ed e' li'
// che viene in mente di metterci mano. Ripiegato, perche' e' una cosa che si
// fa due volte l'anno.
export function CampoChiave({ onSalva, autoFocus }) {
  const [bozza, setBozza] = useState("");
  const salva = () => {
    const k = bozza.trim();
    if (!k) return;
    setOracleKey(k);
    setBozza("");
    onSalva?.();
  };
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <input
        type="password"
        value={bozza}
        autoFocus={autoFocus}
        onChange={(e) => setBozza(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && salva()}
        placeholder="sk-ant-…"
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: `1px solid ${C.border}`,
          borderRadius: R.piccolo,
          padding: "7px 10px",
          fontSize: F.nota,
          color: C.text,
        }}
      />
      <button
        onClick={salva}
        style={{
          flexShrink: 0,
          fontSize: F.piccolo,
          color: C.arcane,
          border: `1px solid ${C.arcane}55`,
          borderRadius: R.tondo,
          padding: "5px 12px",
        }}
      >
        Salva
      </button>
    </div>
  );
}

export function CambiaChiave() {
  const [aperto, setAperto] = useState(false);
  const [fatto, setFatto] = useState(false);
  if (!hasOracle()) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => { setAperto((v) => !v); setFatto(false); }}
        style={{
          fontSize: F.minuscolo,
          color: C.muted,
          border: `1px solid ${C.border}`,
          borderRadius: R.tondo,
          padding: "4px 10px",
        }}
      >
        🔑 Cambia la chiave {aperto ? "⌃" : "⌄"}
      </button>
      {aperto && (
        <>
          <p style={{ margin: "8px 0 0", fontSize: F.minuscolo, color: C.dim, lineHeight: 1.5 }}>
            Le chiavi di Anthropic scadono. Creane una nuova su console.anthropic.com (Chiavi API →
            Crea chiave) e incollala qui: quella vecchia viene sostituita e resta solo su questo
            dispositivo.
          </p>
          <CampoChiave autoFocus onSalva={() => { setFatto(true); setAperto(false); }} />
        </>
      )}
      {fatto && (
        <p style={{ margin: "6px 0 0", fontSize: F.minuscolo, color: C.green }}>
          Chiave sostituita 🔑
        </p>
      )}
    </div>
  );
}

import { useState } from "react";
import { C, F, R } from "../data/constants.js";
import { SCALINI, leggiTetto, scriviTetto, scalinoSopra, soldi, soldiTetto } from "../lib/spesa.js";

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

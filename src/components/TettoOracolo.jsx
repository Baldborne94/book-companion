import { useState } from "react";
import { C, F, R } from "../data/constants.js";
import { SCALINI, leggiTetto, scriviTetto, scalinoSopra, soldi, soldiTetto, rigaMese } from "../lib/spesa.js";
import { setOracleKey, hasOracle, leggiScadenza, scriviScadenza, statoChiave, frasScadenza } from "../lib/oracle.js";

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
  // LA DATA E' FACOLTATIVA, e lo resta. Pretenderla prima di lasciar
  // incollare una chiave sarebbe peggio del problema che risolve: chi non
  // la sa, o ha fretta, deve poter salvare e basta.
  const [quando, setQuando] = useState(() => leggiScadenza());
  const salva = () => {
    const k = bozza.trim();
    if (!k) return;
    setOracleKey(k);
    scriviScadenza(quando);
    setBozza("");
    onSalva?.();
  };
  return (
    <>
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
    <label style={{ display: "block", marginTop: 8, fontSize: F.minuscolo, color: C.dim }}>
      Scade il (facoltativo — la data sta scritta accanto alla chiave nella console)
      <input
        type="date"
        value={quando}
        onChange={(e) => setQuando(e.target.value)}
        style={{
          display: "block",
          marginTop: 4,
          background: "transparent",
          border: `1px solid ${C.border}`,
          borderRadius: R.piccolo,
          padding: "6px 10px",
          fontSize: F.nota,
          color: C.text,
        }}
      />
    </label>
    </>
  );
}

// Il promemoria, dove la chiave si guarda. Detto sempre quando la data c'e':
// una riga che compare solo all'ultimo momento e' una riga di cui non ci si
// puo' fidare.
export function ScadenzaChiave() {
  const st = statoChiave({});
  const frase = frasScadenza(st);
  if (!frase) return null;
  const colore = st.stato === "scaduta" ? C.red : st.stato === "inScadenza" ? C.accent : C.dim;
  return (
    <p style={{ margin: "6px 0 0", fontSize: F.minuscolo, color: colore, lineHeight: 1.5 }}>
      {st.stato === "valida" ? "🔑 " : "⚠️ "}
      {frase}
      {st.stato !== "valida" ? " Creane una nuova nella console e incollala qui sotto." : ""}
    </p>
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
      <ScadenzaChiave />
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

// ---------------------------------------------------------------------------
// L'ORACOLO NELLE IMPOSTAZIONI.
//
// La chiave, la sua scadenza, il tetto del mese e quanto hai speso: erano
// quattro cose sparse dentro le schede dell'Oracolo, cioe' raggiungibili
// solo mentre l'Oracolo lo stavi usando. Ma la chiave si cambia PRIMA che
// smetta di funzionare, e chi la deve cambiare sta leggendo, non
// interrogando (chiesto dal lettore: «si' fai la schermata delle
// impostazioni»).
//
// Qui la chiave si vede sempre, anche quando non c'e' niente che non va: e'
// il posto dove uno va a cercarla, e trovarla spenta e' un'informazione
// quanto trovarla accesa.
export function SezioneOracolo() {
  const [giro, setGiro] = useState(0);
  const ce = hasOracle();
  return (
    <div key={giro}>
      {/* PRIMA LO STATO, POI LA SPIEGAZIONE. La riga c'era gia' e diceva la
          cosa giusta, ma era un paragrafo di prosa: chi arriva qui ha in
          testa UNA domanda — «la chiave ce l'ho o no?» — e la risposta
          stava annegata in mezzo a una frase sulla riservatezza (chiesto
          dal lettore: «dove vedo se mi ha salvato la password?»). Adesso e'
          una riga sola, in colore, che si legge senza leggere. */}
      <p
        style={{
          margin: 0,
          fontSize: F.corpo,
          fontWeight: 600,
          color: ce ? C.green : C.muted,
          lineHeight: 1.4,
        }}
      >
        {ce ? "🔑 Chiave salvata" : "🔒 Nessuna chiave salvata"}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: F.piccolo, color: C.muted, lineHeight: 1.5 }}>
        {ce
          ? "Sta su questo dispositivo e non esce mai da qui: le domande partono dal browser dritte all'API di Anthropic, e paghi solo quel che chiedi. Per sostituirla, incolla la nuova qui sotto."
          : "Senza una chiave API di Anthropic l'Oracolo resta spento: «Chi è costui?», «Dove eravamo rimasti» e «Prima di cominciare» non compaiono. La chiave resta solo su questo dispositivo."}
      </p>
      {ce && <ScadenzaChiave />}
      {ce && rigaMese() && (
        <p style={{ margin: "6px 0 0", fontSize: F.minuscolo, color: C.dim, lineHeight: 1.5 }}>
          Hai speso {rigaMese()}.
        </p>
      )}
      {/* IL CAMPO STA SEMPRE APERTO QUI DENTRO, non ripiegato dietro un
          tasto: questa e' la stanza della chiave, e in una stanza dedicata
          nascondere l'unica cosa che ci si viene a fare sarebbe assurdo. Il
          comando ripiegato resta nelle schede dell'Oracolo, dove invece e'
          un di piu' accanto alla risposta. */}
      <CampoChiave onSalva={() => setGiro((n) => n + 1)} />
      <Tetto onCambia={() => setGiro((n) => n + 1)} />
    </div>
  );
}

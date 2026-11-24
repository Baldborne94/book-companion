import { C, F, R } from "../data/constants.js";
import { etichettaVista, vistaDiSempre } from "../lib/library.js";

// COME E' DISPOSTO LO SCAFFALE, sotto un tasto solo.
//
// Prima erano due tendine affiancate nell'intestazione della Libreria, e
// il lettore le ha guardate e ha chiesto: «serve avere sia raggruppa che
// ordina? mi sembra un po' confusionario averli entrambi». Le due scelte
// servono davvero — sono ORTOGONALI, una dice quali ripiani e l'altra in
// che ordine, e fonderle darebbe sei raggruppamenti per tre ordinamenti,
// cioe' diciotto voci di menu — ma non devono stare tutt'e due sempre in
// vista: e' la coppia a confondere, non le scelte.
//
// NON E' UN PANNELLO IN `position: fixed`, ed e' una scelta: qui si apre
// sotto il tasto, dentro il flusso, come il selettore dei generi. Un
// pannello a tutto schermo vorrebbe il suo livello nella guardia del tasto
// indietro (`lib/indietro.js`) per una scelta da due tocchi che non copre
// niente di importante.
//
// I CHIP SONO DA 44px come in `GenrePicker`, e il TASTO no: la ragione
// della regola sono i bersagli ATTACCATI — un dito che manca un chip
// prende quello accanto e cambia raggruppamento senza dire niente. Il
// tasto invece sta da solo in fondo alla riga dei filtri (un `flex: 1` lo
// separa), quindi un tocco mancato non fa niente invece di fare la cosa
// sbagliata, e la sua altezza e' quella della riga in cui vive — la
// stessa delle due tendine che sostituisce.
const chip = (attivo) => ({
  padding: "12px 16px",
  borderRadius: R.tondo,
  fontSize: F.nota,
  lineHeight: 1.25,
  cursor: "pointer",
  border: `1px solid ${attivo ? C.accent : C.border}`,
  background: attivo ? `${C.accent}22` : "transparent",
  color: attivo ? C.accent : C.text,
});

function Riga({ titolo, sotto, voci, scelto, onScegli }) {
  return (
    <div>
      <div style={{ fontSize: F.piccolo, color: C.muted, marginBottom: 8 }}>
        <strong style={{ color: C.text, fontWeight: 600 }}>{titolo}</strong>
        {sotto ? ` · ${sotto}` : ""}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {voci.map((v) => (
          <button key={v.id} onClick={() => onScegli(v.id)} style={chip(scelto === v.id)}>
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Disposizione({ vista, gruppi, ordini, onCambia, aperto, onApri }) {
  // acceso quando NON e' la disposizione di sempre, cosi' si vede senza
  // aprire niente che lo scaffale in questo momento e' messo in un altro
  // modo — era la regola della tendina di prima, e resta
  const sempre = vistaDiSempre(vista, gruppi, ordini);

  return (
    <>
      <button
        onClick={() => onApri(!aperto)}
        aria-expanded={aperto}
        style={{
          padding: "6px 12px",
          borderRadius: R.piccolo,
          border: `1px solid ${sempre && !aperto ? C.border : C.accent}`,
          background: aperto ? `${C.accent}14` : C.surface,
          color: sempre && !aperto ? C.muted : C.accent,
          fontSize: F.nota,
          fontFamily: "inherit",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {/* il tasto DICE la scelta in corso: sostituire due tendine, che
            almeno si leggevano chiuse, con una parola sola sarebbe un
            passo indietro */}
        <span aria-hidden="true">⇅</span>
        {etichettaVista(vista, gruppi, ordini)}
        <span aria-hidden="true" style={{ fontSize: F.minuscolo, opacity: 0.7 }}>
          {aperto ? "▴" : "▾"}
        </span>
      </button>

      {aperto && (
        <div
          style={{
            // la riga dei filtri manda a capo (`flexWrap`): questo prende
            // tutta la larghezza e scende sotto, invece di incastrarsi
            // accanto al tasto
            flexBasis: "100%",
            marginTop: 10,
            padding: 14,
            borderRadius: R.medio,
            border: `1px solid ${C.border}`,
            background: C.surface,
            display: "grid",
            gap: 16,
          }}
        >
          <Riga
            titolo="Raggruppa"
            sotto="quali ripiani"
            voci={gruppi}
            scelto={vista.group}
            onScegli={(group) => onCambia({ group })}
          />
          <Riga
            titolo="Ordina"
            sotto="l'ordine dei ripiani e dei libri dentro"
            voci={ordini}
            scelto={vista.sort}
            onScegli={(sort) => onCambia({ sort })}
          />
        </div>
      )}
    </>
  );
}

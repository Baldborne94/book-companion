import { useState } from "react";
import { C } from "../data/constants.js";
import { setOracleKey } from "../lib/oracle.js";
import { raccontaFrontiera } from "../lib/frontiera.js";
import { movimenti, conTitoli, TITOLETTI } from "../lib/chiSono.js";

// Il corpo delle schede dell'Oracolo — «Chi è costui?» e «Dove eravamo
// rimasti» — condiviso fra i due reader. Cambia la domanda, non la scheda:
// stessa attesa, stessa prosa, stessa riga che dichiara da dove viene la
// risposta, stessi passaggi ripiegati dietro un bottone.
//
// La chiave sta QUI, dove l'Oracolo si usa. Prima la scheda diceva «la trovi
// nella scheda del dizionario» e ti lasciava a cercarla: una porta in faccia
// la prima volta che tocchi la funzione.

function Chiave({ onSalva }) {
  const [bozza, setBozza] = useState("");
  return (
    <div>
      <p style={{ fontSize: 13, color: C.muted, margin: "0 0 8px", lineHeight: 1.45 }}>
        Serve una chiave API di Anthropic (console.anthropic.com). Resta solo su questo dispositivo
        e paghi solo quel che chiedi.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="password"
          value={bozza}
          onChange={(e) => setBozza(e.target.value)}
          placeholder="sk-ant-…"
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "7px 10px",
            fontSize: 14,
            color: C.text,
          }}
        />
        <button
          onClick={() => {
            const k = bozza.trim();
            if (!k) return;
            setOracleKey(k);
            setBozza("");
            onSalva();
          }}
          style={{
            flexShrink: 0,
            fontSize: 13.5,
            color: C.arcane,
            border: `1px solid ${C.arcane}55`,
            borderRadius: 999,
            padding: "5px 12px",
          }}
        >
          Salva e chiedi
        </button>
      </div>
    </div>
  );
}

const riga = { color: C.muted, fontSize: 14.5, lineHeight: 1.55, margin: 0 };

// I tomi che non sono su questo dispositivo NON sono stati letti: la
// frontiera li elenca perche' il lettore li ha finiti, ma i byte stanno
// nel cloud e nessuno li ha aperti. Senza questa riga la scheda diceva
// «basata su tutta la saga» mentre rispondeva da un libro solo — ed e'
// esattamente il genere di silenzio che questa app non si permette.
function Lontani({ libri }) {
  if (!libri?.length) return null;
  const nomi = libri.map((l) => `«${l.title}»`).join(", ");
  return (
    <p style={{ margin: "8px 0 0", fontSize: 12.5, color: C.arcane, lineHeight: 1.5 }}>
      {libri.length === 1
        ? `Però ${nomi} non è su questo dispositivo: non ho potuto sfogliarlo, e quel che c'è dentro manca da questa risposta.`
        : `Però questi non sono su questo dispositivo: ${nomi}. Non ho potuto sfogliarli, e quel che c'è dentro manca da questa risposta.`}
    </p>
  );
}

// Le attese dicono cosa sta facendo, non «attendere»: raccogliere i passaggi
// di un protagonista su tre volumi prende decine di secondi, e una rotellina
// muta in quel tempo si legge come un blocco.
export const attese = (s) => ({
  nomi: "Cerco con quali nomi il libro la chiama…",
  cerco: s.nome
    ? `Cerco ${[s.nome, ...(s.alias || [])].join(", ")} in quello che hai letto…`
    : "Rileggo quello che hai letto finora…",
  chiedo: `✨ L'Oracolo sta leggendo ${s.passaggi?.length || 0} passaggi…`,
});

export default function SchedaOracolo({ scheda, attese, vuoto, onRiprova }) {
  const [fonti, setFonti] = useState(false);
  if (!scheda) return null;
  const { fase, passaggi = [], tappe = [] } = scheda;

  if (fase !== "fatto" && fase !== "errore" && fase !== "vuoto") {
    return <p style={riga}>{attese[fase]}</p>;
  }
  if (fase === "vuoto") {
    return (
      <>
        <p style={riga}>{vuoto}</p>
        {/* «non l'ho trovato» detto senza dire che tre volumi sono rimasti
            chiusi e' una mezza verita' */}
        <Lontani libri={scheda.lontani} />
      </>
    );
  }
  if (fase === "errore") {
    return scheda.error === "chiave" ? (
      <Chiave onSalva={onRiprova} />
    ) : (
      <div>
        <p style={riga}>
          {scheda.error === "rete"
            ? "L'Oracolo ha bisogno della rete: riprova quando sei online."
            : "L'Oracolo non ha risposto. Riprova fra un momento."}
        </p>
        <button
          onClick={onRiprova}
          style={{
            marginTop: 10,
            fontSize: 13.5,
            color: C.arcane,
            border: `1px solid ${C.arcane}55`,
            borderRadius: 999,
            padding: "5px 12px",
          }}
        >
          Riprova
        </button>
      </div>
    );
  }

  // i numeri dei volumi tornano titoli solo qui, sullo schermo: al modello
  // i titoli non arrivano mai
  const testo = conTitoli(scheda.answer, tappe);
  // i tre movimenti («Chi è» soltanto: il riassunto resta prosa nuda); se
  // il modello non ha diviso in tre, niente titoletti — meglio senza che
  // con un titolo sul pezzo sbagliato
  const parti = scheda.nome ? movimenti(testo) : null;
  const prosa = { color: C.text, fontSize: 15.5, lineHeight: 1.6, margin: 0, whiteSpace: "pre-line" };
  return (
    <>
      {parti ? (
        parti.map((p, i) => (
          <div key={i} style={{ marginTop: i ? 14 : 0 }}>
            <div style={{ fontSize: 11.5, color: C.arcane, marginBottom: 4 }}>{TITOLETTI[i]}</div>
            <p style={prosa}>{p}</p>
          </div>
        ))
      ) : (
        /* pre-line: la prosa ha nella riga vuota la sua unica struttura;
           un divisorio avanzato dal modello si riduce a quella */
        <p style={prosa}>{testo.replace(/\n\s*-{3,}\s*\n/g, "\n\n")}</p>
      )}
      {/* una risposta troncata, mostrata com'e', sembra finita: il lettore
          crede che la storia si fermi li' */}
      {scheda.tagliata && (
        <p style={{ marginTop: 10, fontSize: 12.5, color: C.dim, lineHeight: 1.5 }}>
          L'Oracolo si è fermato qui: il racconto era troppo lungo per una scheda sola.
        </p>
      )}
      {/* Da dove viene la risposta: la garanzia resta, ma ripiegata. Il
          controllo dev'essere possibile, non un muro di citazioni sotto ogni
          scheda. */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <p style={{ margin: 0, fontSize: 12.5, color: C.dim, lineHeight: 1.5 }}>
          Basata solo su quello che hai letto: {raccontaFrontiera(tappe)}.
          {/* i nomi trovati si dichiarano: se ne ha preso uno sbagliato te ne
              accorgi da qui, senza dover leggere i passaggi */}
          {scheda.alias?.length ? ` Cercata anche come ${scheda.alias.join(", ")}.` : ""}
        </p>
        <Lontani libri={scheda.lontani} />
        <button
          onClick={() => setFonti((v) => !v)}
          style={{
            marginTop: 8,
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 13,
            border: `1px solid ${C.border}`,
            color: C.muted,
          }}
        >
          {fonti ? "Nascondi i passaggi" : `Vedi i ${passaggi.length} passaggi usati`}
        </button>
        {fonti &&
          passaggi.map((p, i) => {
            const dove = [tappe.length > 1 ? p.libro?.title : null, p.dove].filter(Boolean).join(" · ");
            return (
              <div
                key={i}
                style={{
                  padding: "8px 10px",
                  marginTop: i === 0 ? 10 : 6,
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  fontSize: 13,
                  color: C.muted,
                  lineHeight: 1.5,
                }}
              >
                {dove && <span style={{ color: C.accent, marginRight: 6 }}>{dove}</span>}
                {p.testo}
              </div>
            );
          })}
      </div>
    </>
  );
}

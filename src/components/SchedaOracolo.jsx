import { useState } from "react";
import { C, F, R } from "../data/constants.js";
import { hasOracle } from "../lib/oracle.js";
import { raccontaFrontiera } from "../lib/frontiera.js";
import { movimenti, conTitoli, TITOLETTI } from "../lib/chiSono.js";
import { rigaUltima, riassunto, costo, rigaMese, leggiTetto, TARIFFE, MODELLO } from "../lib/spesa.js";
import { Tetto, TettoFinito, CampoChiave, CambiaChiave } from "./TettoOracolo.jsx";

// Il corpo delle schede dell'Oracolo — «Chi è costui?» e «Dove eravamo
// rimasti» — condiviso fra i due reader. Cambia la domanda, non la scheda:
// stessa attesa, stessa prosa, stessa riga che dichiara da dove viene la
// risposta, stessi passaggi ripiegati dietro un bottone.
//
// La chiave sta QUI, dove l'Oracolo si usa. Prima la scheda diceva «la trovi
// nella scheda del dizionario» e ti lasciava a cercarla: una porta in faccia
// la prima volta che tocchi la funzione.

// LA RIGA DEL COSTO. Quella della singola risposta piu' il mese in corso:
// il totale da solo non dice mai quale funzione spende, e la singola da
// sola non dice dove stai andando a finire. La tariffa e' scritta accanto
// perche' un numero in valuta che non si puo' verificare vale poco — e
// perche' quando Anthropic la cambia, quella riga dice ancora la verita'
// su come e' stato fatto il conto.
//
// E DICE QUANTO RESTA, non solo quanto e' andato. «$1,20» da solo non e' ne'
// poco ne' tanto: lo diventa accanto al tetto che ti sei dato. Il comando per
// cambiarlo sta qui sotto e non in un pannello di impostazioni, perche' e'
// qui che il numero si guarda ed e' qui che viene voglia di muoverlo.
function Costo({ uso }) {
  // il tetto si cambia due righe piu' sotto, e la riga del mese lo NOMINA:
  // senza questo giro cambierebbe l'etichetta del comando e non la frase che
  // dice quanto resta, cioe' proprio il numero che si era andati a muovere
  const [, setGiro] = useState(0);
  if (!uso) return null;
  const riga = rigaUltima(uso);
  const mese = rigaMese();
  return (
    <>
      <p style={{ margin: "6px 0 0", fontSize: F.minuscolo, color: C.dim, lineHeight: 1.5 }}>
        Questa risposta: {riga}
        {mese ? ` · ${mese}` : ""}
        <span style={{ opacity: 0.75 }}>
          {" "}
          ({MODELLO}: ${TARIFFE.dentro} e ${TARIFFE.fuori} per milione di token)
        </span>
      </p>
      <Tetto onCambia={() => setGiro((v) => v + 1)} />
      <CambiaChiave />
    </>
  );
}

// «Non c'e' una chiave» e «la chiave che hai non vale piu'» arrivano
// tutt'e due come `error: "chiave"`, ma per chi legge sono due cose
// diverse: la prima e' una funzione mai accesa, la seconda e' una cosa che
// funzionava e si e' rotta — e in quel caso «serve una chiave» suona come
// se l'app se ne fosse dimenticata. Chi ce l'ha lo sappiamo (`hasOracle`),
// quindi glielo si dice.
function Chiave({ onSalva }) {
  const rifiutata = hasOracle();
  return (
    <div>
      <p style={{ fontSize: F.piccolo, color: C.muted, margin: "0 0 8px", lineHeight: 1.45 }}>
        {rifiutata
          ? "La chiave che hai salvato non è più valida: probabilmente è scaduta. Creane una nuova su console.anthropic.com (Chiavi API → Crea chiave) e incollala qui."
          : "Serve una chiave API di Anthropic (console.anthropic.com). Resta solo su questo dispositivo e paghi solo quel che chiedi."}
      </p>
      <CampoChiave onSalva={onSalva} />
    </div>
  );
}

// LETTA AL RENDER, NON AL CARICAMENTO DEL MODULO: un oggetto costante
// congela quello che legge, e questo file gira prima che il tema scelto
// venga applicato. Come funzione segue anche la levetta della dimensione.
const riga = () => ({ color: C.muted, fontSize: F.nota, lineHeight: 1.55, margin: 0 });

// I tomi che non sono su questo dispositivo NON sono stati letti: la
// frontiera li elenca perche' il lettore li ha finiti, ma i byte stanno
// nel cloud e nessuno li ha aperti. Senza questa riga la scheda diceva
// «basata su tutta la saga» mentre rispondeva da un libro solo — ed e'
// esattamente il genere di silenzio che questa app non si permette.
// I volumi SFOGLIATI in cui il nome non e' saltato fuori. Detto per
// nome, un volume che tace e' un'informazione; taciuto, e' il modo in cui
// un pezzo di storia sparisce senza che nessuno se ne accorga — che e'
// gia' successo, e il lettore l'ha dovuto scoprire leggendo la scheda.
function Muti({ tappe, passaggi, lontani }) {
  const conRoba = new Set(passaggi.map((p) => p.libro?.id));
  const assenti = new Set((lontani || []).map((l) => l.id));
  const muti = tappe
    .map((t) => t.libro)
    .filter((l) => l && !conRoba.has(l.id) && !assenti.has(l.id));
  if (!muti.length || !conRoba.size) return null;
  return (
    <p style={{ margin: "6px 0 0", fontSize: F.minuscolo, color: C.dim, lineHeight: 1.5 }}>
      Non l'ho trovato in {muti.map((l) => `«${l.title}»`).join(", ")}.
    </p>
  );
}

function Lontani({ libri }) {
  if (!libri?.length) return null;
  const nomi = libri.map((l) => `«${l.title}»`).join(", ");
  return (
    <p style={{ margin: "8px 0 0", fontSize: F.minuscolo, color: C.arcane, lineHeight: 1.5 }}>
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
    return <p style={riga()}>{attese[fase]}</p>;
  }
  if (fase === "vuoto") {
    return (
      <>
        <p style={riga()}>{vuoto}</p>
        {/* «non l'ho trovato» detto senza dire che tre volumi sono rimasti
            chiusi e' una mezza verita' */}
        <Lontani libri={scheda.lontani} />
      </>
    );
  }
  if (fase === "errore") {
    // IL TETTO FINITO NON E' UN GUASTO: e' la tua decisione che funziona, e
    // si racconta coi numeri veri invece che con «l'Oracolo non ha risposto»
    if (scheda.error === "tetto") {
      return (
        <TettoFinito
          speso={costo(riassunto().mese)}
          tetto={scheda.tettoMese ?? leggiTetto()}
          onRiprova={onRiprova}
        />
      );
    }
    return scheda.error === "chiave" ? (
      <Chiave onSalva={onRiprova} />
    ) : (
      <div>
        <p style={riga()}>
          {scheda.error === "rete"
            ? "L'Oracolo ha bisogno della rete: riprova quando sei online."
            : "L'Oracolo non ha risposto. Riprova fra un momento."}
        </p>
        <button
          onClick={onRiprova}
          style={{
            marginTop: 10,
            fontSize: F.piccolo,
            color: C.arcane,
            border: `1px solid ${C.arcane}55`,
            borderRadius: R.tondo,
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
  const prosa = { color: C.text, fontSize: F.corpo, lineHeight: 1.6, margin: 0, whiteSpace: "pre-line" };
  return (
    <>
      {parti ? (
        parti.map((p, i) => (
          <div key={i} style={{ marginTop: i ? 14 : 0 }}>
            <div style={{ fontSize: F.minuscolo, color: C.arcane, marginBottom: 4 }}>{TITOLETTI[i]}</div>
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
        <p style={{ marginTop: 10, fontSize: F.minuscolo, color: C.dim, lineHeight: 1.5 }}>
          L'Oracolo si è fermato qui: il racconto era troppo lungo per una scheda sola.
        </p>
      )}
      {/* Da dove viene la risposta: la garanzia resta, ma ripiegata. Il
          controllo dev'essere possibile, non un muro di citazioni sotto ogni
          scheda. */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <p style={{ margin: 0, fontSize: F.minuscolo, color: C.dim, lineHeight: 1.5 }}>
          Basata solo su quello che hai letto: {raccontaFrontiera(tappe)}.
          {/* i nomi trovati si dichiarano: se ne ha preso uno sbagliato te ne
              accorgi da qui, senza dover leggere i passaggi */}
          {scheda.alias?.length ? ` Cercata anche come ${scheda.alias.join(", ")}.` : ""}
        </p>
        <Lontani libri={scheda.lontani} />
        {/* solo per la scheda personaggio: nel riassunto «non l'ho
            trovato» non vuol dire niente, non si cerca un nome */}
        {scheda.nome && (
          <Muti tappe={tappe} passaggi={passaggi} lontani={scheda.lontani} />
        )}
        {/* QUANTO E' COSTATA QUESTA RISPOSTA. La chiave è tua e paghi tu:
            un centinaio di passaggi davanti al modello non costano come
            una parola cercata nel dizionario, e finché il numero non si
            vedeva non c'era modo di saperlo. Sta qui e non in cima perché
            è una nota a piè di pagina, non il titolo della scheda. */}
        <Costo uso={scheda.uso} />
        <button
          onClick={() => setFonti((v) => !v)}
          style={{
            marginTop: 8,
            padding: "6px 14px",
            borderRadius: R.tondo,
            fontSize: F.piccolo,
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
                  borderRadius: R.piccolo,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  fontSize: F.piccolo,
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

// IL DIZIONARIO SUL DISPOSITIVO, nella stanza delle impostazioni.
//
// Chiesto dal lettore: «ci sarebbe modo di avere dizionario anche offline?».
// Sta qui e non nella scheda del dizionario per la stessa ragione della
// chiave dell'Oracolo: si scarica PRIMA di averne bisogno — in treno, senza
// rete, la scheda del dizionario e' l'ultimo posto dove si puo' rimediare.
import { useEffect, useState } from "react";
import { C, F, R } from "../data/constants.js";
import {
  statoDizionario,
  scaricaDizionario,
  rimuoviDizionario,
  cartellinoInRete,
} from "../lib/dizionarioOffline.js";
import { statoWiktionary, giroWiktionary, rimuoviWiktionary, cartellinoWikt, fraseWiktionary } from "../lib/wiktionaryOffline.js";

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
const voci = (n) => n.toLocaleString("it-IT");

export default function SezioneDizionario({ wikt = null, onScaricaWikt, onFermaWikt }) {
  const [stato, setStato] = useState(undefined); // undefined = non ancora guardato
  const [cartellino, setCartellino] = useState(null);
  const [avanzamento, setAvanzamento] = useState(null);
  const [guaio, setGuaio] = useState("");
  const [confermaVia, setConfermaVia] = useState(false);

  useEffect(() => {
    let vivo = true;
    statoDizionario().then((s) => vivo && setStato(s));
    cartellinoInRete().then((c) => vivo && setCartellino(c));
    return () => {
      vivo = false;
    };
  }, []);

  async function scarica() {
    if (avanzamento) return;
    setGuaio("");
    setAvanzamento({ scaricati: 0, totale: cartellino?.byte || null });
    try {
      const m = await scaricaDizionario({ onProgress: setAvanzamento });
      setStato(m);
    } catch (e) {
      // un buco di rete a meta' scaricamento e' la cosa piu' probabile che
      // possa succedere qui, e va detta: un tasto che torna com'era senza
      // spiegare sembra un tasto rotto
      setGuaio(e?.message || "non sono riuscito a scaricarlo");
    } finally {
      setAvanzamento(null);
    }
  }

  async function via() {
    await rimuoviDizionario();
    setStato(null);
    setConfermaVia(false);
  }

  const tasto = {
    minHeight: 44,
    padding: "8px 14px",
    borderRadius: R.tondo,
    border: `1px solid ${C.border}`,
    color: C.text,
    fontSize: F.corpo,
  };
  const nota = { margin: "8px 0 0", fontSize: F.minuscolo, color: C.muted, lineHeight: 1.5 };

  return (
    <div>
      {/* PRIMA LO STATO, POI LA SPIEGAZIONE: la sola domanda che uno ha in
          testa arrivando qui è «ce l'ho o no?», ed è la stessa lezione
          della riga della chiave dell'Oracolo. */}
      <p
        style={{
          margin: 0,
          fontSize: F.corpo,
          fontWeight: 600,
          color: stato ? C.green : C.muted,
        }}
      >
        {stato === undefined
          ? "…"
          : stato
            ? `📖 Dizionario inglese→italiano sul dispositivo · ${voci(stato.voci)} voci`
            : "☁ Il dizionario funziona solo con la rete, e solo in inglese"}
      </p>

      {avanzamento && (
        <p style={{ ...nota, color: C.text }}>
          {avanzamento.totale
            ? `Scarico… ${mb(avanzamento.scaricati)} di ${mb(avanzamento.totale)}`
            : `Scarico… ${mb(avanzamento.scaricati)}`}
        </p>
      )}
      {guaio && <p style={{ ...nota, color: C.red }}>{guaio}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {!stato && (
          <button onClick={scarica} disabled={!!avanzamento} style={{ ...tasto, color: avanzamento ? C.muted : C.arcane, borderColor: `${C.arcane}55` }}>
            {avanzamento
              ? "Scarico…"
              : cartellino
                ? `📖 Scarica per l'uso offline · ${mb(cartellino.byte)}`
                : "📖 Scarica per l'uso offline"}
          </button>
        )}
        {stato && !confermaVia && (
          <button onClick={() => setConfermaVia(true)} style={{ ...tasto, color: C.muted }}>
            Rimuovi
          </button>
        )}
        {stato && confermaVia && (
          <>
            <button onClick={via} style={{ ...tasto, color: C.red }}>
              Rimuovi davvero
            </button>
            <button onClick={() => setConfermaVia(false)} style={{ ...tasto, color: C.muted }}>
              Lascia stare
            </button>
          </>
        )}
      </div>

      <p style={nota}>
        {cartellino ? `${voci(cartellino.voci)} voci` : "Un dizionario inglese completo"}, locuzioni
        e verbi frasali compresi
        {cartellino?.italiano ? `, ${voci(cartellino.italiano)} con la resa italiana` : ""}. Una volta
        sceso risponde <strong>subito e senza rete</strong>: la scheda del dizionario mostra la parola
        in italiano in cima, poi le definizioni in inglese, e la rete — quando c'è — arriva dopo ad
        arricchire.
      </p>
      <p style={nota}>
        La resa italiana è quella di un dizionario, senso per senso, non una traduzione a macchina: le
        definizioni restano <strong>in inglese</strong>, perché tradotte a macchina uscivano storte.
      </p>
      <p style={{ ...nota, opacity: 0.8 }}>
        Da <strong>WordNet 3.0</strong>, Princeton University (
        <a href="/dizionario/LICENZA-WordNet.txt" target="_blank" rel="noreferrer" style={{ color: C.arcane }}>
          licenza
        </a>
        ) e <strong>MultiWordNet 1.5</strong>, Fondazione Bruno Kessler, CC BY 3.0 (
        <a href="/dizionario/LICENZA-MultiWordNet.txt" target="_blank" rel="noreferrer" style={{ color: C.arcane }}>
          attribuzione
        </a>
        ).
      </p>

      <Wiktionary lavoro={wikt} onScarica={onScaricaWikt} onFerma={onFermaWikt} tasto={tasto} nota={nota} />
    </div>
  );
}

// IL DIZIONARIO SOLO INGLESE, PIU' RICCO (chiesto dal lettore: «non voglio
// solo il dizionario inglese italiano ma anche il dizionario solo inglese
// che mi da' il significato delle parole»). Sta qui sotto e non in un
// pannello a se': per chi legge e' sempre «il dizionario», e la scheda
// usa tutt'e due insieme — la resa italiana da WordNet, i significati da
// Wiktionary. Lo scaricamento e' un lavoro lungo e vive in App.
function Wiktionary({ lavoro, onScarica, onFerma, tasto, nota }) {
  const [stato, setStato] = useState(undefined);
  const [giro, setGiro] = useState(null);
  // undefined = non ancora chiesto, null = il sito non ce l'ha
  const [cartellino, setCartellino] = useState(undefined);
  const [confermaVia, setConfermaVia] = useState(false);
  const inCorso = !!lavoro;
  useEffect(() => {
    let vivo = true;
    statoWiktionary().then((s) => vivo && setStato(s));
    giroWiktionary().then((g) => vivo && setGiro(g));
    cartellinoWikt().then((c) => vivo && setCartellino(c));
    return () => {
      vivo = false;
    };
  }, [inCorso]);

  async function via() {
    await rimuoviWiktionary().catch(() => {});
    setStato(null);
    setGiro(null);
    setConfermaVia(false);
  }

  const aMeta = !stato && giro;
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}66` }}>
      <p style={{ margin: 0, fontSize: F.corpo, fontWeight: 600, color: lavoro ? C.text : stato ? C.green : C.muted }}>
        {lavoro
          ? "📚 Wiktionary inglese sta scendendo"
          : stato === undefined
            ? "…"
            : stato
              ? `📚 Wiktionary inglese sul dispositivo · ${voci(stato.voci)} voci`
              : aMeta
                ? "📚 Wiktionary inglese sceso a metà"
                : "Il dizionario solo inglese, più ricco"}
      </p>
      {lavoro && <p style={{ ...nota, color: C.text }}>Scarico… {fraseWiktionary(lavoro)}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {lavoro ? (
          <button onClick={onFerma} style={tasto}>
            Ferma
          </button>
        ) : (
          <>
            {!stato && (cartellino || aMeta) && (
              <button onClick={() => onScarica()} style={{ ...tasto, color: C.arcane, borderColor: `${C.arcane}55` }}>
                {aMeta ? "📚 Riprendi lo scaricamento" : `📚 Scarica Wiktionary${cartellino ? ` · ${mb(cartellino.byte)}` : ""}`}
              </button>
            )}
            {(stato || aMeta) && !confermaVia && (
              <button onClick={() => setConfermaVia(true)} style={{ ...tasto, color: C.muted }}>
                Rimuovi
              </button>
            )}
            {confermaVia && (
              <>
                <button onClick={via} style={{ ...tasto, color: C.red }}>
                  Rimuovi davvero
                </button>
                <button onClick={() => setConfermaVia(false)} style={{ ...tasto, color: C.muted }}>
                  Lascia stare
                </button>
              </>
            )}
          </>
        )}
      </div>
      <p style={nota}>
        {cartellino ? `${voci(cartellino.voci)} voci` : "Le voci"} di Wiktionary inglese, solo in inglese: più
        significati di WordNet, con un <strong>esempio d'uso</strong> sotto i primi, le parole rare e arcaiche, le
        locuzioni e i modi di dire, e le etichette che dicono se una parola è antiquata, letteraria o gergale.
        Una volta sceso prende il posto di Wiktionary in rete: la scheda risponde <strong>subito e senza
        rete</strong>, con la resa italiana di sopra quando c'è anche l'altro dizionario.
      </p>
      {cartellino === null && !stato && !aMeta && (
        <p style={nota}>Il dizionario non si trova sul sito: si riprova riaprendo le Impostazioni.</p>
      )}
      <p style={{ ...nota, opacity: 0.8 }}>
        Da <strong>Wiktionary</strong> inglese, dei suoi autori, CC BY-SA 4.0, estratto da wiktextract (kaikki.org) (
        <a href="/dizionario/wikt/LICENZA-Wiktionary.txt" target="_blank" rel="noreferrer" style={{ color: C.arcane }}>
          attribuzione
        </a>
        ).
      </p>
    </div>
  );
}

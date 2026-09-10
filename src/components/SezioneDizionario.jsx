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

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
const voci = (n) => n.toLocaleString("it-IT");

export default function SezioneDizionario() {
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
    </div>
  );
}

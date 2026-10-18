// LEXICANUM SUL DISPOSITIVO, nella stanza delle impostazioni.
//
// Chiesto dal lettore: «vorrei poter avere in locale Lexicanum per tutti i
// miei libri del 40K». Come il dizionario si scarica PRIMA di averne
// bisogno; a differenza del dizionario e' un lavoro lungo — migliaia di
// pagine chieste piano a un wiki di volontari — quindi vive in App
// (`scaricaLex`), si vede da ogni sezione e si ferma e si riprende.
import { useEffect, useState } from "react";
import { C, F, R } from "../data/constants.js";
import { statoLexicanum, giroLexicanum, rimuoviLexicanum, fraseLexicanum, SITO } from "../lib/lexicanum.js";

const voci = (n) => Number(n || 0).toLocaleString("it-IT");
const giorno = (ts) => new Date(ts).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

export default function SezioneLexicanum({ lavoro, onScarica, onFerma }) {
  const [stato, setStato] = useState(undefined);
  const [giro, setGiro] = useState(null);
  const [confermaVia, setConfermaVia] = useState(false);

  // si rilegge quando il lavoro parte e quando finisce: e' App che scarica,
  // e questa stanza puo' essere aperta in mezzo
  const inCorso = !!lavoro;
  useEffect(() => {
    let vivo = true;
    statoLexicanum().then((s) => vivo && setStato(s));
    giroLexicanum().then((g) => vivo && setGiro(g));
    return () => {
      vivo = false;
    };
  }, [inCorso]);

  async function via() {
    await rimuoviLexicanum().catch(() => {});
    setStato(null);
    setGiro(null);
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
  const aMeta = !stato && giro;

  return (
    <div>
      <p style={{ margin: 0, fontSize: F.corpo, fontWeight: 600, color: lavoro ? C.text : stato ? C.green : C.muted }}>
        {lavoro
          ? "⚔ Lexicanum sta scendendo"
          : stato === undefined
          ? "…"
          : stato
            ? `⚔ Lexicanum sul dispositivo · ${voci(stato.voci)} voci, del ${giorno(stato.quando)}`
            : aMeta
              ? `⚔ Lexicanum sceso a metà · ${voci(giro.voci)} voci`
              : "Lexicanum non è sul dispositivo"}
      </p>

      {lavoro && <p style={{ ...nota, color: C.text }}>Scarico… {fraseLexicanum(lavoro)}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {lavoro ? (
          <button onClick={onFerma} style={tasto}>
            Ferma
          </button>
        ) : (
          <>
            {!stato && (
              <button onClick={() => onScarica()} style={{ ...tasto, color: C.arcane, borderColor: `${C.arcane}55` }}>
                {aMeta ? "⚔ Riprendi lo scaricamento" : "⚔ Scarica Lexicanum"}
              </button>
            )}
            {stato && !confermaVia && (
              <button onClick={() => onScarica({ aggiorna: true })} style={tasto}>
                ↻ Aggiorna
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
        Le voci del wiki del 40K, sul dispositivo: nei libri del 40K la scheda del dizionario mostra la voce
        di un nome, di una legione o di un pianeta <strong>subito e senza rete</strong>, e i link portano alle
        altre voci.
      </p>
      <p style={nota}>
        I paragrafi che Lexicanum cita da un volume della saga che non hai ancora letto restano{" "}
        <strong>velati</strong> finché non li tocchi: si guarda la fonte di ogni paragrafo, con la stessa regola
        dell'Oracolo.
      </p>
      <p style={nota}>
        Lo scaricamento chiede le voci a Lexicanum cinquanta alla volta, con calma: è un wiki di volontari.
        Ci vuole tempo e qualche centinaio di MB di rete; si può fermare e riprendere, anche ad app chiusa.
      </p>
      <p style={{ ...nota, opacity: 0.8 }}>
        Testi da{" "}
        <a href={SITO} target="_blank" rel="noreferrer" style={{ color: C.arcane }}>
          Lexicanum
        </a>{" "}
        e dei suoi autori, licenza Creative Commons Attribuzione–Non commerciale: per uso personale.
        Warhammer 40,000 è un marchio di Games Workshop.
      </p>
    </div>
  );
}

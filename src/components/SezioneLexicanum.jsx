// I WIKI DEL 40K SUL DISPOSITIVO, nella stanza delle impostazioni.
//
// Chiesto dal lettore: «vorrei poter avere in locale Lexicanum per tutti i
// miei libri del 40K», e poi «aggiungi fandom come seconda scheda con
// l'avviso». Come il dizionario si scaricano PRIMA di averne bisogno; a
// differenza del dizionario sono lavori lunghi — migliaia di pagine chieste
// piano a wiki di volontari — quindi vivono in App (`scaricaWikiQui`), si
// vedono da ogni sezione e si fermano e si riprendono. Un blocco per wiki,
// con lo stesso motore e le sue parole.
import { useEffect, useState } from "react";
import { C, F, R } from "../data/constants.js";
import { statoLexicanum, giroLexicanum, rimuoviLexicanum, fraseLexicanum, vociDiPrima, LEXICANUM, FANDOM } from "../lib/lexicanum.js";

const voci = (n) => Number(n || 0).toLocaleString("it-IT");
const giorno = (ts) => new Date(ts).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

const tasto = () => ({
  minHeight: 44,
  padding: "8px 14px",
  borderRadius: R.tondo,
  border: `1px solid ${C.border}`,
  color: C.text,
  fontSize: F.corpo,
});
const nota = () => ({ margin: "8px 0 0", fontSize: F.minuscolo, color: C.muted, lineHeight: 1.5 });

function BloccoWiki({ wiki, icona, lavoro, onScarica, onFerma, children }) {
  const [stato, setStato] = useState(undefined);
  const [giro, setGiro] = useState(null);
  const [confermaVia, setConfermaVia] = useState(false);
  // RISCARICARE E' UN GIRO INTERO, decine di migliaia di voci: «Aggiorna»
  // accanto a «Rimuovi» si tocca anche per errore, o credendo che serva a
  // far funzionare il wiki, e allora chiede conferma e dice cosa costa
  const [confermaGiro, setConfermaGiro] = useState(false);

  // si rilegge quando il lavoro parte e quando finisce: e' App che scarica,
  // e questa stanza puo' essere aperta in mezzo
  const inCorso = !!lavoro;
  useEffect(() => {
    let vivo = true;
    statoLexicanum(undefined, wiki).then((s) => vivo && setStato(s));
    giroLexicanum(undefined, wiki).then((g) => vivo && setGiro(g));
    return () => {
      vivo = false;
    };
  }, [inCorso, wiki]);

  async function via() {
    await rimuoviLexicanum(undefined, wiki).catch(() => {});
    setStato(null);
    setGiro(null);
    setConfermaVia(false);
  }

  const t = tasto();
  const n = nota();
  const aMeta = !stato && giro;

  return (
    <div>
      <p style={{ margin: 0, fontSize: F.corpo, fontWeight: 600, color: lavoro ? C.text : stato ? C.green : C.muted }}>
        {lavoro
          ? `${icona} ${wiki.nome} sta scendendo`
          : stato === undefined
            ? "…"
            : stato
              ? `${icona} ${wiki.nome} sul dispositivo · ${voci(stato.voci)} voci, del ${giorno(stato.quando)}`
              : aMeta
                ? `${icona} ${wiki.nome} sceso a metà · ${voci(giro.voci)} voci`
                : `${wiki.nome} non è sul dispositivo`}
      </p>

      {lavoro && <p style={{ ...n, color: C.text }}>Scarico… {fraseLexicanum(lavoro)}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {lavoro ? (
          <button onClick={onFerma} style={t}>
            Ferma
          </button>
        ) : (
          <>
            {!stato && (
              <button onClick={() => onScarica()} style={{ ...t, color: C.arcane, borderColor: `${C.arcane}55` }}>
                {aMeta ? `${icona} Riprendi lo scaricamento` : `${icona} Scarica ${wiki.nome}`}
              </button>
            )}
            {stato && !confermaVia && !confermaGiro && (
              <button onClick={() => setConfermaGiro(true)} style={t}>
                ↻ Aggiorna
              </button>
            )}
            {confermaGiro && (
              <>
                <button
                  onClick={() => {
                    setConfermaGiro(false);
                    onScarica({ aggiorna: true });
                  }}
                  style={{ ...t, color: C.arcane, borderColor: `${C.arcane}55` }}
                >
                  Riscarica tutte le voci
                </button>
                <button onClick={() => setConfermaGiro(false)} style={{ ...t, color: C.muted }}>
                  Lascia stare
                </button>
              </>
            )}
            {(stato || aMeta) && !confermaVia && !confermaGiro && (
              <button onClick={() => setConfermaVia(true)} style={{ ...t, color: C.muted }}>
                Rimuovi
              </button>
            )}
            {confermaVia && (
              <>
                <button onClick={via} style={{ ...t, color: C.red }}>
                  Rimuovi davvero
                </button>
                <button onClick={() => setConfermaVia(false)} style={{ ...t, color: C.muted }}>
                  Lascia stare
                </button>
              </>
            )}
          </>
        )}
      </div>

      {vociDiPrima(stato) && !lavoro && !confermaGiro && !confermaVia && (
        <p style={{ ...n, color: C.text }}>
          Queste voci sono scese prima che l'app sapesse leggere il riquadro dei dati, le citazioni e le tabelle:
          per averli tocca «↻ Aggiorna». Rifà il giro intero, e intanto le voci di adesso continuano a rispondere.
        </p>
      )}

      {confermaGiro && (
        <p style={{ ...n, color: C.text }}>
          {vociDiPrima(stato)
            ? `Riscarica le voci col riquadro dei dati, le citazioni e le tabelle, e prende anche quelle nuove del wiki.`
            : `Non serve per usarlo: ${wiki.nome} è già qui e resta. Riscaricare serve solo a prendere le voci nuove del wiki.`}{" "}
          Rifà tutto il giro di prima; intanto le voci di adesso continuano a rispondere.
        </p>
      )}

      {children}
    </div>
  );
}

export default function SezioneLexicanum({ lavoro, onScarica, onFerma, lavoroFan, onScaricaFan, onFermaFan }) {
  const n = nota();
  return (
    <div>
      <BloccoWiki wiki={LEXICANUM} icona="⚔" lavoro={lavoro} onScarica={onScarica} onFerma={onFerma}>
        <p style={n}>
          Le voci del wiki del 40K, sul dispositivo: nei libri del 40K i nomi si segnano nel testo e la scheda del
          dizionario mostra la voce di un nome, di una legione o di un pianeta <strong>subito e senza rete</strong>, e i
          link portano alle altre voci.
        </p>
        <p style={n}>
          I paragrafi che Lexicanum cita da un volume della saga che non hai ancora letto restano{" "}
          <strong>velati</strong> finché non li tocchi: si guarda la fonte di ogni paragrafo, con la stessa regola
          dell'Oracolo.
        </p>
        <p style={n}>
          Lo scaricamento chiede le voci a Lexicanum cinquanta alla volta, con calma: è un wiki di volontari. Ci vuole
          tempo e qualche centinaio di MB di rete. Se l'app si chiude o la rete cade riparte da sola da dove era arrivato;
          se lo fermi tu resta fermo finché non lo riprendi. Una volta sceso{" "}
          <strong>resta su questo dispositivo</strong> e non si riscarica: ogni dispositivo (e ogni indirizzo dell'app,
          come le anteprime) ha il suo.
        </p>
        <p style={{ ...n, opacity: 0.8 }}>
          Testi da{" "}
          <a href={LEXICANUM.sito} target="_blank" rel="noreferrer" style={{ color: C.arcane }}>
            Lexicanum
          </a>{" "}
          e dei suoi autori, licenza Creative Commons Attribuzione–Non commerciale: per uso personale. Warhammer 40,000 è
          un marchio di Games Workshop.
        </p>
      </BloccoWiki>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}66` }}>
        <BloccoWiki wiki={FANDOM} icona="📜" lavoro={lavoroFan} onScarica={onScaricaFan} onFerma={onFermaFan}>
          <p style={n}>
            Il Warhammer 40k Wiki di Fandom, come <strong>seconda scheda</strong> accanto a Lexicanum: voci più lunghe e
            raccontate, utili per legioni, fazioni e guerre.
          </p>
          <p style={n}>
            <strong>Può spoilerare.</strong> Fandom non dice da quale libro viene ogni paragrafo, quindi non si può
            velare un paragrafo per volta: davanti alla voce c'è un avviso con i libri delle sue fonti che non hai
            ancora letto, e la voce si legge solo se lo tocchi.
          </p>
          <p style={n}>
            Le voci sono settemila ma lunghe: sul dispositivo occupano intorno ai 200 MB, e lo scaricamento chiede
            tempo. Si ferma e si riprende come quello di Lexicanum, e resta su questo dispositivo.
          </p>
          <p style={{ ...n, opacity: 0.8 }}>
            Testi dal{" "}
            <a href={FANDOM.sito} target="_blank" rel="noreferrer" style={{ color: C.arcane }}>
              Warhammer 40k Wiki
            </a>{" "}
            di Fandom e dei suoi autori, licenza Creative Commons Attribuzione–Condividi allo stesso modo: per uso
            personale.
          </p>
        </BloccoWiki>
      </div>
    </div>
  );
}

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
import {
  statoLexicanum,
  giroLexicanum,
  rimuoviLexicanum,
  fraseLexicanum,
  vociDiPrima,
  immaginiDi,
  misuraImmagini,
  statoImmagini,
  rimuoviImmagini,
  fraseImmagini,
  illustrazioniDi,
  misuraIllustrazioni,
  statoIllustrazioni,
  rimuoviIllustrazioni,
  fraseIllustrazioni,
  LATI_ILLUSTRAZIONI,
  riepilogoWiki,
  LEXICANUM,
  FANDOM,
} from "../lib/lexicanum.js";

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
const mega = (b) => `${Math.max(1, Math.round(b / 1048576)).toLocaleString("it-IT")} MB`;

// LE IMMAGINI PRINCIPALI, sotto il wiki gia' sceso. Prima si misura (quante
// voci hanno l'immagine, quanto pesano, se il wiki le lascia salvare), poi si
// scarica dicendo il peso: un tasto non promette cio' che non sa.
function BloccoImmagini({ wiki, lavoro, altro, onScarica, onFerma, onCambio }) {
  const [stato, setStato] = useState(undefined);
  const [giro, setGiro] = useState(null);
  const [misura, setMisura] = useState(null);
  const [confermaVia, setConfermaVia] = useState(false);
  const inCorso = !!lavoro;
  useEffect(() => {
    let vivo = true;
    statoImmagini(undefined, wiki).then((s) => vivo && setStato(s));
    giroLexicanum(undefined, immaginiDi(wiki)).then((g) => vivo && setGiro(g));
    return () => {
      vivo = false;
    };
  }, [inCorso, wiki]);

  async function misurale() {
    setMisura("…");
    try {
      setMisura(await misuraImmagini({ wiki }));
    } catch (e) {
      setMisura({ errore: e?.message || "Il wiki non ha risposto." });
    }
  }
  async function via() {
    await rimuoviImmagini(undefined, wiki).catch(() => {});
    setStato(null);
    setGiro(null);
    setMisura(null);
    setConfermaVia(false);
    onCambio?.();
  }

  const t = tasto();
  const n = nota();
  const viola = { ...t, color: C.arcane, borderColor: `${C.arcane}55` };
  const pronta = misura && misura !== "…" && !misura.errore && !misura.bloccate && !misura.senzaPrincipale;
  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ margin: 0, fontSize: F.piccolo, fontWeight: 600, color: lavoro ? C.text : stato ? C.green : C.muted }}>
        {lavoro
          ? `🖼 Le immagini stanno scendendo`
          : stato === undefined
            ? "…"
            : stato
              ? `🖼 Immagini sul dispositivo · ${fraseImmagini(stato)}`
              : giro
                ? `🖼 Immagini scese a metà · ${fraseImmagini(giro)}`
                : `🖼 Le immagini non sono sul dispositivo`}
      </p>
      {lavoro && <p style={{ ...n, color: C.text }}>Scarico… {fraseImmagini(lavoro)}</p>}
      {altro && !lavoro && !stato && <p style={n}>Stanno scendendo le immagini dell'altro wiki: una alla volta.</p>}

      {!altro && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {lavoro ? (
            <button onClick={onFerma} style={t}>
              Ferma
            </button>
          ) : stato ? (
            confermaVia ? (
              <>
                <button onClick={via} style={{ ...t, color: C.red }}>
                  Rimuovi le immagini
                </button>
                <button onClick={() => setConfermaVia(false)} style={{ ...t, color: C.muted }}>
                  Lascia stare
                </button>
              </>
            ) : (
              <button onClick={() => setConfermaVia(true)} style={{ ...t, color: C.muted }}>
                Rimuovi le immagini
              </button>
            )
          ) : giro ? (
            <button onClick={() => onScarica()} style={viola}>
              🖼 Riprendi le immagini
            </button>
          ) : pronta ? (
            <button onClick={() => onScarica()} style={viola}>
              🖼 Scarica le immagini · circa {mega(misura.stima)}
            </button>
          ) : (
            <button onClick={misurale} disabled={misura === "…"} style={viola}>
              {misura === "…" ? "Misuro…" : "🖼 Misura le immagini"}
            </button>
          )}
        </div>
      )}

      {!lavoro && !stato && !giro && pronta && (
        <p style={n}>
          Misurate su {misura.campione} voci: {Math.round(misura.quota * 100)}% hanno un'immagine, in media{" "}
          {Math.max(1, Math.round(misura.medio / 1024))} KB l'una. Per tutte le voci circa {mega(misura.stima)}. Solo l'immagine
          principale di ogni voce, già ridotta dal wiki.
        </p>
      )}
      {misura?.bloccate && (
        <p style={{ ...n, color: C.text }}>
          {wiki.nome} non lascia salvare le sue immagini a un'app nel browser: si vedono solo aprendo la voce sul sito.
        </p>
      )}
      {misura?.errore && <p style={{ ...n, color: C.text }}>{misura.errore} Si può riprovare.</p>}
      {misura?.senzaPrincipale && (
        <p style={{ ...n, color: C.text }}>
          {wiki.nome} non segna quale sia l'immagine principale delle sue voci: su {misura.campione} voci guardate, nessuna
          la dichiara. Per questa strada non c'è niente da scaricare.
        </p>
      )}
      {!stato && (
        <p style={n}>
          L'immagine sta in cima alla voce, col riquadro dei dati
          {wiki === FANDOM ? ", dietro l'avviso della voce." : ", e resta velata con lui: anche un'immagine può dire come va a finire."}
        </p>
      )}
    </div>
  );
}

// LE ALTRE ILLUSTRAZIONI DI FANDOM, sotto le immagini principali: anche
// qui prima si misura, poi si sceglie la misura col suo peso
function BloccoIllustrazioni({ lavoro, onScarica, onFerma, onCambio }) {
  const [stato, setStato] = useState(undefined);
  const [giro, setGiro] = useState(null);
  const [misura, setMisura] = useState(null);
  const [confermaVia, setConfermaVia] = useState(false);
  const inCorso = !!lavoro;
  useEffect(() => {
    let vivo = true;
    statoIllustrazioni().then((s) => vivo && setStato(s));
    giroLexicanum(undefined, illustrazioniDi(FANDOM)).then((g) => vivo && setGiro(g));
    return () => {
      vivo = false;
    };
  }, [inCorso]);

  async function misurale() {
    setMisura("…");
    try {
      setMisura(await misuraIllustrazioni());
    } catch (e) {
      setMisura({ errore: e?.message || "Il wiki non ha risposto." });
    }
  }
  async function via() {
    await rimuoviIllustrazioni().catch(() => {});
    setStato(null);
    setGiro(null);
    setMisura(null);
    setConfermaVia(false);
    onCambio?.();
  }

  const t = tasto();
  const n = nota();
  const viola = { ...t, color: C.arcane, borderColor: `${C.arcane}55` };
  const pronta = misura && misura !== "…" && !misura.errore && !misura.bloccate && !misura.nessuna;
  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ margin: 0, fontSize: F.piccolo, fontWeight: 600, color: lavoro ? C.text : stato ? C.green : C.muted }}>
        {lavoro
          ? "🖼 Le illustrazioni stanno scendendo"
          : stato === undefined
            ? "…"
            : stato
              ? `🖼 Illustrazioni sul dispositivo · ${fraseIllustrazioni(stato)} · ${stato.lato} px`
              : giro
                ? `🖼 Illustrazioni scese a metà · ${fraseIllustrazioni(giro)}`
                : "🖼 Le altre illustrazioni non sono sul dispositivo"}
      </p>
      {lavoro && <p style={{ ...n, color: C.text }}>Scarico… {fraseIllustrazioni(lavoro)}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {lavoro ? (
          <button onClick={onFerma} style={t}>
            Ferma
          </button>
        ) : stato ? (
          confermaVia ? (
            <>
              <button onClick={via} style={{ ...t, color: C.red }}>
                Rimuovi le illustrazioni
              </button>
              <button onClick={() => setConfermaVia(false)} style={{ ...t, color: C.muted }}>
                Lascia stare
              </button>
            </>
          ) : (
            <button onClick={() => setConfermaVia(true)} style={{ ...t, color: C.muted }}>
              Rimuovi le illustrazioni
            </button>
          )
        ) : giro ? (
          <button onClick={() => onScarica()} style={viola}>
            🖼 Riprendi le illustrazioni
          </button>
        ) : pronta ? (
          LATI_ILLUSTRAZIONI.map((lato) => (
            <button key={lato} onClick={() => onScarica(lato)} style={viola}>
              🖼 Scarica a {lato} px · circa {mega(misura.stime[lato])}
            </button>
          ))
        ) : (
          <button onClick={misurale} disabled={misura === "…"} style={viola}>
            {misura === "…" ? "Misuro…" : "🖼 Misura le illustrazioni"}
          </button>
        )}
      </div>
      {!lavoro && !stato && !giro && pronta && (
        <p style={n}>
          Misurate su {misura.campione} voci: in media {misura.perVoce.toFixed(1).replace(".", ",")} illustrazioni per voce oltre alla
          principale, circa {voci(misura.stimaQuante)} in tutto. A 250 px stanno bene accanto al testo; a 400 px si vedono nitide anche
          aperte in grande.
        </p>
      )}
      {misura?.bloccate && <p style={{ ...n, color: C.text }}>Fandom non lascia salvare le sue illustrazioni a un'app nel browser.</p>}
      {misura?.nessuna && <p style={{ ...n, color: C.text }}>Nelle {misura.campione} voci guardate non ci sono illustrazioni oltre alla principale.</p>}
      {misura?.errore && <p style={{ ...n, color: C.text }}>{misura.errore} Si può riprovare.</p>}
      {!stato && (
        <p style={n}>
          Le altre illustrazioni di ogni voce, oltre alla principale: stanno in fondo alla voce, nella sezione «Illustrazioni», col
          nome del file come didascalia, e un tocco le apre in grande. Su Fandom dietro l'avviso della voce, su Lexicanum velate. Lo
          scaricamento è lungo, ore: prima l'elenco dei file di ogni voce, poi le illustrazioni, e se l'app si chiude riparte da solo.
        </p>
      )}
    </div>
  );
}

function BloccoWiki({ wiki, icona, lavoro, onScarica, onFerma, immagini, onImmagini, onFermaImmagini, illustrazioni, onIllustrazioni, onFermaIllustrazioni, onCambio, children }) {
  const [stato, setStato] = useState(undefined);
  const [giro, setGiro] = useState(null);
  const [confermaVia, setConfermaVia] = useState(false);
  // RISCARICARE E' UN GIRO INTERO, decine di migliaia di voci: «Aggiorna»
  // accanto a «Rimuovi» si tocca anche per errore, o credendo che serva a
  // far funzionare il wiki, e allora chiede conferma e dice cosa costa
  const [confermaGiro, setConfermaGiro] = useState(false);
  // a wiki gia' sceso la spiegazione si chiude: resta a un tocco
  const [info, setInfo] = useState(false);

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
    onCambio?.();
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

      {/* LEXICANUM NON HA UN BLOCCO DI IMMAGINI: non segna l'immagine
          principale delle sue voci (misurato: nessuna su cinquanta), e le
          sue voci prendono quelle di Fandom. Un tasto «Misura» li' faceva
          credere che mancasse qualcosa */}
      {stato && wiki === FANDOM && (
        <BloccoImmagini
          wiki={wiki}
          lavoro={immagini?.quale === wiki.id ? immagini : null}
          altro={!!immagini && immagini.quale !== wiki.id}
          onScarica={() => onImmagini?.(wiki.id)}
          onFerma={onFermaImmagini}
          onCambio={onCambio}
        />
      )}
      {stato && wiki !== FANDOM && (
        <p style={{ ...n, marginTop: 12 }}>
          🖼 Lexicanum non segna le immagini delle sue voci: le prende da Fandom (l'immagine principale e le altre illustrazioni),
          velate perché possono dire come va a finire. Si scaricano nel blocco di Fandom qui sotto.
        </p>
      )}
      {stato && wiki === FANDOM && <BloccoIllustrazioni lavoro={illustrazioni} onScarica={onIllustrazioni} onFerma={onFermaIllustrazioni} onCambio={onCambio} />}

      {stato && (
        <button
          onClick={() => setInfo((v) => !v)}
          aria-expanded={info}
          style={{ minHeight: 44, padding: "6px 0", marginTop: 6, fontSize: F.piccolo, color: C.arcane }}
        >
          {info ? "ℹ Nascondi la spiegazione" : `ℹ Cos'è ${wiki.nome} e come funziona`}
        </button>
      )}
      {(!stato || info) && children}
    </div>
  );
}

// IL RIEPILOGO, in cima: cosa c'e' sul dispositivo e cosa manca, in una
// riga per cosa (`riepilogoWiki`). Si rilegge quando un lavoro parte o
// finisce e quando qualcosa si rimuove
function Riepilogo({ versione }) {
  const [r, setR] = useState(null);
  useEffect(() => {
    let vivo = true;
    Promise.all([
      statoLexicanum(undefined, LEXICANUM),
      giroLexicanum(undefined, LEXICANUM),
      statoLexicanum(undefined, FANDOM),
      giroLexicanum(undefined, FANDOM),
      statoImmagini(undefined, FANDOM),
      giroLexicanum(undefined, immaginiDi(FANDOM)),
      statoIllustrazioni(),
      giroLexicanum(undefined, illustrazioniDi(FANDOM)),
    ])
      .then(([lex, lexGiro, fan, fanGiro, img, imgGiro, ill, illGiro]) => vivo && setR(riepilogoWiki({ lex, lexGiro, fan, fanGiro, img, imgGiro, ill, illGiro })))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [versione]);
  if (!r) return null;
  const segno = { fatto: "✓", aMeta: "◐", dopo: "○", manca: "○" };
  return (
    <div
      role="status"
      aria-label="Riepilogo dei wiki"
      style={{ marginBottom: 16, padding: 12, borderRadius: R.medio, border: `1px solid ${r.tutto ? `${C.green}66` : C.border}`, background: `${C.surface}55` }}
    >
      <p style={{ margin: 0, fontSize: F.corpo, fontWeight: 600, color: r.tutto ? C.green : C.text }}>{r.frase}</p>
      <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {r.righe.map((x) => (
          <li key={x.nome} style={{ fontSize: F.piccolo, lineHeight: 1.45, color: x.stato === "fatto" ? C.text : C.muted }}>
            <span style={{ display: "inline-block", width: 22, color: x.stato === "fatto" ? C.green : x.stato === "aMeta" ? C.accent : C.muted }}>{segno[x.stato]}</span>
            {x.nome} <span style={{ color: C.muted }}>· {x.dettaglio}</span>
          </li>
        ))}
      </ul>
      <p style={{ margin: "8px 0 0", fontSize: F.minuscolo, color: C.muted, lineHeight: 1.5 }}>
        Le voci di Lexicanum usano le immagini e le illustrazioni di Fandom: Lexicanum non segna le sue.
      </p>
    </div>
  );
}

export default function SezioneLexicanum({ lavoro, onScarica, onFerma, lavoroFan, onScaricaFan, onFermaFan, immagini, onImmagini, onFermaImmagini, illustrazioni, onIllustrazioni, onFermaIllustrazioni }) {
  const img = { immagini, onImmagini, onFermaImmagini };
  const n = nota();
  const [rimossi, setRimossi] = useState(0);
  const onCambio = () => setRimossi((v) => v + 1);
  const versione = `${rimossi}|${!!lavoro}|${!!lavoroFan}|${!!immagini}|${!!illustrazioni}`;
  return (
    <div>
      <Riepilogo versione={versione} />
      <BloccoWiki wiki={LEXICANUM} icona="⚔" lavoro={lavoro} onScarica={onScarica} onFerma={onFerma} {...img} onCambio={onCambio}>
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
        <BloccoWiki
          wiki={FANDOM}
          icona="📜"
          lavoro={lavoroFan}
          onScarica={onScaricaFan}
          onFerma={onFermaFan}
          {...img}
          illustrazioni={illustrazioni}
          onIllustrazioni={onIllustrazioni}
          onFermaIllustrazioni={onFermaIllustrazioni}
          onCambio={onCambio}
        >
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

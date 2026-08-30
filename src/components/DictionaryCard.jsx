import { useRef, useState } from "react";
import { C, FONT_TITLE, F, R } from "../data/constants.js";
import { consultaOracolo, hasOracle, setOracleKey } from "../lib/oracle.js";
import { rigaUltima, rigaMese, riassunto, costo, leggiTetto } from "../lib/spesa.js";
import { TettoFinito } from "./TettoOracolo.jsx";
import { chiaveGlossario, vociDi, salvaVoci, aggiungi, togli, cerca } from "../lib/glossarioMio.js";

// La scheda del dizionario e' identica nei due reader: qui una volta sola,
// cosi' EPUB e PDF non divergono.
// Le definizioni parola per parola non stanno piu' qui: il dizionario del
// tablet, nel menu di selezione, e' migliore del nostro (scelta del
// lettore, e il dizionario in rete e' stato congedato). La scheda risponde
// con quello che il tablet non puo' sapere: glossario della saga, modi di
// dire, e l'Oracolo.
// La voce di vocabolario, impaginata come il Collins del tablet (scelta
// del lettore: «usa lo stile che si presenta usando il dizionario collins
// che mi sembra fatto bene»). Le due cose che la rendono leggibile sono
// la BANDA che dice da dove viene la risposta, e i sensi NUMERATI con la
// categoria grammaticale davanti — non un muro di prosa.
//
// E il primo riquadro resta IN LINGUA, come nel Collins: tradurre a
// macchina le definizioni e' esattamente il difetto che aveva fatto
// congedare questo dizionario. La resa italiana sta nel secondo riquadro,
// dove il Collins mette la sua, e riguarda la parola — non la glossa.
function banda(testo) {
  return (
    <div
      style={{
        padding: "5px 12px",
        background: `${C.surface}e6`,
        borderBottom: `1px solid ${C.border}`,
        fontSize: F.minuscolo,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        color: C.muted,
      }}
    >
      {testo}
    </div>
  );
}

function Voce({ dict }) {
  const entries = dict.entries || [];
  if (!entries.length && !dict.translation) return null;
  const lingua = (dict.lang || "en") === "en" ? "Inglese" : (dict.lang || "").toUpperCase();

  return (
    <div
      style={{
        marginBottom: 12,
        border: `1px solid ${C.border}`,
        borderRadius: R.piccolo,
        overflow: "hidden",
        background: `${C.surface}55`,
      }}
    >
      {entries.length > 0 && (
        <>
          {banda(`Wiktionary ${lingua}`)}
          <div style={{ padding: "9px 12px 11px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: F.corpo, fontWeight: 600, color: C.text }}>
                {dict.lemma || dict.word}
              </span>
              {dict.forma && (
                <span style={{ fontSize: F.minuscolo, color: C.muted, fontStyle: "italic" }}>
                  ({dict.forma} «{dict.lemma}»)
                </span>
              )}
            </div>
            {entries.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7 }}>
                <span style={{ flexShrink: 0, fontSize: F.piccolo, color: C.accent, minWidth: 12 }}>
                  {i + 1}
                </span>
                <div style={{ minWidth: 0 }}>
                  {e.pos && (
                    <span
                      style={{
                        fontSize: F.minuscolo,
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                        color: C.arcane,
                        marginRight: 7,
                      }}
                    >
                      {e.pos}
                    </span>
                  )}
                  <span style={{ fontSize: F.nota, color: C.text, lineHeight: 1.5 }}>{e.text}</span>
                  {/* «The quality or state of being gormless» non spiega
                      niente a chi non sa cosa vuol dire «gormless»: la sua
                      definizione va qui, rientrata, come il rimando di un
                      vocabolario di carta — e non fra i sensi qui sopra,
                      che sono di un'ALTRA parola */}
                  {e.rimando && (
                    <div
                      style={{
                        marginTop: 6,
                        paddingLeft: 9,
                        borderLeft: `2px solid ${C.border}`,
                      }}
                    >
                      <span style={{ fontSize: F.minuscolo, fontWeight: 600, color: C.accent }}>
                        {e.rimando.parola}
                      </span>
                      {e.rimando.sensi.map((s, k) => (
                        <div
                          key={k}
                          style={{ fontSize: F.minuscolo, color: C.muted, lineHeight: 1.45, marginTop: 2 }}
                        >
                          {s.pos && (
                            <span
                              style={{
                                letterSpacing: 0.5,
                                textTransform: "uppercase",
                                color: C.arcane,
                                marginRight: 6,
                              }}
                            >
                              {s.pos}
                            </span>
                          )}
                          {s.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {dict.translation && (
        <>
          {banda(dict.machine ? "Reso a macchina, dall'inglese" : "Dall'inglese all'italiano")}
          <div style={{ padding: "8px 12px 10px" }}>
            <span style={{ fontSize: F.nota, color: C.text, lineHeight: 1.5 }}>
              {dict.translation}
            </span>
            {dict.machine && (
              <div style={{ fontSize: F.minuscolo, color: C.muted, marginTop: 5, lineHeight: 1.4 }}>
                Nessuna voce di vocabolario per questo passaggio: qui sopra c'è una traduzione
                automatica, non il senso del modo di dire.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function DictionaryCard({ dict, book, bottom, onClose }) {
  // {loading} | {answer} | {error}; la chiave si chiede qui dentro, dove
  // l'Oracolo si usa, non in un pannello di impostazioni da scoprire
  const [oracolo, setOracolo] = useState(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  // il glossario tuo: `giro` serve solo a rileggere le voci dopo aver
  // salvato — stanno in localStorage, e senza un rendering non si rileggono
  const [glossOpen, setGlossOpen] = useState(false);
  const [glossDraft, setGlossDraft] = useState("");
  const [, setGiro] = useState(0);
  // la scheda resta montata tra una selezione e l'altra: la risposta della
  // frase di prima non deve comparire sotto la frase nuova
  const tagRef = useRef();
  const tag = dict ? `${dict.raw || ""}|${dict.word || ""}` : "";
  if (tagRef.current !== tag) {
    tagRef.current = tag;
    if (oracolo) setOracolo(null);
    if (keyOpen) setKeyOpen(false);
    if (glossOpen) setGlossOpen(false);
  }

  async function chiedi() {
    setOracolo({ loading: true });
    const mio = tag;
    const res = await consultaOracolo({
      text: dict.raw?.trim() || dict.word,
      context: dict.context,
      book,
    });
    if (tagRef.current === mio) setOracolo(res);
  }

  function salvaChiave() {
    const k = keyDraft.trim();
    if (!k) return;
    setOracleKey(k);
    setKeyDraft("");
    setKeyOpen(false);
    chiedi();
  }

  // IL GLOSSARIO TUO, per qualunque saga. Le nostre voci coprono un mondo
  // solo; questa è la strada perché il lettore tenga i termini del mondo
  // che sta attraversando davvero.
  const chiaveMia = chiaveGlossario(book);
  const termine = (dict?.raw?.trim() || dict?.word || "").trim();
  // solo su un TERMINE, non su un periodo: un glossario di paragrafi non è
  // un glossario
  const segnabile = !!chiaveMia && !!termine && termine.split(/\s+/).length <= 4 && termine.length <= 60;
  const mie = segnabile ? vociDi(chiaveMia) : [];
  const mia = segnabile ? cerca(mie, termine) : null;

  function apriGloss() {
    // prefilled con quello che c'è già, o con la risposta dell'Oracolo: è
    // proprio la spiegazione che altrimenti butteresti via chiudendo la scheda
    setGlossDraft(mia?.d || oracolo?.answer || "");
    setGlossOpen(true);
  }

  function salvaGloss() {
    const d = glossDraft.trim();
    if (!d) return;
    salvaVoci(chiaveMia, aggiungi(mie, termine, d));
    setGlossOpen(false);
    setGiro((g) => g + 1);
  }

  function rimuoviGloss() {
    salvaVoci(chiaveMia, togli(mie, termine));
    setGlossOpen(false);
    setGiro((g) => g + 1);
  }

  if (!dict) return null;
  // Chi seleziona UNA FRASE sta chiedendo cosa vuol dire quella frase: in
  // cima ci va il modo di dire, non il nome proprio che capita di trovarci
  // dentro. Chiedere il senso di un periodo e vedersi rispondere con la voce
  // di un termine appena cercato e' l'errore piu' irritante che questa
  // scheda possa fare, e lo faceva.
  // Se nella frase c'e' piu' di una cosa da spiegare, sceglierne una sola da
  // mettere in cima e' arbitrario: la prima in ordine di lettura non e' per
  // forza quella che non si capiva. Si elencano tutte, in ordine di lettura.
  const tutte = dict.found || [];
  const elenco = dict.frase && tutte.length > 1;
  const primaria = elenco ? null : dict.frase ? dict.slang || dict.gloss : dict.gloss || dict.slang;
  const secondaria = elenco || primaria !== dict.gloss ? (elenco ? null : dict.gloss) : dict.slang;
  const voce = !!(dict.entries?.length || dict.translation);
  const local = primaria || secondaria || elenco || voce;
  const rest = elenco ? tutte : tutte.filter((e) => e.t !== primaria?.t && e.t !== secondaria?.t);
  const testo = dict.raw?.trim() || dict.word || "";
  const titolo = primaria?.t || (testo.length > 44 ? `${testo.slice(0, 44)}…` : testo);

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 30,
        background: "#0806115e",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(94%, 460px)",
          marginBottom: bottom,
          maxHeight: "52%",
          overflowY: "auto",
          background: `${C.card}fa`,
          border: `1px solid ${C.border}`,
          borderRadius: R.medio,
          boxShadow: "0 12px 44px #000000aa",
          padding: "13px 16px 15px",
          animation: "bc-fade-in 0.2s ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text }}>
            {titolo}
          </span>
          {primaria?.k && <span style={{ fontSize: F.minuscolo, color: C.arcane }}>{primaria.k}</span>}
          {primaria?.r && (
            <span style={{ fontSize: F.minuscolo, color: C.muted, fontStyle: "italic" }}>{primaria.r}</span>
          )}
          <button onClick={onClose} style={{ marginLeft: "auto", color: C.muted, fontSize: F.rilievo }}>
            ✕
          </button>
        </div>

        {primaria && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: F.corpo, color: C.text, lineHeight: 1.5, margin: "0 0 8px" }}>
              {primaria.d}
            </p>
            {primaria.wiki && (
            <a
              href={primaria.wiki}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                fontSize: F.piccolo,
                color: C.accent,
                border: `1px solid ${C.accent}55`,
                borderRadius: R.tondo,
                padding: "5px 12px",
                textDecoration: "none",
              }}
            >
              Apri sul wiki ↗
            </a>
            )}
            {primaria.wiki && (
              <span style={{ fontSize: F.minuscolo, color: C.muted, marginLeft: 9 }}>di là si spoilera</span>
            )}
          </div>
        )}

        {/* Il rimando al wiki della saga quando il glossario tace: senza
            piu' il dizionario in rete non sappiamo se la parola e' inglese
            comune, ma chi apre questa scheda in un libro di saga sta quasi
            sempre chiedendo di un nome del mondo, non di un vocabolo. */}
        {!primaria && dict.wikiSearch && !dict.loading && (
          <a
            href={dict.wikiSearch.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              marginBottom: 12,
              fontSize: F.piccolo,
              color: C.accent,
              border: `1px solid ${C.accent}55`,
              borderRadius: R.tondo,
              padding: "5px 12px",
              textDecoration: "none",
            }}
          >
            Cerca «{dict.wikiSearch.term}» sul wiki ↗
          </a>
        )}

        <Voce dict={dict} />

        {secondaria && (
          <div
            style={{
              marginBottom: 12,
              paddingLeft: 10,
              borderLeft: `2px solid ${C.arcane}66`,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: F.nota, color: C.text, fontWeight: 600 }}>{secondaria.t}</span>
              {(secondaria.r || secondaria.k) && (
                <span style={{ fontSize: F.minuscolo, color: C.muted, fontStyle: "italic" }}>
                  {secondaria.r || secondaria.k}
                </span>
              )}
            </div>
            <p style={{ fontSize: F.corpo, color: C.text, lineHeight: 1.45, margin: 0 }}>
              {secondaria.d}
            </p>
            {secondaria.wiki && (
              <a
                href={secondaria.wiki}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-block", marginTop: 6, fontSize: F.minuscolo, color: C.accent, textDecoration: "none" }}
              >
                Apri sul wiki ↗
              </a>
            )}
          </div>
        )}

        {rest.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: F.minuscolo, color: C.muted, marginBottom: 6 }}>
              {elenco ? "In questa frase riconosco" : "Nel brano riconosco anche"}
            </div>
            {rest.slice(0, 12).map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, alignItems: "baseline" }}>
                {e.wiki ? (
                  <a
                    href={e.wiki}
                    target="_blank"
                    rel="noreferrer"
                    style={{ flexShrink: 0, minWidth: 96, fontSize: F.piccolo, color: C.accent, fontWeight: 600, textDecoration: "none" }}
                  >
                    {e.t} ↗
                  </a>
                ) : (
                  <span style={{ flexShrink: 0, minWidth: 96, fontSize: F.piccolo, color: C.text, fontWeight: 600 }}>
                    {e.t}
                  </span>
                )}
                <span style={{ fontSize: F.piccolo, color: C.muted, lineHeight: 1.4 }}>{e.d}</span>
              </div>
            ))}
            {rest.length > 12 && (
              <div style={{ fontSize: F.minuscolo, color: C.muted, marginTop: 4 }}>
                e altre {rest.length - 12} voci
              </div>
            )}
          </div>
        )}

        {!dict.loading && !local && dict.frase && !dict.wikiSearch && (
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(`"${dict.word}" meaning`)}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              marginBottom: 10,
              fontSize: F.piccolo,
              color: C.arcane,
              border: `1px solid ${C.arcane}55`,
              borderRadius: R.tondo,
              padding: "5px 12px",
              textDecoration: "none",
            }}
          >
            Cerca questa espressione ↗
          </a>
        )}

        {dict.loading ? (
          <p style={{ color: C.muted, fontSize: F.nota }}>Sfoglio il glossario…</p>
        ) : local ? null : (
          // il glossario che tace non chiude la scheda: resta l'Oracolo, e
          // per la definizione nuda c'e' il dizionario del tablet
          <p style={{ color: C.muted, fontSize: F.nota, lineHeight: 1.5 }}>
            {dict.offline
              ? "Senza rete il vocabolario non risponde: le parole già cercate restano consultabili, le altre aspettano."
              : dict.frase
                ? "Questo passaggio non è un modo di dire che conosco."
                : `Né il glossario né il vocabolario conoscono «${dict.word}». C'è anche il dizionario del tablet, nel menu della selezione.`}
          </p>
        )}

        {/* L'Oracolo: glossario e dizionario spiegano parole e modi di dire,
            ma il senso di una battuta sta nel paragrafo. Si offre sempre,
            anche quando una risposta di casa c'e' gia'. */}
        {(dict.raw || dict.word) && !dict.loading && (
          <div style={{ marginTop: 10, paddingTop: 11, borderTop: `1px solid ${C.border}66` }}>
            {oracolo?.answer ? (
              <>
                <div style={{ fontSize: F.minuscolo, color: C.arcane, marginBottom: 4 }}>✨ L'Oracolo dice</div>
                <p style={{ fontSize: F.corpo, color: C.text, lineHeight: 1.5, margin: 0 }}>{oracolo.answer}</p>
                {/* quanto è costata: qui le domande sono piccole e costano
                    pochissimo, ed è proprio il confronto che serve — una
                    parola spiegata non è una scheda su cento passaggi */}
                {oracolo.uso && (
                  <p style={{ margin: "6px 0 0", fontSize: F.minuscolo, color: C.dim }}>
                    {rigaUltima(oracolo.uso)}
                    {rigaMese() ? ` · ${rigaMese()}` : ""}
                  </p>
                )}
              </>
            ) : oracolo?.loading ? (
              <p style={{ fontSize: F.piccolo, color: C.muted, margin: 0 }}>✨ L'Oracolo sta leggendo il passaggio…</p>
            ) : oracolo?.error === "chiave" ? (
              <div>
                <p style={{ fontSize: F.piccolo, color: C.muted, margin: "0 0 8px" }}>
                  L'Oracolo non ha accettato la chiave.
                </p>
                <button
                  onClick={() => { setOracolo(null); setKeyOpen(true); }}
                  style={{ fontSize: F.piccolo, color: C.arcane, border: `1px solid ${C.arcane}55`, borderRadius: R.tondo, padding: "5px 12px" }}
                >
                  Cambia chiave
                </button>
              </div>
            ) : oracolo?.error === "tetto" ? (
              // il tetto del mese non e' un guasto dell'Oracolo: e' la
              // decisione del lettore che sta funzionando, e si dice coi
              // numeri veri invece che con «non ha risposto»
              <TettoFinito
                speso={costo(riassunto().mese)}
                tetto={oracolo.tettoMese ?? leggiTetto()}
                onRiprova={() => { setOracolo(null); chiedi(); }}
              />
            ) : oracolo?.error ? (
              <div>
                <p style={{ fontSize: F.piccolo, color: C.muted, margin: "0 0 8px" }}>
                  {oracolo.error === "rete"
                    ? "L'Oracolo ha bisogno della rete: riprova quando sei online."
                    : "L'Oracolo non ha risposto: riprova tra un momento."}
                </p>
                <button
                  onClick={chiedi}
                  style={{ fontSize: F.piccolo, color: C.arcane, border: `1px solid ${C.arcane}55`, borderRadius: R.tondo, padding: "5px 12px" }}
                >
                  Riprova
                </button>
              </div>
            ) : keyOpen ? (
              <div>
                <p style={{ fontSize: F.piccolo, color: C.muted, margin: "0 0 8px", lineHeight: 1.45 }}>
                  Serve una chiave API di Anthropic (console.anthropic.com). Resta solo su questo
                  dispositivo e paghi solo quel che chiedi.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="password"
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
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
                    onClick={salvaChiave}
                    style={{ flexShrink: 0, fontSize: F.piccolo, color: C.arcane, border: `1px solid ${C.arcane}55`, borderRadius: R.tondo, padding: "5px 12px" }}
                  >
                    Salva e chiedi
                  </button>
                </div>
              </div>
            ) : hasOracle() ? (
              <button
                onClick={chiedi}
                style={{ fontSize: F.piccolo, color: C.arcane, border: `1px solid ${C.arcane}55`, borderRadius: R.tondo, padding: "5px 12px" }}
              >
                ✨ Spiegami questo passaggio
              </button>
            ) : (
              <button
                onClick={() => setKeyOpen(true)}
                style={{ fontSize: F.minuscolo, color: C.muted, textAlign: "left", padding: 0, lineHeight: 1.45 }}
              >
                ✨ L'Oracolo può spiegarti cosa vuol dire qui, nel contesto del libro — serve una
                chiave API, tocca per impostarla
              </button>
            )}
          </div>
        )}

        {/* IL GLOSSARIO TUO. Le nostre voci coprono un mondo solo, e la
            spiegazione dell'Oracolo finora si buttava via chiudendo la
            scheda: qui si tiene, sulla saga del libro, e da domani quel
            termine si spiega da solo — anche senza rete e senza chiave. */}
        {segnabile && (
          <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
            {glossOpen ? (
              <div>
                <textarea
                  value={glossDraft}
                  onChange={(e) => setGlossDraft(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder={`Cosa vuol dire «${termine}», con parole tue`}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: R.piccolo,
                    border: `1px solid ${C.border}`,
                    background: C.surface,
                    color: C.text,
                    fontSize: F.nota,
                    lineHeight: 1.45,
                    resize: "vertical",
                    outline: "none",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={salvaGloss}
                    style={{
                      fontSize: F.piccolo,
                      color: C.accent,
                      border: `1px solid ${C.accent}55`,
                      borderRadius: R.tondo,
                      padding: "5px 14px",
                    }}
                  >
                    Tieni nel glossario
                  </button>
                  <button onClick={() => setGlossOpen(false)} style={{ fontSize: F.piccolo, color: C.muted, padding: "5px 8px" }}>
                    Lascia stare
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={apriGloss}
                  style={{
                    fontSize: F.piccolo,
                    color: mia ? C.muted : C.accent,
                    border: `1px solid ${mia ? C.border : `${C.accent}55`}`,
                    borderRadius: R.tondo,
                    padding: "5px 14px",
                  }}
                >
                  {mia ? "✎ Cambia la tua voce" : "📖 Tieni nel glossario"}
                </button>
                {mia && (
                  <button onClick={rimuoviGloss} aria-label="Togli dal glossario" style={{ color: C.muted, padding: 6 }}>
                    🗑
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useRef, useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { consultaOracolo, hasOracle, setOracleKey } from "../lib/oracle.js";

// La scheda del dizionario e' identica nei due reader: qui una volta sola,
// cosi' EPUB e PDF non divergono.
export default function DictionaryCard({ dict, book, bottom, onClose }) {
  const [all, setAll] = useState(false);
  // {loading} | {answer} | {error}; la chiave si chiede qui dentro, dove
  // l'Oracolo si usa, non in un pannello di impostazioni da scoprire
  const [oracolo, setOracolo] = useState(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  // la scheda resta montata tra una selezione e l'altra: la risposta della
  // frase di prima non deve comparire sotto la frase nuova
  const tagRef = useRef();
  const tag = dict ? `${dict.raw || ""}|${dict.word || ""}` : "";
  if (tagRef.current !== tag) {
    tagRef.current = tag;
    if (oracolo) setOracolo(null);
    if (keyOpen) setKeyOpen(false);
    if (all) setAll(false);
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
  const local = primaria || secondaria || elenco;
  const rest = elenco ? tutte : tutte.filter((e) => e.t !== primaria?.t && e.t !== secondaria?.t);
  // se la prima riga e' solo il rimando («plurale di…»), un significato vero
  // in piu' resta visibile senza dover toccare «Altri»
  const shown = (local ? 1 : dict.translation ? 2 : 3) + (dict.entries?.[0]?.forma ? 1 : 0);
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
          borderRadius: 16,
          boxShadow: "0 12px 44px #000000aa",
          padding: "13px 16px 15px",
          animation: "bc-fade-in 0.2s ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: FONT_TITLE, fontSize: 21, fontWeight: 600, color: C.text }}>
            {titolo}
          </span>
          {primaria?.k && <span style={{ fontSize: 11.5, color: C.arcane }}>{primaria.k}</span>}
          {primaria?.r && (
            <span style={{ fontSize: 11.5, color: C.muted, fontStyle: "italic" }}>{primaria.r}</span>
          )}
          {!dict.gloss && dict.foreign && (
            <span style={{ fontSize: 11.5, color: C.muted }}>in lingua originale</span>
          )}
          <button onClick={onClose} style={{ marginLeft: "auto", color: C.muted, fontSize: 17 }}>
            ✕
          </button>
        </div>

        {primaria && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 15.5, color: C.text, lineHeight: 1.5, margin: "0 0 8px" }}>
              {primaria.d}
            </p>
            {primaria.wiki && (
            <a
              href={primaria.wiki}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                fontSize: 13.5,
                color: C.accent,
                border: `1px solid ${C.accent}55`,
                borderRadius: 999,
                padding: "5px 12px",
                textDecoration: "none",
              }}
            >
              Apri sul wiki ↗
            </a>
            )}
            {primaria.wiki && (
              <span style={{ fontSize: 11.5, color: C.muted, marginLeft: 9 }}>di là si spoilera</span>
            )}
          </div>
        )}

        {/* Il rimando al wiki della saga solo se la parola NON esiste in
            inglese: se Wiktionary ha una voce, e' una parola comune e sul
            wiki del Mondo Disco non ci sara' nulla. Vale anche per la sola
            traduzione: se MyMemory sa renderla, e' inglese. Offrirlo a ogni
            parola sconosciuta voleva dire offrirlo quasi sempre a vuoto. */}
        {!primaria && dict.wikiSearch && !dict.loading && !dict.entries.length && !dict.translation && (
          <a
            href={dict.wikiSearch.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              marginBottom: 12,
              fontSize: 13.5,
              color: C.accent,
              border: `1px solid ${C.accent}55`,
              borderRadius: 999,
              padding: "5px 12px",
              textDecoration: "none",
            }}
          >
            Cerca «{dict.wikiSearch.term}» sul wiki ↗
          </a>
        )}

        {secondaria && (
          <div
            style={{
              marginBottom: 12,
              paddingLeft: 10,
              borderLeft: `2px solid ${C.arcane}66`,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 14.5, color: C.text, fontWeight: 600 }}>{secondaria.t}</span>
              {(secondaria.r || secondaria.k) && (
                <span style={{ fontSize: 11.5, color: C.muted, fontStyle: "italic" }}>
                  {secondaria.r || secondaria.k}
                </span>
              )}
            </div>
            <p style={{ fontSize: 15, color: C.text, lineHeight: 1.45, margin: 0 }}>
              {secondaria.d}
            </p>
            {secondaria.wiki && (
              <a
                href={secondaria.wiki}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-block", marginTop: 6, fontSize: 12.5, color: C.accent, textDecoration: "none" }}
              >
                Apri sul wiki ↗
              </a>
            )}
          </div>
        )}

        {rest.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 6 }}>
              {elenco ? "In questa frase riconosco" : "Nel brano riconosco anche"}
            </div>
            {rest.slice(0, 12).map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, alignItems: "baseline" }}>
                {e.wiki ? (
                  <a
                    href={e.wiki}
                    target="_blank"
                    rel="noreferrer"
                    style={{ flexShrink: 0, minWidth: 96, fontSize: 13.5, color: C.accent, fontWeight: 600, textDecoration: "none" }}
                  >
                    {e.t} ↗
                  </a>
                ) : (
                  <span style={{ flexShrink: 0, minWidth: 96, fontSize: 13.5, color: C.text, fontWeight: 600 }}>
                    {e.t}
                  </span>
                )}
                <span style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.4 }}>{e.d}</span>
              </div>
            ))}
            {rest.length > 12 && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                e altre {rest.length - 12} voci
              </div>
            )}
          </div>
        )}

        {dict.translation && (
          <>
            {dict.machine && (
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 2 }}>
                traduzione automatica, solo per orientarsi
              </div>
            )}
            <p
              style={{
                fontSize: dict.machine ? 15 : 16.5,
                color: dict.machine ? C.text : C.accent,
                lineHeight: 1.4,
                margin: "0 0 10px",
              }}
            >
              {dict.translation}
            </p>
          </>
        )}

        {!dict.loading && !local && !dict.idiom && !dict.entries.length && dict.word && !dict.wikiSearch && (
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(`"${dict.word}" meaning`)}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              marginBottom: 10,
              fontSize: 13.5,
              color: C.arcane,
              border: `1px solid ${C.arcane}55`,
              borderRadius: 999,
              padding: "5px 12px",
              textDecoration: "none",
            }}
          >
            Cerca questa espressione ↗
          </a>
        )}

        {dict.loading ? (
          <p style={{ color: C.muted, fontSize: local ? 13 : 14.5 }}>
            {local ? "Cerco anche sul dizionario…" : "Consulto il dizionario…"}
          </p>
        ) : dict.entries.length === 0 && !dict.translation ? (
          // col glossario in mano il dizionario che tace non e' una notizia:
          // la domanda ha gia' avuto risposta
          local ? null : (
            <p style={{ color: C.muted, fontSize: 14.5, lineHeight: 1.5 }}>
              {dict.offline
                ? "Il dizionario ha bisogno della rete: riprova quando sei online."
                : dict.frase
                  ? "Questo passaggio non è un modo di dire che conosco, e nemmeno Wiktionary ne ha una voce."
                  : `Nessuna voce per «${dict.word}».`}
            </p>
          )
        ) : (
          <>
            {(all ? dict.entries : dict.entries.slice(0, shown)).map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 9, marginBottom: 9 }}>
                {e.pos && (
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 11.5,
                      color: C.arcane,
                      fontStyle: "italic",
                      paddingTop: 3,
                      minWidth: 66,
                    }}
                  >
                    {e.pos}
                  </span>
                )}
                <span style={{ fontSize: 15, color: C.text, lineHeight: 1.45 }}>{e.text}</span>
              </div>
            ))}
            {!all && dict.entries.length > shown && (
              <button onClick={() => setAll(true)} style={{ fontSize: 13.5, color: C.accent, paddingTop: 2 }}>
                Altri {dict.entries.length - shown} significati
              </button>
            )}
          </>
        )}

        {/* L'Oracolo: glossario e dizionario spiegano parole e modi di dire,
            ma il senso di una battuta sta nel paragrafo. Si offre sempre,
            anche quando una risposta di casa c'e' gia'. */}
        {(dict.raw || dict.word) && !dict.loading && (
          <div style={{ marginTop: 10, paddingTop: 11, borderTop: `1px solid ${C.border}66` }}>
            {oracolo?.answer ? (
              <>
                <div style={{ fontSize: 11.5, color: C.arcane, marginBottom: 4 }}>✨ L'Oracolo dice</div>
                <p style={{ fontSize: 15, color: C.text, lineHeight: 1.5, margin: 0 }}>{oracolo.answer}</p>
              </>
            ) : oracolo?.loading ? (
              <p style={{ fontSize: 13.5, color: C.muted, margin: 0 }}>✨ L'Oracolo sta leggendo il passaggio…</p>
            ) : oracolo?.error === "chiave" ? (
              <div>
                <p style={{ fontSize: 13.5, color: C.muted, margin: "0 0 8px" }}>
                  L'Oracolo non ha accettato la chiave.
                </p>
                <button
                  onClick={() => { setOracolo(null); setKeyOpen(true); }}
                  style={{ fontSize: 13.5, color: C.arcane, border: `1px solid ${C.arcane}55`, borderRadius: 999, padding: "5px 12px" }}
                >
                  Cambia chiave
                </button>
              </div>
            ) : oracolo?.error ? (
              <div>
                <p style={{ fontSize: 13.5, color: C.muted, margin: "0 0 8px" }}>
                  {oracolo.error === "rete"
                    ? "L'Oracolo ha bisogno della rete: riprova quando sei online."
                    : "L'Oracolo non ha risposto: riprova tra un momento."}
                </p>
                <button
                  onClick={chiedi}
                  style={{ fontSize: 13.5, color: C.arcane, border: `1px solid ${C.arcane}55`, borderRadius: 999, padding: "5px 12px" }}
                >
                  Riprova
                </button>
              </div>
            ) : keyOpen ? (
              <div>
                <p style={{ fontSize: 13, color: C.muted, margin: "0 0 8px", lineHeight: 1.45 }}>
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
                      borderRadius: 8,
                      padding: "7px 10px",
                      fontSize: 14,
                      color: C.text,
                    }}
                  />
                  <button
                    onClick={salvaChiave}
                    style={{ flexShrink: 0, fontSize: 13.5, color: C.arcane, border: `1px solid ${C.arcane}55`, borderRadius: 999, padding: "5px 12px" }}
                  >
                    Salva e chiedi
                  </button>
                </div>
              </div>
            ) : hasOracle() ? (
              <button
                onClick={chiedi}
                style={{ fontSize: 13.5, color: C.arcane, border: `1px solid ${C.arcane}55`, borderRadius: 999, padding: "5px 12px" }}
              >
                ✨ Spiegami questo passaggio
              </button>
            ) : (
              <button
                onClick={() => setKeyOpen(true)}
                style={{ fontSize: 12.5, color: C.muted, textAlign: "left", padding: 0, lineHeight: 1.45 }}
              >
                ✨ L'Oracolo può spiegarti cosa vuol dire qui, nel contesto del libro — serve una
                chiave API, tocca per impostarla
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

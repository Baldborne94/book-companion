import { useEffect, useRef, useState } from "react";
import { C, FONT_TITLE, F, R, px } from "../data/constants.js";
import { lemmaDoppione, lookup, lookupPhrase, wordCount } from "../lib/dictionary.js";
import { statoDizionario, scaricaDizionario, cartellinoInRete } from "../lib/dizionarioOffline.js";
import { consultaOracolo, hasOracle, setOracleKey } from "../lib/oracle.js";
import { rigaUltima, rigaMese, riassunto, costo, leggiTetto } from "../lib/spesa.js";
import { TettoFinito } from "./TettoOracolo.jsx";
import { chiaveGlossario, vociDi, salvaVoci, aggiungi, togli, cerca } from "../lib/glossarioMio.js";

// La scheda del dizionario e' identica nei due reader: qui una volta sola,
// cosi' EPUB e PDF non divergono. Risponde con quello che il tablet non puo'
// sapere — glossario della saga, modi di dire, l'Oracolo — e con la voce di
// vocabolario, prima dal disco e poi dalla rete.
// LA VOCE, RIFATTA (chiesto dal lettore: «il dizionario non mi piace come
// e' stato fatto» — le definizioni, l'impaginazione, la lentezza).
//
// L'ordine e' quello con cui uno legge una voce bilingue: PRIMA la resa
// italiana, grande, per categoria grammaticale — e' la risposta alla
// domanda che si fa toccando una parola — e POI le definizioni in inglese,
// numerate, con la loro resa accanto quando il senso ce l'ha. Le prime
// quattro in vista, il resto ripiegato: otto sensi in fila erano il muro
// che rendeva la scheda illeggibile.
//
// La resa italiana viene da MultiWordNet, sul dispositivo: e' un dizionario,
// non una traduzione a macchina, e per questo sta in cima senza avvisi.
// MyMemory resta solo dove il disco tace, con la sua banda che lo dice.
const SENSI_IN_VISTA = 4;

// la BANDA dice da dove viene la risposta, come sul Collins del tablet
function banda(testo) {
  return (
    <div
      style={{
        padding: "5px 12px",
        background: `${C.surface}e6`,
        borderBottom: `1px solid ${C.border}`,
        borderTop: `1px solid ${C.border}`,
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

function Voce({ dict, titolo }) {
  const entries = dict.entries || [];
  const italiano = dict.italiano || [];
  const [tutte, setTutte] = useState(false);
  if (!entries.length && !dict.translation && !italiano.length) return null;
  const lingua = (dict.lang || "en") === "en" ? "inglese" : (dict.lang || "").toUpperCase();
  const lemma = dict.lemma || dict.word;
  const dueVolte = lemmaDoppione(dict, titolo);
  const mostrate = tutte ? entries : entries.slice(0, SENSI_IN_VISTA);
  const nascoste = entries.length - mostrate.length;
  const etichetta = (pos) => (
    <span
      style={{
        flexShrink: 0,
        fontSize: F.minuscolo,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: C.arcane,
      }}
    >
      {pos}
    </span>
  );

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
      {!dueVolte && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "9px 12px 0" }}>
          <span style={{ fontSize: F.corpo, fontWeight: 600, color: C.text }}>{lemma}</span>
          {dict.forma && (
            <span style={{ fontSize: F.minuscolo, color: C.muted, fontStyle: "italic" }}>
              ({dict.forma} «{dict.lemma}»)
            </span>
          )}
        </div>
      )}

      {italiano.length > 0 ? (
        <div style={{ padding: "9px 12px 11px" }}>
          {italiano.map((g) => (
            <div key={g.pos} style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 4 }}>
              {g.pos && etichetta(g.pos)}
              <span style={{ fontSize: F.rilievo, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>
                {g.parole.join(", ")}
              </span>
            </div>
          ))}
        </div>
      ) : dict.translation ? (
        <>
          {banda(dict.machine ? "Reso a macchina, dall'inglese" : "Dall'inglese all'italiano")}
          <div style={{ padding: "8px 12px 10px" }}>
            <span style={{ fontSize: F.rilievo, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>
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
      ) : null}

      {entries.length > 0 && (
        <>
          {/* la banda dice la fonte, come sul Collins: una definizione di
              WordNet è più scarna di una di Wiktionary, e sapere da dove
              viene è la differenza fra «il dizionario oggi dice poco» e
              «questa è la voce che sta sul dispositivo» — e dice anche se
              la rete sta ancora cercando */}
          {banda(
            `${dict.dalDisco ? "WordNet · sul dispositivo" : `Wiktionary · ${lingua}`}${dict.cercando ? " · cerco anche in rete…" : ""}`
          )}
          <div style={{ padding: "9px 12px 11px" }}>
            {mostrate.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7 }}>
                <span style={{ flexShrink: 0, fontSize: F.piccolo, color: C.accent, minWidth: 12 }}>
                  {i + 1}
                </span>
                <div style={{ minWidth: 0 }}>
                  {e.pos && <span style={{ marginRight: 7 }}>{etichetta(e.pos)}</span>}
                  <span style={{ fontSize: F.nota, color: C.text, lineHeight: 1.5 }}>{e.text}</span>
                  {/* la resa del SINGOLO senso, quando c'è: è quel che dice
                      quale dei cinque sensi è «gatto» e quale «vomitare» */}
                  {e.ita?.length > 0 && (
                    <span style={{ fontSize: F.nota, color: C.accent, marginLeft: 6 }}>— {e.ita.join(", ")}</span>
                  )}
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
                          {s.pos && <span style={{ marginRight: 6 }}>{etichetta(s.pos)}</span>}
                          {s.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {nascoste > 0 && (
              <button
                onClick={() => setTutte(true)}
                style={{ fontSize: F.piccolo, color: C.muted, padding: "4px 0 0 20px", minHeight: 32 }}
              >
                {nascoste === 1 ? "un altro senso" : `altri ${nascoste} sensi`} ▾
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// IL DIZIONARIO SI SCARICA ANCHE DA QUI. Stava solo nelle Impostazioni — e
// il ragionamento era giusto: si scarica PRIMA di averne bisogno. Ma da
// quando la resa italiana viene dal disco, chi non l'ha scaricato apre la
// scheda e non capisce perche' la parola gli arriva solo in inglese: il
// posto dove si nota la mancanza e' anche il posto dove va offerto il
// rimedio. Un tocco, e la scheda si rilegge da sola.
function ScaricaQui({ cartellino, onFatto }) {
  const [avanzamento, setAvanzamento] = useState(null);
  const [guaio, setGuaio] = useState("");
  const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
  async function scarica() {
    if (avanzamento) return;
    setGuaio("");
    setAvanzamento({ scaricati: 0, totale: cartellino?.byte || null });
    try {
      await scaricaDizionario({ onProgress: setAvanzamento });
      onFatto();
    } catch (e) {
      setGuaio(e?.message || "non sono riuscito a scaricarlo");
    } finally {
      setAvanzamento(null);
    }
  }
  return (
    <div style={{ marginBottom: 12, padding: "9px 12px", border: `1px dashed ${C.border}`, borderRadius: R.piccolo }}>
      <p style={{ margin: "0 0 8px", fontSize: F.piccolo, color: C.muted, lineHeight: 1.45 }}>
        Col dizionario sul dispositivo la scheda dice la parola <strong>in italiano</strong>, subito e
        anche senza rete.
      </p>
      {guaio && <p style={{ margin: "0 0 8px", fontSize: F.minuscolo, color: C.red }}>{guaio}</p>}
      <button
        onClick={scarica}
        disabled={!!avanzamento}
        style={{
          minHeight: 40,
          fontSize: F.piccolo,
          color: avanzamento ? C.muted : C.arcane,
          border: `1px solid ${C.arcane}55`,
          borderRadius: R.tondo,
          padding: "6px 14px",
        }}
      >
        {avanzamento
          ? `Scarico… ${mb(avanzamento.scaricati)}${avanzamento.totale ? ` di ${mb(avanzamento.totale)}` : ""}`
          : `📖 Scarica il dizionario${cartellino?.byte ? ` · ${mb(cartellino.byte)}` : ""}`}
      </button>
    </div>
  );
}


export default function DictionaryCard({ dict: dictProp, book, alto, onClose }) {
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
  // il dizionario sul dispositivo: `null` = non c'e', e allora la scheda
  // offre di scaricarlo; `extra` e' la voce riletta dopo lo scaricamento,
  // che il reader non sa rifare da solo
  const [installato, setInstallato] = useState(undefined);
  const [cartellino, setCartellino] = useState(null);
  const [extra, setExtra] = useState(null);
  // la scheda resta montata tra una selezione e l'altra: la risposta della
  // frase di prima non deve comparire sotto la frase nuova
  const tagRef = useRef();
  const tag = dictProp ? `${dictProp.raw || ""}|${dictProp.word || ""}` : "";
  if (tagRef.current !== tag) {
    tagRef.current = tag;
    if (oracolo) setOracolo(null);
    if (keyOpen) setKeyOpen(false);
    if (glossOpen) setGlossOpen(false);
  }
  const dict = extra && extra.tag === tag ? { ...dictProp, ...extra.res, loading: false, cercando: false } : dictProp;

  useEffect(() => {
    let vivo = true;
    statoDizionario().then((s) => vivo && setInstallato(s));
    cartellinoInRete().then((c) => vivo && setCartellino(c));
    return () => {
      vivo = false;
    };
  }, []);

  async function riletta() {
    setInstallato(await statoDizionario());
    const raw = dictProp?.raw?.trim() || dictProp?.word || "";
    if (!raw) return;
    const mio = tag;
    const cerca = wordCount(raw) > 1 ? lookupPhrase : lookup;
    const res = await cerca(raw, dictProp.lang || "en").catch(() => null);
    if (res && tagRef.current === mio) setExtra({ tag: mio, res });
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
        // LA SCHEDA STA IN CIMA, come il menu da cui si apre: sotto c'è la
        // scheda di dizionario che Android apre sulla selezione, appoggiata
        // al bordo e sempre alla stessa altezza, e le due si coprivano a
        // vicenda. Sopra non ci arriva. Il passaggio che stai leggendo resta
        // scoperto lo stesso — prima restava scoperto quello sopra, adesso
        // quello sotto — quindi non si perde niente.
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          // LA COLONNA DI UNA VOCE DI VOCABOLARIO E' UNA LUNGHEZZA DI RIGA:
          // ferma a 460 mentre la scrittura cresce, la riga si accorcia in
          // caratteri e la definizione si spezza in tre pezzi con mezzo
          // schermo vuoto ai lati. Passa per `px` come le altre colonne.
          // una voce bilingue ha due colonne di roba da dire: piu' larga di
          // prima, e piu' alta, o la resa italiana in cima spingeva le
          // definizioni sotto la piega
          width: `min(94%, ${px(560)}px)`,
          marginTop: alto,
          maxHeight: "62%",
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

        <Voce key={tag} dict={dict} titolo={titolo} />

        {/* il dizionario manca e la parola e' inglese: qui si vede la
            mancanza, e qui si offre il rimedio */}
        {installato === null && !dict.loading && (dict.lang || "en") === "en" && !!dict.word && (
          <ScaricaQui cartellino={cartellino} onFatto={riletta} />
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
          <p style={{ color: C.muted, fontSize: F.nota }}>Cerco…</p>
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

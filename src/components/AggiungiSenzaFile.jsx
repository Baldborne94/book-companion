import { useState } from "react";
import { C, TEMA, FONT_TITLE, F, R, px } from "../data/constants.js";
import { sagaDalNome, saghePerAutore, libriDellaSaga } from "../lib/sagaDaNome.js";
import { sagaDelLibro, fraseSagaDelLibro, raccolteDellAutore } from "../lib/sagaDelLibro.js";
import { giaSulloScaffale } from "../lib/senzaFile.js";

const prendi = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout?.(20000) });
  if (!r.ok) throw new Error(`Wikidata ${r.status}`);
  return r.json();
};

const tasto = (colore, pieno = false) => ({
  minHeight: 44,
  padding: "8px 16px",
  borderRadius: R.piccolo,
  border: `1px solid ${colore}88`,
  background: pieno ? `${colore}22` : "transparent",
  color: colore,
  fontSize: F.piccolo,
  whiteSpace: "nowrap",
});

const campo = (largo = 180) => ({
  flex: `1 1 ${largo}px`,
  minWidth: 0,
  minHeight: 44,
  padding: "8px 12px",
  borderRadius: R.piccolo,
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.text,
  fontSize: F.corpo,
});

// AGGIUNGERE SENZA FILE (`lib/senzaFile.js`, `lib/sagaDaNome.js`): una saga
// dal suo nome — l'elenco si mostra prima di scriverlo, e si toglie quel
// che non si vuole — o un libro solo. Le schede entrano senza ebook, con la
// copertina dal catalogo; il file si sceglie poi dalla scheda.
export default function AggiungiSenzaFile({ books = [], onAggiungi, onClose }) {
  const [nome, setNome] = useState("");
  const [cerca, setCerca] = useState(null);
  const [esito, setEsito] = useState(null);
  const [tolti, setTolti] = useState(() => new Set());
  const [raccolta, setRaccolta] = useState("");
  const VUOTO = { titolo: "", autore: "", saga: "", serie: "", numero: "" };
  const [libro, setLibro] = useState(VUOTO);
  // di che saga e' il libro solo: la proposta e da dove viene
  const [riconosco, setRiconosco] = useState(null);
  // la ricerca per autore: le sue saghe, e un tocco porta l'elenco dei libri
  const [chi, setChi] = useState("");
  const [saghe, setSaghe] = useState(null);
  const [cercaAutore, setCercaAutore] = useState(null);

  async function trova(e) {
    e.preventDefault();
    const n = nome.trim();
    if (!n) return;
    setCerca("cerco");
    setEsito(null);
    try {
      const r = await sagaDalNome(n, { libri: books, prendi });
      setEsito(r && r.volumi.length ? r : { vuota: true, senzaLibri: r?.nome || "" });
      setRaccolta(r?.saga || "");
      setTolti(new Set());
      setCerca(null);
    } catch {
      setCerca("guasto");
    }
  }

  async function trovaAutore(e) {
    e.preventDefault();
    const n = chi.trim();
    if (!n) return;
    setCercaAutore("cerco");
    setSaghe(null);
    try {
      setSaghe((await saghePerAutore(n, { prendi })) || { vuoto: true });
      setCercaAutore(null);
    } catch {
      setCercaAutore("guasto");
    }
  }

  async function apriSaga(voce) {
    setCerca("cerco");
    setEsito(null);
    try {
      const r = await libriDellaSaga(voce, { libri: books, prendi });
      setEsito(r && r.volumi.length ? r : { vuota: true, senzaLibri: r?.nome || "" });
      setRaccolta(r?.saga || "");
      setTolti(new Set());
      setCerca(null);
    } catch {
      setCerca("guasto");
    }
  }

  async function diCheSaga() {
    const voce = { titolo: libro.titolo.trim(), autore: libro.autore.trim() };
    if (!voce.titolo) return;
    setRiconosco({ stato: "cerco" });
    try {
      const r = await sagaDelLibro(voce, books, { prendi });
      if (r) setLibro((l) => ({ ...l, saga: r.saga, serie: r.serie || "", numero: r.numero != null ? String(r.numero) : "" }));
      setRiconosco({ frase: fraseSagaDelLibro(r, voce.autore) });
    } catch {
      setRiconosco({ stato: "guasto" });
    }
  }

  const sueRaccolte = raccolteDellAutore(libro.autore, books);
  // chiesto dal lettore: «se un libro o una saga sono già presenti non me li
  // aggiungere di nuovo» — e lo si dice prima del tasto
  const giaQui = !!libro.titolo.trim() && giaSulloScaffale(libro, books);

  const daAggiungere = esito?.volumi ? esito.volumi.filter((v, i) => !v.gia && !tolti.has(i)) : [];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, overflowY: "auto", background: TEMA.gradient, animation: "bc-fade-in 0.35s ease-out" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 5, padding: "12px 14px", background: `${C.surface}f2`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onClose} aria-label="Chiudi" style={{ width: 44, height: 44, borderRadius: R.piccolo, fontSize: F.titoletto, color: C.text }}>
            ✕
          </button>
          <h2 style={{ flex: 1, minWidth: 0, fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text }}>📥 Aggiungi senza file</h2>
        </div>
      </div>

      <div style={{ maxWidth: px(720), margin: "0 auto", padding: "18px 16px 48px" }}>
        <p style={{ fontSize: F.piccolo, color: C.muted, lineHeight: 1.5, marginBottom: 18 }}>
          La scheda entra sullo scaffale con la sua copertina, senza ebook. Quando avrai il file, apri la scheda e tocca «📂 Scegli
          il file»: entra lì.
        </p>

        <h3 style={{ fontFamily: FONT_TITLE, fontSize: F.titoletto, color: C.accent, marginBottom: 6 }}>Una saga intera, o le saghe di un autore</h3>
        <form onSubmit={trova} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Il nome della saga, es. Gaunt's Ghosts" aria-label="Nome della saga" style={campo(240)} />
          <button type="submit" disabled={!nome.trim() || cerca === "cerco"} style={{ ...tasto(C.accent, true), opacity: nome.trim() ? 1 : 0.5 }}>
            {cerca === "cerco" ? "Cerco…" : "🔍 Cerca i libri"}
          </button>
        </form>
        {/* O UN AUTORE (chiesto dal lettore: «permettimi la ricerca per
            autore così da sapere che saghe ha fatto»): le sue saghe, e un
            tocco ne porta i libri nell'elenco qui sotto */}
        <form onSubmit={trovaAutore} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <input value={chi} onChange={(e) => setChi(e.target.value)} placeholder="Oppure un autore, es. Brandon Sanderson" aria-label="Autore delle saghe" style={campo(240)} />
          <button type="submit" disabled={!chi.trim() || cercaAutore === "cerco"} style={{ ...tasto(C.accent, true), opacity: chi.trim() ? 1 : 0.5 }}>
            {cercaAutore === "cerco" ? "Cerco…" : "🔍 Le sue saghe"}
          </button>
        </form>
        {cercaAutore === "guasto" && <p style={{ fontSize: F.piccolo, color: C.accent, marginBottom: 12 }}>Wikidata non risponde adesso: riprova fra poco.</p>}
        {saghe?.vuoto && <p style={{ fontSize: F.piccolo, color: C.muted, marginBottom: 12 }}>Non ho trovato saghe di questo autore. Prova col nome completo, com'è scritto in copertina.</p>}
        {saghe?.saghe && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: F.piccolo, color: C.muted, marginBottom: 6 }}>Le saghe di {saghe.autore}: toccane una per vederne i libri.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {saghe.saghe.map((v) => (
                <button key={`${v.fonte}:${v.q || v.universo || v.saga}`} onClick={() => apriSaga(v)} style={tasto(v.fonte === "guida" ? C.accent : C.text)}>
                  {v.universo ? "🌐 " : v.fonte === "guida" ? "📜 " : v.fonte === "sciolti" ? "📚 " : ""}
                  {v.nome} · {v.quanti === 1 ? "1 libro" : `${v.quanti} libri`}
                </button>
              ))}
            </div>
          </div>
        )}
        {cerca === "guasto" && <p style={{ fontSize: F.piccolo, color: C.accent, marginBottom: 12 }}>Wikidata non risponde adesso: riprova fra poco.</p>}
        {esito?.vuota && (
          <p style={{ fontSize: F.piccolo, color: C.muted, lineHeight: 1.5, marginBottom: 12 }}>
            {esito.senzaLibri
              ? `Wikidata conosce «${esito.senzaLibri}», ma non dice quali libri ne fanno parte. Aggiungili uno per volta qui sotto: «🔍 Di che saga è?» ti propone la raccolta.`
              : "Non ho trovato una saga con questo nome, né fra le guide dell'app né su Wikidata. Prova col nome inglese, o aggiungi i libri uno per volta qui sotto."}
          </p>
        )}
        {esito?.volumi && (
          <div style={{ marginBottom: 26 }}>
            <p style={{ fontSize: F.piccolo, color: C.muted, lineHeight: 1.5, marginBottom: 8 }}>
              {esito.universo
                ? `«${esito.nome}»: tutte le guide dell'app di questo mondo, una dopo l'altra, ognuna coi suoi numeri.`
                : esito.fonte === "guida"
                ? `«${esito.nome}»: l'elenco della guida dell'app, nell'ordine di lettura.`
                : esito.fonte === "sciolti"
                ? "I suoi libri che su Wikidata non stanno in nessuna serie, per anno di uscita. Spunta quelli di una saga, scrivi qui sotto la raccolta e aggiungili. Un libro appena uscito può non esserci ancora."
                : `«${esito.nome}» su Wikidata${esito.perAnno ? ", in ordine di uscita (lì i volumi non hanno il numero)" : ", nell'ordine della serie"}. Controlla l'elenco: per alcune saghe Wikidata è incompleto.`}
            </p>
            <label style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10, fontSize: F.piccolo, color: C.muted }}>
              Nella raccolta
              <input value={raccolta} onChange={(e) => setRaccolta(e.target.value)} aria-label="Raccolta" style={campo(200)} />
            </label>
            {esito.volumi.map((v, i) => (
              <label key={`${v.numero}-${v.titolo}`} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "4px 0", borderBottom: `1px solid ${C.border}44`, opacity: v.gia ? 0.6 : 1 }}>
                <input
                  type="checkbox"
                  disabled={v.gia}
                  checked={!v.gia && !tolti.has(i)}
                  onChange={() => setTolti((t) => { const n = new Set(t); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                  style={{ width: 22, height: 22 }}
                />
                <span style={{ width: px(44), flexShrink: 0, color: C.muted, fontSize: F.piccolo }}>{v.numero != null ? `n° ${v.numero}` : ""}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: F.nota, color: C.text, overflowWrap: "anywhere" }}>{v.titolo}</span>
                  <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted }}>{[v.autore, v.anno, v.gia ? "✓ è già sullo scaffale" : null].filter(Boolean).join(" · ")}</span>
                </span>
              </label>
            ))}
            <button
              disabled={!daAggiungere.length}
              onClick={() => onAggiungi(daAggiungere.map((v) => ({ ...v, saga: raccolta.trim() || v.saga })))}
              style={{ ...tasto(C.accent, true), marginTop: 12, opacity: daAggiungere.length ? 1 : 0.5 }}
            >
              {daAggiungere.length ? `📥 Aggiungi ${daAggiungere.length === 1 ? "1 scheda" : `${daAggiungere.length} schede`}` : "Li hai già tutti"}
            </button>
          </div>
        )}

        <h3 style={{ fontFamily: FONT_TITLE, fontSize: F.titoletto, color: C.accent, margin: "8px 0 6px" }}>Un libro solo</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!libro.titolo.trim() || giaQui) return;
            onAggiungi([libro]);
            setLibro(VUOTO);
            setRiconosco(null);
          }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <input value={libro.titolo} onChange={(e) => { setLibro({ ...libro, titolo: e.target.value }); setRiconosco(null); }} placeholder="Titolo" aria-label="Titolo" style={campo(220)} />
          <input value={libro.autore} onChange={(e) => setLibro({ ...libro, autore: e.target.value })} placeholder="Autore" aria-label="Autore" style={campo(180)} />
          <input value={libro.saga} onChange={(e) => setLibro({ ...libro, saga: e.target.value, serie: "" })} placeholder="Saga (facoltativa)" aria-label="Saga" style={campo(180)} />
          <input value={libro.numero} onChange={(e) => setLibro({ ...libro, numero: e.target.value })} placeholder="N°" aria-label="Numero" inputMode="decimal" style={{ ...campo(60), flex: "0 1 80px" }} />
          <button type="submit" disabled={!libro.titolo.trim() || giaQui} style={{ ...tasto(C.accent, true), opacity: libro.titolo.trim() && !giaQui ? 1 : 0.5 }}>
            📥 Aggiungi
          </button>
        </form>
        {giaQui && <p style={{ fontSize: F.piccolo, color: C.accent, marginTop: 8 }}>✓ Questo libro è già sullo scaffale: non lo aggiungo di nuovo.</p>}
        {/* DI CHE SAGA E'? (chiesto dal lettore: «se cerco un libro riesci a
            riconoscermi a quale saga appartiene di quelle che ho già
            creato?»): si propone, il campo resta suo */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          <button type="button" onClick={diCheSaga} disabled={!libro.titolo.trim() || riconosco?.stato === "cerco"} style={{ ...tasto(C.accent), opacity: libro.titolo.trim() ? 1 : 0.5 }}>
            {riconosco?.stato === "cerco" ? "Cerco…" : "🔍 Di che saga è?"}
          </button>
          {riconosco?.frase && <span style={{ flex: "1 1 240px", fontSize: F.piccolo, color: C.muted, lineHeight: 1.5 }}>{riconosco.frase}</span>}
          {riconosco?.stato === "guasto" && <span style={{ fontSize: F.piccolo, color: C.accent }}>Wikidata non risponde adesso: riprova fra poco.</span>}
        </div>
        {sueRaccolte.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: F.piccolo, color: C.muted, marginBottom: 6 }}>Le tue raccolte con libri di quest'autore:</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {sueRaccolte.map((r) => (
                <button key={r.saga} type="button" onClick={() => setLibro((l) => ({ ...l, saga: r.saga, serie: "" }))} style={tasto(r.saga === libro.saga ? C.accent : C.text, r.saga === libro.saga)}>
                  {r.saga} · {r.quanti}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

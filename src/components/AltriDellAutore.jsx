import { useEffect, useState } from "react";
import { C, F, R } from "../data/constants.js";
import { opereDi, perSaga, fraseGruppo, idDaPrendere, IN_VISTA } from "../lib/altriDellAutore.js";
import { leggiDaPrendere, scriviDaPrendere, tieni } from "../lib/daPrendere.js";

const prendi = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout?.(20000) });
  if (!r.ok) throw new Error(`Wikidata ${r.status}`);
  return r.json();
};

const tasto = (colore) => ({
  minHeight: 44,
  padding: "8px 14px",
  borderRadius: R.tondo,
  border: `1px solid ${colore}66`,
  color: colore,
  fontSize: F.piccolo,
  whiteSpace: "nowrap",
});

// Una saga dell'autore: il nome, quanti libri, quanti ne hai; sotto, solo
// quelli che mancano, nel loro ordine. Una saga che hai tutta sta in una riga.
function Gruppo({ g, autore, onMetti }) {
  const [tutti, setTutti] = useState(false);
  const mostrati = tutti ? g.mancano : g.mancano.slice(0, IN_VISTA);
  const completa = !g.mancano.length;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", minHeight: 32 }}>
        <span style={{ fontSize: F.nota, color: C.text, fontWeight: 600 }}>{g.saga || "Altri libri"}</span>
        <span style={{ fontSize: F.minuscolo, color: C.muted }}>{g.totale === 1 ? "1 libro" : `${g.totale} libri`}</span>
        <span style={{ fontSize: F.piccolo, color: completa ? C.green : C.accent, marginLeft: "auto" }}>{fraseGruppo(g)}</span>
      </div>
      {!g.saga && g.mancano.length > 0 && (
        <p style={{ fontSize: F.minuscolo, color: C.muted, margin: "0 0 6px" }}>Wikidata non li lega a una saga.</p>
      )}
      {mostrati.map((l) => (
        <div key={l.titolo} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0 6px 12px", borderLeft: `2px solid ${C.border}` }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: F.nota, color: C.text, overflowWrap: "anywhere" }}>
            {l.numero != null && <span style={{ color: C.muted }}>#{l.numero} </span>}
            {l.titolo}
            {l.anno && <span style={{ color: C.muted, fontSize: F.minuscolo }}> · {l.anno}</span>}
          </span>
          {l.gia ? (
            <span style={{ fontSize: F.piccolo, color: C.green, whiteSpace: "nowrap" }}>✓ in Da prendere</span>
          ) : (
            <button onClick={() => onMetti(l)} aria-label={`Metti «${l.titolo}» in Da prendere`} style={tasto(C.accent)}>
              ＋ Da prendere
            </button>
          )}
        </div>
      ))}
      {g.mancano.length > mostrati.length && (
        <button onClick={() => setTutti(true)} style={{ ...tasto(C.muted), border: "none", padding: "6px 12px" }}>
          altri {g.mancano.length - mostrati.length} ▾
        </button>
      )}
    </div>
  );
}

function Autore({ autore, books, onMesso }) {
  const [libri, setLibri] = useState(null);
  const [guasto, setGuasto] = useState(false);
  const [lista, setLista] = useState(leggiDaPrendere);
  useEffect(() => {
    let vivo = true;
    opereDi(autore, prendi)
      .then((l) => vivo && setLibri(l))
      .catch(() => vivo && setGuasto(true));
    return () => {
      vivo = false;
    };
  }, [autore]);
  const titolo = <div style={{ fontSize: F.corpo, color: C.accent, fontWeight: 600, margin: "0 0 8px" }}>{autore}</div>;
  if (guasto) return <div style={{ marginBottom: 18 }}>{titolo}<p style={{ fontSize: F.piccolo, color: C.muted, margin: 0 }}>Wikidata non risponde adesso: riprovo la prossima volta che apri la raccolta.</p></div>;
  if (!libri) return <div style={{ marginBottom: 18 }}>{titolo}<p style={{ fontSize: F.piccolo, color: C.muted, margin: 0 }}>Cerco i suoi libri…</p></div>;
  if (!libri.length) return <div style={{ marginBottom: 18 }}>{titolo}<p style={{ fontSize: F.piccolo, color: C.muted, margin: 0 }}>Wikidata non conosce i suoi libri.</p></div>;
  const gruppi = perSaga(libri, books, lista, autore);
  const metti = (l) => {
    const nuova = tieni(leggiDaPrendere(), { id: idDaPrendere(l, autore), titolo: l.titolo, autore, saga: l.saga || "", numero: l.numero });
    scriviDaPrendere(nuova);
    setLista(nuova);
    onMesso?.(l);
  };
  return (
    <div style={{ marginBottom: 22 }}>
      {titolo}
      {gruppi.map((g) => (
        <Gruppo key={g.saga || "~"} g={g} autore={autore} onMetti={metti} />
      ))}
    </div>
  );
}

// GLI ALTRI LIBRI DEGLI AUTORI CHE SEGUI (`lib/altriDellAutore.js`): in fondo
// alla raccolta seguita, un blocco per autore, una riga per saga.
export default function AltriDellAutore({ autori = [], books = [], notify }) {
  if (!autori.length) return null;
  return (
    <section style={{ marginTop: 28, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
      <h3 style={{ fontSize: F.corpo, color: C.text, margin: "0 0 4px", fontWeight: 600 }}>📚 I libri dei tuoi autori</h3>
      <p style={{ fontSize: F.piccolo, color: C.muted, lineHeight: 1.45, margin: "0 0 14px" }}>
        Saga per saga, coi titoli originali: quanti ne hai e quali ti mancano. «＋ Da prendere» li segna nella lista. Da Wikidata.
      </p>
      {autori.map((a) => (
        <Autore key={a} autore={a} books={books} onMesso={(l) => notify?.(`🛒 «${l.titolo}» in Da prendere`)} />
      ))}
    </section>
  );
}

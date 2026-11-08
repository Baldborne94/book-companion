import { useEffect, useState } from "react";
import { C, F, R, px } from "../data/constants.js";
import { altriLibri, opereDi, IN_VISTA } from "../lib/altriDellAutore.js";
import { leggiDaPrendere, scriviDaPrendere, tieni } from "../lib/daPrendere.js";
import { urlCopertina } from "../lib/consigliLiberi.js";

const prendi = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout?.(20000) });
  if (!r.ok) throw new Error(`Open Library ${r.status}`);
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

// Un autore: i suoi libri che non hai, dal piu' nuovo, i primi in vista e il
// resto dietro un tasto col conto. Un tocco li mette in «Da prendere».
function Autore({ autore, books, onMesso }) {
  const [docs, setDocs] = useState(null);
  const [guasto, setGuasto] = useState(false);
  const [tutti, setTutti] = useState(false);
  const [lista, setLista] = useState(leggiDaPrendere);
  useEffect(() => {
    let vivo = true;
    opereDi(autore, prendi)
      .then((d) => vivo && setDocs(d))
      .catch(() => vivo && setGuasto(true));
    return () => {
      vivo = false;
    };
  }, [autore]);
  if (guasto) return <p style={{ fontSize: F.piccolo, color: C.muted, margin: "0 0 12px" }}>Open Library non risponde adesso: i libri di {autore} li cerco la prossima volta.</p>;
  if (!docs) return <p style={{ fontSize: F.piccolo, color: C.muted, margin: "0 0 12px" }}>Cerco i libri di {autore}…</p>;
  const libri = altriLibri(autore, docs, books, lista);
  const mostrati = tutti ? libri : libri.slice(0, IN_VISTA);
  const metti = (v) => {
    const nuova = tieni(leggiDaPrendere(), { id: v.id, titolo: v.titolo, autore: v.autore });
    scriviDaPrendere(nuova);
    setLista(nuova);
    onMesso?.(v);
  };
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: F.nota, fontWeight: 600, color: C.accent, marginBottom: 6 }}>
        {autore}
        <span style={{ fontWeight: 400, color: C.muted }}>{libri.length ? ` · ${libri.length === 1 ? "1 libro che non hai" : `${libri.length} libri che non hai`}` : ""}</span>
      </div>
      {!libri.length && <p style={{ fontSize: F.piccolo, color: C.muted, margin: 0 }}>Hai già tutti i suoi libri che Open Library conosce.</p>}
      {mostrati.map((v) => {
        const src = urlCopertina(v.copertina, "S");
        return (
          <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, padding: "8px 12px", borderRadius: R.piccolo, border: `1px dashed ${C.border}` }}>
            {src ? (
              <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" style={{ width: px(32), height: px(48), objectFit: "cover", borderRadius: R.minimo, flexShrink: 0, background: C.border }} />
            ) : (
              <span style={{ width: px(32), height: px(48), borderRadius: R.minimo, flexShrink: 0, background: C.border }} />
            )}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: F.nota, color: C.text, overflowWrap: "anywhere" }}>{v.titolo}</span>
              {v.anno && <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted }}>{v.anno}</span>}
            </span>
            {v.gia ? (
              <span style={{ fontSize: F.piccolo, color: C.green, whiteSpace: "nowrap" }}>✓ in Da prendere</span>
            ) : (
              <button onClick={() => metti(v)} aria-label={`Metti «${v.titolo}» in Da prendere`} style={tasto(C.accent)}>
                ＋ Da prendere
              </button>
            )}
          </div>
        );
      })}
      {libri.length > mostrati.length && (
        <button onClick={() => setTutti(true)} style={{ ...tasto(C.muted), border: "none", padding: "6px 0" }}>
          altri {libri.length - mostrati.length} ▾
        </button>
      )}
    </div>
  );
}

// GLI ALTRI LIBRI DEGLI AUTORI CHE SEGUI (`lib/altriDellAutore.js`): in fondo
// alla raccolta seguita, un blocco per autore.
export default function AltriDellAutore({ autori = [], books = [], notify }) {
  if (!autori.length) return null;
  return (
    <section style={{ marginTop: 28, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
      <h3 style={{ fontSize: F.corpo, color: C.text, margin: "0 0 4px", fontWeight: 600 }}>📚 Altri libri dei tuoi autori</h3>
      <p style={{ fontSize: F.piccolo, color: C.muted, lineHeight: 1.45, margin: "0 0 14px" }}>
        Quelli che non hai, dal più nuovo. «＋ Da prendere» li segna nella lista dei libri da prendere. Da Open Library, che delle uscite dell'ultimo anno sa poco.
      </p>
      {autori.map((a) => (
        <Autore key={a} autore={a} books={books} onMesso={(v) => notify?.(`🛒 «${v.titolo}» in Da prendere`)} />
      ))}
    </section>
  );
}

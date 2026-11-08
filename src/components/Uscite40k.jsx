import { useEffect, useMemo, useState } from "react";
import { C, FONT_TITLE, F, R } from "../data/constants.js";
import { controllaUscite, daControllare, leggiUscite, scriviUscite, nuove, segnaViste, fraseUscite, indirizzoPagina } from "../lib/uscite40k.js";
import { trovaApi, LEXICANUM, SITO, del40k } from "../lib/lexicanum.js";
import { idTitolo, leggiDaPrendere, scriviDaPrendere, tieni } from "../lib/daPrendere.js";

const prendi = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout?.(20000) });
  if (!r.ok) throw new Error(`Lexicanum ${r.status}`);
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

// LE USCITE DEL 40K (`lib/uscite40k.js`): sull'Ingresso, solo a chi legge il
// 40K, solo quando c'e' qualcosa di nuovo. Ogni libro: «＋ Da prendere» e la
// sua pagina su Lexicanum; «✓ Viste» le toglie dall'Ingresso.
export default function Uscite40k({ books = [], notify }) {
  const legge40k = useMemo(() => books.some((b) => del40k(b)), [books]);
  const [stato, setStato] = useState(leggiUscite);
  const [guasto, setGuasto] = useState(false);
  const [messi, setMessi] = useState(() => new Set(leggiDaPrendere().filter((v) => !v.deleted).map((v) => v.id)));
  useEffect(() => {
    if (!legge40k || !daControllare(leggiUscite())) return undefined;
    let vivo = true;
    trovaApi({ wiki: LEXICANUM })
      .then(({ api }) => controllaUscite({ api, prendi, stato: leggiUscite() }))
      .then((s) => vivo && setStato(scriviUscite(s)))
      .catch(() => vivo && setGuasto(true));
    return () => {
      vivo = false;
    };
  }, [legge40k]);
  if (!legge40k) return null;
  const elenco = nuove(stato);
  // il guasto si dice solo finche' il controllo non e' mai riuscito: dopo,
  // un giro saltato si rifa' alla prossima apertura
  if (!elenco.length) {
    return guasto && !stato.quando ? <p style={{ fontSize: F.piccolo, color: C.muted, margin: "16px 0 0" }}>Uscite del 40K: Lexicanum non ha risposto, riprovo alla prossima apertura.</p> : null;
  }
  const metti = (v) => {
    const voce = { id: idTitolo(v.titolo, ""), titolo: v.titolo, autore: "", nota: `Lexicanum: ${v.tipo}` };
    scriviDaPrendere(tieni(leggiDaPrendere(), voce));
    setMessi((m) => new Set([...m, voce.id]));
    notify?.(`🛒 «${v.titolo}» in Da prendere`);
  };
  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={{ fontFamily: FONT_TITLE, fontWeight: 600, fontSize: F.titolo, color: C.text, margin: "16px 0 4px" }}>Uscite del 40K</h2>
      <p style={{ fontSize: F.piccolo, color: C.muted, margin: "0 0 10px" }}>{fraseUscite(stato)}: pagine appena aperte per un libro, di solito annunciato o appena uscito.</p>
      {elenco.map((v) => {
        const id = idTitolo(v.titolo, "");
        return (
          <div key={v.pagina} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6, padding: "8px 12px", borderRadius: R.piccolo, border: `1px dashed ${C.border}` }}>
            <span style={{ flex: "1 1 200px", minWidth: 0 }}>
              <span style={{ display: "block", fontSize: F.nota, color: C.text, overflowWrap: "anywhere" }}>{v.titolo}</span>
              <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted }}>{v.tipo}</span>
            </span>
            <a href={indirizzoPagina(SITO, v.pagina)} target="_blank" rel="noopener noreferrer" style={{ ...tasto(C.muted), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
              Lexicanum ↗
            </a>
            {messi.has(id) ? (
              <span style={{ fontSize: F.piccolo, color: C.green, whiteSpace: "nowrap" }}>✓ in Da prendere</span>
            ) : (
              <button onClick={() => metti(v)} aria-label={`Metti «${v.titolo}» in Da prendere`} style={tasto(C.accent)}>
                ＋ Da prendere
              </button>
            )}
          </div>
        );
      })}
      <button onClick={() => setStato(scriviUscite(segnaViste(leggiUscite())))} style={{ ...tasto(C.muted), marginTop: 4 }}>
        ✓ Viste
      </button>
    </section>
  );
}

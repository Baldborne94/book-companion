import { useEffect, useState } from "react";
import { C, F, R, px } from "../data/constants.js";
import { cercaCopertineSerie, cercaCopertinaDelLibro, scaricaCopertina } from "../lib/copertineSerie.js";
import { urlCopertina } from "../lib/consigliLiberi.js";
import { preparaCopertina } from "../lib/copertina.js";
import { putCover } from "../lib/bookStore.js";
import { segnaAMano } from "../lib/copertinaGrande.js";
import { touchBook } from "../lib/library.js";
import { caricaCopertina } from "../lib/sync.js";
import BookCover from "./BookCover.jsx";

// LE COPERTINE DELLA RACCOLTA DAL CATALOGO (`lib/copertineSerie.js`):
// prima l'elenco, la copertina di adesso accanto a quella del catalogo, e si
// mette solo quel che resta spuntato. Una copertina messa cosi' e' come una
// scelta a mano nella scheda (`segnaAMano`: resta anche a tutto schermo; il
// ↺ della scheda torna a quella del file) e viaggia come quella.
// Dalla Manutenzione (`CopertinaGiusta`) vale anche per un `libro` solo, e
// comincia `subito`: chiuso o finito, `onChiudi`.
export default function CopertineDalCatalogo({ r, libro = null, notify, subito = false, onChiudi }) {
  const [stato, setStato] = useState(subito ? { fase: "cerco" } : null);
  const [via, setVia] = useState(() => new Set());
  const numerati = (r?.libri || []).filter((b) => Number.isInteger(Number(b.sagaOrder)) && Number(b.sagaOrder) > 0);
  const nome = libro ? libro.title : r?.nome;
  useEffect(() => {
    if (subito) cerca();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!libro && !numerati.length) return null;
  const chiudi = () => {
    setStato(null);
    onChiudi?.();
  };

  const tasto = (attivo) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    padding: "0 14px",
    borderRadius: R.tondo,
    border: `1px solid ${attivo ? C.accent : C.border}`,
    background: attivo ? `${C.accent}1f` : "transparent",
    color: attivo ? C.accent : C.muted,
    fontSize: F.nota,
  });

  async function cerca() {
    setStato({ fase: "cerco" });
    setVia(new Set());
    try {
      const esito = libro ? await cercaCopertinaDelLibro(libro) : await cercaCopertineSerie({ nome: r.nome, libri: numerati });
      setStato({ fase: "elenco", ...esito });
    } catch {
      setStato({ fase: "guasto" });
    }
  }

  async function metti() {
    const scelte = stato.proposte.filter((p) => !via.has(p.libro.id));
    let messe = 0;
    let perse = 0;
    for (let i = 0; i < scelte.length; i++) {
      setStato((s) => ({ ...s, fase: "metto", fatte: i, di: scelte.length }));
      const p = scelte[i];
      try {
        const grezza = await scaricaCopertina(p.copertina);
        const blob = grezza ? await preparaCopertina(grezza) : null;
        if (!blob) {
          perse++;
          continue;
        }
        await putCover(p.libro.id, blob);
        segnaAMano(p.libro.id, true);
        touchBook(p.libro.id);
        caricaCopertina(p.libro.id);
        messe++;
      } catch {
        perse++;
      }
    }
    chiudi();
    notify?.(
      [messe ? (messe === 1 ? "🖼 Una copertina dal catalogo" : `🖼 ${messe} copertine dal catalogo`) : "", perse ? (perse === 1 ? "una non è arrivata" : `${perse} non sono arrivate`) : ""]
        .filter(Boolean)
        .join(" · ") || "Nessuna copertina messa"
    );
  }

  const riquadro = {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "10px 14px",
    marginBottom: 14,
    borderRadius: R.medio,
    border: `1px solid ${C.border}`,
    background: `linear-gradient(135deg, ${C.card}, ${C.surface})`,
  };

  if (!stato)
    return (
      <div style={{ display: "flex", marginBottom: 14 }}>
        <button onClick={cerca} style={tasto(false)}>
          🖼 Copertine dal catalogo
        </button>
      </div>
    );
  if (stato.fase === "cerco") return <div style={{ ...riquadro, color: C.muted, fontSize: F.nota }}>{libro ? `Cerco la copertina di «${nome}» su Open Library…` : `Cerco le copertine di «${nome}» su Open Library…`}</div>;
  if (stato.fase === "metto")
    return (
      <div style={{ ...riquadro, color: C.muted, fontSize: F.nota }}>
        Metto le copertine… {stato.fatte}/{stato.di}
      </div>
    );
  if (stato.fase === "guasto")
    return (
      <div style={{ ...riquadro, flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: C.muted, fontSize: F.nota }}>Open Library non risponde: riprova più tardi.</span>
        <button onClick={chiudi} style={tasto(false)}>
          Ok
        </button>
      </div>
    );

  const { proposte = [], mancano = [] } = stato;
  const quante = proposte.filter((p) => !via.has(p.libro.id)).length;
  const cambia = (id) =>
    setVia((v) => {
      const n = new Set(v);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <div style={riquadro}>
      <span style={{ color: C.text, fontSize: F.nota }}>
        {libro
          ? proposte.length
            ? `Open Library ha una copertina per «${nome}»: a sinistra quella di adesso, a destra quella del catalogo.`
            : `Open Library non ha una copertina per «${nome}».`
          : proposte.length
            ? `Open Library ha ${proposte.length === 1 ? "una copertina" : `${proposte.length} copertine`} per «${nome}»: a sinistra quella di adesso, a destra quella del catalogo. Togli la spunta a quelle che non vuoi.`
            : `Open Library non ha copertine per i volumi di «${nome}».`}
      </span>
      {mancano.length > 0 && proposte.length > 0 && (
        <span style={{ color: C.muted, fontSize: F.piccolo }}>
          {mancano.length === 1 ? `Il volume ${mancano[0]} non c'è` : `I volumi ${mancano.join(", ")} non ci sono`}: restano come sono.
        </span>
      )}
      {proposte.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, maxHeight: "60vh", overflowY: "auto" }}>
          {proposte.map((p) => {
            const si = !via.has(p.libro.id);
            return (
              <label
                key={p.libro.id}
                title={p.titolo}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 6, borderRadius: R.piccolo, border: `1px solid ${si ? C.accent : C.border}`, opacity: si ? 1 : 0.55, cursor: "pointer" }}
              >
                <span style={{ display: "flex", gap: 4 }}>
                  <span style={{ width: px(56), height: px(84), display: "block" }}>
                    <BookCover book={p.libro} compact radius={R.minimo} />
                  </span>
                  <img src={urlCopertina(p.copertina, "M")} alt={`Copertina del catalogo per il volume ${p.numero}`} loading="lazy" style={{ width: px(56), height: px(84), objectFit: "cover", borderRadius: R.minimo, background: C.surface }} />
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 44, fontSize: F.piccolo, color: C.text }}>
                  <input type="checkbox" checked={si} onChange={() => cambia(p.libro.id)} aria-label={p.numero != null ? `Volume ${p.numero}` : p.libro.title} style={{ width: 22, height: 22 }} />
                  {p.numero}
                </span>
              </label>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {quante > 0 && (
          <button onClick={metti} style={tasto(true)}>
            {quante === 1 ? "🖼 Metti la copertina" : `🖼 Metti le ${quante} copertine`}
          </button>
        )}
        <button onClick={chiudi} style={tasto(false)}>
          {proposte.length ? "Annulla" : "Ok"}
        </button>
      </div>
    </div>
  );
}

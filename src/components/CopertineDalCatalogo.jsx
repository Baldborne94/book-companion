import { useEffect, useState } from "react";
import { C, F, R, px } from "../data/constants.js";
import { cercaCopertineSerie, cercaCopertinaDelLibro, scaricaCopertina, opereDaChiedere, edizioniDellOpera, scelteDelVolume, editoriDelleScelte, tutteDellEditore } from "../lib/copertineSerie.js";
import { urlCopertina } from "../lib/consigliLiberi.js";
import { preparaCopertina } from "../lib/copertina.js";
import { putCover } from "../lib/bookStore.js";
import { segnaAMano } from "../lib/copertinaGrande.js";
import { touchBook } from "../lib/library.js";
import { caricaCopertina } from "../lib/sync.js";
import BookCover from "./BookCover.jsx";

// LE COPERTINE DELLA RACCOLTA DAL CATALOGO (`lib/copertineSerie.js`):
// prima l'elenco: per ogni volume la copertina di adesso e quelle del
// catalogo, di qualunque edizione (`scelteDelVolume`: le edizioni arrivano
// dopo, una domanda per opera), e si mette solo quella toccata; «Tutte di
// Kana» sceglie quella di un editore per ogni volume che ce l'ha. Senza
// tocchi resta tutto com'e'. Una copertina messa cosi' e' come una
// scelta a mano nella scheda (`segnaAMano`: resta anche a tutto schermo; il
// ↺ della scheda torna a quella del file) e viaggia come quella.
// Dalla Manutenzione (`CopertinaGiusta`) vale anche per un `libro` solo, e
// comincia `subito`: chiuso o finito, `onChiudi`.
export default function CopertineDalCatalogo({ r, libro = null, notify, subito = false, onChiudi }) {
  const [stato, setStato] = useState(subito ? { fase: "cerco" } : null);
  // libro → numero della copertina scelta; chi non c'e' tiene la sua
  const [scelta, setScelta] = useState(() => new Map());
  const [edizioni, setEdizioni] = useState(() => new Map());
  const [altre, setAltre] = useState(null);
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
    setScelta(new Map());
    setEdizioni(new Map());
    setAltre(null);
    let esito;
    try {
      esito = libro ? await cercaCopertinaDelLibro(libro) : await cercaCopertineSerie({ nome: r.nome, libri: numerati });
    } catch {
      setStato({ fase: "guasto" });
      return;
    }
    setStato({ fase: "elenco", ...esito });
    // le altre edizioni, tre domande alla volta; un'opera che non risponde
    // resta con la sua copertina
    const chiavi = opereDaChiedere(esito.proposte);
    if (!chiavi.length) return;
    const lette = new Map();
    let fatte = 0;
    let perse = 0;
    setAltre({ fatte, di: chiavi.length, perse });
    const coda = [...chiavi];
    const lavora = async () => {
      while (coda.length) {
        const k = coda.shift();
        try {
          lette.set(k, await edizioniDellOpera(k));
        } catch {
          perse++;
        }
        fatte++;
        setEdizioni(new Map(lette));
        setAltre({ fatte, di: chiavi.length, perse });
      }
    };
    await Promise.all([lavora(), lavora(), lavora()]);
  }

  async function metti() {
    const scelte = stato.proposte.filter((p) => scelta.has(p.libro.id));
    let messe = 0;
    let perse = 0;
    for (let i = 0; i < scelte.length; i++) {
      setStato((s) => ({ ...s, fase: "metto", fatte: i, di: scelte.length }));
      const p = scelte[i];
      try {
        const grezza = await scaricaCopertina(scelta.get(p.libro.id));
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
  const volumi = proposte.map((p) => ({ ...p, copertine: scelteDelVolume(p, edizioni) }));
  const editori = editoriDelleScelte(volumi);
  const quante = scelta.size;
  const scegli = (id, copertina) =>
    setScelta((v) => {
      const n = new Map(v);
      if (copertina == null) n.delete(id);
      else n.set(id, copertina);
      return n;
    });
  const nomeDi = (p) => (p.numero != null ? `Volume ${p.etichetta}` : p.libro.title);
  const riquadretto = (attivo) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    padding: 3,
    borderRadius: R.minimo,
    border: `2px solid ${attivo ? C.accent : "transparent"}`,
    background: attivo ? `${C.accent}1f` : "transparent",
  });
  const didascalia = { fontSize: F.minuscolo, color: C.muted, maxWidth: px(64), lineHeight: 1.2, textAlign: "center", overflowWrap: "anywhere" };
  return (
    <div style={riquadro}>
      <span style={{ color: C.text, fontSize: F.nota }}>
        {proposte.length
          ? libro
            ? `Le copertine di «${nome}» su Open Library: tocca quella che vuoi. «La tua» lascia quella di adesso.`
            : `Le copertine dei volumi di «${nome}» su Open Library, di ogni edizione: tocca quella che vuoi per ogni volume, o prendile tutte da un editore. «La tua» lascia quella di adesso.`
          : libro
            ? `Open Library non ha una copertina per «${nome}».`
            : `Open Library non ha copertine per i volumi di «${nome}».`}
      </span>
      {mancano.length > 0 && proposte.length > 0 && (
        <span style={{ color: C.muted, fontSize: F.piccolo }}>
          {mancano.length === 1 ? `Il volume ${mancano[0]} non c'è` : `I volumi ${mancano.join(", ")} non ci sono`}: restano come sono.
        </span>
      )}
      {altre && altre.fatte < altre.di && <span style={{ color: C.muted, fontSize: F.piccolo }}>Cerco le altre edizioni… {altre.fatte}/{altre.di}</span>}
      {altre && altre.fatte === altre.di && altre.perse > 0 && (
        <span style={{ color: C.muted, fontSize: F.piccolo }}>{altre.perse === 1 ? "Le edizioni di un volume non sono arrivate" : `Le edizioni di ${altre.perse} volumi non sono arrivate`}: lì c'è solo la prima.</span>
      )}
      {(editori.length > 0 || quante > 0) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {editori.map((e) => (
            <button key={e.chiave} onClick={() => setScelta(tutteDellEditore(volumi, e.chiave))} style={tasto(false)}>
              Tutte {e.nome} ({e.quanti})
            </button>
          ))}
          {quante > 0 && (
            <button onClick={() => setScelta(new Map())} style={tasto(false)}>
              Tieni le tue
            </button>
          )}
        </div>
      )}
      {proposte.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, maxHeight: "60vh", overflowY: "auto" }}>
          {volumi.map((p) => {
            const mia = scelta.get(p.libro.id);
            return (
              <div key={p.libro.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: 6, borderRadius: R.piccolo, border: `1px solid ${mia ? C.accent : C.border}` }}>
                <span style={{ fontSize: F.piccolo, color: C.text }}>{p.numero != null ? p.etichetta : p.libro.title}</span>
                <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <button onClick={() => scegli(p.libro.id, null)} aria-pressed={!mia} aria-label={`${nomeDi(p)}: la tua`} style={riquadretto(!mia)}>
                    <span style={{ width: px(56), height: px(84), display: "block" }}>
                      <BookCover book={p.libro} compact radius={R.minimo} />
                    </span>
                    <span style={didascalia}>la tua</span>
                  </button>
                  {p.copertine.map((c, i) => (
                    <button key={c.copertina} onClick={() => scegli(p.libro.id, c.copertina)} aria-pressed={mia === c.copertina} aria-label={`${nomeDi(p)}: ${c.editore || `copertina ${i + 1}`}`} style={riquadretto(mia === c.copertina)}>
                      <img src={urlCopertina(c.copertina, "M")} alt="" loading="lazy" style={{ width: px(56), height: px(84), objectFit: "cover", borderRadius: R.minimo, background: C.surface }} />
                      <span style={didascalia}>{c.editore || "—"}</span>
                    </button>
                  ))}
                </span>
              </div>
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
          {quante ? "Annulla" : "Chiudi"}
        </button>
      </div>
    </div>
  );
}

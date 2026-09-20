import { useMemo, useState } from "react";
import { C, TEMA, FONT_TITLE, F, R, px } from "../data/constants.js";
import { getStatus } from "../lib/library.js";
import { perParte } from "../lib/cammino.js";
import { numerazioneGuida, sagaComune, campiDaScrivere } from "../lib/numeraCammino.js";

// I FILTRI SONO TRE, e il terzo è quello per cui la pagina esiste: su una
// guida da settantuno tappe «cosa mi manca» è la domanda vera, e senza un
// tasto si scorre tutto a occhio.
const FILTRI = [
  { id: "tutte", nome: "Tutte" },
  { id: "tue", nome: "Ce l'hai" },
  { id: "mancano", nome: "Ti mancano" },
];

const STATO = { read: "letto", reading: "in lettura", abandoned: "abbandonato" };

function Tappa({ t, onOpenBook }) {
  const { voce, libro } = t;
  const stato = libro ? STATO[getStatus(libro.id)] : null;
  const dentro = (
    <>
      {/* IL NUMERO È QUELLO DEL CAMMINO, non quello della collana: la guida
          rimescola apposta, e «The First Heretic» è il 14 in copertina e il
          6 qui. Dove il numero non c'è — antologie, prologo, i 40K — al suo
          posto va il trattino e la ragione sta nella nota. */}
      <span
        style={{
          width: px(46),
          flexShrink: 0,
          textAlign: "center",
          fontFamily: FONT_TITLE,
          fontSize: F.piccolo,
          color: voce.o ? (libro ? C.accent : C.muted) : C.muted,
          opacity: voce.o ? 1 : 0.6,
        }}
      >
        {voce.o ? `n° ${voce.o}` : "—"}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontFamily: FONT_TITLE,
            fontWeight: 600,
            fontSize: F.corpo,
            color: libro ? C.text : C.muted,
          }}
        >
          {voce.t}
        </span>
        <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted, marginTop: 2 }}>
          {[voce.a, voce.nota, libro ? `nella tua biblioteca${stato ? ` · ${stato}` : ""}` : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span
        style={{
          flexShrink: 0,
          fontSize: F.minuscolo,
          color: libro ? C.green : C.muted,
          opacity: libro ? 1 : 0.7,
        }}
      >
        {libro ? "✓" : "manca"}
      </span>
    </>
  );

  const stile = {
    display: "flex",
    width: "100%",
    gap: 10,
    alignItems: "center",
    textAlign: "left",
    padding: "9px 4px",
    borderBottom: `1px solid ${C.border}44`,
  };

  // quello che hai si apre nella sua scheda; quello che manca non porta da
  // nessuna parte, e un tasto che non fa niente è peggio di nessun tasto
  return libro ? (
    <button onClick={() => onOpenBook(libro.id)} style={stile}>
      {dentro}
    </button>
  ) : (
    <div style={stile}>{dentro}</div>
  );
}

// IL PANNELLO CHE PROPONE I NUMERI. Stessa forma di «Titoli da ripulire»,
// e per la stessa ragione: un numero storto non alza nessun errore, sposta
// soltanto il confine di quel che l'Oracolo puo' raccontare — quindi si
// guarda prima, una riga per volta, e quel che togli non si tocca.
function SceltaNumeri({ numeri, saga, scelti, sagaScelta, onCambia, onSaga, onChiudi, onVai }) {
  const quanti = scelti.size + (saga && sagaScelta ? saga.quali.length : 0);
  const riga = (on) => ({
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    marginBottom: 6,
    borderRadius: R.piccolo,
    border: `1px solid ${on ? `${C.accent}88` : C.border}`,
    background: on ? `${C.accent}14` : "transparent",
  });
  return (
    <div
      onClick={onChiudi}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 55,
        background: "#080611cc",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        animation: "bc-fade-in 0.25s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: px(520),
          maxHeight: "100%",
          overflowY: "auto",
          borderRadius: R.grande,
          border: `1px solid ${C.border}`,
          background: `linear-gradient(180deg, ${C.card}, ${C.surface})`,
          boxShadow: `0 0 60px ${C.arcane}22, 0 20px 50px #00000088`,
          padding: 22,
        }}
      >
        <h2 style={{ fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text }}>
          🔢 Numera come la guida
        </h2>
        <p style={{ color: C.muted, fontSize: F.piccolo, marginTop: 6, marginBottom: 16, lineHeight: 1.5 }}>
          Il numero di lettura è l'unico campo che dice all'Oracolo cosa viene prima e cosa viene
          dopo. Qui diventa il posto nella guida — antologie comprese — così la frontiera delle
          schede combacia col percorso. Guarda e spunta: quello che lasci non si tocca.
        </p>

        {saga && (
          <button onClick={onSaga} style={riga(sagaScelta)}>
            <span style={{ fontSize: F.rilievo, color: sagaScelta ? C.accent : C.muted }}>
              {sagaScelta ? "☑" : "☐"}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", color: C.text, fontSize: F.corpo }}>
                Scrivi «{saga.nome}» su {saga.quali.length}{" "}
                {saga.quali.length === 1 ? "volume" : "volumi"}
              </span>
              <span style={{ display: "block", color: C.muted, fontSize: F.minuscolo, marginTop: 2 }}>
                Stanno in un'altra saga, e la frontiera confronta la saga lettera per lettera: così
                come sono, per l'Oracolo sono due storie diverse.
              </span>
            </span>
          </button>
        )}

        {numeri.map((p) => {
          const on = scelti.has(p.id);
          return (
            <button key={p.id} onClick={() => onCambia(p.id)} style={riga(on)}>
              <span style={{ fontSize: F.rilievo, color: on ? C.accent : C.muted }}>
                {on ? "☑" : "☐"}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", color: C.text, fontSize: F.corpo }}>{p.title}</span>
                <span style={{ display: "block", color: C.muted, fontSize: F.minuscolo, marginTop: 2 }}>
                  {p.da == null ? "senza numero" : `n° ${p.da}`} → <b style={{ color: C.accent }}>n° {p.a}</b>
                </span>
              </span>
            </button>
          );
        })}

        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <button
            onClick={onChiudi}
            style={{
              padding: "10px 18px",
              borderRadius: R.piccolo,
              border: `1px solid ${C.border}`,
              color: C.muted,
              fontSize: F.nota,
            }}
          >
            Lascia stare
          </button>
          <button
            onClick={onVai}
            disabled={!quanti}
            style={{
              padding: "10px 20px",
              borderRadius: R.piccolo,
              border: `1px solid ${quanti ? `${C.accent}88` : C.border}`,
              background: quanti ? `${C.accent}22` : "transparent",
              color: quanti ? C.accent : C.muted,
              fontSize: F.nota,
            }}
          >
            {quanti ? `Scrivi ${quanti}` : "Niente spuntato"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Cammino({ cammino, onClose, onOpenBook, onNumera }) {
  const [filtro, setFiltro] = useState("tutte");
  const [numerare, setNumerare] = useState(null);
  const { tappe, tue, fuori, saga } = cammino;

  // le due proposte si calcolano a ogni giro e non alla pressione: servono
  // gia' per sapere se il tasto ha qualcosa da offrire, e un tasto che
  // promette quel che non puo' dare e' il difetto di «Porta qui 18 tomi»
  const daFare = useMemo(() => {
    const numeri = numerazioneGuida(cammino);
    const sagaDa = sagaComune(cammino);
    return numeri.length || sagaDa ? { numeri, saga: sagaDa } : null;
  }, [cammino]);

  const parti = useMemo(() => {
    const scelte =
      filtro === "tue" ? tappe.filter((t) => t.libro) : filtro === "mancano" ? tappe.filter((t) => !t.libro) : tappe;
    // si filtra PRIMA di raggruppare, così una parte dove non resta niente
    // non lascia un'intestazione vuota
    return perParte(scelte);
  }, [tappe, filtro]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        overflowY: "auto",
        background: TEMA.gradient,
        animation: "bc-fade-in 0.35s ease-out",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          padding: "14px 18px 10px",
          background: `${C.surface}f2`,
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ flex: 1, fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text }}>
            Il cammino · {saga}
          </h2>
          <button onClick={onClose} aria-label="Chiudi" style={{ fontSize: F.titoletto, color: C.muted, padding: 6 }}>
            ✕
          </button>
        </div>
        <p style={{ fontSize: F.piccolo, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>
          {`Hai ${tue} delle ${tappe.length} tappe.`}
          {fuori > 0 ? ` Altri ${fuori} dei tuoi libri non stanno in questo percorso.` : ""}
        </p>
        {onNumera && daFare && (
          <button
            onClick={() =>
              setNumerare({
                ...daFare,
                scelti: new Set(daFare.numeri.map((p) => p.id)),
                sagaScelta: true,
              })
            }
            style={{
              minHeight: 44,
              marginTop: 8,
              padding: "0 14px",
              borderRadius: R.piccolo,
              border: `1px solid ${C.accent}66`,
              background: `${C.accent}14`,
              color: C.accent,
              fontSize: F.piccolo,
            }}
          >
            🔢 Numera come la guida
            {daFare.numeri.length ? ` · ${daFare.numeri.length}` : ""}
          </button>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {FILTRI.map((f) => {
            const acceso = filtro === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                style={{
                  minHeight: 44,
                  padding: "0 14px",
                  borderRadius: R.tondo,
                  border: `1px solid ${acceso ? C.accent : C.border}`,
                  color: acceso ? C.accent : C.muted,
                  background: acceso ? `${C.accent}14` : "transparent",
                  fontSize: F.piccolo,
                }}
              >
                {f.nome}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ maxWidth: px(760), margin: "0 auto", padding: "14px 18px 40px" }}>
        {parti.map(({ parte, tappe: dentro }) => (
          <section key={parte} style={{ marginBottom: 22 }}>
            <h3
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                fontFamily: FONT_TITLE,
                fontSize: F.rilievo,
                fontWeight: 600,
                color: C.accent,
                marginBottom: 4,
                paddingBottom: 4,
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              {parte}
              <span style={{ fontSize: F.minuscolo, color: C.muted, fontFamily: "inherit", fontWeight: 400 }}>
                {dentro.filter((t) => t.libro).length}/{dentro.length}
              </span>
            </h3>
            {dentro.map((t) => (
              <Tappa key={t.voce.t} t={t} onOpenBook={onOpenBook} />
            ))}
          </section>
        ))}
        {numerare && (
          <SceltaNumeri
            numeri={numerare.numeri}
            saga={numerare.saga}
            scelti={numerare.scelti}
            sagaScelta={numerare.sagaScelta}
            onCambia={(id) =>
              setNumerare((n) => {
                if (!n) return n;
                const scelti = new Set(n.scelti);
                if (scelti.has(id)) scelti.delete(id);
                else scelti.add(id);
                return { ...n, scelti };
              })
            }
            onSaga={() => setNumerare((n) => (n ? { ...n, sagaScelta: !n.sagaScelta } : n))}
            onChiudi={() => setNumerare(null)}
            onVai={() => {
              const campi = campiDaScrivere(numerare);
              setNumerare(null);
              onNumera(campi);
            }}
          />
        )}
        {parti.length === 0 && (
          <p style={{ color: C.muted, fontSize: F.corpo, lineHeight: 1.6, marginTop: 20 }}>
            {filtro === "tue"
              ? "Di questo percorso non hai ancora nessun volume."
              : "Hai tutte le tappe del percorso."}
          </p>
        )}
      </div>
    </div>
  );
}

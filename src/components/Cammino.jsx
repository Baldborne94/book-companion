import { useMemo, useState } from "react";
import { C, TEMA, FONT_TITLE, F, R, px } from "../data/constants.js";
import { getStatus } from "../lib/library.js";
import { perParte, prossimoPasso, lettiDelCammino } from "../lib/cammino.js";
import { numerazioneGuida, serieDaScrivere, sagaComune, campiDaScrivere } from "../lib/numeraCammino.js";
import { raccontiLetti, segnaRacconto, chiaveRacconto } from "../lib/racconti.js";

// I FILTRI SONO TRE, e il terzo è quello per cui la pagina esiste: su una
// guida da settantuno tappe «cosa mi manca» è la domanda vera, e senza un
// tasto si scorre tutto a occhio.
const FILTRI = [
  { id: "tutte", nome: "Tutte" },
  { id: "tue", nome: "Ce l'hai" },
  { id: "mancano", nome: "Ti mancano" },
];

const STATO = { read: "letto", reading: "in lettura", abandoned: "abbandonato" };

// IL TUO PROSSIMO PASSO, in cima e prima di tutto il resto.
//
// La pagina diceva soltanto «Hai 10 delle 71 tappe» — un conto di
// POSSESSO — e su settantuno righe «dove sono arrivato, cosa apro adesso»
// restava da scorrere a occhio.
//
// Le righe sono due perché le domande sono due: il passo della GUIDA (che
// può essere un libro che non hai, ed è metà del valore di una guida:
// «vallo a prendere») e il primo che puoi APRIRE davvero. Quando
// coincidono la seconda non si scrive, o sarebbe lo stesso titolo due
// volte a mezzo centimetro di distanza.
function Passo({ passo, onOpenBook, letto, onSegna }) {
  const { tappa, inCorso, apribile, prologo } = passo;
  const { voce, libro } = tappa;
  const racconto = voce.tipo === "racconto";
  // su un racconto la riga PIÙ importante è dove trovarlo: «leggi The
  // Aurelian» senza «in Eye of Terra» è un passo che non puoi eseguire
  const riga = [voce.a, racconto && voce.in ? `in «${voce.in}»` : voce.nota]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: R.piccolo,
        border: `1px solid ${C.accent}44`,
        background: `${C.accent}0f`,
      }}
    >
      <div style={{ fontFamily: FONT_TITLE, fontSize: F.minuscolo, color: C.accent, letterSpacing: 1 }}>
        {inCorso ? "LO STAI LEGGENDO" : "IL TUO PROSSIMO PASSO"}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: FONT_TITLE, fontWeight: 600, fontSize: F.rilievo, color: C.text }}>
            {tappa.posto == null ? "" : `n° ${tappa.posto} · `}
            {voce.t}
          </span>
          <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted, marginTop: 2 }}>
            {[riga, libro ? null : racconto ? "l'antologia non ce l'hai" : "non ce l'hai"]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        {/* un racconto non si apre: si spunta. Il tasto che lo dichiara
            letto sta QUI, dove il passo si legge — mandare a cercarlo
            nell'elenco sarebbe un passo che non si può chiudere da dove
            lo si incontra. */}
        {racconto && (
          <button
            onClick={() => onSegna(voce, !letto)}
            style={{
              flexShrink: 0,
              minHeight: 44,
              padding: "0 14px",
              borderRadius: R.piccolo,
              border: `1px solid ${C.accent}66`,
              background: `${C.accent}1a`,
              color: C.accent,
              fontSize: F.piccolo,
            }}
          >
            L'ho letto
          </button>
        )}
        {libro && !racconto && (
          <button
            onClick={() => onOpenBook(libro.id)}
            style={{
              flexShrink: 0,
              minHeight: 44,
              padding: "0 14px",
              borderRadius: R.piccolo,
              border: `1px solid ${C.accent}66`,
              background: `${C.accent}1a`,
              color: C.accent,
              fontSize: F.piccolo,
            }}
          >
            Aprilo
          </button>
        )}
      </div>
      {apribile && (
        <button
          onClick={() => onOpenBook(apribile.libro.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            width: "100%",
            minHeight: 44,
            marginTop: 4,
            textAlign: "left",
            fontSize: F.piccolo,
            color: C.muted,
          }}
        >
          <span style={{ color: C.accent }}>↳</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            {/* un libro che hai gia' in mano non e' «il primo che puoi
                aprire»: offerto cosi' si legge come una novita', mentre e'
                quello che stai leggendo da ieri sera */}
            {/* «INTANTO» fa un lavoro che «il primo che puoi aprire» non
                faceva: dice che la riga sopra è un buco da colmare e questa
                è la sera di stasera. Senza, la riga sopra — ferma su un
                volume che non hai — si legge come un guasto. */}
            {getStatus(apribile.libro.id) === "reading" ? "Intanto stai leggendo: " : "Intanto puoi aprire: "}
            <span style={{ color: C.text }}>{apribile.voce.t}</span>
          </span>
        </button>
      )}
      {/* il prologo si nomina solo quando sei PROPRIO all'inizio: più
          avanti sarebbe una riga che torna a ogni apertura e si impara a
          saltare */}
      {prologo === "scelta" && (
        <p style={{ fontSize: F.minuscolo, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
          Il prologo qui sotto sono quattro percorsi alternativi: ne cominci uno, non tutti. Appena ne apri un volume il
          cammino ti propone il suo seguito.
        </p>
      )}
    </div>
  );
}

// UN RACCONTO SI SPUNTA, NON SI APRE. È quaranta pagine dentro
// un'antologia: la biblioteca conosce il volume, non la storia, quindi
// l'unico modo di dire «questa l'ho letta» è una casella. La riga dice da
// quale antologia si pesca e se quel volume ce l'hai — senza, la guida
// direbbe «leggi The Aurelian» senza dire dove trovarlo.
function Racconto({ t, letto, onSegna }) {
  const { voce, libro } = t;
  return (
    <button
      onClick={() => onSegna(voce, !letto)}
      aria-pressed={letto}
      style={{
        display: "flex",
        width: "100%",
        gap: 10,
        alignItems: "center",
        textAlign: "left",
        minHeight: 44,
        padding: "6px 4px",
        borderBottom: `1px solid ${C.border}44`,
        opacity: letto ? 0.75 : 1,
      }}
    >
      <span
        style={{
          width: px(46),
          flexShrink: 0,
          textAlign: "center",
          fontSize: F.piccolo,
          color: letto ? C.green : C.muted,
        }}
      >
        {letto ? "☑" : "☐"}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: F.piccolo,
            color: libro ? C.text : C.muted,
            textDecoration: letto ? "line-through" : "none",
          }}
        >
          {voce.nota === "audiodramma" ? "🎧 " : "📄 "}
          {voce.t}
        </span>
        <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted, marginTop: 2 }}>
          {[voce.a, voce.in ? `in «${voce.in}»` : "non è raccolto in nessun volume"]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span style={{ flexShrink: 0, fontSize: F.minuscolo, color: libro ? C.green : C.muted, opacity: 0.8 }}>
        {libro ? "ce l'hai" : "manca"}
      </span>
    </button>
  );
}

function Tappa({ t, onOpenBook }) {
  const { voce, libro } = t;
  const stato = libro ? STATO[getStatus(libro.id)] : null;
  const dentro = (
    <>
      {/* IL NUMERO È QUELLO DEL CAMMINO, non quello della collana: la guida
          rimescola apposta, e «The First Heretic» è il 14 in copertina e il
          6 qui. Ed è LO STESSO che il pannello scrive sui tuoi volumi — due
          numeri per lo stesso libro nella stessa app erano il difetto, non
          un dettaglio: qui «n° 1 · Horus Rising» e sullo scaffale 15. Quel
          che la guida non numera porta il suo decimale (0,01: sta prima del
          primo), e il trattino resta ai soli racconti, che non sono file e
          un numero non ce l'hanno da nessuna parte. */}
      <span
        style={{
          width: px(58),
          flexShrink: 0,
          textAlign: "center",
          fontFamily: FONT_TITLE,
          fontSize: F.piccolo,
          color: t.posto == null ? C.muted : libro ? C.accent : C.muted,
          opacity: t.posto == null ? 0.6 : 1,
        }}
      >
        {t.posto == null ? "—" : `n° ${t.posto}`}
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
function SceltaNumeri({ numeri, serie, saga, scelti, sagaScelta, onCambia, onSaga, onChiudi, onVai }) {
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
          🔢 Mettili in ordine di guida
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
          const on = scelti.has(`n:${p.id}`);
          return (
            <button key={`n:${p.id}`} onClick={() => onCambia(`n:${p.id}`)} style={riga(on)}>
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

        {serie.length > 0 && (
          <p style={{ color: C.muted, fontSize: F.minuscolo, margin: "14px 0 8px", lineHeight: 1.5 }}>
            E la <b style={{ color: C.text }}>serie</b>: il campo dice di quale STORIA si tratta,
            e i capitoli della guida lo scaffale li legge da sé. Sono volumi di una
            storia sola, quindi «Prima di cominciare» continua a raccontarti tutto quel che viene
            prima. Chi resta <b style={{ color: C.text }}>senza serie</b> è quel che la guida
            stessa dichiara fuori dalla storia — il prologo e i titoli fuori dal ciclo: restano
            nel percorso e nell’universo, ma non sono un capitolo di questa storia.
          </p>
        )}
        {serie.map((p) => {
          const on = scelti.has(`s:${p.id}`);
          return (
            <button key={`s:${p.id}`} onClick={() => onCambia(`s:${p.id}`)} style={riga(on)}>
              <span style={{ fontSize: F.rilievo, color: on ? C.accent : C.muted }}>
                {on ? "☑" : "☐"}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", color: C.text, fontSize: F.corpo }}>{p.title}</span>
                <span style={{ display: "block", color: C.muted, fontSize: F.minuscolo, marginTop: 2 }}>
                  {p.da ? `«${p.da}»` : "senza serie"} →{" "}
                  <b style={{ color: C.accent }}>{p.a ? `«${p.a}»` : "senza serie"}</b>
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
  const [spuntati, setSpuntati] = useState(() => raccontiLetti());
  const { tappe, tue, volumi, fuori, saga } = cammino;

  // le tre proposte si calcolano a ogni giro e non alla pressione: servono
  // gia' per sapere se il tasto ha qualcosa da offrire, e un tasto che
  // promette quel che non puo' dare e' il difetto di «Porta qui 18 tomi»
  const daFare = useMemo(() => {
    const numeri = numerazioneGuida(cammino);
    const serie = serieDaScrivere(cammino);
    const sagaDa = sagaComune(cammino);
    return numeri.length || serie.length || sagaDa ? { numeri, serie, saga: sagaDa } : null;
  }, [cammino]);

  // il passo e i conti si rifanno quando cambia il cammino: dentro stanno
  // `getStatus`/`getProgress`, che leggono lo storage, e chiamarli a ogni
  // render per settantuno tappe sarebbe lo stesso giro moltiplicato
  const passo = useMemo(() => prossimoPasso(cammino, { spuntati }), [cammino, spuntati]);
  const quanti = useMemo(() => lettiDelCammino(cammino, { spuntati }), [cammino, spuntati]);

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
          {/* IL POSSESSO SI CONTA SUI VOLUMI, non sulle righe: da quando i
              racconti hanno una riga per uno, «delle 110 tappe» sarebbe un
              numero che risponde a una domanda che nessuno ha fatto —
              quanti VOLUMI della guida hai è quel che serve a comprare. */}
          {`Hai ${tue} dei ${volumi ?? tappe.length} volumi della guida.`}
          {/* POSSEDERE NON È AVER LETTO, e sono due domande diverse: si
              può avere mezzo percorso sullo scaffale e non averne aperto
              uno. Lo zero non si dice, come nel resoconto dell'import. */}
          {quanti.letti > 0 ? ` Ne hai lette ${quanti.letti} di ${quanti.quante}.` : ""}
          {fuori > 0 ? ` Altri ${fuori} dei tuoi libri non stanno in questo percorso.` : ""}
        </p>
        {passo && (
          <Passo
            passo={passo}
            onOpenBook={onOpenBook}
            letto={spuntati.has(chiaveRacconto(passo.tappa.voce))}
            onSegna={(voce, l) => setSpuntati(segnaRacconto(voce, l))}
          />
        )}
        {onNumera && daFare && (
          <button
            onClick={() =>
              setNumerare({
                ...daFare,
                scelti: new Set([
                  ...daFare.numeri.map((p) => `n:${p.id}`),
                  ...daFare.serie.map((p) => `s:${p.id}`),
                ]),
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
            🔢 Mettili in ordine di guida
            {daFare.numeri.length + daFare.serie.length
              ? ` · ${daFare.numeri.length + daFare.serie.length}`
              : ""}
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
            {dentro.map((t) =>
              t.voce.tipo === "racconto" ? (
                <Racconto
                  key={t.voce.t}
                  t={t}
                  letto={spuntati.has(chiaveRacconto(t.voce))}
                  onSegna={(voce, letto) => setSpuntati(segnaRacconto(voce, letto))}
                />
              ) : (
                <Tappa key={t.voce.t} t={t} onOpenBook={onOpenBook} />
              )
            )}
          </section>
        ))}
        {numerare && (
          <SceltaNumeri
            numeri={numerare.numeri}
            serie={numerare.serie}
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

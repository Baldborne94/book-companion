import { useEffect, useMemo, useRef, useState } from "react";
import { C, TEMA, FONT_TITLE, F, R, px } from "../data/constants.js";
import {
  IN_VISTA,
  aggiungi,
  arrivato,
  leggiDaPrendere,
  nomeVoce,
  proposte,
  scarta,
  scriviDaPrendere,
  testoLista,
  tieni,
  togli,
  vive,
} from "../lib/daPrendere.js";
import { chiediConsigli, daMostrare, leggiConsigliSalvati, scriviConsigli } from "../lib/consigli.js";
import { consigliDalCatalogo, leggiConsigliLiberi, scriviConsigliLiberi, scaduti, SEZIONI_CATALOGO, urlCopertina } from "../lib/consigliLiberi.js";
import { chiedi, hasOracle } from "../lib/oracle.js";
import { costo, soldi, riassunto, leggiTetto } from "../lib/spesa.js";
import { CampoChiave, TettoFinito } from "./TettoOracolo.jsx";
import { copertinaNota, nuovoCercatore } from "../lib/copertineRete.js";

// uno per tutta la pagina: poche domande alla volta, mai due uguali
const copertinaDiVoce = nuovoCercatore();

const campo = () => ({
  flex: 1,
  minWidth: 0,
  minHeight: 44,
  padding: "10px 14px",
  borderRadius: R.piccolo,
  border: `1px solid ${C.border}`,
  background: C.card,
  color: C.text,
  fontSize: F.nota,
});

const tasto = (colore) => ({
  minHeight: 44,
  padding: "8px 14px",
  borderRadius: R.tondo,
  border: `1px solid ${colore}66`,
  color: colore,
  fontSize: F.piccolo,
  whiteSpace: "nowrap",
});

// La copertina del catalogo, piccola accanto alla voce. Un'immagine che
// non arriva (rete, id senza file) sparisce invece di lasciare l'icona
// rotta: senza copertina la voce resta com'era sempre stata. Se la voce il
// numero non ce l'ha (consigli di prima, Oracolo, guide, scritte a mano) si
// chiede al catalogo per titolo e autore, una volta sola.
function CopertinaVoce({ voce }) {
  const [id, setId] = useState(() => copertinaNota(voce));
  const [rotta, setRotta] = useState(false);
  useEffect(() => {
    let vivo = true;
    const nota = copertinaNota(voce);
    setId(nota);
    if (nota === undefined) copertinaDiVoce(voce).then((c) => vivo && setId(c || 0));
    return () => {
      vivo = false;
    };
  }, [voce.id, voce.titolo, voce.autore, voce.copertina]);
  const src = urlCopertina(id);
  if (!src || rotta) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setRotta(true)}
      style={{ width: px(44), height: px(66), objectFit: "cover", borderRadius: R.minimo, flexShrink: 0, background: C.border }}
    />
  );
}

// Una saga fra le proposte: le prime in vista, il resto dietro un tasto col
// conto — una guida da settantun tappe ne proporrebbe venti in fila.
function GruppoProposte({ gruppo, onTieni, onScarta, sotto }) {
  const [tutte, setTutte] = useState(false);
  const mostrate = tutte ? gruppo.voci : gruppo.voci.slice(0, IN_VISTA);
  const altre = gruppo.voci.length - mostrate.length;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: F.nota, fontWeight: 600, color: sotto ? C.accent : C.text, marginBottom: sotto ? 6 : 0 }}>
        {gruppo.nome}
      </div>
      {gruppo.dopo?.title && (
        <div style={{ fontSize: F.minuscolo, color: C.muted, marginBottom: 6 }}>dopo «{gruppo.dopo.title}»</div>
      )}
      {mostrate.map((v) => (
        <div
          key={v.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
            padding: "8px 12px",
            borderRadius: R.piccolo,
            border: `1px dashed ${C.border}`,
          }}
        >
          <CopertinaVoce voce={v} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: F.nota, color: C.text }}>{nomeVoce(v)}</span>
            {(v.autore || v.saga || (v.titolo && v.numero != null)) && (
              <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted }}>
                {[v.autore, v.saga ? `${v.saga}${v.numero != null ? ` n° ${v.numero}` : ""}` : v.numero != null ? `n° ${v.numero}` : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
            {v.perche && (
              <span style={{ display: "block", fontSize: F.piccolo, color: C.text, opacity: 0.85, marginTop: 2, lineHeight: 1.4 }}>
                {v.perche}
              </span>
            )}
            {/* il catalogo non ha tutto: un titolo che non ritrova si dice,
                non si butta — ma chi lo va a cercare deve saperlo */}
            {v.verificato === false && (
              <span style={{ display: "block", fontSize: F.minuscolo, color: C.accent, marginTop: 2 }}>
                ⚠ non l'ho trovato nel catalogo: controlla prima di cercarlo
              </span>
            )}
          </span>
          <button onClick={() => onTieni(v)} style={tasto(C.accent)}>
            ＋ Tieni
          </button>
          <button onClick={() => onScarta(v)} aria-label="Non mi serve" style={{ minHeight: 44, padding: "8px 10px", color: C.muted }}>
            ✕
          </button>
        </div>
      ))}
      {altre > 0 && (
        <button onClick={() => setTutte(true)} style={{ ...tasto(C.muted), border: "none", padding: "6px 0" }}>
          altre {altre} ▾
        </button>
      )}
    </div>
  );
}

const riga = () => ({ color: C.muted, fontSize: F.nota, lineHeight: 1.55, margin: 0 });

const quandoFu = (t) =>
  new Date(t).toLocaleDateString("it-IT", { day: "numeric", month: "long" });

const FASI_CATALOGO = {
  saghe: "Cerco i volumi dopo i tuoi",
  gusti: "Leggo gli argomenti dei libri che hai amato",
  scoperte: "Scelgo le scoperte",
};

// I CONSIGLI DAL CATALOGO: gratis e senza chiave, quindi partono da soli
// all'apertura — ma una volta a settimana, non a ogni apertura: sono
// decine di domande a Open Library, e il catalogo cambia piano. Mentre
// cercano, quelli della volta prima restano in vista.
function Catalogo({ books, giro, setGiro, gia, onTieni, onScarta }) {
  const [fase, setFase] = useState(null);
  const vivo = useRef(true);
  const sezioni = useMemo(() => daMostrare(giro?.consigli, books, gia, SEZIONI_CATALOGO), [giro, books, gia]);

  async function cerca() {
    setFase({ passo: "saghe" });
    const r = await consigliDalCatalogo(books, { onFase: (passo, a, b) => vivo.current && setFase({ passo, a, b }) });
    if (!vivo.current) return;
    if (r.error) {
      setFase({ passo: "errore" });
      return;
    }
    scriviConsigliLiberi(r);
    setGiro(r);
    setFase(null);
  }

  useEffect(() => {
    vivo.current = true;
    if (books.length && scaduti(giro)) cerca();
    return () => {
      vivo.current = false;
    };
    // una volta all'apertura: i libri importati mentre la pagina e' aperta
    // spariscono dai consigli da soli (`daMostrare`), non serve rifare il giro
  }, []);

  const lavora = fase && fase.passo !== "errore";
  return (
    <section style={{ marginBottom: 26 }}>
      <h3 style={{ fontFamily: FONT_TITLE, fontSize: F.titoletto, color: C.accent, marginBottom: 4 }}>Dal catalogo</h3>
      <p style={{ fontSize: F.piccolo, color: C.muted, marginBottom: 12, lineHeight: 1.45 }}>
        Gratis e senza chiave, da Open Library: il volume dopo l'ultimo che hai letto di ogni saga, e i più votati sui
        generi dei libri che hai amato, di autori che non hai ancora. Si parte dai tuoi preferiti — il cuore e i voti
        alti pesano più di tutto — ma i secondi restano i preferiti di tutti su quei generi: per consigli su misura c'è
        l'Oracolo, qui sotto.
      </p>
      {lavora && (
        <p style={{ ...riga(), marginBottom: 12 }}>
          🔎 {FASI_CATALOGO[fase.passo] || "Cerco nel catalogo"}
          {fase.b ? ` · ${fase.a} di ${fase.b}` : "…"}
        </p>
      )}
      {fase?.passo === "errore" && (
        <p style={{ ...riga(), marginBottom: 12 }}>
          Il catalogo non ha risposto: serve la rete. {giro ? "Qui sotto restano quelli dell'ultima volta." : ""}
        </p>
      )}
      {giro &&
        (sezioni.length === 0 ? (
          <p style={{ ...riga(), marginBottom: 12 }}>
            Il catalogo non ha niente da proporti adesso: le tue saghe sono in pari, o i libri li hai già.
          </p>
        ) : (
          sezioni.map((g) => <GruppoProposte key={g.chiave} gruppo={g} sotto onTieni={onTieni} onScarta={onScarta} />)
        ))}
      {!lavora && (
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
          {giro && <span style={{ fontSize: F.minuscolo, color: C.muted }}>Cercati il {quandoFu(giro.quando)}</span>}
          <button onClick={cerca} style={tasto(C.accent)}>
            {giro ? "↻ Cerca di nuovo" : "🔎 Cerca nel catalogo"}
          </button>
        </div>
      )}
    </section>
  );
}

// I CONSIGLI DELL'ORACOLO: si chiedono a mano, mai da soli — costano, e
// una pagina che spende aprendosi e' una pagina che non si apre piu'.
// La risposta resta sul dispositivo e si rilegge gratis finche' non la
// richiedi.
function Consigli({ books, lista, gia, onTieni, onScarta }) {
  const [giro, setGiro] = useState(leggiConsigliSalvati);
  const [fase, setFase] = useState(null);
  const [, setChiave] = useState(0);
  const sezioni = useMemo(() => daMostrare(giro?.consigli, books, [...lista, ...gia]), [giro, books, lista, gia]);

  async function chiediOra() {
    setFase({ passo: "chiedo" });
    const r = await chiediConsigli(books, {
      chiedi,
      onFase: (passo, a, b) => setFase({ passo, a, b }),
    });
    if (r.error) {
      setFase({ passo: "errore", ...r });
      return;
    }
    scriviConsigli(r);
    setGiro(r);
    setFase(null);
  }

  let stato = null;
  if (fase?.passo === "chiedo") {
    stato = <p style={riga()}>✨ L'Oracolo sta sfogliando la tua biblioteca…</p>;
  } else if (fase?.passo === "controllo") {
    stato = (
      <p style={riga()}>
        🔎 Controllo i titoli nel catalogo{fase.b ? ` · ${fase.a} di ${fase.b}` : "…"}
      </p>
    );
  } else if (fase?.passo === "errore") {
    stato =
      fase.error === "tetto" ? (
        <TettoFinito speso={costo(riassunto().mese)} tetto={fase.tettoMese ?? leggiTetto()} onRiprova={chiediOra} />
      ) : fase.error === "chiave" ? (
        <div>
          <p style={{ ...riga(), marginBottom: 8 }}>
            {hasOracle()
              ? "La chiave salvata non è più valida: probabilmente è scaduta. Incollane una nuova."
              : "Serve una chiave API di Anthropic (console.anthropic.com): resta solo su questo dispositivo."}
          </p>
          <CampoChiave onSalva={chiediOra} />
        </div>
      ) : (
        <div>
          <p style={riga()}>
            {fase.error === "rete"
              ? "L'Oracolo ha bisogno della rete: riprova quando sei online."
              : fase.error === "tagliata"
                ? "La risposta si è interrotta a metà: riprova."
                : fase.error === "illeggibile"
                  ? "La risposta non si lasciava leggere: riprova."
                  : "L'Oracolo non ha risposto. Riprova fra un momento."}
          </p>
          <button onClick={chiediOra} style={{ ...tasto(C.arcane), marginTop: 8 }}>
            Riprova
          </button>
        </div>
      );
  }
  const lavora = fase && fase.passo !== "errore";

  return (
    <section style={{ marginBottom: 26 }}>
      <h3 style={{ fontFamily: FONT_TITLE, fontSize: F.titoletto, color: C.arcane, marginBottom: 4 }}>
        Consigli dell'Oracolo
      </h3>
      {!giro && (
        <p style={{ fontSize: F.piccolo, color: C.muted, marginBottom: 12, lineHeight: 1.45 }}>
          Consigli su misura, a pagamento: l'Oracolo legge la tua biblioteca intera — voti, preferiti,
          abbandoni — e sceglie saghe, autori e scoperte pensando a te. Per rispondere l'Oracolo riceve titoli, autori, saghe, stato e voto dei tuoi libri —
          nessuna pagina — e ogni titolo lo ricontrollo nel catalogo di Open Library.
        </p>
      )}
      {stato}
      {!fase && !hasOracle() && !giro && (
        <div>
          <p style={{ ...riga(), marginBottom: 8 }}>
            Serve una chiave API di Anthropic (console.anthropic.com): resta solo su questo dispositivo e paghi
            solo quel che chiedi.
          </p>
          <CampoChiave onSalva={() => setChiave((n) => n + 1)} />
        </div>
      )}
      {!lavora && hasOracle() && !giro && fase?.passo !== "errore" && (
        <button onClick={chiediOra} style={tasto(C.arcane)}>
          ✨ Chiedi consigli
        </button>
      )}
      {giro && !lavora && (
        <>
          {sezioni.length === 0 ? (
            <p style={{ ...riga(), marginBottom: 12 }}>
              Dei consigli di questo giro non ne resta nessuno: li hai tenuti, scartati o sono già in libreria.
            </p>
          ) : (
            sezioni.map((g) => (
              <GruppoProposte key={g.chiave} gruppo={g} sotto onTieni={onTieni} onScarta={onScarta} />
            ))
          )}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: F.minuscolo, color: C.muted }}>
              Consigli del {quandoFu(giro.quando)}
              {giro.uso ? ` · costati ${soldi(costo(giro.uso))}` : ""}
            </span>
            <button onClick={chiediOra} style={tasto(C.arcane)}>
              ↻ Chiedine di nuovi
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default function DaPrendere({ books, onClose }) {
  const [lista, setLista] = useState(leggiDaPrendere);
  const [titolo, setTitolo] = useState("");
  const [autore, setAutore] = useState("");
  const [copiata, setCopiata] = useState(null);

  const salva = (nuova) => {
    scriviDaPrendere(nuova);
    setLista(nuova);
  };
  const gruppi = useMemo(() => proposte(books, lista), [books, lista]);
  // quel che una guida propone gia' non si ripete fra i consigli
  const gruppiVoci = useMemo(() => gruppi.flatMap((g) => g.voci), [gruppi]);
  const [giroCat, setGiroCat] = useState(leggiConsigliLiberi);
  const giaCat = useMemo(() => [...lista, ...gruppiVoci], [lista, gruppiVoci]);
  // l'Oracolo non ripete quel che il catalogo ha gia' proposto
  const giaOracolo = useMemo(
    () => [...gruppiVoci, ...daMostrare(giroCat?.consigli, books, giaCat, SEZIONI_CATALOGO).flatMap((g) => g.voci)],
    [gruppiVoci, giroCat, books, giaCat]
  );
  // gli arrivati in fondo: sono quelli da togliere, non da cercare
  const voci = useMemo(
    () =>
      vive(lista)
        .map((v) => ({ v, arr: arrivato(v, books) }))
        .sort((a, b) => Number(!!a.arr) - Number(!!b.arr) || (b.v.aggiunta || 0) - (a.v.aggiunta || 0)),
    [lista, books]
  );

  function aggiungiMia(e) {
    e.preventDefault();
    if (!titolo.trim()) return;
    salva(aggiungi(leggiDaPrendere(), { titolo, autore }));
    setTitolo("");
    setAutore("");
  }

  async function copia() {
    const testo = testoLista(lista, books);
    try {
      await navigator.clipboard.writeText(testo);
      setCopiata("si");
    } catch {
      setCopiata("no");
    }
    setTimeout(() => setCopiata(null), 2200);
  }

  const daCopiare = voci.some((x) => !x.arr);

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
          padding: "12px 14px",
          background: `${C.surface}f2`,
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={onClose}
            aria-label="Chiudi la lista"
            style={{ width: 40, height: 40, borderRadius: R.piccolo, fontSize: F.titoletto, color: C.text }}
          >
            ✕
          </button>
          <h2 style={{ flex: 1, minWidth: 0, fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text }}>
            🛒 Da prendere
          </h2>
          {daCopiare && (
            <button onClick={copia} style={tasto(copiata === "si" ? C.green : C.arcane)}>
              {copiata === "si" ? "✓ Copiata" : "⧉ Copia la lista"}
            </button>
          )}
        </div>
        {copiata === "no" && (
          <div style={{ marginTop: 8, fontSize: F.piccolo, color: C.accent }}>
            Gli appunti non si lasciano scrivere qui: tieni aperta questa pagina in libreria.
          </div>
        )}
      </div>

      <div style={{ maxWidth: px(720), margin: "0 auto", padding: "18px 16px 48px" }}>
        {/* un form vero: l'invio della tastiera aggiunge, senza cercare il tasto */}
        <form onSubmit={aggiungiMia} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          <input value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Titolo" style={campo()} />
          <input value={autore} onChange={(e) => setAutore(e.target.value)} placeholder="Autore (facoltativo)" style={campo()} />
          <button type="submit" disabled={!titolo.trim()} style={{ ...tasto(C.accent), opacity: titolo.trim() ? 1 : 0.5 }}>
            ＋ Aggiungi
          </button>
        </form>

        <h3 style={{ fontFamily: FONT_TITLE, fontSize: F.titoletto, color: C.accent, marginBottom: 10 }}>La tua lista</h3>
        {voci.length === 0 ? (
          <p style={{ color: C.muted, marginBottom: 24 }}>
            Ancora vuota. Scrivi qui sopra un titolo, o tieni uno dei consigli qui sotto.
          </p>
        ) : (
          <div style={{ marginBottom: 26 }}>
            {voci.map(({ v, arr }) => (
              <div
                key={v.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                  padding: "10px 14px",
                  borderRadius: R.piccolo,
                  border: `1px solid ${arr ? `${C.green}66` : C.border}`,
                  background: `linear-gradient(135deg, ${C.card}, ${C.surface})`,
                }}
              >
                <CopertinaVoce voce={v} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: F.corpo, color: C.text, fontWeight: 600 }}>{nomeVoce(v)}</span>
                  <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted }}>
                    {[v.autore, v.titolo && v.saga ? `${v.saga}${v.numero != null ? ` n° ${v.numero}` : ""}` : "", v.nota]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {arr && (
                    <span style={{ display: "block", fontSize: F.minuscolo, color: C.green, marginTop: 2 }}>
                      ✓ è arrivato in biblioteca{arr.title && arr.title !== v.titolo ? ` («${arr.title}»)` : ""}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => salva(togli(leggiDaPrendere(), v.id))}
                  aria-label="Togli dalla lista"
                  style={arr ? tasto(C.green) : { minHeight: 44, padding: 8, color: C.muted }}
                >
                  {arr ? "Togli" : "🗑"}
                </button>
              </div>
            ))}
          </div>
        )}

        <Catalogo
          books={books}
          giro={giroCat}
          setGiro={setGiroCat}
          gia={giaCat}
          onTieni={(v) => salva(tieni(leggiDaPrendere(), v))}
          onScarta={(v) => salva(scarta(leggiDaPrendere(), v.id))}
        />

        <Consigli
          books={books}
          lista={lista}
          gia={giaOracolo}
          onTieni={(v) => salva(tieni(leggiDaPrendere(), v))}
          onScarta={(v) => salva(scarta(leggiDaPrendere(), v.id))}
        />

        {gruppi.length > 0 && (
          <>
            <h3 style={{ fontFamily: FONT_TITLE, fontSize: F.titoletto, color: C.arcane, marginBottom: 4 }}>Dalle guide che conosco</h3>
            <p style={{ fontSize: F.piccolo, color: C.muted, marginBottom: 12, lineHeight: 1.45 }}>
              I volumi che ti mancano per andare avanti, dopo l'ultimo che hai letto, dalle guide di lettura che
              l'app conosce già — senza chiedere niente a nessuno.
            </p>
            {gruppi.map((g) => (
              <GruppoProposte
                key={`${g.saga}|${g.nome}`}
                gruppo={g}
                onTieni={(v) => salva(tieni(leggiDaPrendere(), v))}
                onScarta={(v) => salva(scarta(leggiDaPrendere(), v.id))}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

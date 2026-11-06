import { useEffect, useMemo, useRef, useState } from "react";
import { C, TEMA, FONT_TITLE, F, R, px } from "../data/constants.js";
import {
  IN_VISTA, NOME_LINGUA, SITO,
  cerca, capitoli, leggiSerie, scriviSerie, segui, smetti, cambiaLingua, conCapitoli, visti, nellaBiblioteca, daScaricare, spiega, ritmoComune,
} from "../lib/mangadex.js";

// LE SERIE SEGUITE SU MANGADEX (`lib/mangadex.js`): cerca una serie,
// seguila, vedi i capitoli, scarica quelli che vuoi (diventano CBZ nella
// biblioteca) e leggi dove stanno quelli che MangaDex non ospita. Le
// richieste passano dalla `rete` che arriva da App: quella del guscio
// Android (`lib/reteGuscio.js`), perche' MangaDex respinge le pagine web, o
// nel browser la fetch di sempre, che si sente dire la sfida.
const ritmoMangadex = ritmoComune;
const diretta = (url, opzioni) => fetch(url, opzioni);

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
const tasto = (colore, pieno = false) => ({
  minHeight: 44,
  padding: "8px 14px",
  borderRadius: R.tondo,
  border: `1px solid ${colore}66`,
  color: pieno ? C.bg : colore,
  background: pieno ? colore : "transparent",
  fontSize: F.piccolo,
  whiteSpace: "nowrap",
});

// LA COPERTINA DAL GUSCIO: il deposito di MangaDex respinge anche le
// immagini chieste da una pagina, quindi passano dalla rete del guscio e
// si mostrano dai loro byte (un indirizzo `blob:` da guardare, mai salvato)
function useImmagine(src, rete) {
  const [url, setUrl] = useState(rete ? null : src);
  useEffect(() => {
    if (!rete || !src) {
      setUrl(src);
      return;
    }
    let vivo = true;
    let fatto = null;
    rete(src)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((b) => {
        if (!vivo || !b) return;
        fatto = URL.createObjectURL(new Blob([b]));
        setUrl(fatto);
      })
      .catch(() => {});
    return () => {
      vivo = false;
      if (fatto) URL.revokeObjectURL(fatto);
    };
  }, [src, rete]);
  return url;
}

function Copertina({ src: indirizzo, lato = 56, rete = null }) {
  const src = useImmagine(indirizzo, rete);
  const [rotta, setRotta] = useState(false);
  if (!src || rotta) return <div style={{ width: px(lato), height: px(lato * 1.5), borderRadius: R.minimo, background: C.border, flexShrink: 0 }} />;
  return <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setRotta(true)} style={{ width: px(lato), height: px(lato * 1.5), objectFit: "cover", borderRadius: R.minimo, flexShrink: 0, background: C.border }} />;
}

const lingue = (s) => (s.lingue || []).map((l) => NOME_LINGUA[l] || l).join(", ");

export default function SerieSeguite({ books, onClose, onApri, onScarica, scarico = null, rete: reteGuscio = null, guscioVecchio = false }) {
  const rete = reteGuscio || diretta;
  const [lista, setLista] = useState(leggiSerie);
  const [testo, setTesto] = useState("");
  const [trovate, setTrovate] = useState(null);
  const [cercando, setCercando] = useState(false);
  const [guasto, setGuasto] = useState(null);
  // i capitoli di ogni serie, per id: { lista, guasto, caricando }
  const [capitoliDi, setCapitoliDi] = useState({});
  const [aperta, setAperta] = useState(null);
  const [tutti, setTutti] = useState({});
  const vivo = useRef(true);
  useEffect(() => () => void (vivo.current = false), []);

  const salva = (nuova) => {
    scriviSerie(nuova);
    setLista(nuova);
  };

  // IL CONTROLLO DI UNA SERIE: i capitoli, e la lista aggiornata coi nuovi
  async function controlla(serie) {
    setCapitoliDi((m) => ({ ...m, [serie.id]: { ...(m[serie.id] || {}), caricando: true, guasto: null } }));
    try {
      const caps = await capitoli(serie.id, { fetch: rete, ritmo: ritmoMangadex, lingua: serie.lingua });
      if (!vivo.current) return;
      setCapitoliDi((m) => ({ ...m, [serie.id]: { lista: caps, caricando: false, guasto: null } }));
      setLista((l) => scriviSerie(l.map((s) => (s.id === serie.id ? conCapitoli(s, caps) : s))));
    } catch (e) {
      if (!vivo.current) return;
      setCapitoliDi((m) => ({ ...m, [serie.id]: { ...(m[serie.id] || {}), caricando: false, guasto: spiega(e) } }));
    }
  }
  // all'apertura si controllano tutte, una dopo l'altra
  useEffect(() => {
    (async () => {
      for (const s of leggiSerie()) {
        if (!vivo.current) return;
        await controlla(s);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cercaOra(e) {
    e?.preventDefault?.();
    if (!testo.trim()) return;
    setCercando(true);
    setGuasto(null);
    try {
      const r = await cerca(testo, { fetch: rete, ritmo: ritmoMangadex });
      if (vivo.current) setTrovate(r);
    } catch (err) {
      if (vivo.current) setGuasto(spiega(err));
    } finally {
      if (vivo.current) setCercando(false);
    }
  }

  function seguiOra(trovata) {
    const nuova = segui(lista, trovata);
    salva(nuova);
    const s = nuova.find((x) => x.id === trovata.id);
    if (s) controlla(s);
  }
  function apri(serie) {
    const giaAperta = aperta === serie.id;
    setAperta(giaAperta ? null : serie.id);
    if (!giaAperta && serie.nuovi) salva(lista.map((s) => (s.id === serie.id ? visti(s) : s)));
  }
  function lingua(serie, l) {
    const nuova = cambiaLingua(lista, serie.id, l);
    salva(nuova);
    controlla(nuova.find((s) => s.id === serie.id));
  }

  const seguite = useMemo(() => new Set(lista.map((s) => s.id)), [lista]);
  const occupato = !!scarico;

  return (
    <div role="dialog" aria-label="Serie seguite" style={{ position: "fixed", inset: 0, zIndex: 40, overflowY: "auto", background: TEMA.gradient, animation: "bc-fade-in 0.35s ease-out" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 5, padding: "12px 14px", background: `${C.surface}f2`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onClose} aria-label="Chiudi le serie seguite" style={{ width: 40, height: 40, borderRadius: R.piccolo, fontSize: F.titoletto, color: C.text }}>
            ✕
          </button>
          <h2 style={{ flex: 1, minWidth: 0, fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text }}>📡 Serie seguite</h2>
        </div>
      </div>
      <div style={{ padding: "14px 14px 40px", maxWidth: px(760), margin: "0 auto" }}>
        <p style={{ fontSize: F.piccolo, color: C.muted, lineHeight: 1.45, marginBottom: 12 }}>
          I manga da MangaDex: cerchi una serie, la segui, e i capitoli che MangaDex ospita si scaricano nella biblioteca come
          fumetti, da leggere offline. I manga con licenza (One Piece, Kingdom…) lì hanno solo il rimando a chi li pubblica:
          si vede quando esce un capitolo nuovo e si legge là.
        </p>
        {/* nel guscio vecchio la rete non c'e': lo si dice prima di cercare */}
        {guscioVecchio && (
          <div style={{ fontSize: F.piccolo, color: C.accent, marginBottom: 10, lineHeight: 1.45 }}>
            ⚠ MangaDex respinge le pagine web: qui le richieste devono passare dall'app Android, e questa è una versione che non lo sa fare. Installa l'APK più recente.
          </div>
        )}
        <form onSubmit={cercaOra} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Cerca una serie su MangaDex" aria-label="Cerca una serie" style={campo()} />
          <button type="submit" disabled={cercando || !testo.trim()} style={tasto(C.accent, true)}>
            {cercando ? "Cerco…" : "Cerca"}
          </button>
        </form>
        {guasto && <div style={{ fontSize: F.piccolo, color: C.accent, marginBottom: 10 }}>⚠ {guasto}</div>}
        {trovate && (
          <div style={{ marginBottom: 18 }}>
            {!trovate.length && <div style={{ fontSize: F.nota, color: C.muted }}>Nessuna serie con questo nome, in inglese o in italiano.</div>}
            {trovate.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 6, borderRadius: R.piccolo, border: `1px dashed ${C.border}` }}>
                <Copertina src={s.copertina} lato={44} rete={reteGuscio} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: F.nota, color: C.text }}>{s.titolo}</span>
                  <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted }}>
                    {[s.autore, s.anno, lingue(s)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {seguite.has(s.id) ? (
                  <span style={{ fontSize: F.piccolo, color: C.green }}>✓ Seguita</span>
                ) : (
                  <button onClick={() => seguiOra(s)} style={tasto(C.accent)}>
                    ＋ Segui
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {!lista.length && !trovate && <div style={{ fontSize: F.nota, color: C.muted }}>Non segui ancora nessuna serie: cercane una qui sopra.</div>}
        {lista.map((serie) => {
          const c = capitoliDi[serie.id] || {};
          const caps = c.lista || [];
          const nuovi = daScaricare(caps, books, serie);
          const inVista = tutti[serie.id] ? caps : caps.slice(0, IN_VISTA);
          const espansa = aperta === serie.id;
          return (
            <section key={serie.id} style={{ marginBottom: 14, padding: 12, borderRadius: R.medio, border: `1px solid ${C.border}`, background: `${C.card}cc` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Copertina src={serie.copertina} rete={reteGuscio} />
                <button onClick={() => apri(serie)} aria-expanded={espansa} style={{ flex: 1, minWidth: 0, textAlign: "left", minHeight: 44, color: C.text }}>
                  <span style={{ display: "block", fontFamily: FONT_TITLE, fontSize: F.rilievo, fontWeight: 600 }}>{serie.titolo}</span>
                  <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted }}>
                    {[serie.autore, NOME_LINGUA[serie.lingua] || serie.lingua, serie.ultimo != null ? `ultimo capitolo: ${serie.ultimo}` : null].filter(Boolean).join(" · ")}
                  </span>
                  {c.caricando && <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted }}>controllo i capitoli…</span>}
                  {c.guasto && <span style={{ display: "block", fontSize: F.minuscolo, color: C.accent }}>⚠ {c.guasto}</span>}
                  {serie.nuovi > 0 && (
                    <span style={{ display: "inline-block", marginTop: 4, padding: "2px 8px", borderRadius: R.tondo, background: `${C.accent}33`, color: C.accent, fontSize: F.minuscolo }}>
                      {serie.nuovi === 1 ? "1 capitolo nuovo" : `${serie.nuovi} capitoli nuovi`}
                    </span>
                  )}
                </button>
                <span style={{ color: C.muted, fontSize: F.piccolo }}>{espansa ? "▴" : "▾"}</span>
              </div>
              {espansa && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    {nuovi.length > 0 && (
                      <button onClick={() => onScarica(serie, nuovi.slice(0, 10).reverse())} disabled={occupato} style={tasto(C.accent, true)}>
                        ⬇ Scarica {nuovi.length === 1 ? "il capitolo che manca" : `gli ultimi ${Math.min(10, nuovi.length)} che mancano`}
                      </button>
                    )}
                    {(serie.lingue || []).length > 1 &&
                      serie.lingue.map((l) => (
                        <button key={l} onClick={() => l !== serie.lingua && lingua(serie, l)} style={tasto(l === serie.lingua ? C.green : C.muted)} aria-pressed={l === serie.lingua}>
                          {NOME_LINGUA[l] || l}
                        </button>
                      ))}
                    <button onClick={() => controlla(serie)} disabled={!!c.caricando} style={tasto(C.muted)}>
                      ↻ Aggiorna
                    </button>
                    <a href={`${SITO}/title/${serie.id}`} target="_blank" rel="noopener noreferrer" style={{ ...tasto(C.muted), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                      ↗ Su MangaDex
                    </a>
                    <button onClick={() => salva(smetti(lista, serie.id))} style={tasto(C.muted)}>
                      Smetti di seguire
                    </button>
                  </div>
                  {!caps.length && !c.caricando && <div style={{ fontSize: F.nota, color: C.muted }}>Nessun capitolo in {NOME_LINGUA[serie.lingua] || serie.lingua}.</div>}
                  {inVista.map((cap) => {
                    const libro = nellaBiblioteca(books, serie, cap);
                    const ospitato = !cap.esterno && cap.pagine > 0;
                    return (
                      <div key={cap.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${C.border}55` }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: F.nota, color: C.text }}>
                          {cap.numero != null ? `Cap. ${cap.numero}` : "Fuori numero"}
                          {cap.titolo ? ` · ${cap.titolo}` : ""}
                          <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted }}>
                            {[cap.gruppo, cap.data ? new Date(cap.data).toLocaleDateString("it-IT") : null, ospitato ? `${cap.pagine} pagine` : null].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        {libro ? (
                          <button onClick={() => onApri(libro.id)} style={tasto(C.green)}>
                            📖 Leggi
                          </button>
                        ) : cap.esterno ? (
                          <a href={cap.esterno} target="_blank" rel="noopener noreferrer" style={{ ...tasto(C.arcane), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                            ↗ Leggi là
                          </a>
                        ) : ospitato ? (
                          <button onClick={() => onScarica(serie, [cap])} disabled={occupato} style={tasto(C.accent)}>
                            ⬇ Scarica
                          </button>
                        ) : (
                          <span style={{ fontSize: F.minuscolo, color: C.muted }}>senza pagine</span>
                        )}
                      </div>
                    );
                  })}
                  {caps.length > inVista.length && (
                    <button onClick={() => setTutti((t) => ({ ...t, [serie.id]: true }))} style={{ ...tasto(C.muted), marginTop: 8 }}>
                      Mostra tutti i {caps.length} capitoli
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

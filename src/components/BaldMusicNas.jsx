import { useEffect, useState } from "react";
import { C, FONT_TITLE, F, R, px } from "../data/constants.js";
import { Faccia, Icona } from "./Ascolto.jsx";
import { collegato, credenziali, salvaCollegamento, provaServer, raccolteNavidrome, braniNavidrome, fraseNavidrome } from "../lib/navidrome.js";
import { puntoDi, doveDi, minuti } from "../lib/music.js";

// le raccolte gia' chieste in questa apertura dell'app: tornando dalla pagina
// di una raccolta la griglia c'e' subito, senza richiederla al NAS
let ricordate = null;

// LE RACCOLTE E LE PLAYLIST DI BALDMUSIC, nella sala della musica
// (`lib/navidrome.js`): si collega una volta per dispositivo, poi si
// ascoltano in streaming dal NAS come quelle di qui.
export default function BaldMusicNas({ playerRef, queue, playing, cerca = "", onApri }) {
  const [cred, setCred] = useState(() => collegato());
  const [modulo, setModulo] = useState(false);
  const [base, setBase] = useState("");
  const [utente, setUtente] = useState("");
  const [password, setPassword] = useState("");
  const [esito, setEsito] = useState(null); // { ok, frase }
  const [provo, setProvo] = useState(false);
  const [raccolte, setRaccolteStato] = useState(() => (collegato() ? ricordate : null));
  const setRaccolte = (r) => {
    ricordate = r;
    setRaccolteStato(r);
  };
  const [menu, setMenu] = useState(false);

  async function carica(c = cred) {
    if (!c) return;
    setEsito(null);
    try {
      setRaccolte(await raccolteNavidrome(c));
    } catch (e) {
      setRaccolte(null);
      setEsito({ ok: false, frase: fraseNavidrome(e) });
    }
  }
  useEffect(() => {
    if (!ricordate) carica();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function collega() {
    const c = credenziali(base, utente, password);
    if (!c.base || !c.utente) return setEsito({ ok: false, frase: "Scrivi l'indirizzo di Navidrome (lo stesso di BaldMusic) e il tuo utente." });
    setProvo(true);
    setEsito({ ok: null, frase: "Busso a Navidrome…" });
    try {
      await provaServer(c);
      salvaCollegamento(c);
      setCred(c);
      setPassword("");
      setModulo(false);
      await carica(c);
    } catch (e) {
      setEsito({ ok: false, frase: fraseNavidrome(e) });
    } finally {
      setProvo(false);
    }
  }

  function scollega() {
    salvaCollegamento(null);
    setCred(null);
    setRaccolte(null);
    setMenu(false);
  }

  async function suona(r, da = 0) {
    try {
      const brani = await braniNavidrome(cred, r.id);
      if (!playerRef.current?.playQueue(brani, false, { da, raccolta: r.id, nome: r.name })) setEsito({ ok: false, frase: `«${r.name}» è vuota.` });
    } catch (e) {
      setEsito({ ok: false, frase: fraseNavidrome(e) });
    }
  }
  // LA RACCOLTA SI APRE COME UNA PAGINA, come quelle di qui (il lettore:
  // «mi è possibile vedere i brani della raccolta?»: l'elenco sotto la
  // griglia finiva in fondo e non si vedeva)
  const apri = (r) => onApri?.(r.id);

  const campo = { flex: 1, minWidth: 160, minHeight: 44, padding: "0 12px", borderRadius: R.piccolo, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: F.nota };
  const pillola = (acceso = false) => ({ minHeight: 44, padding: "0 16px", borderRadius: R.tondo, fontSize: F.nota, border: `1px solid ${acceso ? C.accent : C.border}`, color: acceso ? C.accent : C.muted, flexShrink: 0 });
  const titoletto = { fontFamily: FONT_TITLE, fontWeight: 600, fontSize: F.titoletto, color: C.text, margin: "22px 0 8px" };
  const griglia = { display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${px(140)}px, 1fr))`, gap: 14, alignItems: "start" };
  const frase = esito && (
    <p role="status" style={{ fontSize: F.piccolo, color: esito.ok === false ? C.accent : C.muted, lineHeight: 1.45, margin: "8px 2px" }}>
      {esito.frase}
    </p>
  );

  if (!cred)
    return (
      <section aria-label="BaldMusic sul NAS">
        <h3 style={titoletto}>🎧 BaldMusic sul NAS</h3>
        {!modulo ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <p style={{ flex: 1, minWidth: 200, fontSize: F.piccolo, color: C.muted, lineHeight: 1.5 }}>
              Le raccolte e le playlist di BaldMusic, in streaming da Navidrome: niente da caricare qui.
            </p>
            <button onClick={() => setModulo(true)} style={pillola(true)}>
              Collega Navidrome
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: F.piccolo, color: C.muted, lineHeight: 1.5 }}>
              Indirizzo, utente e password sono quelli di BaldMusic. Su questo dispositivo resta solo un gettone, mai la password: non te li richiede più.
            </p>
            <input aria-label="Indirizzo di Navidrome" value={base} onChange={(e) => setBase(e.target.value)} placeholder="nas.tuarete.ts.net" autoCapitalize="none" autoCorrect="off" spellCheck={false} style={campo} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input aria-label="Utente di Navidrome" value={utente} onChange={(e) => setUtente(e.target.value)} placeholder="Utente" autoCapitalize="none" autoComplete="username" style={campo} />
              <input aria-label="Password di Navidrome" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && collega()} placeholder="Password" autoComplete="current-password" style={campo} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={collega} disabled={provo} style={pillola(true)}>
                {provo ? "Collego…" : "Collega"}
              </button>
              <button onClick={() => { setModulo(false); setEsito(null); }} style={pillola()}>
                Annulla
              </button>
            </div>
          </div>
        )}
        {frase}
      </section>
    );

  const q = cerca.trim().toLowerCase();
  const viste = (raccolte || []).filter((r) => !q || r.name.toLowerCase().includes(q));
  const casella = (r) => {
    const inAscolto = queue?.raccolta === r.id || queue?.origine === r.id;
    return (
      <div key={r.id} style={{ minWidth: 0 }}>
        <div style={{ position: "relative" }}>
          <button onClick={() => apri(r)} aria-label={`Apri ${r.name}`} style={{ display: "block", width: "100%", padding: 0 }}>
            <Faccia nome={r.name} piena viva={inAscolto && playing} />
          </button>
          {r.brani > 0 && (
            <button
              onClick={() => suona(r)}
              aria-label={`Suona ${r.name}`}
              style={{ width: 44, height: 44, borderRadius: R.tondo, display: "flex", alignItems: "center", justifyContent: "center", position: "absolute", right: 8, bottom: 8, background: `linear-gradient(180deg, ${C.accent}, ${C.accentDeep})`, color: C.onAccent, boxShadow: `0 2px 10px ${C.bg}aa` }}
            >
              <Icona nome="play" misura={22} />
            </button>
          )}
        </div>
        <button onClick={() => apri(r)} style={{ display: "block", width: "100%", minHeight: 44, padding: "8px 2px 4px", textAlign: "left" }}>
          <span style={{ display: "block", fontSize: F.corpo, color: inAscolto ? C.accent : C.text, lineHeight: 1.3, overflowWrap: "break-word" }}>{r.name}</span>
          <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted, marginTop: 2 }}>
            {[`${r.brani} ${r.brani === 1 ? "brano" : "brani"}`, "sul NAS", inAscolto ? (playing ? "♫ in ascolto" : "in pausa") : null].filter(Boolean).join(" · ")}
          </span>
        </button>
      </div>
    );
  };
  const perTipo = (tipo) => viste.filter((r) => r.tipo === tipo);
  const blocco = (tipo, titolo) => {
    const gruppo = perTipo(tipo);
    if (!gruppo.length) return null;
    return (
      <>
        <p style={{ fontSize: F.piccolo, color: C.muted, margin: "10px 2px 8px" }}>{titolo}</p>
        <div style={griglia}>{gruppo.map(casella)}</div>
      </>
    );
  };

  if (q && raccolte && !viste.length) return null;
  return (
    <section aria-label="BaldMusic sul NAS">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h3 style={{ ...titoletto, flex: 1 }}>🎧 BaldMusic sul NAS</h3>
        <button onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label="Altro per BaldMusic" style={{ ...pillola(menu), width: 44, padding: 0, marginTop: 14 }}>
          ⋯
        </button>
      </div>
      {menu && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <button onClick={() => { setMenu(false); carica(); }} style={pillola()}>
            ⟳ Aggiorna
          </button>
          <button onClick={scollega} style={pillola()}>
            Scollega da questo dispositivo
          </button>
        </div>
      )}
      {raccolte == null && !esito && <p style={{ fontSize: F.piccolo, color: C.muted }}>Chiedo le raccolte a Navidrome…</p>}
      {raccolte && raccolte.length === 0 && <p style={{ fontSize: F.piccolo, color: C.muted }}>Su BaldMusic non ci sono ancora raccolte né playlist.</p>}
      {blocco("raccolta", "Raccolte")}
      {blocco("playlist", "Playlist")}
      {frase}
      {esito?.ok === false && (
        <button onClick={() => carica()} style={{ ...pillola(), marginTop: 4 }}>
          Riprova
        </button>
      )}
    </section>
  );
}

// LA PAGINA DI UNA RACCOLTA DI BALDMUSIC: tutti i suoi brani da scegliere,
// «Suona» da dove eri e «Casuale»; l'indietro la chiude (App, `raccoltaMusica`)
export function PaginaBaldMusic({ id, playerRef, queue, playing, current, onChiudi, cerca = "" }) {
  const cred = collegato();
  const [brani, setBrani] = useState(null);
  const [errore, setErrore] = useState(null);
  const r = (ricordate || []).find((x) => x.id === id) || { id, name: queue?.origine === id && queue?.nome ? queue.nome : "BaldMusic", tipo: "raccolta" };
  useEffect(() => {
    let vivo = true;
    if (!cred) return setErrore("Navidrome non è collegato su questo dispositivo.");
    braniNavidrome(cred, id)
      .then((b) => vivo && setBrani(b))
      .catch((e) => vivo && setErrore(fraseNavidrome(e)));
    return () => {
      vivo = false;
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const inAscolto = queue?.raccolta === id || queue?.origine === id;
  const dove = brani ? doveDi(r, brani) : 0;
  const punto = brani?.length ? puntoDi(brani[dove]) : 0;
  const suona = (da = 0, casuale = false) => brani?.length && playerRef.current?.playQueue(brani, casuale, { da, raccolta: id, nome: r.name });
  const q = cerca.trim().toLowerCase();
  const visti = (brani || []).map((b, i) => ({ b, i })).filter(({ b }) => !q || b.name.toLowerCase().includes(q));
  const pillola = (acceso = false) => ({ minHeight: 44, padding: "0 16px", borderRadius: R.tondo, fontSize: F.nota, border: `1px solid ${acceso ? C.accent : C.border}`, color: acceso ? C.accent : C.muted, flexShrink: 0 });
  const pieno = { minHeight: 44, padding: "0 20px", borderRadius: R.tondo, fontSize: F.corpo, fontWeight: 600, background: `linear-gradient(180deg, ${C.accent}, ${C.accentDeep})`, color: C.onAccent };

  return (
    <div>
      <button onClick={onChiudi} style={pillola()}>
        ‹ Le raccolte
      </button>
      <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "14px 0 6px", flexWrap: "wrap" }}>
        <div style={{ width: px(120), flexShrink: 0 }}>
          <Faccia nome={r.name} piena viva={inAscolto && playing} />
        </div>
        <div style={{ flex: 1, minWidth: px(200) }}>
          <h2 style={{ fontFamily: FONT_TITLE, fontWeight: 600, fontSize: F.titolo, color: C.text, lineHeight: 1.25, overflowWrap: "break-word" }}>{r.name}</h2>
          <div style={{ fontSize: F.piccolo, color: C.muted, marginTop: 4, lineHeight: 1.4 }}>
            {[
              r.tipo === "playlist" ? "playlist di BaldMusic" : "raccolta di BaldMusic",
              brani ? `${brani.length} ${brani.length === 1 ? "brano" : "brani"}` : null,
              inAscolto ? (playing ? "♫ in ascolto" : "in pausa") : brani && (dove > 0 || punto > 0) ? `eri a «${brani[dove].name}»${punto ? `, ${minuti(punto)}` : ""}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      </div>
      {brani?.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
          {inAscolto ? (
            <button onClick={() => (playing ? playerRef.current?.pause() : playerRef.current?.resume())} style={pieno}>
              {playing ? "⏸ Pausa" : "▶ Riprendi"}
            </button>
          ) : (
            <button onClick={() => suona(dove)} style={pieno}>
              {dove > 0 || punto > 0 ? "▶ Riprendi" : "▶ Suona"}
            </button>
          )}
          {brani.length > 1 && (
            <button onClick={() => suona(0, true)} style={pillola()}>
              🔀 Casuale
            </button>
          )}
        </div>
      )}
      {errore && <p role="status" style={{ fontSize: F.piccolo, color: C.accent, lineHeight: 1.45 }}>{errore}</p>}
      {!brani && !errore && <p style={{ fontSize: F.piccolo, color: C.muted }}>Chiedo i brani al NAS…</p>}
      {brani && brani.length === 0 && <p style={{ fontSize: F.piccolo, color: C.muted }}>Nessun brano.</p>}
      {brani && q && !visti.length && <p style={{ fontSize: F.piccolo, color: C.muted }}>Niente per «{cerca.trim()}».</p>}
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {visti.map(({ b, i }) => {
          const ora = inAscolto && current?.nd === b.nd;
          return (
            <li key={`${b.id}-${i}`}>
              <button onClick={() => suona(i)} style={{ display: "flex", gap: 12, width: "100%", minHeight: 48, alignItems: "center", textAlign: "left", padding: "6px 4px", borderTop: i ? `1px solid ${C.border}` : "none" }}>
                <span style={{ width: px(28), textAlign: "right", fontSize: F.piccolo, color: ora ? C.accent : C.muted, flexShrink: 0 }}>{ora ? "♫" : i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: F.corpo, color: ora ? C.accent : C.text, overflowWrap: "break-word" }}>{b.name}</span>
                {b.durata > 0 && <span style={{ fontSize: F.minuscolo, color: C.muted, flexShrink: 0 }}>{puntoDi(b) > 0 ? `riprende · ${minuti(b.durata)}` : minuti(b.durata)}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

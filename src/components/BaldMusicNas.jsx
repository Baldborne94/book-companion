import { useEffect, useState } from "react";
import { C, FONT_TITLE, F, R, px } from "../data/constants.js";
import { Faccia, Icona } from "./Ascolto.jsx";
import { collegato, credenziali, salvaCollegamento, provaServer, raccolteNavidrome, braniNavidrome, fraseNavidrome } from "../lib/navidrome.js";
import { puntoDi } from "../lib/music.js";

// LE RACCOLTE E LE PLAYLIST DI BALDMUSIC, nella sala della musica
// (`lib/navidrome.js`): si collega una volta per dispositivo, poi si
// ascoltano in streaming dal NAS come quelle di qui.
export default function BaldMusicNas({ playerRef, queue, playing, cerca = "" }) {
  const [cred, setCred] = useState(() => collegato());
  const [modulo, setModulo] = useState(false);
  const [base, setBase] = useState("");
  const [utente, setUtente] = useState("");
  const [password, setPassword] = useState("");
  const [esito, setEsito] = useState(null); // { ok, frase }
  const [provo, setProvo] = useState(false);
  const [raccolte, setRaccolte] = useState(null);
  const [aperta, setAperta] = useState(null); // { id, brani | null }
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
    carica();
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
    setAperta(null);
    setMenu(false);
  }

  async function braniDi(r) {
    if (aperta?.id === r.id && aperta.brani) return aperta.brani;
    return braniNavidrome(cred, r.id);
  }
  async function suona(r, da = 0) {
    try {
      const brani = await braniDi(r);
      if (!playerRef.current?.playQueue(brani, false, { da, raccolta: r.id, nome: r.name })) setEsito({ ok: false, frase: `«${r.name}» è vuota.` });
    } catch (e) {
      setEsito({ ok: false, frase: fraseNavidrome(e) });
    }
  }
  async function apri(r) {
    if (aperta?.id === r.id) return setAperta(null);
    setAperta({ id: r.id, brani: null });
    try {
      const brani = await braniNavidrome(cred, r.id);
      setAperta((a) => (a?.id === r.id ? { id: r.id, brani } : a));
    } catch (e) {
      setAperta(null);
      setEsito({ ok: false, frase: fraseNavidrome(e) });
    }
  }

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
          <button onClick={() => apri(r)} aria-expanded={aperta?.id === r.id} aria-label={`Apri ${r.name}`} style={{ display: "block", width: "100%", padding: 0 }}>
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
  const elenco = (gruppo) => {
    const r = gruppo.find((x) => x.id === aperta?.id);
    if (!r) return null;
    return (
      <div style={{ marginTop: 10, padding: 10, borderRadius: R.medio, border: `1px solid ${C.border}` }}>
        <p style={{ fontSize: F.nota, color: C.text, margin: "0 2px 6px" }}>{r.name}</p>
        {!aperta.brani ? (
          <p style={{ fontSize: F.piccolo, color: C.muted, margin: 2 }}>Chiedo i brani al NAS…</p>
        ) : aperta.brani.length === 0 ? (
          <p style={{ fontSize: F.piccolo, color: C.muted, margin: 2 }}>Nessun brano.</p>
        ) : (
          <ol style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: px(360), overflowY: "auto" }}>
            {aperta.brani.map((b, i) => (
              <li key={`${b.id}-${i}`}>
                <button onClick={() => suona(r, i)} style={{ display: "flex", gap: 10, width: "100%", minHeight: 44, alignItems: "center", textAlign: "left", padding: "4px 2px", borderTop: i ? `1px solid ${C.border}` : "none" }}>
                  <span style={{ width: px(24), textAlign: "right", fontSize: F.minuscolo, color: C.muted }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: F.nota, color: C.text, overflowWrap: "break-word" }}>{b.name}</span>
                  {puntoDi(b) > 0 && <span style={{ fontSize: F.minuscolo, color: C.muted }}>riprende</span>}
                </button>
              </li>
            ))}
          </ol>
        )}
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
        {elenco(gruppo)}
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

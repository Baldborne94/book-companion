import { useEffect, useState } from "react";
import { C, FONT_TITLE, F, R } from "../data/constants.js";
import { isSyncConfigured } from "../lib/supabase.js";
import {
  getSession,
  signIn,
  signOut,
  getLastSync,
  cloudUsage,
  entraConPassword,
  registraConPassword,
  cambiaPassword,
} from "../lib/sync.js";
import { spiegaAccesso, passwordCorta, MIN_PASSWORD } from "../lib/accesso.js";
import { fmtBytes } from "../lib/bytes.js";
// il riferimento del piano sta in UN posto solo: prima era un numero qui e
// la stringa «1 GB» due righe sotto, due cose da cambiare insieme e da
// dimenticare separatamente
import { PIANO, PIENO, parteDelPiano, fetta } from "../lib/spazio.js";


function Spazio({ dati }) {
  if (dati === undefined) return <p style={{ color: C.muted, fontSize: F.piccolo }}>Conto lo spazio…</p>;
  if (!dati) return null;
  const { libri, copertine, melodie, totale } = dati;
  const pieno = parteDelPiano(totale) ?? 0;
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: F.nota, color: C.text }}>{fmtBytes(totale)} lassù</span>
        <span style={{ fontSize: F.minuscolo, color: C.muted }}>di {fmtBytes(PIANO)} del piano gratuito</span>
      </div>
      <div style={{ display: "flex", height: 8, borderRadius: R.minimo, overflow: "hidden", background: C.dim }}>
        <div style={{ width: fetta(libri.byte + copertine.byte), background: C.accent }} />
        <div style={{ width: fetta(melodie.byte), background: C.arcane }} />
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontSize: F.minuscolo, color: C.muted }}>
        <span>
          <span style={{ color: C.accent }}>■</span> {libri.quanti} {libri.quanti === 1 ? "libro" : "libri"} ·{" "}
          {fmtBytes(libri.byte + copertine.byte)}
        </span>
        <span>
          <span style={{ color: C.arcane }}>■</span> {melodie.quanti}{" "}
          {melodie.quanti === 1 ? "melodia" : "melodie"} · {fmtBytes(melodie.byte)}
        </span>
      </div>
      {pieno > PIENO && (
        <p style={{ margin: "8px 0 0", fontSize: F.minuscolo, color: C.accent, lineHeight: 1.45 }}>
          Lo spazio sta finendo. Le melodie pesano molto più dei libri: quelle che non ti servono a
          schermo spento possono tornare a essere un link YouTube, che non occupa niente.
        </p>
      )}
    </div>
  );
}

const fmtWhen = (ts) => {
  if (!ts) return "mai";
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "poco fa";
  if (mins < 60) return `${mins} min fa`;
  return new Date(ts).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Il campo, uguale per email e password: due caselle scritte a mano
// prenderebbero strade diverse alla prima modifica.
const campo = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: R.piccolo,
  border: `1px solid ${C.border}`,
  background: C.bg,
  color: C.text,
  fontSize: F.corpo,
  outline: "none",
};

export default function SyncPanel({ status, onClose, onSync, notify }) {
  const [session, setSession] = useState(undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  // Quello che non ha funzionato si scrive QUI, sotto i campi, non in un
  // avviso che scorre via: chi ha appena sbagliato la password deve poter
  // rileggere il perche' mentre la riscrive.
  const [guaio, setGuaio] = useState(null);
  const [confermare, setConfermare] = useState(false);
  // la password si cambia da dentro, ed e' anche il modo di darsene una
  // dopo essere entrati col link
  const [nuova, setNuova] = useState(null);

  const [spazio, setSpazio] = useState(undefined);

  useEffect(() => {
    getSession().then(setSession);
  }, [status.at]);

  // il conto si rifa' a ogni sincronizzazione finita: e' proprio quando puo'
  // essere cambiato
  useEffect(() => {
    if (!session) return;
    let vivo = true;
    setSpazio(undefined);
    cloudUsage().then((d) => vivo && setSpazio(d));
    return () => { vivo = false; };
  }, [session, status.at]);

  async function handleSignIn() {
    const e = email.trim();
    if (!e || busy) return;
    setBusy(true);
    setGuaio(null);
    try {
      await signIn(e);
      setSent(true);
    } catch (err) {
      setGuaio(spiegaAccesso(err));
    } finally {
      setBusy(false);
    }
  }

  // Entrare e registrarsi sono la stessa fatica con una chiamata diversa,
  // e soprattutto lo stesso posto dove scrivere cos'e' andato storto.
  async function conPassword(registra) {
    const e = email.trim();
    if (!e || busy) return;
    setGuaio(null);
    if (passwordCorta(password)) {
      setGuaio(`La password vuole almeno ${MIN_PASSWORD} caratteri.`);
      return;
    }
    setBusy(true);
    try {
      if (registra) {
        const { dentro } = await registraConPassword(e, password);
        // se il progetto chiede la conferma dell'indirizzo la sessione non
        // arriva: senza dirlo, il pannello resterebbe fermo senza motivo
        if (!dentro) {
          setConfermare(true);
          return;
        }
      } else {
        await entraConPassword(e, password);
      }
      setPassword("");
      setSession(await getSession());
      notify("Dentro. La biblioteca comincia a sincronizzarsi 🕯️");
      onSync?.();
    } catch (err) {
      setGuaio(spiegaAccesso(err));
    } finally {
      setBusy(false);
    }
  }

  async function salvaPassword() {
    if (passwordCorta(nuova)) {
      setGuaio(`La password vuole almeno ${MIN_PASSWORD} caratteri.`);
      return;
    }
    setBusy(true);
    setGuaio(null);
    try {
      await cambiaPassword(nuova);
      setNuova(null);
      notify("Password salvata: la prossima volta entri con quella 🔑");
    } catch (err) {
      setGuaio(spiegaAccesso(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    setSession(null);
    setPassword("");
    notify("Uscito. I libri restano su questo dispositivo 🕯️");
  }

  return (
    <div
      onClick={onClose}
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
          maxWidth: 460,
          borderRadius: R.grande,
          border: `1px solid ${C.border}`,
          background: `linear-gradient(180deg, ${C.card}, ${C.surface})`,
          boxShadow: `0 0 60px ${C.arcane}22, 0 20px 50px #00000088`,
          padding: 22,
        }}
      >
        <h2
          style={{
            fontFamily: FONT_TITLE,
            fontSize: F.titolo,
            fontWeight: 600,
            color: C.text,
            marginBottom: 6,
          }}
        >
          ☁️ La biblioteca ovunque
        </h2>

        {!isSyncConfigured() ? (
          <p style={{ color: C.muted, fontSize: F.nota, lineHeight: 1.5 }}>
            La sincronizzazione non è ancora configurata. Servono le due chiavi del progetto
            Supabase nelle variabili d'ambiente (<code>VITE_SUPABASE_URL</code> e{" "}
            <code>VITE_SUPABASE_ANON_KEY</code>): le istruzioni complete sono in{" "}
            <code>.env.example</code> e <code>supabase/schema.sql</code>. Fino ad allora la
            biblioteca resta su questo dispositivo, come è sempre stata.
          </p>
        ) : session === undefined ? (
          <p style={{ color: C.muted }}>Un momento…</p>
        ) : session ? (
          <>
            <p style={{ color: C.muted, fontSize: F.nota, marginBottom: 16 }}>
              Connesso come <span style={{ color: C.text }}>{session.user.email}</span>
              <br />
              Ultima sincronizzazione: {fmtWhen(getLastSync())}
            </p>
            {status.message && (
              <p style={{ color: C.arcane, fontSize: F.nota, marginBottom: 12 }}>{status.message}</p>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={onSync}
                disabled={status.busy}
                style={{
                  flex: 1,
                  minWidth: 150,
                  padding: "11px 18px",
                  borderRadius: R.piccolo,
                  background: status.busy ? C.dim : `linear-gradient(180deg, ${C.accent}, ${C.accentDeep})`,
                  color: status.busy ? C.muted : C.onAccent,
                  fontWeight: 600,
                  fontSize: F.corpo,
                }}
              >
                {status.busy ? "Sincronizzo…" : "🔄 Sincronizza ora"}
              </button>
              <button
                onClick={handleSignOut}
                style={{
                  padding: "11px 18px",
                  borderRadius: R.piccolo,
                  border: `1px solid ${C.border}`,
                  color: C.muted,
                  fontSize: F.corpo,
                }}
              >
                Esci
              </button>
            </div>
            {/* Chi e' entrato col link puo' darsi una password e non
                dipenderne piu'; ed e' anche la strada per rimetterne una
                dimenticata, senza una pagina di recupero tutta sua. */}
            {nuova === null ? (
              <button
                onClick={() => { setNuova(""); setGuaio(null); }}
                style={{ marginTop: 12, color: C.muted, fontSize: F.nota, textDecoration: "underline" }}
              >
                🔑 Cambia la password
              </button>
            ) : (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  value={nuova}
                  onChange={(e) => setNuova(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && salvaPassword()}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nuova password"
                  style={{ ...campo, flex: 1, minWidth: 160, width: "auto" }}
                />
                <button
                  onClick={salvaPassword}
                  disabled={busy}
                  style={{
                    padding: "10px 18px",
                    borderRadius: R.piccolo,
                    border: `1px solid ${C.accent}88`,
                    color: C.accent,
                    fontSize: F.nota,
                  }}
                >
                  Salva
                </button>
                <button onClick={() => { setNuova(null); setGuaio(null); }} style={{ color: C.muted, fontSize: F.nota }}>
                  Lascia stare
                </button>
              </div>
            )}
            {guaio && (
              <p style={{ marginTop: 10, color: C.red, fontSize: F.nota, lineHeight: 1.45 }}>{guaio}</p>
            )}
            <Spazio dati={spazio} />
          </>
        ) : confermare ? (
          <p style={{ color: C.text, fontSize: F.corpo, lineHeight: 1.55 }}>
            ✉️ Registrato. Ti ho mandato una conferma a <strong>{email.trim()}</strong>.<br />
            <span style={{ color: C.muted, fontSize: F.nota }}>
              Apri quel messaggio una volta sola: da lì in poi entri con email e password, su
              questo dispositivo e su ogni altro.
            </span>
          </p>
        ) : sent ? (
          <p style={{ color: C.text, fontSize: F.corpo, lineHeight: 1.55 }}>
            ✉️ Ti ho mandato un link a <strong>{email.trim()}</strong>.<br />
            <span style={{ color: C.muted, fontSize: F.nota }}>
              Aprilo da questo dispositivo: tornerai qui già connesso, e la biblioteca comincerà
              a sincronizzarsi da sola.
            </span>
          </p>
        ) : (
          <>
            <p style={{ color: C.muted, fontSize: F.nota, lineHeight: 1.5, marginBottom: 14 }}>
              Entra con email e password: libri, segnalibri, evidenziazioni, note e progressi ti
              seguiranno su ogni dispositivo. La prima volta scegli «Registrati».
            </p>
            {/* Un `form` vero, non due caselle sciolte: e' cosi' che il
                portachiavi del tablet capisce che c'e' un accesso da
                ricordare e te lo ripropone la volta dopo — che e' tutto il
                motivo per cui una password batte il link per posta. E il
                tasto «vai» della tastiera Android finisce qui dentro. */}
            <form
              onSubmit={(e) => { e.preventDefault(); conPassword(false); }}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                inputMode="email"
                autoComplete="username"
                placeholder="la-tua@email.it"
                style={campo}
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="password"
                style={campo}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    flex: 1,
                    minWidth: 130,
                    padding: "10px 20px",
                    borderRadius: R.piccolo,
                    background: `linear-gradient(180deg, ${C.accent}, ${C.accentDeep})`,
                    color: C.onAccent,
                    fontWeight: 600,
                    fontSize: F.corpo,
                  }}
                >
                  {busy ? "…" : "Entra"}
                </button>
                <button
                  type="button"
                  onClick={() => conPassword(true)}
                  disabled={busy}
                  style={{
                    padding: "10px 18px",
                    borderRadius: R.piccolo,
                    border: `1px solid ${C.arcane}66`,
                    color: C.arcane,
                    fontSize: F.corpo,
                  }}
                >
                  Registrati
                </button>
              </div>
            </form>
            {guaio && (
              <p style={{ marginTop: 10, color: C.red, fontSize: F.nota, lineHeight: 1.45 }}>{guaio}</p>
            )}
            {/* La strada di prima resta, ed e' quella che serve quando la
                password non ce l'hai piu': si entra col link e da dentro se
                ne rimette una. */}
            <button
              onClick={handleSignIn}
              disabled={busy}
              style={{ marginTop: 12, color: C.muted, fontSize: F.nota, textDecoration: "underline" }}
            >
              Password dimenticata? Mandami il link per email
            </button>
          </>
        )}

        <div style={{ marginTop: 18, textAlign: "right" }}>
          <button onClick={onClose} style={{ color: C.muted, fontSize: F.nota }}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

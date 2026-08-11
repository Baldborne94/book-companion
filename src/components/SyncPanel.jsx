import { useEffect, useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { isSyncConfigured } from "../lib/supabase.js";
import { getSession, signIn, signOut, getLastSync, cloudUsage } from "../lib/sync.js";
import { fmtBytes } from "../lib/bytes.js";

// Il piano gratuito di Supabase da' un gigabyte. Non e' una quota che si
// possa chiedere al server — dipende dal piano — quindi qui e' un
// RIFERIMENTO dichiarato, non una misura: la barra dice «quanto ci sta in un
// piano gratuito», e chi ne ha uno piu' grande sa di avere piu' margine.
const GRATIS = 1e9;

function Spazio({ dati }) {
  if (dati === undefined) return <p style={{ color: C.muted, fontSize: 13.5 }}>Conto lo spazio…</p>;
  if (!dati) return null;
  const { libri, copertine, melodie, totale } = dati;
  const fetta = (n) => `${Math.min(100, (n / GRATIS) * 100)}%`;
  const pieno = totale / GRATIS;
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: 14.5, color: C.text }}>{fmtBytes(totale)} lassù</span>
        <span style={{ fontSize: 12.5, color: C.muted }}>di 1 GB del piano gratuito</span>
      </div>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: C.dim }}>
        <div style={{ width: fetta(libri.byte + copertine.byte), background: C.accent }} />
        <div style={{ width: fetta(melodie.byte), background: C.arcane }} />
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontSize: 12.5, color: C.muted }}>
        <span>
          <span style={{ color: C.accent }}>■</span> {libri.quanti} {libri.quanti === 1 ? "libro" : "libri"} ·{" "}
          {fmtBytes(libri.byte + copertine.byte)}
        </span>
        <span>
          <span style={{ color: C.arcane }}>■</span> {melodie.quanti}{" "}
          {melodie.quanti === 1 ? "melodia" : "melodie"} · {fmtBytes(melodie.byte)}
        </span>
      </div>
      {pieno > 0.8 && (
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: C.accent, lineHeight: 1.45 }}>
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

export default function SyncPanel({ status, onClose, onSync, notify }) {
  const [session, setSession] = useState(undefined);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

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
    try {
      await signIn(e);
      setSent(true);
    } catch {
      notify("Non sono riuscito a inviare il link… controlla l'indirizzo");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    setSession(null);
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
          borderRadius: 18,
          border: `1px solid ${C.border}`,
          background: `linear-gradient(180deg, ${C.card}, ${C.surface})`,
          boxShadow: `0 0 60px ${C.arcane}22, 0 20px 50px #00000088`,
          padding: 22,
        }}
      >
        <h2
          style={{
            fontFamily: FONT_TITLE,
            fontSize: 23,
            fontWeight: 600,
            color: C.text,
            marginBottom: 6,
          }}
        >
          ☁️ La biblioteca ovunque
        </h2>

        {!isSyncConfigured() ? (
          <p style={{ color: C.muted, fontSize: 14.5, lineHeight: 1.5 }}>
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
            <p style={{ color: C.muted, fontSize: 14.5, marginBottom: 16 }}>
              Connesso come <span style={{ color: C.text }}>{session.user.email}</span>
              <br />
              Ultima sincronizzazione: {fmtWhen(getLastSync())}
            </p>
            {status.message && (
              <p style={{ color: C.arcane, fontSize: 14, marginBottom: 12 }}>{status.message}</p>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={onSync}
                disabled={status.busy}
                style={{
                  flex: 1,
                  minWidth: 150,
                  padding: "11px 18px",
                  borderRadius: 12,
                  background: status.busy ? C.dim : `linear-gradient(180deg, ${C.accent}, #b8893a)`,
                  color: status.busy ? C.muted : "#241c0a",
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                {status.busy ? "Sincronizzo…" : "🔄 Sincronizza ora"}
              </button>
              <button
                onClick={handleSignOut}
                style={{
                  padding: "11px 18px",
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  color: C.muted,
                  fontSize: 15,
                }}
              >
                Esci
              </button>
            </div>
            <Spazio dati={spazio} />
          </>
        ) : sent ? (
          <p style={{ color: C.text, fontSize: 15, lineHeight: 1.55 }}>
            ✉️ Ti ho mandato un link a <strong>{email.trim()}</strong>.<br />
            <span style={{ color: C.muted, fontSize: 14 }}>
              Aprilo da questo dispositivo: tornerai qui già connesso, e la biblioteca comincerà
              a sincronizzarsi da sola.
            </span>
          </p>
        ) : (
          <>
            <p style={{ color: C.muted, fontSize: 14.5, lineHeight: 1.5, marginBottom: 14 }}>
              Entra con la tua email: libri, segnalibri, evidenziazioni, note e progressi ti
              seguiranno su ogni dispositivo. Niente password — ricevi un link e sei dentro.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                type="email"
                inputMode="email"
                placeholder="la-tua@email.it"
                style={{
                  flex: 1,
                  minWidth: 180,
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.text,
                  fontSize: 15,
                  outline: "none",
                }}
              />
              <button
                onClick={handleSignIn}
                disabled={busy}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  background: `linear-gradient(180deg, ${C.accent}, #b8893a)`,
                  color: "#241c0a",
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                {busy ? "…" : "Inviami il link"}
              </button>
            </div>
          </>
        )}

        <div style={{ marginTop: 18, textAlign: "right" }}>
          <button onClick={onClose} style={{ color: C.muted, fontSize: 14.5 }}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

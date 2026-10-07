import { useEffect, useState } from "react";
import { C, FONT_TITLE, F, R, px } from "../data/constants.js";
import { isSyncConfigured } from "../lib/supabase.js";
import {
  getSession,
  signIn,
  signOut,
  getLastSync,
  cloudUsage,
  entraConPassword,
  registraConPassword,
  rimandaConferma,
  cambiaPassword,
} from "../lib/sync.js";
import { spiegaAccesso, daConfermare, passwordCorta, MIN_PASSWORD, GIA_REGISTRATA } from "../lib/accesso.js";
// il riferimento del piano sta in UN posto solo: prima era un numero qui e
// la stringa «1 GB» due righe sotto, due cose da cambiare insieme e da
// dimenticare separatamente
import { PIENO, parteDelPiano } from "../lib/spazio.js";
import { BarraCloud } from "./BarraCloud.jsx";
import SezioneDrive from "./SezioneDrive.jsx";
import { ultimoGiro } from "../lib/resoconto.js";
import { entraConGoogle, statoRinnovo } from "../lib/accessoGoogle.js";
import { driveProntoOra, driveAcceso, scollegaDrive, permessoDriveMancante } from "../lib/drive.js";


function Spazio({ dati }) {
  if (dati === undefined) return <p style={{ color: C.muted, fontSize: F.piccolo }}>Conto lo spazio…</p>;
  if (!dati) return null;
  const pieno = parteDelPiano(dati.totale) ?? 0;
  return (
    <div>
      {/* la barra è la stessa che sta in Libreria, e sta in un file solo
          perché i colori devono restare gli stessi: due grafici che
          raccontano il medesimo secchio con due palette sarebbero peggio di
          nessun grafico */}
      <BarraCloud dati={dati} />
      {pieno > PIENO && (
        <p style={{ margin: "8px 0 0", fontSize: F.minuscolo, color: C.accent, lineHeight: 1.45 }}>
          Lo spazio sta finendo. Un libro che non rileggerai può uscire dalla biblioteca, e i file
          audio non salgono più: se lassù ne restano, la prossima sincronizzazione li toglie.
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
// LETTO AL RENDER, NON AL CARICAMENTO DEL MODULO. Era un oggetto costante,
// e un oggetto costante congela i valori che legge: questo file e' importato
// in cima ad `App.jsx`, quindi girava PRIMA che il tema scelto venisse
// applicato — sul Rifugio Silvano e sulla Cittadella il campo restava col
// bordo viola della notte. Adesso e' una funzione, cosi' segue anche la
// levetta della dimensione dell'interfaccia, che muta `F` e `R` da viva.
const campo = () => ({
  width: "100%",
  padding: "10px 14px",
  borderRadius: R.piccolo,
  border: `1px solid ${C.border}`,
  background: C.bg,
  color: C.text,
  fontSize: F.corpo,
  outline: "none",
});

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
  const [guaioGoogle, setGuaioGoogle] = useState(null);
  const [confermare, setConfermare] = useState(false);
  // il guaio dell'indirizzo non confermato e' l'unico che ha una via
  // d'uscita, e sta a parte perche' e' l'unico che fa comparire un tasto
  const [rimanda, setRimanda] = useState(false);
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

  // UN ACCESSO SOLO (vedi `accessoGoogle.js`): la pagina va da Google e
  // torna qui gia' dentro, biblioteca e Drive insieme
  async function conGoogle() {
    if (busy) return;
    setBusy(true);
    setGuaioGoogle(null);
    try {
      await entraConGoogle();
    } catch (err) {
      setGuaioGoogle(spiegaAccesso(err));
      setBusy(false);
    }
  }

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
    setRimanda(false);
    if (passwordCorta(password)) {
      setGuaio(`La password vuole almeno ${MIN_PASSWORD} caratteri.`);
      return;
    }
    setBusy(true);
    try {
      if (registra) {
        const { esito } = await registraConPassword(e, password);
        // L'EMAIL GIA' REGISTRATA NON E' UN ERRORE PER SUPABASE, e la
        // password appena scritta non e' stata salvata: dire «controlla la
        // posta» qui era la bugia che ha lasciato il lettore con una
        // password che non esisteva (vedi `esitoRegistrazione`)
        if (esito === "esiste") {
          setGuaio(GIA_REGISTRATA);
          return;
        }
        // se il progetto chiede la conferma dell'indirizzo la sessione non
        // arriva: senza dirlo, il pannello resterebbe fermo senza motivo
        if (esito === "conferma") {
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
      setRimanda(daConfermare(err));
    } finally {
      setBusy(false);
    }
  }

  // Rimandare la conferma non e' «riprovare»: e' l'unica cosa che sblocca
  // un indirizzo registrato e mai confermato, e finisce nello stesso stato
  // di quando ci si e' appena registrati — cioe' «adesso guarda la posta».
  async function rimandaLaConferma() {
    const e = email.trim();
    if (!e || busy) return;
    setBusy(true);
    setGuaio(null);
    try {
      await rimandaConferma(e);
      setRimanda(false);
      setConfermare(true);
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
          maxWidth: px(460),
          // IL PANNELLO DEVE STARE DENTRO LO SCHERMO, SEMPRE. A due volte
          // la scala questa scheda arriva a 1084px in un'area alta 730 e
          // sbordava sopra E sotto: i tasti per tornare a una misura più
          // piccola finivano fuori, cioè scegliere «Massima» era una porta
          // che si chiudeva alle spalle. Misurato, non temuto.
          maxHeight: "100%",
          overflowY: "auto",
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
            {/* DA DENTRO, UNA SCHEDA SOLA (chiesto dal lettore: «si può
                ripulire un po' questo pannello?»): chi sei, e due righe che
                dicono se biblioteca e Drive stanno a posto. Il resto — il
                racconto del giro, la password, l'uscita — c'e', piegato */}
            <div
              style={{
                padding: "12px 14px",
                marginBottom: 12,
                borderRadius: R.piccolo,
                border: `1px solid ${C.border}`,
                background: C.bg,
              }}
            >
              <div style={{ color: C.text, fontSize: F.corpo, overflowWrap: "anywhere" }}>{session.user.email}</div>
              <Riga ok={!!getLastSync()}>
                {getLastSync() ? `Biblioteca sincronizzata · ${fmtWhen(getLastSync())}` : "Biblioteca non ancora sincronizzata"}
              </Riga>
              <StatoGoogle
                conGoogle={(session.user.app_metadata?.providers || []).includes("google")}
                onGoogle={conGoogle}
                busy={busy}
                guaio={guaioGoogle}
              />
            </div>
            <button
              onClick={onSync}
              disabled={status.busy}
              style={{
                width: "100%",
                minHeight: 48,
                padding: "10px 18px",
                borderRadius: R.piccolo,
                background: status.busy ? C.dim : `linear-gradient(180deg, ${C.accent}, ${C.accentDeep})`,
                color: status.busy ? C.muted : C.onAccent,
                fontWeight: 600,
                fontSize: F.corpo,
              }}
            >
              {status.busy ? "Sincronizzo…" : "🔄 Sincronizza ora"}
            </button>
            {status.message && (
              <div style={{ marginTop: 10 }}>
                <p style={{ color: C.arcane, fontSize: F.nota, margin: 0 }}>{status.message}</p>
                {/* IL TESTO GREZZO NON SI BUTTA, SI RIPIEGA: la frase sopra
                    serve a chi legge, questo a chi deve ripararlo quando gli
                    arriva la fotografia */}
                {status.dettaglio && (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ color: C.muted, fontSize: F.piccolo, cursor: "pointer" }}>
                      Dettagli tecnici
                    </summary>
                    <p
                      style={{
                        color: C.muted,
                        fontSize: F.piccolo,
                        margin: "6px 0 0",
                        wordBreak: "break-word",
                        fontFamily: "monospace",
                      }}
                    >
                      {status.dettaglio}
                    </p>
                  </details>
                )}
              </div>
            )}
            <Racconto voci={status.racconto || ultimoGiro()?.voci || []} />
            <Spazio dati={spazio} />
          </>
        ) : confermare ? (
          <p style={{ color: C.text, fontSize: F.corpo, lineHeight: 1.55 }}>
            ✉️ Registrato. Ti ho mandato una conferma a <strong>{email.trim()}</strong>.<br />
            <span style={{ color: C.muted, fontSize: F.nota }}>
              Apri quel messaggio una volta sola: da lì in poi entri con email e password, su
              questo dispositivo e su ogni altro. Se non lo trovi, guarda nella posta
              indesiderata.
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
              Libri, segnalibri, note e progressi ti seguono su ogni dispositivo, e i file dei libri
              stanno sul tuo Google Drive. Entri una volta sola, per tutt'e due.
            </p>
            <button
              onClick={conGoogle}
              disabled={busy}
              style={{
                width: "100%",
                minHeight: 48,
                padding: "10px 20px",
                borderRadius: R.piccolo,
                background: `linear-gradient(180deg, ${C.accent}, ${C.accentDeep})`,
                color: C.onAccent,
                fontWeight: 600,
                fontSize: F.corpo,
              }}
            >
              {busy ? "Vado da Google…" : "Entra con Google"}
            </button>
            {guaioGoogle && (
              <p style={{ marginTop: 10, color: C.red, fontSize: F.nota, lineHeight: 1.45 }}>{guaioGoogle}</p>
            )}
            <details style={{ marginTop: 14 }}>
              <summary style={{ color: C.muted, fontSize: F.nota, cursor: "pointer", padding: "12px 0" }}>
                Entra con email e password
              </summary>
            <p style={{ color: C.muted, fontSize: F.piccolo, lineHeight: 1.5, margin: "4px 0 10px" }}>
              La strada di prima. Con la stessa email del tuo Google ritrovi la stessa biblioteca
              in tutt'e due i modi. Google Drive, così, si collega a parte.
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
                style={campo()}
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="password"
                style={campo()}
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
            {/* Il tasto compare SOLO sull'indirizzo non confermato, ed è
                l'unica uscita da un vicolo cieco: senza, il messaggio qui
                sopra dice «apri la mail che ti ho mandato» a chi quella
                mail non ce l'ha più, e non resta niente da fare. */}
            {rimanda && (
              <button
                onClick={rimandaLaConferma}
                disabled={busy}
                style={{
                  marginTop: 10,
                  padding: "10px 18px",
                  borderRadius: R.piccolo,
                  border: `1px solid ${C.arcane}66`,
                  color: C.arcane,
                  fontSize: F.corpo,
                }}
              >
                {busy ? "…" : "✉️ Rimandami la conferma"}
              </button>
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
            </details>
          </>
        )}

        {/* da fuori «Entra con Google» collega anche Drive: una seconda
            porta per la stessa stanza era la confusione di prima */}
        {(!isSyncConfigured() || session) && <SezioneDrive onCollegato={onSync} notify={notify} sobria={!!session} />}

        {isSyncConfigured() && session && (
          <details style={{ marginTop: 16, paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
            <summary style={{ color: C.muted, fontSize: F.nota, cursor: "pointer", padding: "12px 0" }}>Altro</summary>
            {/* Chi e' entrato col link puo' darsi una password e non
                dipenderne piu'; ed e' anche la strada per rimetterne una
                dimenticata, senza una pagina di recupero tutta sua. */}
            {nuova === null ? (
              <button
                onClick={() => { setNuova(""); setGuaio(null); }}
                style={{ display: "block", minHeight: 44, color: C.muted, fontSize: F.nota, textDecoration: "underline" }}
              >
                🔑 Cambia la password
              </button>
            ) : (
              <div style={{ margin: "4px 0 8px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  value={nuova}
                  onChange={(e) => setNuova(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && salvaPassword()}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nuova password"
                  style={{ ...campo(), flex: 1, minWidth: 160, width: "auto" }}
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
            {guaio && <p style={{ margin: "4px 0 8px", color: C.red, fontSize: F.nota, lineHeight: 1.45 }}>{guaio}</p>}
            {driveAcceso() && (
              <button
                onClick={async () => {
                  await scollegaDrive();
                  notify?.("Google Drive scollegato. I file su Drive restano dove sono.");
                  onClose?.();
                }}
                style={{ display: "block", minHeight: 44, color: C.muted, fontSize: F.nota, textDecoration: "underline" }}
              >
                Scollega Google Drive
              </button>
            )}
            <button
              onClick={handleSignOut}
              style={{
                marginTop: 4,
                minHeight: 44,
                padding: "8px 18px",
                borderRadius: R.piccolo,
                border: `1px solid ${C.border}`,
                color: C.muted,
                fontSize: F.nota,
              }}
            >
              Esci
            </button>
            <p style={{ margin: "8px 0 0", color: C.muted, fontSize: F.minuscolo, lineHeight: 1.45 }}>
              Uscendo, i libri restano su questo dispositivo.
            </p>
          </details>
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

// A CHE PUNTO E' GOOGLE, da dentro: si rinnova da solo, o ha ritirato il
// permesso, o l'account e' entrato con email e password e Google non c'e'.
// Ogni stato dice cosa fare, con un tasto solo.
function StatoGoogle({ conGoogle, onGoogle, busy, guaio }) {
  const stato = statoRinnovo();
  let frase;
  let ok = false;
  let chiedi = false;
  if (permessoDriveMancante()) {
    frase = "Google ha dato l'ingresso ma non Drive (la casella non era spuntata): rientra con Google e lasciala spuntata.";
    chiedi = true;
  } else if (stato === "revocato") {
    frase = "Google ha ritirato il permesso per Drive (o è scaduto): rientra con Google.";
    chiedi = true;
  } else if (conGoogle && stato !== "nessuno") {
    ok = driveProntoOra();
    frase = ok ? "Google Drive collegato · si rinnova da solo" : "Google Drive · rinnovo la chiave…";
  } else {
    frase = "Entra con Google (la stessa email) e Drive si collega da solo, senza chiedere più niente.";
    chiedi = true;
  }
  return (
    <>
      <Riga ok={ok}>{frase}</Riga>
      {chiedi && (
        <button
          onClick={onGoogle}
          disabled={busy}
          style={{
            marginTop: 8,
            minHeight: 44,
            padding: "8px 16px",
            borderRadius: R.piccolo,
            border: `1px solid ${C.accent}88`,
            color: C.accent,
            fontSize: F.nota,
          }}
        >
          {busy ? "Vado da Google…" : "Entra con Google"}
        </button>
      )}
      {guaio && <p style={{ marginTop: 8, color: C.red, fontSize: F.nota, lineHeight: 1.45 }}>{guaio}</p>}
    </>
  );
}

// una riga della scheda: a posto (✓) o da guardare (·)
function Riga({ ok, children }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: F.nota, lineHeight: 1.4, color: ok ? C.muted : C.text }}>
      <span style={{ color: ok ? C.accent : C.muted, flexShrink: 0 }}>{ok ? "✓" : "·"}</span>
      <span>{children}</span>
    </div>
  );
}

// COSA HA FATTO L'ULTIMO GIRO, libro per libro (`raccontaGiro`): ↓ quel che
// e' arrivato qui, ↑ quel che e' partito. Il nome intero, come sullo
// scaffale; l'elenco scorre dentro il pannello invece di allungarlo.
const MOSTRATE = 40;
function Racconto({ voci }) {
  if (!voci.length) return null;
  return (
    <details style={{ marginTop: 10 }}>
      <summary style={{ color: C.muted, fontSize: F.nota, cursor: "pointer", padding: "10px 0" }}>
        Nell'ultimo giro · {voci.length === 1 ? "un libro" : `${voci.length} libri`}
      </summary>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: px(220), overflowY: "auto" }}>
        {voci.slice(0, MOSTRATE).map((v, i) => (
          <li key={i} style={{ fontSize: F.piccolo, color: C.muted, padding: "3px 0", overflowWrap: "break-word" }}>
            <span style={{ color: v.verso === "qui" ? C.arcane : C.accent }}>{v.verso === "qui" ? "↓" : "↑"}</span>{" "}
            <span style={{ color: C.text }}>{v.titolo}</span>: {v.cose.join(" · ")}
          </li>
        ))}
        {voci.length > MOSTRATE && (
          <li style={{ fontSize: F.piccolo, color: C.muted, padding: "3px 0" }}>e altri {voci.length - MOSTRATE}</li>
        )}
      </ul>
    </details>
  );
}

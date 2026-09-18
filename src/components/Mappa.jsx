import { useState } from "react";
import { C, FONT_TITLE, F, R, TEMA, px } from "../data/constants.js";
import { MAPPA, LUOGHI, vociDi } from "../data/mappa.js";

// COSA SA FARE L'APP.
//
// Chiesto dal lettore: «c'è modo di rendere più user friendly
// l'applicazione?». La diagnosi stava nelle sue stesse segnalazioni, sei
// su sei: «dove regolo le dimensioni?», «ma dove sarebbe quello che hai
// fatto?», «serve avere sia raggruppa che ordina?». Non che l'app sia
// fatta male — che non dice quello che sa fare, e le funzioni si scoprono
// per caso o chiedendole a qualcun altro.
//
// NON E' UN TUTORIAL: un tutorial si legge una volta, quando non serve, e
// non lo si ritrova il giorno che servirebbe. Questa e' una mappa — non
// compare mai da sola, non si mette in mezzo, e sta dove uno la va a
// cercare quando si chiede «ma l'app lo sa fare?».
//
// **I FILTRI SONO LUOGHI, NON CATEGORIE**: la domanda che uno ha in testa
// non e' «quali funzioni di annotazione esistono», e' «sto leggendo, cosa
// posso fare da qui». E «Tutto» e' il primo perche' una mappa serve anche
// a scorrerla intera senza sapere cosa cerchi — filtrare e' un di piu',
// non il passo obbligato.
export default function Mappa({ onClose }) {
  const [luogo, setLuogo] = useState(null);
  const mostrati = luogo ? LUOGHI.filter((l) => l.id === luogo) : LUOGHI;

  // 44px: sono chip attaccati, e un dito che ne manca uno prende quello
  // accanto — la stessa ragione di `GenrePicker`
  const chip = (attivo) => ({
    padding: "12px 16px",
    borderRadius: R.tondo,
    fontSize: F.nota,
    lineHeight: 1.25,
    cursor: "pointer",
    border: `1px solid ${attivo ? C.accent : C.border}`,
    background: attivo ? `${C.accent}22` : "transparent",
    color: attivo ? C.accent : C.text,
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        // SOPRA IMPOSTAZIONI (55) E SOTTO IL TOAST (60). Si apre DA dentro
        // il pannello delle impostazioni, che resta montato: a 50 sarebbe
        // comparsa dietro di lui, cioè un tasto che apre una schermata che
        // non si vede. E sotto il toast, perché un avviso deve arrivare
        // anche da qui.
        zIndex: 56,
        // il gradiente del tema vivo, non i viola della notte scritti a
        // mano: sugli altri temi sarebbe un alone di un altro mondo
        background: TEMA.gradient,
        overflowY: "auto",
        animation: "bc-fade-in 0.25s ease-out",
      }}
    >
      <div style={{ width: "100%", maxWidth: px(720), margin: "0 auto", padding: "22px 16px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <h2
            style={{
              flex: 1,
              fontFamily: FONT_TITLE,
              fontSize: F.titolo,
              fontWeight: 600,
              color: C.text,
              margin: 0,
            }}
          >
            Cosa sa fare l'app
          </h2>
          <button
            onClick={onClose}
            style={{
              minWidth: 44,
              minHeight: 44,
              borderRadius: R.tondo,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.muted,
              fontSize: F.rilievo,
            }}
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>
        <p style={{ color: C.muted, fontSize: F.nota, margin: "0 0 18px" }}>
          {MAPPA.length} cose, raccolte per dove ti trovi quando ti servono. Accanto a ognuna c'è da dove si
          apre: sapere che una funzione esiste senza sapere dove sta non serve a niente.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          <button onClick={() => setLuogo(null)} style={chip(luogo === null)}>
            Tutto
          </button>
          {LUOGHI.map((l) => (
            <button key={l.id} onClick={() => setLuogo(l.id)} style={chip(luogo === l.id)}>
              {l.nome}
            </button>
          ))}
        </div>

        {mostrati.map((l) => (
          <section key={l.id} style={{ marginBottom: 26 }}>
            <h3
              style={{
                fontFamily: FONT_TITLE,
                fontSize: F.titoletto,
                fontWeight: 600,
                color: C.accent,
                margin: "0 0 2px",
              }}
            >
              {l.nome}
            </h3>
            {l.sotto && (
              <p style={{ color: C.muted, fontSize: F.piccolo, margin: "0 0 12px" }}>{l.sotto}</p>
            )}
            {vociDi(l.id).map((v) => (
              <div
                key={v.nome}
                style={{
                  padding: "12px 14px",
                  marginBottom: 8,
                  borderRadius: R.medio,
                  border: `1px solid ${C.border}`,
                  background: C.card,
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_TITLE,
                    fontSize: F.rilievo,
                    fontWeight: 600,
                    color: C.text,
                    marginBottom: 4,
                  }}
                >
                  {v.nome}
                </div>
                <p style={{ color: C.text, fontSize: F.nota, margin: "0 0 6px", lineHeight: 1.45 }}>{v.cosa}</p>
                {/* IL «DOVE» E' LA META' CHE SERVE, e si vede che e' un'altra
                    cosa: in corsivo e smorzato, o si leggerebbe come la coda
                    della frase di sopra invece che come l'indicazione */}
                <p style={{ color: C.muted, fontSize: F.piccolo, margin: 0, fontStyle: "italic" }}>{v.dove}</p>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

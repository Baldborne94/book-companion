// LA PROVA SULLA MICROSD (`lib/provaScheda.js`): un riquadro nelle
// Impostazioni, sotto Fandom. Si sceglie una cartella sulla scheda, si
// scrivono e si rileggono 200 illustrazioni vere, e riaperta l'app si
// guarda se Chrome ha ricordato il permesso. Il risultato si copia e si
// manda: decide come costruire il giro delle illustrazioni.
import { useEffect, useState } from "react";
import { C, F, R } from "../data/constants.js";
import { getAux, putAux, removeAux } from "../lib/bookStore.js";
import { provaScrittura, rileggiProva, togliProva, rigaScrittura, rigaRiapertura, testoProva, leggiStato, scriviStato, QUANTE } from "../lib/provaScheda.js";

const MANIGLIA = "prova_sd_cartella";

export default function ProvaScheda() {
  const [stato, setStato] = useState(() => leggiStato());
  const [conto, setConto] = useState(null);
  const [permesso, setPermesso] = useState(null);
  const [guaio, setGuaio] = useState("");
  const [copiato, setCopiato] = useState(false);
  const [occupata, setOccupata] = useState(false);

  // a ogni apertura: la cartella ricordata, e cosa dice Chrome del permesso
  useEffect(() => {
    let vivo = true;
    getAux(MANIGLIA)
      .then(async (c) => {
        if (!vivo || !c?.queryPermission) return;
        setPermesso(await c.queryPermission({ mode: "readwrite" }));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const salva = (s) => {
    setStato(s);
    scriviStato(s);
  };

  async function prova() {
    setGuaio("");
    let cartella;
    try {
      cartella = await window.showDirectoryPicker({ id: "bc-illustrazioni", mode: "readwrite" });
    } catch (e) {
      if (e?.name !== "AbortError") setGuaio(`Non riesco ad aprire quella cartella (${e?.message || e?.name}).`);
      return;
    }
    setOccupata(true);
    setConto({ fatte: 0, di: QUANTE });
    // la cartella si ricorda e la scrittura si salva appena finisce: se
    // la rilettura non torna, riaperta l'app la prova c'e' lo stesso
    let ricordata = true;
    await putAux(MANIGLIA, cartella).catch(() => (ricordata = false));
    let fatta = null;
    try {
      const scrittura = await provaScrittura({
        cartella,
        onProgress: setConto,
        onScritte: (parziale) => {
          fatta = { cartella: cartella.name, ricordata, scrittura: parziale, riaperture: [] };
          salva(fatta);
        },
      });
      salva({ cartella: cartella.name, ricordata, scrittura, riaperture: [] });
      setPermesso(await cartella.queryPermission?.({ mode: "readwrite" }));
    } catch (e) {
      const errore = `${e?.name || "Errore"}: ${e?.message || ""}`.trim();
      setGuaio(`La prova si è fermata: ${errore}.`);
      salva({ ...(fatta || { cartella: cartella.name, ricordata, scrittura: null, riaperture: [] }), errore });
    } finally {
      setOccupata(false);
      setConto(null);
    }
  }

  // RIAPERTA L'APP: il permesso si annota com'era PRIMA di chiederlo, poi
  // si chiede (dentro il tocco, come vuole Chrome) e si rilegge
  async function rileggi() {
    setGuaio("");
    setOccupata(true);
    const quando = Date.now();
    let prima = "cartella non ricordata";
    try {
      const cartella = await getAux(MANIGLIA);
      if (!cartella) throw new Error("la cartella della prova non è più ricordata");
      prima = await cartella.queryPermission({ mode: "readwrite" });
      let ora = prima;
      if (ora !== "granted") ora = await cartella.requestPermission({ mode: "readwrite" });
      setPermesso(ora);
      const rilettura = ora === "granted" ? await rileggiProva({ cartella, onProgress: setConto }) : null;
      salva({ ...stato, riaperture: [...(stato?.riaperture || []), { quando, permesso: prima, rilettura }] });
    } catch (e) {
      const errore = `${e?.name || "Errore"}: ${e?.message || ""}`.trim();
      setGuaio(`Rilettura non riuscita: ${errore}.`);
      salva({ ...stato, riaperture: [...(stato?.riaperture || []), { quando, permesso: prima, errore }] });
    } finally {
      setOccupata(false);
      setConto(null);
    }
  }

  async function togli() {
    setGuaio("");
    try {
      const cartella = await getAux(MANIGLIA);
      if (cartella && (await cartella.requestPermission({ mode: "readwrite" })) === "granted") await togliProva(cartella);
    } catch {
      /* la cartella non c'è più: niente da togliere */
    }
    await removeAux(MANIGLIA).catch(() => {});
    salva(null);
    setPermesso(null);
  }

  async function copia() {
    try {
      await navigator.clipboard.writeText(testoProva(stato, navigator.userAgent));
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2500);
    } catch {
      setGuaio("Non riesco a copiare: tieni premuto sul testo qui sopra e copialo a mano.");
    }
  }

  const tasto = (pieno) => ({
    minHeight: 44,
    padding: "6px 14px",
    borderRadius: R.tondo,
    fontSize: F.piccolo,
    border: `1px solid ${pieno ? C.accent : C.border}`,
    color: pieno ? C.accent : C.muted,
    background: pieno ? `${C.accent}14` : "transparent",
    opacity: occupata ? 0.6 : 1,
  });
  const riga = { fontSize: F.piccolo, color: C.text, lineHeight: 1.5, margin: "6px 0 0", overflowWrap: "anywhere" };

  return (
    <div style={{ marginTop: 16, padding: 12, borderRadius: R.medio, border: `1px dashed ${C.arcane}66` }}>
      <div style={{ fontSize: F.nota, color: C.text, fontWeight: 600 }}>🧪 Prova: le illustrazioni sulla microSD</div>
      <p style={{ fontSize: F.piccolo, color: C.muted, lineHeight: 1.5, margin: "6px 0 0" }}>
        Scegli una cartella sulla scheda (per esempio <strong>book-companion</strong>): scrivo lì {QUANTE} illustrazioni di
        Fandom, le rileggo e misuro i tempi. Serve la rete, e tieni aperta questa pagina finché finisce. Poi chiudi l'app,
        riaprila e tocca «🔁 Rileggi dalla cartella»: così vediamo se Chrome ricorda il permesso.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <button onClick={prova} disabled={occupata} style={tasto(true)}>
          {conto && conto.fase !== "rileggo" ? `…scrivo ${conto.fatte}/${conto.di}` : stato ? "📁 Rifai la prova" : "📁 Scegli la cartella e prova"}
        </button>
        {stato && (
          <button onClick={rileggi} disabled={occupata} style={tasto(false)}>
            {conto?.fase === "rileggo" ? `…rileggo ${conto.fatte}${conto.di ? `/${conto.di}` : ""}` : "🔁 Rileggi dalla cartella"}
          </button>
        )}
      </div>
      {stato && (
        <>
          <p style={riga}>
            Cartella «{stato.cartella}»{stato.scrittura ? `: ${rigaScrittura(stato.scrittura)}` : ""}.
          </p>
          {stato.errore && <p style={{ ...riga, color: C.accent }}>Errore: {stato.errore}</p>}
          {permesso && (
            <p style={{ ...riga, color: permesso === "granted" ? C.accent : C.muted }}>
              Adesso Chrome dice: {permesso === "granted" ? "permesso sulla cartella ricordato" : "il permesso va richiesto con un tocco"}.
            </p>
          )}
          {(stato.riaperture || []).map((r, i) => (
            <p key={i} style={riga}>
              Riapertura {i + 1} — {rigaRiapertura(r)}
            </p>
          ))}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button onClick={copia} style={tasto(false)}>
              {copiato ? "✓ Copiato" : "📋 Copia il risultato"}
            </button>
            <button onClick={togli} disabled={occupata} style={tasto(false)}>
              🗑 Togli i file della prova
            </button>
          </div>
        </>
      )}
      {guaio && <p style={{ ...riga, color: C.accent }}>{guaio}</p>}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { listTrackIds } from "../lib/bookStore.js";
import { C, FONT_TITLE, F, R, px } from "../data/constants.js";
import {
  getFavoritesRaw, saveFavorites, isFile, addTrackFile, dropTrack, parseYouTube,
  getListsRaw, saveLists, nuovaRaccolta, braniDi, puntoDi, doveDi, minuti, MUSICA_CAMBIATA, nonArrivati,
  pianoDaCartella, vociDellaCartella,
} from "../lib/music.js";
import EmptyState from "./EmptyState.jsx";
import { InAscolto, Icona, Faccia } from "./Ascolto.jsx";
import {
  braniInVista, perLettera, raccolteInVista, inQuante, vistaIniziale, vistaSalvata, salvaVista, ordineSalvato, salvaOrdine, ORDINI,
} from "../lib/salaMusica.js";
import { useViewport } from "../lib/viewport.js";


// LETTO AL RENDER, NON AL CARICAMENTO DEL MODULO. Era un oggetto costante,
// e un oggetto costante congela i valori che legge: questo file e' importato
// in cima ad `App.jsx`, quindi girava PRIMA che il tema scelto venisse
// applicato — sul Rifugio Silvano e sulla Cittadella il campo restava col
// bordo viola della notte. Adesso e' una funzione, cosi' segue anche la
// levetta della dimensione dell'interfaccia, che muta `F` e `R` da viva.
const inputStyle = () => ({
  flex: 1,
  minWidth: 160,
  padding: "10px 14px",
  borderRadius: R.piccolo,
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.text,
  fontSize: F.corpo,
  outline: "none",
});

export default function MusicRoom({ music, playerRef, notify, onCambiata, aperta: apertaDaApp, onApri }) {
  const [favs, setFavs] = useState(() => getFavoritesRaw());
  const [favName, setFavName] = useState("");
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const fileRef = useRef(null);
  const [caricando, setCaricando] = useState(false);
  // le melodie di una cartella custodite fin qui, su quante: sono decine di
  // file da qualche mega, e il tasto dice a che punto e'
  const [daCartellaConto, setDaCartellaConto] = useState(null);
  const cartellaPossibile = typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
  const [raccolte, setRaccolte] = useState(() => getListsRaw());
  // quali melodie da file hanno i byte QUI: le altre non si suonano da qui,
  // e il segno lo dice prima del tocco
  const [qui, setQui] = useState(null);
  // l'id della raccolta di cui si stanno scegliendo i brani: finche' e'
  // acceso, l'elenco delle melodie diventa una lista di spunte
  const [scegliendo, setScegliendo] = useState(null);
  const [nuova, setNuova] = useState(false);
  const [nomeNuova, setNomeNuova] = useState("");
  const [rinomina, setRinomina] = useState(null);
  const [bozzaRac, setBozzaRac] = useState("");
  // LA RACCOLTA APERTA E' UNA PAGINA, e l'indietro la chiude prima di
  // lasciare la sala: per questo sta in App, come quella della Libreria
  const [apertaQui, setApertaQui] = useState(null);
  const aperta = onApri ? apertaDaApp : apertaQui;
  const apri = onApri || setApertaQui;
  // il menu «⋯» della raccolta aperta: scegliere i brani, rinominare,
  // dimenticare — le cose che si fanno di rado stanno li' dentro
  const [menu, setMenu] = useState(false);
  // COME UN LETTORE MUSICALE (`lib/salaMusica.js`): una ricerca, due viste
  // (raccolte e brani), l'ordine dei brani, e il menu di ogni brano
  const [cerca, setCerca] = useState("");
  // la vista scelta a mano; senza scelta decide `vistaIniziale` a ogni
  // disegno, cosi' la prima raccolta arrivata dall'altro dispositivo si vede
  const [vista, setVista] = useState(() => vistaSalvata());
  const [ordine, setOrdine] = useState(() => ordineSalvato());
  const [menuBrano, setMenuBrano] = useState(null);
  const [nelleRaccolte, setNelleRaccolte] = useState(null);
  const [aggiungi, setAggiungi] = useState(false);

  const { current, playing, queue } = music;
  const { wide } = useViewport();
  const suona = (f) => !!current && (f.trackId ? current.trackId === f.trackId : !!f.url && current.url === f.url);
  // si rilegge quando cambia l'elenco o il brano
  useEffect(() => {
    let vivo = true;
    listTrackIds()
      .then((ids) => vivo && setQui(new Set(ids)))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [favs, current?.trackId]);

  // UN LINK SI SUONA SENZA CUSTODIRLO, dallo stesso riquadro di «＋ Da
  // YouTube»: la barra larga in cima alla sala era la cosa piu' grande della
  // pagina dopo il lettore, per un gesto che si fa di rado
  function suonaOra() {
    const url = newUrl.trim();
    if (!url) return;
    if (playerRef.current?.play(url)) {
      setNewUrl("");
      setNewName("");
      setAdding(false);
    }
  }

  // ogni cambio della musica parte da solo verso gli altri dispositivi,
  // come una scheda cambiata (`lib/presto.js`)
  function commit(next) {
    setFavs(next);
    saveFavorites(next);
    onCambiata?.();
  }

  function saveCurrentAsFav() {
    if (!current) return;
    const now = Date.now();
    const name = favName.trim() || "Melodia senza nome";
    commit([...favs, { id: crypto.randomUUID(), name, url: current.url, addedAt: now, updatedAt: now }]);
    setFavName("");
    notify(`«${name}» custodita tra le tue melodie ✨`);
  }

  function removeFav(f) {
    // la lapide resta (serve a propagare l'eliminazione), ma i byte se ne
    // vanno subito: sono la cosa pesante
    if (isFile(f)) dropTrack(f.trackId);
    commit(favs.map((x) => (x.id === f.id ? { ...x, deleted: true, updatedAt: Date.now() } : x)));
  }

  async function addFiles(lista) {
    const scelti = [...(lista || [])];
    if (!scelti.length) return;
    setCaricando(true);
    const nuovi = [];
    let scartati = 0;
    for (const file of scelti) {
      const voce = await addTrackFile(file).catch(() => null);
      if (voce) nuovi.push(voce);
      else scartati++;
    }
    setCaricando(false);
    if (nuovi.length) {
      commit([...favs, ...nuovi]);
      notify(
        nuovi.length === 1
          ? `«${nuovi[0].name}» custodita ✨ Questa suona anche a tablet spento.`
          : `${nuovi.length} melodie custodite ✨ Queste suonano anche a tablet spento.`
      );
    }
    if (scartati) notify(`${scartati} file non sono audio e li ho lasciati fuori 🎵`);
  }

  // UNA CARTELLA → LE SUE RACCOLTE (`pianoDaCartella`): ogni sottocartella
  // una raccolta col suo nome, i brani gia' custoditi non si ricaricano, una
  // raccolta che c'e' gia' prende solo quel che le manca
  async function daCartella() {
    let scelta;
    try {
      scelta = await window.showDirectoryPicker({ id: "bc-musica" });
    } catch (e) {
      if (e?.name !== "AbortError") notify("Non riesco ad aprire quella cartella 🎵");
      return;
    }
    setCaricando(true);
    try {
      const piano = pianoDaCartella(scelta.name, await vociDellaCartella(scelta), { raccolte, favs });
      if (!piano.length) {
        notify(`Nella cartella «${scelta.name}» non ho trovato musica 🎵`);
        return;
      }
      const totale = piano.reduce((n, p) => n + p.nuovi.length, 0);
      let fatti = 0;
      setDaCartellaConto({ fatti, totale });
      const nuove = [];
      let elenco = raccolte;
      const dette = [];
      let scartati = 0;
      for (const p of piano) {
        const ids = [];
        for (const pezzo of p.sequenza) {
          if (pezzo.id) {
            ids.push(pezzo.id);
            continue;
          }
          const voce = await addTrackFile(pezzo.file).catch(() => null);
          setDaCartellaConto({ fatti: ++fatti, totale });
          if (voce) {
            nuove.push(voce);
            ids.push(voce.id);
          } else scartati++;
        }
        if (!ids.length) continue;
        const ora = Date.now();
        elenco = p.id
          ? elenco.map((x) => (x.id === p.id ? { ...x, brani: [...(x.brani || []), ...ids], updatedAt: ora } : x))
          : [...elenco, { ...nuovaRaccolta(p.nome), brani: ids }];
        dette.push(`«${p.nome}» (${ids.length})`);
      }
      if (nuove.length) commit([...favs, ...nuove]);
      if (dette.length) {
        commitRac(elenco);
        cambiaVista("raccolte");
      }
      notify(
        dette.length
          ? `📁 Dalla cartella «${scelta.name}»: ${dette.join(", ")} ✨`
          : `Le raccolte di «${scelta.name}» avevano già tutti i loro brani ✨`
      );
      if (scartati) notify(`${scartati} file non si sono lasciati custodire e li ho lasciati fuori 🎵`);
    } finally {
      setCaricando(false);
      setDaCartellaConto(null);
    }
  }

  function addMelody() {
    const url = newUrl.trim();
    if (!parseYouTube(url)) {
      notify("Questo non sembra un link YouTube… incolla un video o una playlist 🎵");
      return;
    }
    const now = Date.now();
    const name = newName.trim() || "Melodia senza nome";
    commit([...favs, { id: crypto.randomUUID(), name, url, addedAt: now, updatedAt: now }]);
    setNewUrl("");
    setNewName("");
    setAdding(false);
    notify(`«${name}» custodita tra le tue melodie ✨`);
  }

  function commitRac(next) {
    setRaccolte(next);
    saveLists(next);
    onCambiata?.();
  }

  // e quel che arriva dagli altri si vede subito, a sala aperta
  useEffect(() => {
    const rileggi = () => {
      setFavs(getFavoritesRaw());
      setRaccolte(getListsRaw());
    };
    window.addEventListener(MUSICA_CAMBIATA, rileggi);
    return () => window.removeEventListener(MUSICA_CAMBIATA, rileggi);
  }, []);

  function creaRaccolta() {
    const nome = nomeNuova.trim();
    if (!nome) return;
    const r = nuovaRaccolta(nome);
    commitRac([...raccolte, r]);
    setNomeNuova("");
    setNuova(false);
    setScegliendo(r.id);
    setCerca("");
    apri(r.id);
    notify(`«${nome}» creata ✨ Ora scegli i brani.`);
  }

  function togliRaccolta(r) {
    commitRac(raccolte.map((x) => (x.id === r.id ? { ...x, deleted: true, updatedAt: Date.now() } : x)));
    if (scegliendo === r.id) setScegliendo(null);
    if (aperta === r.id) apri(null);
  }

  function commitRinominaRac() {
    const nome = bozzaRac.trim();
    if (!nome) {
      setRinomina(null);
      return;
    }
    commitRac(raccolte.map((x) => (x.id === rinomina ? { ...x, name: nome, updatedAt: Date.now() } : x)));
    setRinomina(null);
  }

  // un tocco sulla melodia mentre si sceglie: dentro se non c'era, fuori se
  // c'era. L'ordine e' quello in cui li hai messi, non quello dell'elenco.
  function alterna(racId, favId) {
    commitRac(
      raccolte.map((x) => {
        if (x.id !== racId) return x;
        const dentro = (x.brani || []).includes(favId);
        return {
          ...x,
          brani: dentro ? x.brani.filter((b) => b !== favId) : [...(x.brani || []), favId],
          updatedAt: Date.now(),
        };
      })
    );
  }

  function startRename(f) {
    setEditing(f.id);
    setDraft(f.name);
  }

  function commitRename() {
    const name = draft.trim();
    if (!name) {
      setEditing(null);
      return;
    }
    commit(favs.map((x) => (x.id === editing ? { ...x, name, updatedAt: Date.now() } : x)));
    setEditing(null);
    notify(`Ora si chiama «${name}» ✨`);
  }

  const liveFavs = favs.filter((f) => !f.deleted);
  const liveRac = raccolte.filter((r) => !r.deleted);
  const pagina = liveRac.find((r) => r.id === aperta) || null;
  const alreadySaved =
    current &&
    liveFavs.some((f) => (current.trackId ? f.trackId === current.trackId : f.url === current.url));

  function cambiaVista(v) {
    setVista(v);
    salvaVista(v);
    setMenuBrano(null);
  }

  function cambiaOrdine(o) {
    setOrdine(o);
    salvaOrdine(o);
  }

  const pillola = (acceso = false) => ({
    minHeight: 44,
    padding: "0 16px",
    borderRadius: R.tondo,
    fontSize: F.nota,
    border: `1px solid ${acceso ? C.accent : C.border}`,
    color: acceso ? C.accent : C.muted,
    background: acceso ? `${C.accent}14` : "transparent",
    flexShrink: 0,
    whiteSpace: "nowrap",
  });
  const pieno = {
    minHeight: 44,
    padding: "0 20px",
    borderRadius: R.tondo,
    fontSize: F.corpo,
    fontWeight: 600,
    background: `linear-gradient(180deg, ${C.accent}, ${C.accentDeep})`,
    color: C.onAccent,
    flexShrink: 0,
    whiteSpace: "nowrap",
  };
  const tondo = (acceso = false) => ({
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: R.tondo,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: F.corpo,
    border: `1px solid ${acceso ? C.accent : C.border}`,
    color: acceso ? C.accent : C.muted,
  });
  const titoletto = { fontFamily: FONT_TITLE, fontWeight: 600, fontSize: F.titoletto, color: C.text, margin: "18px 0 8px" };

  // COME UN LETTORE VERO: a schermo largo «In ascolto» sta fermo a sinistra
  // e la tua musica scorre a destra; a schermo stretto sta in cima
  const ascolto = (
    <InAscolto
      ripiegabile={!wide}
      music={music}
      playerRef={playerRef}
      nomeRaccolta={queue?.raccolta ? liveRac.find((r) => r.id === queue.raccolta)?.name : null}
      vuoto={
        liveFavs.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => playerRef.current?.playQueue(braniInVista(liveFavs, { ordine }), false)} style={pieno}>
              ▶ Tutte le melodie
            </button>
            {liveFavs.length > 1 && (
              <button onClick={() => playerRef.current?.playQueue(liveFavs, true)} style={pillola()}>
                🔀 A caso
              </button>
            )}
          </div>
        )
      }
    >
      {!alreadySaved && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <input
            value={favName}
            onChange={(e) => setFavName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveCurrentAsFav()}
            placeholder="Un nome per questa melodia…"
            style={{ ...inputStyle(), background: C.bg }}
          />
          <button
            onClick={saveCurrentAsFav}
            style={{ padding: "9px 16px", borderRadius: R.piccolo, border: `1px solid ${C.accent}88`, color: C.accent, fontSize: F.nota }}
          >
            ☆ Custodisci
          </button>
        </div>
      )}
    </InAscolto>
  );

  // UNA RIGA PER BRANO, COME NEI LETTORI MUSICALI: copertina piccola (o il
  // numero dentro una raccolta), il nome intero, una riga sotto con quel
  // che conta, e il resto nel menu «⋯» — matita e cestino in vista su ogni
  // riga erano 87 coppie di tasti
  function riga(f, { numero = null, onPlay, dentro = null }) {
    const ora = suona(f);
    const punto = ora ? 0 : puntoDi(f);
    const manca = isFile(f) && qui && !qui.has(f.trackId);
    const sotto = [
      ora ? (playing ? "♫ in ascolto" : "in pausa") : punto > 0 ? `da ${minuti(punto)}` : null,
      !isFile(f) ? "♪ YouTube" : null,
      manca ? "⚠ non è su questo dispositivo" : null,
    ].filter(Boolean);
    const conMenu = menuBrano === f.id;
    const voce = { minHeight: 44, padding: "0 14px", borderRadius: R.tondo, fontSize: F.piccolo, border: `1px solid ${C.border}`, color: C.muted };
    if (editing === f.id) {
      return (
        <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 56, padding: "4px 8px" }}>
          <Faccia nome={f.name} misura={px(40)} />
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditing(null);
            }}
            onBlur={commitRename}
            placeholder="Come la chiami?"
            style={{ ...inputStyle(), minWidth: 0, padding: "8px 10px", background: C.bg }}
          />
        </div>
      );
    }
    return (
      <div key={f.id} style={{ borderRadius: R.piccolo, background: ora ? `${C.accent}14` : conMenu ? `${C.card}` : "transparent" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={onPlay}
            title={isFile(f) ? "Dal tuo archivio: va avanti a schermo spento" : "Da YouTube: solo a schermo acceso"}
            style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, minHeight: 56, padding: "6px 8px", textAlign: "left" }}
          >
            {numero != null ? (
              <span style={{ width: px(26), flexShrink: 0, textAlign: "center", fontSize: F.piccolo, color: ora ? C.accent : C.muted }}>
                {ora ? (playing ? "♫" : "❚❚") : numero}
              </span>
            ) : (
              <Faccia nome={f.name} misura={px(40)} viva={ora && playing} />
            )}
            <span style={{ flex: 1, minWidth: 0 }}>
              {/* IL NOME INTERO (chiesto dal lettore: «i testi dei file che
                  importo, posso leggere praticamente nulla») */}
              <span style={{ display: "block", fontSize: F.corpo, color: ora ? C.accent : C.text, lineHeight: 1.3, overflowWrap: "break-word" }}>{f.name}</span>
              {sotto.length > 0 && (
                <span style={{ display: "block", fontSize: F.minuscolo, color: manca ? C.accent : C.muted, marginTop: 2, lineHeight: 1.35 }}>{sotto.join(" · ")}</span>
              )}
            </span>
          </button>
          <button
            onClick={() => {
              setMenuBrano(conMenu ? null : f.id);
              setNelleRaccolte(null);
            }}
            aria-expanded={conMenu}
            aria-label={`Altro per ${f.name}`}
            style={{ ...tondo(conMenu), border: "none" }}
          >
            ⋯
          </button>
        </div>
        {conMenu && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "2px 8px 10px" }}>
            {dentro ? (
              <button
                onClick={() => {
                  alterna(dentro.id, f.id);
                  setMenuBrano(null);
                }}
                style={voce}
              >
                ✕ Togli da «{dentro.name}»
              </button>
            ) : (
              liveRac.length > 0 && (
                <button
                  onClick={() => setNelleRaccolte(nelleRaccolte === f.id ? null : f.id)}
                  aria-expanded={nelleRaccolte === f.id}
                  style={{ ...voce, border: `1px solid ${nelleRaccolte === f.id ? C.accent : C.border}`, color: nelleRaccolte === f.id ? C.accent : C.muted }}
                >
                  ✧ Nelle raccolte{inQuante(f, liveRac) ? ` (${inQuante(f, liveRac)})` : ""}
                </button>
              )
            )}
            <button
              onClick={() => {
                startRename(f);
                setMenuBrano(null);
              }}
              style={voce}
            >
              ✎ Rinomina
            </button>
            {!dentro && (
              <button
                onClick={() => {
                  removeFav(f);
                  setMenuBrano(null);
                  notify(`«${f.name}» dimenticata`);
                }}
                style={voce}
              >
                🗑 Dimentica
              </button>
            )}
            {nelleRaccolte === f.id && (
              <div style={{ flexBasis: "100%", display: "flex", gap: 8, flexWrap: "wrap" }}>
                {liveRac.map((r) => {
                  const sta = (r.brani || []).includes(f.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => alterna(r.id, f.id)}
                      aria-pressed={sta}
                      style={{ ...voce, border: `1px solid ${sta ? C.accent : C.border}`, color: sta ? C.accent : C.muted, background: sta ? `${C.accent}14` : "transparent" }}
                    >
                      {sta ? "✓" : "＋"} {r.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // le righe di una lista che suona da sé: il tocco su un brano suona da
  // li' in avanti tutta la lista che vedi, come in ogni lettore
  const righe = (lista) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {lista.map((f, i) => riga(f, { onPlay: () => playerRef.current?.playQueue(lista, false, { da: i }) }))}
    </div>
  );

  // LA CASELLA DI UNA RACCOLTA: copertina disegnata dal nome, ▶ sopra per
  // suonarla da dove eri, il nome intero sotto; il tocco apre la sua pagina
  function casella(r) {
    const brani = braniDi(r, liveFavs);
    const dove = doveDi(r, brani);
    const inAscolto = queue?.raccolta === r.id;
    const sotto = [
      brani.length === 0 ? "nessun brano ancora" : `${brani.length} ${brani.length === 1 ? "brano" : "brani"}`,
      inAscolto ? (playing ? "♫ in ascolto" : "in pausa") : null,
    ].filter(Boolean);
    return (
      <div key={r.id} style={{ minWidth: 0 }}>
        <div style={{ position: "relative" }}>
          <button onClick={() => { setCerca(""); apri(r.id); }} aria-label={`Apri ${r.name}`} style={{ display: "block", width: "100%", padding: 0 }}>
            <Faccia nome={r.name} piena viva={inAscolto && playing} />
          </button>
          {brani.length > 0 && (
            <button
              onClick={() => playerRef.current?.playQueue(brani, false, { da: dove, raccolta: r.id })}
              aria-label={`Suona ${r.name}`}
              style={{ ...tondo(), position: "absolute", right: 8, bottom: 8, border: "none", background: `linear-gradient(180deg, ${C.accent}, ${C.accentDeep})`, color: C.onAccent, boxShadow: `0 2px 10px ${C.bg}aa` }}
            >
              <Icona nome="play" misura={22} />
            </button>
          )}
        </div>
        <button onClick={() => { setCerca(""); apri(r.id); }} style={{ display: "block", width: "100%", minHeight: 44, padding: "8px 2px 4px", textAlign: "left" }}>
          <span style={{ display: "block", fontSize: F.corpo, color: inAscolto ? C.accent : C.text, lineHeight: 1.3, overflowWrap: "break-word" }}>{r.name}</span>
          <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted, marginTop: 2, lineHeight: 1.35 }}>{sotto.join(" · ")}</span>
        </button>
      </div>
    );
  }

  const griglia = { display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${px(140)}px, 1fr))`, gap: 14, alignItems: "start" };
  const nienteDa = (testo) => <p style={{ fontSize: F.nota, color: C.muted, margin: "12px 2px" }}>{testo}</p>;

  // ---- LA PAGINA DI UNA RACCOLTA ------------------------------------------
  function paginaRaccolta(r) {
    const brani = braniDi(r, liveFavs);
    const dove = doveDi(r, brani);
    const punto = brani.length ? puntoDi(brani[dove]) : 0;
    const riprendi = dove > 0 || punto > 0;
    const inAscolto = queue?.raccolta === r.id;
    const mancano = nonArrivati(r, favs);
    const scelta = scegliendo === r.id;
    const voce = { minHeight: 44, padding: "0 14px", borderRadius: R.tondo, fontSize: F.piccolo, border: `1px solid ${C.border}`, color: C.muted };
    // i brani della raccolta che la ricerca trova, col loro numero vero
    const visti = brani.map((f, i) => ({ f, i })).filter(({ f }) => braniInVista([f], { cerca }).length);
    return (
      <div>
        <button onClick={() => { apri(null); setMenu(false); setScegliendo(null); }} style={{ ...pillola(), padding: "0 14px" }}>
          ‹ Le raccolte
        </button>
        <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "14px 0 6px", flexWrap: "wrap" }}>
          <div style={{ width: px(120), flexShrink: 0 }}>
            <Faccia nome={r.name} piena viva={inAscolto && playing} />
          </div>
          <div style={{ flex: 1, minWidth: px(200) }}>
            {rinomina === r.id ? (
              <input
                autoFocus
                value={bozzaRac}
                onChange={(e) => setBozzaRac(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRinominaRac();
                  if (e.key === "Escape") setRinomina(null);
                }}
                onBlur={commitRinominaRac}
                style={{ ...inputStyle(), minWidth: 0, width: "100%", background: C.bg }}
              />
            ) : (
              <h2 style={{ fontFamily: FONT_TITLE, fontWeight: 600, fontSize: F.titolo, color: C.text, lineHeight: 1.25, overflowWrap: "break-word" }}>{r.name}</h2>
            )}
            <div style={{ fontSize: F.piccolo, color: C.muted, marginTop: 4, lineHeight: 1.4 }}>
              {brani.length === 0 ? "nessun brano ancora" : `${brani.length} ${brani.length === 1 ? "brano" : "brani"}`}
              {mancano > 0 && ` · ${mancano === 1 ? "1 brano non ancora arrivato qui" : `${mancano} brani non ancora arrivati qui`}`}
              {inAscolto
                ? ` · ${playing ? "♫ in ascolto" : "in pausa"}`
                : riprendi
                  ? ` · eri a «${brani[dove].name}»${punto ? `, ${minuti(punto)}` : ""}`
                  : ""}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
              {/* SE STA GIA' SUONANDO, il tasto grande e' pausa e ripresa,
                  come in ogni lettore: ripartire dal segno sarebbe un salto */}
              <button
                onClick={() =>
                  inAscolto
                    ? playing
                      ? playerRef.current?.pause()
                      : playerRef.current?.resume()
                    : playerRef.current?.playQueue(brani, false, { da: dove, raccolta: r.id })
                }
                disabled={!brani.length}
                style={{ ...pieno, opacity: brani.length ? 1 : 0.5 }}
              >
                {inAscolto ? (playing ? "❚❚ Pausa" : "▶ Riprendi") : riprendi ? "▶ Riprendi" : "▶ In ordine"}
              </button>
              <button
                onClick={() => playerRef.current?.playQueue(brani, true)}
                disabled={brani.length < 2}
                aria-label={`${r.name} a caso`}
                style={{ ...pillola(), display: "flex", alignItems: "center", gap: 6, opacity: brani.length > 1 ? 1 : 0.5 }}
              >
                <Icona nome="caso" misura={18} /> Casuale
              </button>
              <button onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label={`Altro per ${r.name}`} style={tondo(menu)}>
                ⋯
              </button>
            </div>
            {menu && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <button
                  onClick={() => {
                    setScegliendo(scelta ? null : r.id);
                    setMenu(false);
                  }}
                  style={{ ...voce, border: `1px solid ${scelta ? C.accent : C.border}`, color: scelta ? C.accent : C.muted }}
                >
                  {scelta ? "Fatto" : "Scegli i brani"}
                </button>
                <button
                  onClick={() => {
                    setRinomina(r.id);
                    setBozzaRac(r.name);
                    setMenu(false);
                  }}
                  style={voce}
                >
                  ✎ Rinomina
                </button>
                <button
                  onClick={() => {
                    togliRaccolta(r);
                    setMenu(false);
                    notify(`«${r.name}» dimenticata — i brani restano fra le tue melodie`);
                  }}
                  style={voce}
                >
                  🗑 Dimentica
                </button>
              </div>
            )}
          </div>
        </div>

        {scelta ? (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                padding: "10px 14px",
                borderRadius: R.piccolo,
                margin: "12px 0",
                border: `1px solid ${C.accent}66`,
                background: `${C.accent}14`,
              }}
            >
              <span style={{ flex: 1, minWidth: px(200), fontSize: F.nota, color: C.text, lineHeight: 1.4 }}>
                Scegli i brani per <b>«{r.name}»</b> — tocca per metterli dentro o toglierli. {brani.length > 0 && `${brani.length} scelti.`}
              </span>
              <button onClick={() => setScegliendo(null)} style={{ ...pillola(true), border: `1px solid ${C.accent}` }}>
                Fatto
              </button>
            </div>
            {/* la scelta pesca da tutti i brani, in ordine di nome, e la
                ricerca in cima restringe: con 87 brani si scrive «cadia» */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {braniInVista(liveFavs, { cerca }).map((f) => {
                const sta = (r.brani || []).includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => alterna(r.id, f.id)}
                    aria-pressed={sta}
                    style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 52, padding: "6px 10px", borderRadius: R.piccolo, textAlign: "left", background: sta ? `${C.accent}10` : "transparent" }}
                  >
                    <span style={{ width: px(22), flexShrink: 0, fontSize: F.titoletto, color: sta ? C.accent : C.muted }}>{sta ? "✓" : "○"}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: F.corpo, color: sta ? C.text : C.muted, lineHeight: 1.3, overflowWrap: "break-word" }}>{f.name}</span>
                    <span style={{ fontSize: F.corpo, color: isFile(f) ? C.accent : C.muted, opacity: 0.8 }}>{isFile(f) ? "♫" : "♪"}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : brani.length === 0 ? (
          <div style={{ margin: "16px 2px" }}>
            {nienteDa("Questa raccolta è vuota.")}
            <button onClick={() => setScegliendo(r.id)} style={pillola(true)}>
              Scegli i brani
            </button>
          </div>
        ) : visti.length === 0 ? (
          nienteDa(`Nessun brano di «${r.name}» per «${cerca.trim()}».`)
        ) : (
          // UN BRANO SCELTO DALLA RACCOLTA (chiesto dal lettore:
          // «selezionare cosa riprodurre nelle raccolte»): si suona da li', e
          // poi avanti in ordine
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }}>
            {visti.map(({ f, i }) =>
              riga(f, { numero: i + 1, dentro: r, onPlay: () => playerRef.current?.playQueue(brani, false, { da: i, raccolta: r.id }) })
            )}
          </div>
        )}
      </div>
    );
  }

  // ---- LE DUE VISTE -------------------------------------------------------
  const cercato = cerca.trim();
  const raccolteViste = raccolteInVista(liveRac, cerca);
  const braniVisti = braniInVista(liveFavs, { cerca, ordine });
  const conLettere = ordine === "nome" && !cercato && braniVisti.length >= 20;
  const gruppi = conLettere ? perLettera(braniVisti) : null;
  const vistaOra = vistaIniziale(vista, liveRac.length);

  const vistaRaccolte = (
    <>
      {nuova && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <input
            autoFocus
            value={nomeNuova}
            onChange={(e) => setNomeNuova(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && creaRaccolta()}
            placeholder="Come la chiami? («Notti d'inverno»)"
            style={inputStyle()}
          />
          <button onClick={creaRaccolta} style={{ ...pieno, borderRadius: R.piccolo }}>
            ✧ Crea
          </button>
          <button onClick={() => setNuova(false)} style={pillola()}>
            Annulla
          </button>
        </div>
      )}
      {liveRac.length === 0 && !cercato && (
        <p style={{ fontSize: F.piccolo, color: C.muted, margin: "0 0 14px", lineHeight: 1.5 }}>
          Una raccolta è un gruppo di brani che scegli tu — «per leggere», «per dormire» — e che suonano uno dopo l'altro. Una cartella
          del tablet con dentro le sue sottocartelle diventa le sue raccolte da «＋ Aggiungi».
        </p>
      )}
      {cercato && raccolteViste.length === 0 && braniVisti.length === 0 && nienteDa(`Niente per «${cercato}».`)}
      <div style={griglia}>
        {raccolteViste.map(casella)}
        {!cercato && (
          <button
            onClick={() => setNuova((v) => !v)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              aspectRatio: "1 / 1",
              borderRadius: R.medio,
              border: `1px dashed ${nuova ? C.accent : C.border}`,
              color: nuova ? C.accent : C.muted,
              fontSize: F.nota,
              padding: 8,
            }}
          >
            ＋ Nuova raccolta
          </button>
        )}
      </div>
      {/* CERCANDO, ANCHE I BRANI: si cerca quel che ci si ricorda, e un nome
          di brano non sta nel nome di una raccolta */}
      {cercato && braniVisti.length > 0 && (
        <>
          <h3 style={titoletto}>Brani</h3>
          {righe(braniVisti)}
        </>
      )}
    </>
  );

  const vistaBrani =
    liveFavs.length === 0 ? (
      <EmptyState
        emoji="🎼"
        title="La sala della musica attende"
        text="Porta qui i tuoi file audio da «＋ Aggiungi» — pioggia e camino, arpe celtiche, cori lontani: li suona l'app, e ti accompagnano anche a tablet spento fino allo scadere del timer. Un link YouTube va bene lo stesso, ma solo a schermo acceso."
      />
    ) : (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <button
            onClick={() => braniVisti.length && playerRef.current?.playQueue(braniVisti, false)}
            disabled={!braniVisti.length}
            style={{ ...pillola(queue && !queue.shuffle && !queue.raccolta), opacity: braniVisti.length ? 1 : 0.5 }}
          >
            ▶ Tutti
          </button>
          <button
            onClick={() => braniVisti.length > 1 && playerRef.current?.playQueue(braniVisti, true)}
            disabled={braniVisti.length < 2}
            style={{ ...pillola(!!queue?.shuffle), opacity: braniVisti.length > 1 ? 1 : 0.5 }}
          >
            🔀 Casuale
          </button>
          <span style={{ flex: 1 }} />
          <select
            value={ordine}
            onChange={(e) => cambiaOrdine(e.target.value)}
            aria-label="Ordine dei brani"
            style={{ minHeight: 44, padding: "0 12px", borderRadius: R.tondo, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: F.nota }}
          >
            {ORDINI.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>
        {/* LE LETTERE, per saltare in una lista lunga: una striscia che
            scorre di lato, non una riga che va a capo tre volte */}
        {gruppi && gruppi.length > 1 && (
          <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 6, marginBottom: 6 }} aria-label="Salta alla lettera">
            {gruppi.map((g) => (
              <button
                key={g.lettera}
                onClick={() => document.getElementById(`bc-lettera-${g.lettera}`)?.scrollIntoView({ block: "start", behavior: "smooth" })}
                style={{ minWidth: 44, minHeight: 44, flexShrink: 0, borderRadius: R.piccolo, fontSize: F.nota, color: C.accent, border: `1px solid ${C.border}` }}
              >
                {g.lettera}
              </button>
            ))}
          </div>
        )}
        {cercato && braniVisti.length === 0 && nienteDa(`Nessun brano per «${cercato}».`)}
        {gruppi
          ? gruppi.map((g) => (
              <div key={g.lettera}>
                <div id={`bc-lettera-${g.lettera}`} style={{ fontFamily: FONT_TITLE, fontSize: F.titoletto, color: C.accent, padding: "10px 8px 2px", scrollMarginTop: 12 }}>
                  {g.lettera}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {g.brani.map(({ f, i }) => riga(f, { onPlay: () => playerRef.current?.playQueue(braniVisti, false, { da: i }) }))}
                </div>
              </div>
            ))
          : righe(braniVisti)}
      </>
    );

  return (
    <div
      style={{
        animation: "bc-fade-in 0.4s ease-out",
        display: wide ? "grid" : "block",
        gridTemplateColumns: `${px(360)}px minmax(0, 1fr)`,
        gap: 28,
        alignItems: "start",
      }}
    >
      <div
        style={
          wide
            ? { position: "sticky", top: 8, maxHeight: "calc(100vh - 150px)", overflowY: "auto", borderRadius: R.grande }
            : { marginBottom: 16 }
        }
      >
        {ascolto}
      </div>
      <div style={{ minWidth: 0 }}>
        {/* LA RICERCA E «＋ AGGIUNGI» IN CIMA, COME IN OGNI LETTORE: i quattro
            modi di portare musica erano quattro tasti in fila sopra l'elenco */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            <input
              type="text"
              enterKeyHint="search"
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              placeholder={pagina ? `Cerca in «${pagina.name}»` : "Cerca fra brani e raccolte"}
              aria-label="Cerca nella musica"
              style={{ ...inputStyle(), width: "100%", minWidth: 0, minHeight: 44, borderRadius: R.tondo, paddingLeft: 16, paddingRight: cerca ? 48 : 16 }}
            />
            {cerca && (
              <button onClick={() => setCerca("")} aria-label="Cancella la ricerca" style={{ ...tondo(), border: "none", position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)" }}>
                ✕
              </button>
            )}
          </div>
          <button onClick={() => setAggiungi((v) => !v)} aria-expanded={aggiungi} style={pillola(aggiungi || caricando)}>
            {aggiungi ? "Chiudi" : "＋ Aggiungi"}
          </button>
        </div>

        {(aggiungi || caricando) && (
          <div style={{ padding: 12, borderRadius: R.medio, border: `1px solid ${C.border}`, background: `linear-gradient(135deg, ${C.card}, ${C.surface})`, marginBottom: 14 }}>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              multiple
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
              style={{ display: "none" }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => fileRef.current?.click()} disabled={caricando} style={{ ...pillola(true), opacity: caricando && daCartellaConto ? 0.6 : 1 }}>
                {caricando && !daCartellaConto ? "…custodisco" : "♫ Dai tuoi file"}
              </button>
              {cartellaPossibile && (
                <button onClick={daCartella} disabled={caricando} style={{ ...pillola(true), opacity: caricando && !daCartellaConto ? 0.6 : 1 }}>
                  {daCartellaConto ? `…custodisco ${daCartellaConto.fatti}/${daCartellaConto.totale}` : "📁 Da una cartella"}
                </button>
              )}
              <button onClick={() => setAdding((v) => !v)} aria-expanded={adding} style={pillola(adding)}>
                {adding ? "Annulla" : "＋ Da YouTube"}
              </button>
            </div>
            <p style={{ fontSize: F.minuscolo, color: C.muted, margin: "8px 2px 0", lineHeight: 1.5 }}>
              ♫ I tuoi file suonano anche a schermo spento · ♪ YouTube solo a schermo acceso
              {cartellaPossibile ? " · una cartella diventa le sue raccolte, una per sottocartella" : ""}
            </p>
            {adding && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <input
                  autoFocus
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addMelody()}
                  placeholder="Incolla un link YouTube (video o playlist)…"
                  style={{ ...inputStyle(), flexBasis: "100%" }}
                />
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addMelody()}
                  placeholder="Nome («Pioggia e camino»)"
                  style={inputStyle()}
                />
                <button onClick={suonaOra} style={{ padding: "10px 18px", borderRadius: R.piccolo, border: `1px solid ${C.accent}88`, color: C.accent, fontSize: F.corpo }}>
                  ▶ Suona ora
                </button>
                <button onClick={addMelody} style={{ ...pieno, borderRadius: R.piccolo }}>
                  ☆ Custodisci
                </button>
              </div>
            )}
          </div>
        )}

        {pagina ? (
          paginaRaccolta(pagina)
        ) : (
          <>
            <div role="tablist" aria-label="La tua musica" style={{ display: "flex", gap: 4, padding: 4, borderRadius: R.tondo, border: `1px solid ${C.border}`, background: C.surface, marginBottom: 14 }}>
              {[
                { id: "raccolte", nome: "✧ Raccolte", n: liveRac.length },
                { id: "brani", nome: "♫ Brani", n: liveFavs.length },
              ].map((t) => {
                const sel = vistaOra === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={sel}
                    onClick={() => cambiaVista(t.id)}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      borderRadius: R.tondo,
                      fontSize: F.nota,
                      color: sel ? C.accent : C.muted,
                      background: sel ? `${C.accent}1f` : "transparent",
                      fontWeight: sel ? 600 : 400,
                    }}
                  >
                    {t.nome} {t.n > 0 && <span style={{ color: C.muted, fontWeight: 400 }}>{t.n}</span>}
                  </button>
                );
              })}
            </div>
            {vistaOra === "raccolte" ? vistaRaccolte : vistaBrani}
          </>
        )}
      </div>
    </div>
  );
}

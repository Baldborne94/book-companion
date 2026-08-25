import { useEffect, useRef, useState } from "react";
import { C, FONT_TITLE, F, R } from "../data/constants.js";
import { getProgress, getStatus, combacia } from "../lib/library.js";
import { storageEstimate, statoPersistenza, requestPersistence, getFile } from "../lib/bookStore.js";
import { importFiles, resoconto } from "../lib/importBook.js";
import { exportLibrary, ultimoArchivio, promemoriaArchivio } from "../lib/exportLibrary.js";
import { restoreLibrary, sbircia } from "../lib/restoreLibrary.js";
import { getFavorites, isFile } from "../lib/music.js";
import { cercaOvunque, abbastanzaLunga } from "../lib/librarySearch.js";
import { portaACasa } from "../lib/sync.js";
import { fmtBytes } from "../lib/bytes.js";
import { famigliaDi } from "../data/generi.js";
import BookCover from "./BookCover.jsx";
import EmptyState from "./EmptyState.jsx";

const FILTERS = [
  { id: "all", label: "Tutti" },
  { id: "unread", label: "Da leggere" },
  { id: "reading", label: "In lettura" },
  { id: "read", label: "Letti" },
  { id: "abandoned", label: "Abbandonati" },
];

const SORTS = [
  { id: "recent", label: "Recenti" },
  { id: "title", label: "Titolo" },
  { id: "author", label: "Autore" },
];

const GROUPS = [
  { id: "none", label: "Scaffale" },
  { id: "genre", label: "Genere", empty: "Senza genere" },
  { id: "saga", label: "Saga", empty: "Fuori saga" },
];

function Shelf({ books, onOpenBook, localIds, showOrder }) {
  // Chi ha il dorso disegnato lo sa solo `BookCover`, che va a guardare in
  // IndexedDB se una copertina c'è: lo dice qui, e lo scaffale evita di
  // ristampare titolo e autore sotto una copertina che li porta già.
  const [dorsi, setDorsi] = useState({});
  const segnaDorso = (id, v) =>
    setDorsi((d) => (d[id] === v ? d : { ...d, [id]: v }));
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))",
        gap: "20px 16px",
      }}
    >
      {books.map((b) => {
        const status = getStatus(b.id);
        const pct = Math.round(getProgress(b.id) * 100);
        // IL TITOLO NON SI SCRIVE DUE VOLTE. Sul dorso disegnato c'è già,
        // composto come si deve: ripeterlo qui sotto era rumore, e per
        // giunta faceva venire le righe sfrangiate perché certe didascalie
        // andavano a capo e altre no. Con una copertina VERA invece la
        // didascalia è l'unico posto dove il titolo si legge, e resta.
        const disegnato = dorsi[b.id];
        return (
          <button
            key={b.id}
            onClick={() => onOpenBook(b.id)}
            style={{
              display: "block",
              textAlign: "center",
              animation: "bc-fade-in 0.4s ease-out",
            }}
          >
            <div style={{ position: "relative", opacity: status === "abandoned" ? 0.55 : 1 }}>
              <BookCover book={b} onDisegnata={(v) => segnaDorso(b.id, v)} />
              {status === "reading" && pct > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    padding: "2px 7px",
                    borderRadius: R.piccolo,
                    fontSize: F.minuscolo,
                    fontWeight: 600,
                    background: `${C.bg}cc`,
                    border: `1px solid ${C.accent}88`,
                    color: C.accent,
                  }}
                >
                  {pct}%
                </span>
              )}
              {status === "read" && (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    padding: "2px 7px",
                    borderRadius: R.piccolo,
                    fontSize: F.minuscolo,
                    background: `${C.bg}cc`,
                    border: `1px solid ${C.green}88`,
                    color: C.green,
                  }}
                >
                  ✓
                </span>
              )}
              {/* Abbandonato: un segno suo, non il ✓ dei finiti. E la
                  copertina si smorza, perche' sullo scaffale si deve
                  vedere da lontano che quel libro è fermo. */}
              {status === "abandoned" && (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    padding: "2px 7px",
                    borderRadius: R.piccolo,
                    fontSize: F.minuscolo,
                    background: `${C.bg}cc`,
                    border: `1px solid ${C.red}88`,
                    color: C.red,
                  }}
                >
                  ⏸
                </span>
              )}
              {showOrder && b.sagaOrder != null && (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    minWidth: 20,
                    padding: "1px 6px",
                    borderRadius: R.piccolo,
                    fontSize: F.minuscolo,
                    fontWeight: 600,
                    background: `${C.bg}dd`,
                    border: `1px solid ${C.accent}88`,
                    color: C.accent,
                  }}
                >
                  {b.sagaOrder}
                </span>
              )}
              {localIds && !localIds.has(b.id) && (
                <span
                  title="Nel cloud — si scarica quando lo apri"
                  style={{
                    position: "absolute",
                    bottom: 6,
                    left: 6,
                    padding: "1px 6px",
                    borderRadius: R.piccolo,
                    fontSize: F.minuscolo,
                    background: `${C.bg}cc`,
                    border: `1px solid ${C.arcane}77`,
                    color: C.arcane,
                  }}
                >
                  ☁
                </span>
              )}
            </div>
            <div
              style={{
                height: 5,
                margin: "0 4px",
                borderRadius: "0 0 4px 4px",
                background: `linear-gradient(180deg, ${C.accent}55, #3a2b1466)`,
              }}
            />
            {!disegnato && (
              <div
                style={{
                  marginTop: 7,
                  fontSize: F.nota,
                  lineHeight: 1.25,
                  color: C.text,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {b.title}
              </div>
            )}
            {!disegnato && b.author && (
              <div
                style={{
                  fontSize: F.minuscolo,
                  color: C.muted,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {b.author}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Grouped({ books, group, onOpenBook, localIds }) {
  if (group === "none") return <Shelf books={books} onOpenBook={onOpenBook} localIds={localIds} />;

  const cfg = GROUPS.find((g) => g.id === group);
  const buckets = new Map();
  for (const b of books) {
    // il genere si raggruppa per FAMIGLIA: «Fantasy · Grimdark» e «Fantasy
    // · Epico» stanno sullo stesso scaffale. Prendendo il valore intero
    // ogni sottogenere farebbe un gruppo da un libro, e uno scaffale di
    // gruppi da uno non e' un raggruppamento.
    const key = group === "genre" ? famigliaDi(b.genre) : (b[group] || "").trim();
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(b);
  }
  // dentro una saga comanda l'ordine di lettura; i libri senza numero in coda
  if (group === "saga") {
    for (const [key, list] of buckets) {
      if (!key) continue;
      list.sort((a, b) => {
        const x = a.sagaOrder ?? Infinity;
        const y = b.sagaOrder ?? Infinity;
        return x === y ? 0 : x - y;
      });
    }
  }
  // i libri senza etichetta chiudono la fila
  const names = [...buckets.keys()].filter(Boolean).sort((a, b) => a.localeCompare(b, "it"));
  if (buckets.has("")) names.push("");

  return names.map((name) => (
    <section key={name || "_"} style={{ marginBottom: 26 }}>
      <h3
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          fontFamily: FONT_TITLE,
          fontWeight: 600,
          fontSize: F.titoletto,
          color: name ? C.accent : C.muted,
          marginBottom: 10,
          paddingBottom: 5,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <span>{name || cfg.empty}</span>
        <span style={{ fontSize: F.piccolo, color: C.muted, fontFamily: "inherit" }}>
          {buckets.get(name).length}
        </span>
      </h3>
      <Shelf
        books={buckets.get(name)}
        onOpenBook={onOpenBook}
        localIds={localIds}
        showOrder={group === "saga" && !!name}
      />
    </section>
  ));
}

export default function Library({
  books,
  updateBooks,
  onOpenBook,
  onReadAt,
  notify,
  localIds,
  onImported,
  focusSaga,
  collegato,
  onFileLocali,
}) {
  const [query, setQuery] = useState("");
  // la ricerca dentro i tomi: `vivo` e' il filo che la tiene in vita, e
  // spezzarlo e' l'unico modo per fermarla a meta'
  const [dentro, setDentro] = useState(null);
  const vivo = useRef(null);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [group, setGroup] = useState("none");
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // il richiamo dei tomi dal cloud: {i, totale, titolo} mentre scende, e
  // `filoTomi` e' il modo di fermarlo a meta'
  const [portando, setPortando] = useState(null);
  const filoTomi = useRef(null);
  // il ripasso delle impronte e' l'altra passata lunga: stessa forma,
  // stesso modo di fermarla
  const [improntando, setImprontando] = useState(null);
  const filoImpronte = useRef(null);
  const archiveRef = useRef(null);
  const [estimate, setEstimate] = useState(null);
  const inputRef = useRef(null);
  // Le melodie caricate da file vivono solo qui, come i libri: chi ne ha
  // deve poter fare un archivio anche senza avere un libro in libreria.
  const melodie = getFavorites().filter(isFile).length;

  // Lo sfratto della memoria: se il browser non ha concesso la persistenza,
  // biblioteca, evidenziazioni, diario e punti di lettura stanno in uno
  // spazio che puo' essere buttato via quando serve posto. Qui si GUARDA
  // soltanto — chiedere all'apertura della Libreria farebbe comparire un
  // permesso a sorpresa — e la richiesta vera resta quella dell'avvio.
  const [persist, setPersist] = useState("concessa");

  useEffect(() => {
    storageEstimate().then(setEstimate);
    statoPersistenza().then(setPersist);
  }, [books]);

  async function richiediPersistenza() {
    // riprovare ha senso davvero: Android la concede quando la PWA viene
    // installata o quando l'app se l'e' guadagnata con l'uso
    setPersist(await requestPersistence());
  }

  // I tomi che stanno solo nel cloud: sono quelli con la nuvoletta, e sono
  // quelli che le domande sulla saga non possono sfogliare. Senza un cloud
  // collegato non c'e' niente da richiamare: offrirlo lo stesso sarebbe una
  // promessa che nessuno puo' mantenere.
  const nelCloud = collegato && localIds ? books.filter((b) => !localIds.has(b.id)) : [];

  // IL RICONOSCIMENTO GIRA SOLO ALL'IMPORT, e i libri entrati prima non
  // tornano indietro a farsi guardare. Chi ha importato i Pratchett prima
  // che il ciclo venisse salvato ha saga e numero ma serie vuota, e senza
  // serie «Prima di cominciare» non sa quale storia stai continuando.
  //
  // Questo giro ripassa quello che c'e' gia': riempie i campi vuoti e
  // aggiorna i cicli che avevamo scritto NOI, che nel frattempo hanno
  // cambiato nome. Quello che hai scritto a mano non si tocca mai, nemmeno
  // quando il riconoscimento la pensa diversamente — su questi campi
  // l'ultima parola e' del lettore. Il conto dice le due cose separate,
  // perche' «rinominati» e' un intervento su roba che c'era gia'.
  async function riconosciSaghe() {
    const { ripassa } = await import("../lib/sagaBooks.js");
    let sistemati = 0;
    let rinominati = 0;
    let dedotte = 0;
    const next = books.map((b) => {
      // la biblioteca intera va passata: e' da li' che si impara la saga di
      // un autore che la nostra tabella non conosce
      const esito = ripassa(b, books);
      if (!esito) return b;
      if (esito.dedotta) dedotte += 1;
      else if ((b.series || "").trim() && "series" in esito.campi) rinominati += 1;
      else sistemati += 1;
      return { ...b, ...esito.campi };
    });
    if (sistemati || rinominati || dedotte) updateBooks(next);
    const parti = [];
    if (sistemati) parti.push(`${sistemati} ${sistemati === 1 ? "libro sistemato" : "libri sistemati"}`);
    if (rinominati)
      parti.push(`${rinominati} ${rinominati === 1 ? "serie rinominata" : "serie rinominate"}`);
    // la saga dedotta si dice a parte: non l'abbiamo riconosciuta, l'abbiamo
    // copiata dagli altri libri di quell'autore, e il lettore deve saperlo
    if (dedotte)
      parti.push(
        `${dedotte} ${dedotte === 1 ? "saga dedotta" : "saghe dedotte"} dalla tua biblioteca`
      );
    notify?.(parti.length ? parti.join(", ") : "Erano già tutti a posto");
  }

  // I LIBRI GIA' IN CASA NON HANNO L'IMPRONTA, e sono la biblioteca intera
  // di chi c'era prima della cura sui doppioni. Senza, rimettere dentro lo
  // stesso file non lo fa SALTARE: resta solo il sospetto per titolo e
  // autore, che si limita a dirtelo.
  const senzaImpronta = books.filter((b) => !b.impronta);

  async function ripassaLeImpronte() {
    if (!senzaImpronta.length || improntando) return;
    const mio = {};
    filoImpronte.current = mio;
    setImprontando({ i: 0, totale: senzaImpronta.length, titolo: senzaImpronta[0].title });
    const { ripassaImpronte } = await import("../lib/importBook.js");
    const esito = await ripassaImpronte(senzaImpronta, {
      leggiByte: (id) => getFile(id),
      vivo: () => filoImpronte.current === mio,
      onProgress: (p) => filoImpronte.current === mio && setImprontando(p),
    });
    if (filoImpronte.current !== mio) return;
    filoImpronte.current = null;
    setImprontando(null);
    // quel che e' stato letto resta scritto anche se il giro e' stato
    // fermato: e' la stessa promessa di «Porta qui i tomi»
    const quante = Object.keys(esito.campi).length;
    if (quante) updateBooks(books.map((b) => (esito.campi[b.id] ? { ...b, impronta: esito.campi[b.id] } : b)));
    const parti = [];
    if (esito.scritte) parti.push(`${esito.scritte} ${esito.scritte === 1 ? "tomo riconosciuto" : "tomi riconosciuti"}`);
    // i tomi rimasti lassu' si contano e si dicono, come ovunque: qui non
    // c'e' un guasto, c'e' un file che su questo dispositivo non c'e'
    if (esito.senzaByte)
      parti.push(`${esito.senzaByte} ${esito.senzaByte === 1 ? "non è" : "non sono"} su questo dispositivo`);
    if (esito.illeggibili) parti.push(`${esito.illeggibili} non si ${esito.illeggibili === 1 ? "è" : "sono"} letti`);
    notify?.(parti.length ? parti.join(", ") : "Erano già tutti a posto");
  }

  async function richiamaTomi() {
    if (!nelCloud.length || portando) return;
    const mio = {};
    filoTomi.current = mio;
    setPortando({ i: 0, totale: nelCloud.length, titolo: nelCloud[0].title });
    const esito = await portaACasa(nelCloud, {
      vivo: () => filoTomi.current === mio,
      onProgress: (p) => filoTomi.current === mio && setPortando(p),
    });
    if (filoTomi.current !== mio) return;
    filoTomi.current = null;
    setPortando(null);
    // quel che e' sceso resta sceso anche se il giro e' stato fermato: si
    // dice quanto si e' fatto, non «annullato»
    const parti = [];
    if (esito.scesi) parti.push(`${esito.scesi} ${esito.scesi === 1 ? "tomo è" : "tomi sono"} qui`);
    if (esito.falliti)
      parti.push(`${esito.falliti} non ${esito.falliti === 1 ? "è sceso" : "sono scesi"}`);
    notify?.(
      parti.length
        ? `${parti.join(", ")}${esito.fermato ? " — giro fermato" : ""}`
        : "Non c'era niente da portare a casa"
    );
    // le nuvolette si spengono qui, senza aspettare una sincronizzazione
    // intera: quel che e' cambiato sta tutto in casa
    if (esito.scesi) onFileLocali?.();
  }

  // uscendo dalla libreria la ricerca in corso non serve piu' a nessuno, e
  // continuerebbe ad aprire tomi a vuoto
  useEffect(() => () => { if (vivo.current) vivo.current.acceso = false; }, []);

  // Spezzare il filo ferma il giro, ma il giro fermato non torna piu' a
  // scrivere lo stato: la chiusura tocca a qui, o la riga «sfoglio…»
  // resterebbe appesa per sempre. Quello che ha gia' trovato resta a
  // schermo: e' il senso di fermarsi invece di annullare.
  function fermaRicerca() {
    if (vivo.current) vivo.current.acceso = false;
    vivo.current = null;
    setDentro((d) => (d?.cercando ? { ...d, cercando: false, dove: null } : d));
  }

  async function cercaDentro() {
    fermaRicerca();
    const q = query.trim();
    if (!abbastanzaLunga(q)) return;
    const filo = { acceso: true };
    vivo.current = filo;
    setDentro({ q, cercando: true, dove: null, fatti: 0, totale: books.length, esiti: [], lontani: 0 });
    const { lontani, esaminati } = await cercaOvunque(books, q, {
      vivo: () => filo.acceso,
      onLibro: ({ i, titolo }) =>
        filo.acceso && setDentro((d) => (d ? { ...d, fatti: i, dove: titolo } : d)),
      onTrovato: ({ libro, trovati }) =>
        filo.acceso && setDentro((d) => (d ? { ...d, esiti: [...d.esiti, { libro, trovati }] } : d)),
    });
    if (!filo.acceso) return;
    vivo.current = null;
    setDentro((d) => (d ? { ...d, cercando: false, dove: null, lontani, esaminati } : d));
  }

  // arrivo dalla home toccando una saga: la libreria si apre gia' raccolta
  // per saghe e ristretta a quella
  useEffect(() => {
    if (!focusSaga) return;
    setGroup("saga");
    setQuery(focusSaga);
  }, [focusSaga]);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length || importing) return;
    setImporting(true);
    try {
      // la libreria di adesso serve a riconoscere i doppioni: senza, lo
      // stesso file importato due volte fa due libri distinti
      const esito = await importFiles(files, books);
      if (esito.added.length) {
        updateBooks([...books, ...esito.added]);
        onImported?.();
      }
      notify(resoconto(esito));
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  // Da quanto non c'e' una copia al sicuro. Sta accanto all'avviso sulla
  // persistenza perche' sono la stessa preoccupazione vista da due lati:
  // uno dice che il browser puo' sfrattarti, l'altro da quanto non hai una
  // copia fuori dal browser.
  const [ultimoArch, setUltimoArch] = useState(ultimoArchivio);
  const promemoria = promemoriaArchivio({
    ultimo: ultimoArch,
    roba: books.length + melodie,
    persistenza: persist,
  });

  async function handleExport() {
    // anche una biblioteca senza libri vale un archivio, se ci sono melodie
    // caricate da file: quei byte stanno solo qui
    if (!books.length && !melodie) return;
    notify("Preparo il backup…");
    try {
      const r = await exportLibrary();
      setUltimoArch(Date.now());
      const parti = [
        r.libri ? `${r.libri} ${r.libri === 1 ? "libro" : "libri"}` : null,
        r.melodie ? `${r.melodie} ${r.melodie === 1 ? "melodia" : "melodie"}` : null,
      ].filter(Boolean);
      notify(`Backup scaricato: ${parti.join(" e ")} al sicuro 🕯️`);
    } catch {
      notify("Esportazione fallita, riprova");
    }
  }

  // PRIMA SI SBIRCIA, POI SI SCEGLIE. L'archivio e' un blocco unico e
  // finora entrava tutto senza chiedere: chi voleva solo i libri si
  // ritrovava in casa anche le melodie. Qui si legge il solo indice — non
  // si estrae un byte — e si mostra cosa c'e' dentro.
  const [archivio, setArchivio] = useState(null);

  async function apriArchivio(file) {
    if (!file || restoring) return;
    try {
      const dentro = await sbircia(file);
      setArchivio({ file, dentro, prendi: { libri: dentro.libri > 0, melodie: dentro.melodie > 0 } });
    } catch (err) {
      notify(err?.message || "Archivio illeggibile");
    } finally {
      if (archiveRef.current) archiveRef.current.value = "";
    }
  }

  async function handleRestore(file, cosa) {
    if (!file || restoring) return;
    setArchivio(null);
    setRestoring(true);
    try {
      const r = await restoreLibrary(file, { onProgress: notify, cosa });
      updateBooks(r.books);
      onImported?.();
      const parts = [
        r.added ? `${r.added} ${r.added === 1 ? "libro tornato" : "libri tornati"}` : null,
        r.files ? `${r.files} ${r.files === 1 ? "file" : "file"} recuperati` : null,
        r.melodie ? `${r.melodie} ${r.melodie === 1 ? "melodia tornata" : "melodie tornate"}` : null,
        r.raccolte ? `${r.raccolte} ${r.raccolte === 1 ? "raccolta" : "raccolte"}` : null,
        r.termini ? `${r.termini} ${r.termini === 1 ? "termine" : "termini"} di glossario` : null,
        r.kept ? `${r.kept} gia' in libreria` : null,
      ].filter(Boolean);
      notify(parts.length ? `Ripristino: ${parts.join(", ")} 🕯️` : "Nell'archivio non c'era nulla di nuovo");
      // l'avviso sull'archivio vecchio ora lo da' il pannello, PRIMA di
      // partire: a ripristino fatto sarebbe solo un rimpianto
    } catch (err) {
      notify(err?.message || "Ripristino fallito, riprova");
    } finally {
      setRestoring(false);
      if (archiveRef.current) archiveRef.current.value = "";
    }
  }

  const visible = books
    .filter((b) => combacia(b, query))
    .filter((b) => filter === "all" || getStatus(b.id) === filter)
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "it")
        : sort === "author"
          ? (a.author || "~").localeCompare(b.author || "~", "it")
          : b.addedAt - a.addedAt
    );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      style={{
        borderRadius: R.medio,
        outline: dragOver ? `2px dashed ${C.accent}` : "2px dashed transparent",
        outlineOffset: 6,
        transition: "outline-color 0.2s ease-out",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".epub,.pdf"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={archiveRef}
        type="file"
        accept=".zip"
        style={{ display: "none" }}
        onChange={(e) => apriArchivio(e.target.files?.[0])}
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={importing}
          style={{
            padding: "10px 20px",
            borderRadius: R.piccolo,
            background: importing ? C.dim : `linear-gradient(180deg, ${C.accent}, ${C.accentDeep})`,
            color: importing ? C.muted : C.onAccent,
            fontWeight: 600,
            fontSize: F.corpo,
            boxShadow: importing ? "none" : `0 0 20px ${C.accent}2e`,
          }}
        >
          {importing ? "Sto rilegando i tomi…" : "＋ Aggiungi libri"}
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && cercaDentro()}
          placeholder="Titolo, autore, saga, genere, le tue note…"
          style={{
            flex: 1,
            minWidth: 180,
            padding: "10px 14px",
            borderRadius: R.piccolo,
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.text,
            fontSize: F.corpo,
            outline: "none",
          }}
        />
        {/* lo scaffale risponde subito su titoli e autori; questo va a
            guardare dentro, ed e' un altro mestiere: si chiede a mano */}
        {abbastanzaLunga(query) && books.length > 0 && (
          <button
            onClick={dentro?.cercando ? fermaRicerca : cercaDentro}
            style={{
              padding: "10px 18px",
              borderRadius: R.piccolo,
              fontSize: F.nota,
              border: `1px solid ${dentro?.cercando ? C.border : C.arcane}88`,
              color: dentro?.cercando ? C.muted : C.arcane,
              background: dentro?.cercando ? "transparent" : `${C.arcane}14`,
            }}
          >
            {dentro?.cercando ? "Ferma" : "🔍 Cerca dentro i tomi"}
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: "6px 14px",
                borderRadius: R.tondo,
                fontSize: F.nota,
                border: `1px solid ${active ? C.accent : C.border}`,
                color: active ? C.accent : C.muted,
                background: active ? `${C.accent}14` : "transparent",
                transition: "color 0.2s ease-out, border-color 0.2s ease-out",
              }}
            >
              {f.label}
            </button>
          );
        })}
        <span style={{ flex: 1 }} />
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: R.piccolo,
            border: `1px solid ${group === "none" ? C.border : C.accent}`,
            background: C.surface,
            color: group === "none" ? C.muted : C.accent,
            fontSize: F.nota,
            fontFamily: "inherit",
          }}
        >
          {GROUPS.map((g) => (
            <option key={g.id} value={g.id}>
              Raggruppa: {g.label}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: R.piccolo,
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.muted,
            fontSize: F.nota,
            fontFamily: "inherit",
          }}
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              Ordina: {s.label}
            </option>
          ))}
        </select>
      </div>

      {dentro && (
        <div
          style={{
            marginBottom: 22,
            padding: "14px 16px",
            borderRadius: R.medio,
            border: `1px solid ${C.arcane}55`,
            background: `linear-gradient(135deg, ${C.arcane}12, ${C.card})`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <h3 style={{ fontFamily: FONT_TITLE, fontSize: F.rilievo, fontWeight: 600, color: C.text }}>
              <span style={{ color: C.arcane, marginRight: 6 }}>✦</span>
              «{dentro.q}» dentro i tomi
            </h3>
            <span style={{ flex: 1 }} />
            {dentro.cercando ? (
              <span style={{ fontSize: F.piccolo, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>
                sfoglio «{dentro.dove || "…"}» · {dentro.fatti + 1} di {dentro.totale}
              </span>
            ) : (
              <button onClick={() => setDentro(null)} aria-label="Chiudi i risultati" style={{ color: C.muted, padding: 4, fontSize: F.corpo }}>
                ✕
              </button>
            )}
          </div>

          {dentro.esiti.length === 0 && !dentro.cercando && (
            <p style={{ fontSize: F.piccolo, color: C.muted, margin: 0, lineHeight: 1.5 }}>
              Non l'ho trovata in nessuno dei tomi che hai qui.
            </p>
          )}

          {dentro.esiti.map(({ libro, trovati }) => (
            <div key={libro.id} style={{ marginTop: 12 }}>
              <div style={{ fontSize: F.nota, color: C.text, fontWeight: 600, marginBottom: 4 }}>
                {libro.title}
                {libro.author && <span style={{ color: C.muted, fontWeight: 400 }}> · {libro.author}</span>}
              </div>
              {trovati.map((t, i) => (
                <button
                  key={i}
                  onClick={() => onReadAt?.(libro.id, t.punto)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    marginBottom: 6,
                    borderRadius: R.piccolo,
                    border: `1px solid ${C.border}`,
                    background: C.surface,
                    color: C.muted,
                    fontSize: F.piccolo,
                    lineHeight: 1.5,
                  }}
                >
                  {t.dove && <span style={{ color: C.arcane, marginRight: 6 }}>{t.dove}</span>}
                  {t.prima}
                  <mark style={{ background: "transparent", color: C.accent, fontWeight: 600 }}>{t.dentro}</mark>
                  {t.dopo}
                </button>
              ))}
            </div>
          ))}

          {!dentro.cercando && dentro.lontani > 0 && (
            <p style={{ fontSize: F.minuscolo, color: C.dim, margin: "10px 0 0", lineHeight: 1.45 }}>
              {dentro.lontani === 1
                ? "Un tomo vive solo sull'altro dispositivo e non l'ho aperto: aprilo una volta da qui e la prossima ricerca lo troverà."
                : `${dentro.lontani} tomi vivono solo sull'altro dispositivo e non li ho aperti: aprili una volta da qui e la prossima ricerca li troverà.`}
            </p>
          )}
        </div>
      )}

      {books.length === 0 ? (
        <EmptyState
          emoji="📜"
          title="Il tuo grimorio è ancora vuoto…"
          text="Porta qui i tuoi EPUB e PDF: appariranno come tomi su uno scaffale incantato, con le loro copertine. Puoi anche trascinarli direttamente in questa pagina."
          action="Aggiungi il primo libro"
          onAction={() => inputRef.current?.click()}
        />
      ) : visible.length === 0 ? (
        <p style={{ textAlign: "center", color: C.muted, padding: "32px 0" }}>
          Nessun tomo risponde all'appello con questi filtri…
        </p>
      ) : (
        <Grouped books={visible} group={group} onOpenBook={onOpenBook} localIds={localIds} />
      )}

      {(books.length > 0 || melodie > 0) && (
        <div
          style={{
            marginTop: 32,
            paddingTop: 14,
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: F.piccolo,
            color: C.muted,
          }}
        >
          {/* mentre i tomi scendono, il posto del conteggio lo prende il
              titolo: un giro lungo deve dire a che punto e' e su cosa */}
          {portando ? (
            <span style={{ color: C.arcane }}>
              ☁ Porto qui «{portando.titolo}» — {portando.i + 1} di {portando.totale}
            </span>
          ) : improntando ? (
            <span style={{ color: C.arcane }}>
              👯 Guardo «{improntando.titolo}» — {improntando.i + 1} di {improntando.totale}
            </span>
          ) : (
            <span>
              {books.length} {books.length === 1 ? "libro custodito" : "libri custoditi"}
              {melodie ? ` · ${melodie} ${melodie === 1 ? "melodia" : "melodie"}` : ""}
              {estimate?.usage ? ` · ${fmtBytes(estimate.usage)} usati` : ""}
              {estimate?.quota ? ` di ${fmtBytes(estimate.quota)}` : ""}
              {` · v. ${typeof __BC_VERSIONE__ !== "undefined" ? __BC_VERSIONE__ : "?"}`}
            </span>
          )}
          {/* Non un allarme: uno STATO. Sparisce da solo quando il browser
              concede la persistenza — cosa che su Android succede quando la
              PWA viene installata — e finche' c'e' sta accanto al tasto che
              lo risolve davvero, che e' l'archivio. */}
          {persist === "negata" && !portando && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                color: C.accent,
              }}
            >
              ⚠ Il browser non ha promesso di conservare questi dati: può
              liberarli se gli serve spazio.
              <button
                onClick={richiediPersistenza}
                style={{
                  padding: "3px 10px",
                  borderRadius: R.tondo,
                  border: `1px solid ${C.accent}66`,
                  color: C.accent,
                  fontSize: F.minuscolo,
                }}
              >
                Richiedi
              </button>
            </span>
          )}
          {/* L'altra meta' della stessa preoccupazione: non «il browser può
              sfrattarti» ma «da quanto non hai una copia fuori dal browser».
              Sotto soglia tace — e la soglia si stringe a una settimana se
              la persistenza è stata negata, perché lì il rischio è vero. */}
          {promemoria && !portando && (
            <span style={{ color: C.muted }}>
              ⧗ {promemoria} <span style={{ color: C.arcane }}>Esportala qui accanto.</span>
            </span>
          )}
          {/* Il richiamo dei tomi: c'e' solo se qualcosa e' rimasto lassu',
              e il numero sta nel tasto perche' chi lo tocca sappia in
              anticipo quanta connessione ci vuole. */}
          {nelCloud.length > 0 && (
            <button
              onClick={portando ? () => { filoTomi.current = null; setPortando(null); } : richiamaTomi}
              style={{
                padding: "7px 16px",
                borderRadius: R.piccolo,
                border: `1px solid ${C.arcane}66`,
                color: C.arcane,
                fontSize: F.nota,
                marginRight: 8,
              }}
            >
              {portando
                ? `Fermo qui (${portando.i + 1} di ${portando.totale})`
                : `☁ Porta qui ${nelCloud.length} ${nelCloud.length === 1 ? "tomo" : "tomi"}`}
            </button>
          )}
          <button
            onClick={riconosciSaghe}
            style={{
              padding: "7px 16px",
              borderRadius: R.piccolo,
              border: `1px solid ${C.border}`,
              color: C.text,
              fontSize: F.nota,
              marginRight: 8,
            }}
          >
            🔖 Riconosci saghe e cicli
          </button>
          {/* Il ripasso delle impronte c'e' solo se qualcuno ne ha bisogno:
              a biblioteca gia' a posto sarebbe un tasto che non fa niente.
              Il numero sta scritto sopra perche' e' un giro che legge i
              byte di ogni tomo, e chi lo tocca deve sapere quanto dura. */}
          {senzaImpronta.length > 0 && (
            <button
              onClick={improntando ? () => { filoImpronte.current = null; setImprontando(null); } : ripassaLeImpronte}
              style={{
                padding: "7px 16px",
                borderRadius: R.piccolo,
                border: `1px solid ${C.border}`,
                color: C.text,
                fontSize: F.nota,
                marginRight: 8,
              }}
            >
              {improntando
                ? `Fermo qui (${improntando.i + 1} di ${improntando.totale})`
                : `👯 Riconosci i doppioni di ${senzaImpronta.length} ${senzaImpronta.length === 1 ? "tomo" : "tomi"}`}
            </button>
          )}
          <button
            onClick={() => archiveRef.current?.click()}
            disabled={restoring}
            style={{
              padding: "7px 16px",
              borderRadius: R.piccolo,
              border: `1px solid ${C.border}`,
              color: restoring ? C.muted : C.text,
              fontSize: F.nota,
              marginRight: 8,
            }}
          >
            {restoring ? "Ripristino…" : "↩ Ripristina"}
          </button>
          <button
            onClick={handleExport}
            style={{
              padding: "7px 16px",
              borderRadius: R.piccolo,
              border: `1px solid ${C.arcane}66`,
              color: C.arcane,
              fontSize: F.nota,
            }}
          >
            📦 Esporta biblioteca
          </button>
        </div>
      )}

      {archivio && (
        <SceltaArchivio
          archivio={archivio}
          onCambia={(prendi) => setArchivio((a) => (a ? { ...a, prendi } : a))}
          onChiudi={() => setArchivio(null)}
          onVai={() => handleRestore(archivio.file, archivio.prendi)}
        />
      )}
    </div>
  );
}

// Il pannello che si apre PRIMA di ripristinare. Non chiede «vuoi
// continuare?» — quello sarebbe un intralcio — ma dice cosa c'e' dentro
// l'archivio e lascia scegliere quale meta' prendere. Le caselle partono
// spuntate: chi tocca «Ripristina» e conferma senza leggere ottiene quello
// che otteneva prima, cioe' tutto.
function SceltaArchivio({ archivio, onCambia, onChiudi, onVai }) {
  const { dentro, prendi } = archivio;
  const niente = !prendi.libri && !prendi.melodie;
  const righe = [
    dentro.libri && {
      id: "libri",
      testo: `${dentro.libri} ${dentro.libri === 1 ? "libro" : "libri"}`,
      // quello che viaggia col libro e non si vede nel conto
      sotto: dentro.termini
        ? `con segnalibri, evidenziazioni, punto di lettura e ${dentro.termini} ${
            dentro.termini === 1 ? "termine" : "termini"
          } di glossario`
        : "con segnalibri, evidenziazioni e punto di lettura",
    },
    dentro.melodie && {
      id: "melodie",
      testo: `${dentro.melodie} ${dentro.melodie === 1 ? "melodia" : "melodie"}`,
      // le raccolte seguono le melodie: sono elenchi di quei brani
      sotto: dentro.raccolte
        ? `con ${dentro.raccolte} ${dentro.raccolte === 1 ? "raccolta" : "raccolte"}`
        : "i file caricati da te",
    },
  ].filter(Boolean);

  return (
    <div
      onClick={onChiudi}
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
          maxWidth: 420,
          borderRadius: R.grande,
          border: `1px solid ${C.border}`,
          background: `linear-gradient(180deg, ${C.card}, ${C.surface})`,
          boxShadow: `0 0 60px ${C.arcane}22, 0 20px 50px #00000088`,
          padding: 22,
        }}
      >
        <h2 style={{ fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text }}>
          ↩ Cosa porto dentro?
        </h2>
        <p style={{ color: C.muted, fontSize: F.piccolo, marginTop: 6, marginBottom: 16 }}>
          {righe.length
            ? "Quello che è già qui resta com'è: dall'archivio si prende solo ciò che manca."
            : "Questo archivio è vuoto: non c'è nulla da riportare dentro."}
        </p>

        {righe.map((r) => (
          <button
            key={r.id}
            onClick={() => onCambia({ ...prendi, [r.id]: !prendi[r.id] })}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              textAlign: "left",
              padding: "12px 14px",
              marginBottom: 8,
              borderRadius: R.piccolo,
              border: `1px solid ${prendi[r.id] ? `${C.accent}88` : C.border}`,
              background: prendi[r.id] ? `${C.accent}14` : "transparent",
            }}
          >
            <span style={{ fontSize: F.rilievo, color: prendi[r.id] ? C.accent : C.muted }}>
              {prendi[r.id] ? "☑" : "☐"}
            </span>
            <span>
              <span style={{ display: "block", color: C.text, fontSize: F.corpo }}>{r.testo}</span>
              <span style={{ display: "block", color: C.muted, fontSize: F.minuscolo, marginTop: 2 }}>
                {r.sotto}
              </span>
            </span>
          </button>
        ))}

        {/* Detto prima, non dopo: a ripristino fatto sarebbe solo un rimpianto. */}
        {dentro.parziale && dentro.libri > 0 && prendi.libri && (
          <p style={{ color: C.accent, fontSize: F.minuscolo, marginTop: 10 }}>
            ⚠ Archivio vecchio: segnalibri ed evidenziazioni non erano stati salvati.
          </p>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <button
            onClick={onChiudi}
            style={{
              padding: "10px 18px",
              borderRadius: R.piccolo,
              border: `1px solid ${C.border}`,
              color: C.muted,
              fontSize: F.nota,
            }}
          >
            Lascia stare
          </button>
          <button
            onClick={onVai}
            disabled={niente}
            style={{
              padding: "10px 20px",
              borderRadius: R.piccolo,
              border: `1px solid ${niente ? C.border : `${C.accent}88`}`,
              background: niente ? "transparent" : `${C.accent}22`,
              color: niente ? C.muted : C.accent,
              fontSize: F.nota,
            }}
          >
            Ripristina
          </button>
        </div>
      </div>
    </div>
  );
}

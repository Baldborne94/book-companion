import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { segnaposto } from "../lib/segnaposto.js";
import { C, FONT_TITLE, F, R } from "../data/constants.js";
import { getCover, getAux, putAux } from "../lib/bookStore.js";
import { caricaCopertina, giaVista, ascoltaCopertine, chiaveMin, LATO_MIN, generazione } from "../lib/miniature.js";
import { preparaCopertina, fronteDaMostrare } from "../lib/copertina.js";
import { versoDelLibro } from "../lib/library.js";
import { vestito, gradinoTitolo, corpiDelDorso, INTERLINEA_TITOLO, INTERLINEA_AUTORE, RIGHE_AUTORE, STACCO_AUTORE } from "../lib/dorso.js";
import { chiaveHardcover, domandaHardcover, copertinaHardcover } from "../lib/hardcover.js";

// IL DORSO DISEGNATO, per i libri che una copertina non ce l'hanno.
//
// Prima era lo stesso rettangolo per tutti — stesso gradiente, stessa 📖 —
// e dodici libri sullo scaffale erano dodici rettangoli identici. Ma uno
// scaffale serve a riconoscere un libro con la coda dell'occhio: se devi
// leggere ogni titolo, non è uno scaffale, è un elenco.
//
// Il colore viene dalla SAGA (vedi `lib/dorso.js`), quindi i volumi di una
// storia stanno nello stesso quartiere e si vede da lontano che vanno
// insieme; dentro la famiglia si distinguono per una sfumatura.
// LO SPAZIO DEL DORSO SI MISURA (`corpiDelDorso` in `lib/dorso.js`): quanto è
// larga la colonna lo sa solo il browser. Si guarda il riquadro dentro i
// margini, che non cambia con quel che ci si scrive (guardare il titolo
// vorrebbe dire rimisurarlo ogni volta che l'autore cambia corpo). Un
// osservatore per tutti i dorsi, e la misura arriva prima del disegno:
// `flushSync`, o per un fotogramma si vedrebbe la parola spezzata.
const misure = new WeakMap();
const osservatore =
  typeof ResizeObserver === "undefined"
    ? null
    : new ResizeObserver((voci) =>
        flushSync(() => {
          for (const v of voci) misure.get(v.target)?.(v.contentRect);
        })
      );

function useRiquadro() {
  const ref = useRef(null);
  const [riquadro, setRiquadro] = useState(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !osservatore) return undefined;
    misure.set(el, ({ width, height }) => {
      if (width > 0 && height > 0) setRiquadro((p) => (p && p.larga === width && p.spazio === height ? p : { larga: width, spazio: height }));
    });
    osservatore.observe(el);
    return () => {
      osservatore.unobserve(el);
      misure.delete(el);
    };
  }, []);
  return [ref, riquadro];
}

function Disegnato({ book, radius, compact, numerato }) {
  const v = vestito(book);
  const costola = compact ? 3 : 7;
  const [spazioRef, riquadro] = useRiquadro();
  const tetto = F[gradinoTitolo(book.title)];
  const autore = book.author ? F.minuscolo : 0;
  const corpi = riquadro ? corpiDelDorso(book.title, { ...riquadro, tetto, autore }) : { titolo: tetto, autore };
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: radius,
        background: `linear-gradient(155deg, ${v.alto}, ${v.basso})`,
        overflow: "hidden",
      }}
    >
      {/* la costola col filo di luce: è il dettaglio che fa leggere il
          rettangolo come un libro invece che come una tessera colorata */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: costola,
          background: v.costola,
          boxShadow: `inset -1px 0 0 ${v.filo}55`,
        }}
      />
      {/* Piccolo — le tre miniature di una saga, il diario — il titolo non
          si legge comunque: lì il colore È l'informazione, e scriverci
          sopra farebbe solo sporco. */}
      {!compact && (
        <div
          ref={spazioRef}
          style={{
            position: "absolute",
            inset: 0,
            paddingLeft: costola + 11,
            paddingRight: 11,
            // IL NUMERO DEL VOLUME STA NELL'ANGOLO IN ALTO A SINISTRA, ed
            // è esattamente dove comincia il titolo: sul dorso disegnato
            // la pastiglia si mangiava la prima parola. Dove il numero
            // c'è, il titolo comincia sotto.
            paddingTop: numerato ? 32 : 16,
            paddingBottom: 14,
            display: "flex",
            flexDirection: "column",
            // lo scaffale centra il contenuto del suo bottone: una
            // copertina no, il titolo di un libro sta a sinistra
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontFamily: FONT_TITLE,
              fontSize: corpi.titolo,
              lineHeight: INTERLINEA_TITOLO,
              color: v.inchiostro,
              display: "-webkit-box",
              WebkitLineClamp: 5,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              // `break-word` e non `wordBreak: break-word`: quello spezza
              // le parole anche quando ci starebbero, e «Neuromante»
              // diventava «Neuroma / nte». Qui si spezza solo quello che
              // davvero non entra — e il corpo del titolo, che tiene conto
              // della parola più lunga, fa in modo che non succeda.
              overflowWrap: "break-word",
              // il titolo prende lo spazio che avanza e si taglia dentro
              // il suo riquadro: `minHeight: 0` è quello che glielo
              // permette dentro un flex, e senza di lui un titolo lungo su
              // una copertina piccola sbordava dal fondo — l'autore finiva
              // fuori e il titolo si vedeva mozzato a metà lettera
              flex: 1,
              minHeight: 0,
            }}
          >
            {book.title}
          </div>
          {book.author && (
            <>
              <div style={{ height: 1, background: `${v.tenue}55`, marginBottom: STACCO_AUTORE - 1, maxWidth: 44 }} />
              <div
                style={{
                  fontSize: corpi.autore,
                  lineHeight: INTERLINEA_AUTORE,
                  color: v.tenue,
                  display: "-webkit-box",
                  WebkitLineClamp: RIGHE_AUTORE,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {book.author}
              </div>
            </>
          )}
          {book.fileType && book.fileType !== "epub" && !segnaposto(book) && (
            <div
              style={{
                position: "absolute",
                top: 8,
                right: 9,
                fontSize: F.minuscolo,
                letterSpacing: 0.8,
                color: `${v.tenue}aa`,
              }}
            >
              {String(book.fileType).toUpperCase()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Le dipendenze della memoria delle miniature (`lib/miniature.js`): qui il
// database e il canvas, la' la regola.
const DEPS = {
  leggiCover: (id) => getCover(id),
  leggiMin: (id) => getAux(chiaveMin(id)),
  scriviMin: (id, v) => putAux(chiaveMin(id), v),
  creaUrl: (blob) => URL.createObjectURL(blob),
  revoca: (url) => URL.revokeObjectURL(url),
};

// quanto prima dello schermo si comincia a leggere: una schermata e mezza,
// cosi' scorrendo la copertina e' gia' pronta quando arriva
const ANTICIPO = "900px 0px";

// `version` serve a chi la copertina la CAMBIA: l'id del libro non cambia,
// quindi senza un secondo appiglio l'effetto non ripartirebbe e resteresti
// a guardare quella di prima.
//
// `onDisegnata` dice a chi ci sta attorno se il dorso l'abbiamo disegnato
// noi: sullo scaffale serve a non stampare il titolo DUE VOLTE — una sul
// dorso e una nella didascalia sotto — che era l'altra cosa che rendeva la
// libreria confusa.
//
// LA COPERTINA SI LEGGE QUANDO STA PER ENTRARE NELLO SCHERMO, e sullo
// scaffale e' una MINIATURA ricordata (`lib/miniature.js`): leggere e
// decodificare tutte le copertine intere all'apertura era il grosso dei
// sei secondi misurati con 400 libri. `intera` e' per chi la mostra grande
// — la scheda del libro — e li' si legge l'originale, come prima.
// `haCopertina` e' quel che la Libreria sa gia' in un colpo solo
// (`listCoverIds`): `false` disegna il dorso senza chiedere niente.
export default function BookCover({ book, radius = 8, compact = false, version = 0, onDisegnata, numerato = false, intera = false, haCopertina }) {
  const nota = intera ? undefined : haCopertina === false ? null : giaVista(book.id);
  const [url, setUrl] = useState(nota);
  const [vicina, setVicina] = useState(intera || nota !== undefined || typeof IntersectionObserver === "undefined");
  const [giro, setGiro] = useState(0);
  // la copertina di Hardcover, mostrata dove la nostra manca (`copertinaHardcover`)
  const [web, setWeb] = useState(null);
  const scatola = useRef(null);

  useEffect(() => {
    if (vicina || !scatola.current) return;
    const oss = new IntersectionObserver(
      (voci) => {
        if (voci.some((v) => v.isIntersecting)) {
          setVicina(true);
          oss.disconnect();
        }
      },
      { rootMargin: ANTICIPO }
    );
    oss.observe(scatola.current);
    return () => oss.disconnect();
  }, [vicina]);

  // una copertina cambiata altrove (la scheda, la sincronizzazione) si
  // rilegge anche qui, o lo scaffale mostrerebbe quella di prima
  useEffect(() => ascoltaCopertine((id) => id === book.id && setGiro((g) => g + 1)), [book.id]);

  useEffect(() => {
    if (!intera && haCopertina === false) {
      setUrl(null);
      onDisegnata?.(true);
      return;
    }
    if (!vicina) return;
    let alive = true;
    if (intera) {
      let objectUrl = null;
      getCover(book.id)
        .then((blob) => fronteDaMostrare(blob, versoDelLibro(book)))
        .then((blob) => {
        if (!alive) return;
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
          onDisegnata?.(false);
        } else {
          // tolta la copertina si torna al dorso disegnato: senza questo,
          // la vecchia immagine resterebbe appesa allo schermo
          setUrl(null);
          onDisegnata?.(true);
        }
      });
      return () => {
        alive = false;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }
    // l'indirizzo della miniatura lo tiene la memoria, e non si revoca
    // allo smontaggio: lo riusa il prossimo che disegna lo stesso libro
    // la miniatura di un fumetto la cui copertina e' la sovraccoperta
    // aperta ne tiene il fronte, dalla parte del suo verso
    const verso = versoDelLibro(book);
    caricaCopertina(book.id, { ...DEPS, riduci: (blob) => preparaCopertina(blob, LATO_MIN, { verso }) })
      .catch(() => null)
      .then((u) => {
        if (!alive) return;
        setUrl(u || null);
        onDisegnata?.(!u);
      });
    return () => {
      alive = false;
    };
  }, [book.id, version, vicina, intera, haCopertina, giro, generazione(book.id)]);

  // SENZA COPERTINA, CON LA CHIAVE DI HARDCOVER: si mostra la sua, se c'e'
  useEffect(() => {
    setWeb(null);
    if (url !== null || !vicina) return;
    const chiave = chiaveHardcover();
    if (!chiave) return;
    let alive = true;
    copertinaHardcover(book, { chiedi: domandaHardcover(chiave) }).then((u) => {
      if (!alive || !u) return;
      setWeb(u);
      onDisegnata?.(false);
    });
    return () => {
      alive = false;
    };
  }, [book.id, book.title, book.author, url, vicina]);

  return (
    <div
      ref={scatola}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "2 / 3",
        borderRadius: radius,
        overflow: "hidden",
        background: C.surface,
        border: `1px solid ${C.border}`,
      }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          decoding="async"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : url === null && web ? (
        <img
          src={web}
          alt=""
          decoding="async"
          referrerPolicy="no-referrer"
          // un'immagine che non arriva (rete, indirizzo cambiato) torna al dorso
          onError={() => {
            setWeb(null);
            onDisegnata?.(true);
          }}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : url === null ? (
        <Disegnato book={book} radius={radius} compact={compact} numerato={numerato} />
      ) : null}
    </div>
  );
}

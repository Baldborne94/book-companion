import { useEffect, useRef, useState } from "react";
import { C, FONT_TITLE, F, R } from "../data/constants.js";
import { getCover, getAux, putAux } from "../lib/bookStore.js";
import { caricaCopertina, giaVista, ascoltaCopertine, chiaveMin, LATO_MIN, generazione } from "../lib/miniature.js";
import { preparaCopertina } from "../lib/copertina.js";
import { vestito, gradinoTitolo } from "../lib/dorso.js";

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
function Disegnato({ book, radius, compact, numerato }) {
  const v = vestito(book);
  const costola = compact ? 3 : 7;
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
              fontSize: F[gradinoTitolo(book.title)],
              lineHeight: 1.22,
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
              <div style={{ height: 1, background: `${v.tenue}55`, marginBottom: 7, maxWidth: 44 }} />
              <div
                style={{
                  fontSize: F.minuscolo,
                  lineHeight: 1.3,
                  color: v.tenue,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {book.author}
              </div>
            </>
          )}
          {book.fileType && book.fileType !== "epub" && (
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
  riduci: (blob) => preparaCopertina(blob, LATO_MIN),
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
      getCover(book.id).then((blob) => {
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
    caricaCopertina(book.id, DEPS)
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
      ) : url === null ? (
        <Disegnato book={book} radius={radius} compact={compact} numerato={numerato} />
      ) : null}
    </div>
  );
}

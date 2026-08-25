import { useEffect, useState } from "react";
import { C, FONT_TITLE, F, R } from "../data/constants.js";
import { getCover } from "../lib/bookStore.js";
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
function Disegnato({ book, radius, compact }) {
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
            paddingTop: 16,
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
          {book.fileType === "pdf" && (
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
              PDF
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// `version` serve a chi la copertina la CAMBIA: l'id del libro non cambia,
// quindi senza un secondo appiglio l'effetto non ripartirebbe e resteresti
// a guardare quella di prima.
//
// `onDisegnata` dice a chi ci sta attorno se il dorso l'abbiamo disegnato
// noi: sullo scaffale serve a non stampare il titolo DUE VOLTE — una sul
// dorso e una nella didascalia sotto — che era l'altra cosa che rendeva la
// libreria confusa.
export default function BookCover({ book, radius = 8, compact = false, version = 0, onDisegnata }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    getCover(book.id).then((blob) => {
      if (!alive) return;
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        onDisegnata?.(false);
      } else {
        // tolta la copertina si torna al dorso disegnato: senza questo, la
        // vecchia immagine resterebbe appesa allo schermo
        setUrl(null);
        onDisegnata?.(true);
      }
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [book.id, version]);

  return (
    <div
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
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <Disegnato book={book} radius={radius} compact={compact} />
      )}
    </div>
  );
}

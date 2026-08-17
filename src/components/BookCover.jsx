import { useEffect, useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { getCover } from "../lib/bookStore.js";

// `version` serve a chi la copertina la CAMBIA: l'id del libro non cambia,
// quindi senza un secondo appiglio l'effetto non ripartirebbe e resteresti
// a guardare quella di prima.
export default function BookCover({ book, radius = 8, compact = false, version = 0 }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    getCover(book.id).then((blob) => {
      if (!alive) return;
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } else {
        // tolta la copertina si torna al dorso disegnato: senza questo, la
        // vecchia immagine resterebbe appesa allo schermo
        setUrl(null);
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
        width: "100%",
        aspectRatio: "2 / 3",
        borderRadius: radius,
        overflow: "hidden",
        background: `linear-gradient(160deg, ${C.card}, ${C.surface})`,
        border: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div style={{ padding: compact ? 4 : 10, textAlign: "center" }}>
          <div style={{ fontSize: compact ? 16 : 22, marginBottom: compact ? 0 : 6 }}>
            {book.fileType === "pdf" ? "📄" : "📖"}
          </div>
          {!compact && (
          <div
            style={{
              fontFamily: FONT_TITLE,
              fontSize: 13,
              lineHeight: 1.25,
              color: C.text,
              display: "-webkit-box",
              WebkitLineClamp: 4,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {book.title}
          </div>
          )}
        </div>
      )}
    </div>
  );
}

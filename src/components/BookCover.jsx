import { useEffect, useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { getCover } from "../lib/bookStore.js";

export default function BookCover({ book, radius = 8, compact = false }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    getCover(book.id).then((blob) => {
      if (alive && blob) {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      }
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [book.id]);

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

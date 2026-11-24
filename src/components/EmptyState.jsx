import { C, FONT_TITLE, F, R, px } from "../data/constants.js";

export default function EmptyState({ emoji, title, text, action, onAction }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "48px 24px",
        animation: "bc-fade-in 0.6s ease-out",
      }}
    >
      <div
        style={{
          fontSize: 64,
          marginBottom: 16,
          filter: `drop-shadow(0 0 22px ${C.arcane}66)`,
        }}
      >
        {emoji}
      </div>
      <h2
        style={{
          fontFamily: FONT_TITLE,
          fontWeight: 600,
          fontSize: F.titolo,
          color: C.text,
          marginBottom: 8,
        }}
      >
        {title}
      </h2>
      <p style={{ color: C.muted, maxWidth: px(420), margin: "0 auto 24px" }}>{text}</p>
      {action && (
        <button
          onClick={onAction}
          style={{
            padding: "12px 28px",
            borderRadius: R.piccolo,
            background: `linear-gradient(180deg, ${C.accent}, ${C.accentDeep})`,
            color: C.onAccent,
            fontWeight: 600,
            fontSize: F.corpo,
            boxShadow: `0 0 24px ${C.accent}33`,
            transition: "box-shadow 0.2s ease-out",
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

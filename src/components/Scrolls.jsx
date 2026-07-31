import { C } from "../data/constants.js";

// cataste di rotoli nella nicchia: ogni riga e' [cy, raggio, [cx...]]
const PILE = [
  [101, 10.5, [20, 42, 64, 86]],
  [83, 10, [31, 53, 75]],
  [66, 9.5, [42, 64]],
];

// la spirale della pergamena arrotolata, vista di taglio
const spiral = (r) =>
  `M0 ${-r * 0.62}a${r * 0.62} ${r * 0.62} 0 1 1 ${-r * 0.62} ${r * 0.62}` +
  `a${r * 0.34} ${r * 0.34} 0 1 0 ${r * 0.34} ${-r * 0.34}`;

function Nook({ corner, size, delay }) {
  const flip = {
    tl: "none",
    tr: "scaleX(-1)",
    bl: "scaleY(-1)",
    br: "scale(-1, -1)",
  }[corner];
  const pos = {
    tl: { top: 0, left: 0 },
    tr: { top: 0, right: 0 },
    bl: { bottom: 0, left: 0 },
    br: { bottom: 0, right: 0 },
  }[corner];

  return (
    <div
      style={{
        position: "absolute",
        ...pos,
        width: size,
        transform: flip,
        transformOrigin: "center",
        animation: `bc-flicker ${13 + delay}s ease-in-out ${delay}s infinite`,
      }}
    >
      <svg viewBox="0 0 200 130" style={{ display: "block", width: "100%", color: C.accent }}>
        <g stroke="currentColor" fill="none" strokeLinecap="round">
          <path d="M-4 112h116" strokeWidth="1.6" opacity="0.26" />
          {PILE.map(([cy, r, xs], row) =>
            xs.map((cx, i) => (
              <g key={`${row}-${i}`} opacity={0.3 - row * 0.06}>
                <circle cx={cx} cy={cy} r={r} fill="currentColor" opacity="0.22" stroke="none" />
                <circle cx={cx} cy={cy} r={r} strokeWidth="1.2" />
                <path d={spiral(r)} strokeWidth="1" transform={`translate(${cx} ${cy})`} />
              </g>
            ))
          )}
          <g opacity="0.2" transform="rotate(-7 96 44)">
            <rect x="68" y="34" width="56" height="19" rx="9.5" strokeWidth="1.2" />
            <ellipse cx="68" cy="43.5" rx="4" ry="9.5" strokeWidth="1.2" />
            <path d="M124 38.5h6M124 48h6" strokeWidth="1" />
          </g>
        </g>
      </svg>
    </div>
  );
}

export default function Scrolls() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        opacity: 0.62,
      }}
    >
      <Nook corner="tl" size="min(25vw, 195px)" delay={0} />
      <Nook corner="tr" size="min(22vw, 170px)" delay={1.4} />
      <Nook corner="bl" size="min(24vw, 185px)" delay={2.7} />
      <Nook corner="br" size="min(26vw, 205px)" delay={1.9} />
    </div>
  );
}

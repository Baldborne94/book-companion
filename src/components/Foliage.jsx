import { C } from "../data/constants.js";

const LEAF = "M0 0 C 11 -13, 34 -15, 47 0 C 34 15, 11 13, 0 0 Z";

// posizioni lungo il ramo: [x, y, rotazione, scala]
const LEAVES = [
  [22, 12, -58, 0.62],
  [46, 23, 28, 0.7],
  [70, 37, -46, 0.66],
  [93, 53, 34, 0.74],
  [114, 70, -38, 0.6],
  [133, 86, 44, 0.66],
  [58, 29, -104, 0.44],
  [104, 61, 96, 0.42],
];

function Branch({ corner, size, delay }) {
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
        animation: `bc-sway ${9 + delay}s ease-in-out ${delay}s infinite`,
      }}
    >
      <svg viewBox="0 0 190 120" style={{ display: "block", width: "100%", color: C.arcane }}>
        <path
          d="M2 4 C 52 16, 106 42, 152 104"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          opacity="0.5"
        />
        {LEAVES.map(([x, y, rot, sc], i) => (
          <path
            key={i}
            d={LEAF}
            fill="currentColor"
            opacity={i > 5 ? 0.22 : 0.36}
            transform={`translate(${x} ${y}) rotate(${rot}) scale(${sc})`}
          />
        ))}
      </svg>
    </div>
  );
}

export default function Foliage() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        opacity: 0.72,
      }}
    >
      <Branch corner="tl" size="min(38vw, 300px)" delay={0} />
      <Branch corner="tr" size="min(34vw, 270px)" delay={1.6} />
      <Branch corner="bl" size="min(30vw, 240px)" delay={3.1} />
      <Branch corner="br" size="min(36vw, 285px)" delay={2.2} />
    </div>
  );
}

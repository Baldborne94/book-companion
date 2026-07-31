const Icon = ({ size = 24, children, style, strokeWidth = 1.35 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block", ...style }}
    aria-hidden="true"
  >
    {children}
  </svg>
);

const FILL = 0.18;

export const CandleIcon = ({ active, ...p }) => (
  <Icon {...p}>
    {active && (
      <ellipse cx="12" cy="5.4" rx="3.5" ry="4.3" fill="currentColor" stroke="none" opacity="0.14" />
    )}
    <path
      d="M12 2.2c1.75 1.9 2.62 3.3 2.62 4.5a2.62 2.62 0 0 1-5.24 0c0-1.2.87-2.6 2.62-4.5z"
      fill="currentColor"
      stroke="none"
    />
    <path d="M12 9.4v1.2" />
    <path
      d="M8.8 12.1c0-.8.65-1.45 1.45-1.45h3.5c.8 0 1.45.65 1.45 1.45v7.3H8.8z"
      fill="currentColor"
      fillOpacity={active ? FILL : 0}
    />
    <path d="M7 19.4h10l-.9 1.9H7.9z" fill="currentColor" fillOpacity={active ? FILL : 0} />
    <path d="M8.8 14.2c1.05.35 1.4 1.05 1.4 1.95" opacity="0.5" />
  </Icon>
);

export const BooksIcon = ({ active, ...p }) => (
  <Icon {...p}>
    <path
      d="M3.7 8.2c0-.6.5-1.1 1.1-1.1h1.6c.6 0 1.1.5 1.1 1.1v11.2H3.7z"
      fill="currentColor"
      fillOpacity={active ? FILL : 0}
    />
    <path d="M3.7 10.5h3.8M3.7 16.1h3.8" opacity="0.55" />
    <path
      d="M9.4 6c0-.6.5-1.1 1.1-1.1h1.8c.6 0 1.1.5 1.1 1.1v13.4H9.4z"
      fill="currentColor"
      fillOpacity={active ? FILL : 0}
    />
    <path d="M9.4 8.6h4M9.4 16.1h4" opacity="0.55" />
    <g transform="rotate(12 17.1 13.2)">
      <path
        d="M15.1 8c0-.6.5-1.1 1.1-1.1h1.7c.6 0 1.1.5 1.1 1.1v11.4h-3.9z"
        fill="currentColor"
        fillOpacity={active ? FILL : 0}
      />
      <path d="M15.1 10.3h3.9" opacity="0.55" />
    </g>
    <path d="M2.6 20.6h18.8" />
  </Icon>
);

export const MusicIcon = ({ active, ...p }) => (
  <Icon {...p}>
    <path d="M9.5 17.4V5.7l8.9-1.8v11.5" />
    <path d="M9.5 9.1l8.9-1.8" />
    <ellipse
      cx="7.2"
      cy="17.7"
      rx="2.35"
      ry="1.85"
      transform="rotate(-14 7.2 17.7)"
      fill="currentColor"
      fillOpacity={active ? 1 : 0}
    />
    <ellipse
      cx="16.1"
      cy="15.7"
      rx="2.35"
      ry="1.85"
      transform="rotate(-14 16.1 15.7)"
      fill="currentColor"
      fillOpacity={active ? 1 : 0}
    />
  </Icon>
);

export const LeafIcon = ({ active, ...p }) => (
  <Icon {...p}>
    <path
      d="M4.5 19.6c-1.3-7.7 4-14.3 15-15.4 1 8.3-4.6 14.8-15 15.4z"
      fill="currentColor"
      fillOpacity={active ? FILL : 0}
    />
    <path d="M4.5 19.6C8 15.3 11.9 11.6 17.2 8.5" opacity="0.6" />
    <path d="M11.2 12.6c1.3-.7 2.6-1 4-1M8.4 15.6c1-.6 2-.9 3.1-1" opacity="0.45" />
  </Icon>
);

export const CloudIcon = ({ active, ...p }) => (
  <Icon {...p}>
    <path
      d="M7.6 18.2a4.25 4.25 0 0 1 .5-8.45 5.75 5.75 0 0 1 10.9 1.55 3.55 3.55 0 0 1-.7 6.9z"
      fill="currentColor"
      fillOpacity={active ? FILL : 0}
    />
    <path d="M12 15.9v-4.6M10.1 13.2L12 11.3l1.9 1.9" />
  </Icon>
);

export const SparkIcon = (p) => (
  <Icon {...p}>
    <path
      d="M12 3.1l1.55 5.85 5.85 1.55-5.85 1.55L12 17.9l-1.55-5.85L4.6 10.5l5.85-1.55z"
      fill="currentColor"
      stroke="none"
    />
  </Icon>
);

export const ScrollIcon = ({ active, ...p }) => (
  <Icon {...p}>
    <path
      d="M7.6 3.9h11.2v13.4c0 1.6-1.3 2.9-2.9 2.9H7.6z"
      fill="currentColor"
      fillOpacity={active ? FILL : 0}
    />
    <path d="M7.6 3.9H5.9A1.9 1.9 0 0 0 4 5.8c0 1 .85 1.9 1.9 1.9h1.7" />
    <path d="M18.8 17.3h1.3a1.9 1.9 0 0 1 0 3.8H8.4" />
    <path d="M10.4 8.3h5.9M10.4 11.5h5.9M10.4 14.7h3.6" opacity="0.7" />
  </Icon>
);

export const StarIcon = (p) => (
  <Icon {...p}>
    <path
      d="M12 3.4l2.55 5.6 6.05.72-4.5 4.15 1.22 6-5.32-3-5.32 3 1.22-6-4.5-4.15 6.05-.72z"
      fill="currentColor"
      stroke="none"
    />
  </Icon>
);

export const BookmarkIcon = (p) => (
  <Icon {...p}>
    <path d="M6.6 3.6h10.8v17.2l-5.4-3.9-5.4 3.9z" />
  </Icon>
);

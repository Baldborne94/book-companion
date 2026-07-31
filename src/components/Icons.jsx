const Icon = ({ size = 24, children, style }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block", ...style }}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const CandleIcon = (p) => (
  <Icon {...p}>
    <path
      d="M12 2.4c1.5 1.7 2.2 2.9 2.2 3.9a2.2 2.2 0 0 1-4.4 0c0-1 .7-2.2 2.2-3.9z"
      fill="currentColor"
      stroke="none"
    />
    <path d="M12 8.4v1.4" />
    <rect x="8.7" y="9.8" width="6.6" height="10.2" rx="1.5" />
    <path d="M7.2 20.6h9.6" />
    <path d="M10.6 12.6v4.6" opacity="0.45" />
  </Icon>
);

export const BooksIcon = (p) => (
  <Icon {...p}>
    <rect x="3.6" y="7.4" width="4" height="12.2" rx="1.1" />
    <rect x="9.2" y="5.2" width="4" height="14.4" rx="1.1" />
    <rect
      x="15.2"
      y="7"
      width="4"
      height="12.6"
      rx="1.1"
      transform="rotate(11 17.2 13.3)"
    />
    <path d="M2.6 20.4h18.8" />
  </Icon>
);

export const MusicIcon = (p) => (
  <Icon {...p}>
    <path d="M9.6 17.6V5.8l9-1.8v11.6" />
    <path d="M9.6 9.2l9-1.8" />
    <ellipse cx="7.3" cy="17.9" rx="2.4" ry="1.9" />
    <ellipse cx="16.3" cy="15.9" rx="2.4" ry="1.9" />
  </Icon>
);

export const LeafIcon = (p) => (
  <Icon {...p}>
    <path d="M4.4 19.8c-1.2-7.8 4.2-14.4 15.2-15.6 1 8.4-4.6 15-15.2 15.6z" />
    <path d="M4.4 19.8C8 15.4 12 11.6 17.4 8.4" opacity="0.6" />
  </Icon>
);

export const CloudIcon = (p) => (
  <Icon {...p}>
    <path d="M7.6 18.4a4.3 4.3 0 0 1 .5-8.55 5.8 5.8 0 0 1 11 1.55 3.6 3.6 0 0 1-.7 7z" />
  </Icon>
);

export const SparkIcon = (p) => (
  <Icon {...p}>
    <path
      d="M12 3.2l1.5 5.9 5.9 1.5-5.9 1.5-1.5 5.9-1.5-5.9L4.6 10.6l5.9-1.5z"
      fill="currentColor"
      stroke="none"
    />
  </Icon>
);

// Shared line-art icons. Plain presentational SVG — no state, no client
// directive, so both server and client components can pull them in.

// The moto wave: the back of a rider's left hand dropped off the clutch, index
// and middle finger pointing down. Wrist at the top, thumb tucked on the left,
// curled ring and pinky bulging on the right — those bumps live in the outline
// itself rather than in the detail strokes, so the shape still reads as a hand
// once it's filled in.
//
// The geometry is one closed path in a 24x24 box: stroked when the viewer
// hasn't waved, filled when they have. Below ~24px the silhouette gets busy, so
// callers should render it at 26-28px and keep the count beside it.
const WAVE_HAND =
  "M9.2 2.6 L13.4 2.6 C15 2.8 16.2 3.8 16.6 5.2 C17.8 5.6 18.4 6.4 18.3 7.6 " +
  "C18.25 8.2 18 8.45 17.9 8.8 C18.4 9.4 18.45 10.6 17.8 11.4 " +
  "C17.2 12.1 16.4 12.4 15.52 12.45 L17.62 21.51 A1.35 1.35 0 0 1 14.98 22.09 " +
  "L12.9 15 Q11.7 13.4 10.55 15 L8.57 21.89 A1.3 1.3 0 0 1 6.03 21.31 " +
  "L8.13 12.01 C7 12.1 6 11.8 5.4 11 C4.6 10.2 4.4 9 4.9 8 C5.4 7 6.2 6.8 6.9 7 " +
  "C7 5.6 7.6 4.4 8.6 3.6 Z";

// Thumb crease and the two curled-knuckle rolls. Only drawn on the outline
// state — inside a solid fill they'd just be noise.
const WAVE_DETAILS = [
  "M6.7 7.5 C7.6 8.7 8.1 10.3 8.2 11.8",
  "M15.2 7 C16.4 7.2 17.2 7.8 17.6 8.7",
  "M15.2 10 C16.2 10.2 17 10.7 17.4 11.4",
];

export function WaveIcon({ filled, size = 28 }: { filled: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        d={WAVE_HAND}
        fill={filled ? "currentColor" : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {!filled &&
        WAVE_DETAILS.map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        ))}
    </svg>
  );
}

export function ChatIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 20.5l1.6-4.9A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z" />
    </svg>
  );
}

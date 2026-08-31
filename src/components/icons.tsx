// No client directive in here, so server and client components can both import.

// The moto wave: the back of a rider's left hand dropped off the clutch, index
// and middle finger pointing down. Wrist at the top, thumb tucked on the left,
// curled ring and pinky bulging on the right — those bumps live in the outline
// itself rather than in the detail strokes, so the shape still reads as a hand
// once it's filled in.
//
// Below ~24px the silhouette gets busy; render it at 26-28px.
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

/* The wheel, measured off the Ninja H2R press photo in docs/adr/assets rather
   than eyeballed from it. See ADR 0004 for the fractions and how they were got;
   the measurement rig is not in the repo. */

// A 24-box, so these are the ADR's fractions times a rim radius of 10.6.
const RIM_MID = 9.68; // rim drawn as one stroke at its own section, 8.76 -> 10.6
const RIM_SECTION = 1.84;
const STRIPE_R = 10.25; // the green line, at 0.972 of the rim
const HUB_R = 2.8;

/**
 * One blade, pointing straight up, hub to rim: a flat-sided taper from 24
 * degrees of arc at the root to 4 at the tip.
 *
 * The root is the one place this icon is knowingly *not* the object. On the real
 * wheel the blades merge into a solid star at 0.318, and drawn that way and
 * filled it is geometrically a sheriff's badge — so the measured taper stops at
 * 0.47 and the blade runs to the hub at constant width, windows open. See ADR
 * 0004.
 */
const BLADE = "M10.85,9.45L10.43,7.25L11.39,3.26L12.61,3.26L13.56,7.25L13.15,9.45Z";

/**
 * Rotated so a blade sits at twelve o'clock, three degrees off vertical — the
 * angle the reference wheel happens to be stopped at. ADR 0001 picked the other
 * phase, a window at twelve; ADR 0004 overrules it, so don't rotate it back.
 */
const BLADE_PITCH = 72; // 360 / 5, and the only reason there are five of them

/**
 * The stripe is drawn twice its scale width. At 0.042 of the rim it would be a
 * half-pixel line at header size, and an unread mark nobody can see isn't one.
 *
 * Render at 22-24px. Below about 18 the windows silt up and it goes to a disc.
 */
export function WheelIcon({ lit = false, size = 24 }: { lit?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <circle
        cx="12"
        cy="12"
        r={RIM_MID}
        fill="none"
        stroke="currentColor"
        strokeWidth={RIM_SECTION}
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={BLADE}
          fill="currentColor"
          transform={`rotate(${i * BLADE_PITCH - 3} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r={HUB_R} fill="none" stroke="currentColor" strokeWidth="1.15" />
      {lit && (
        <circle
          cx="12"
          cy="12"
          r={STRIPE_R}
          fill="none"
          stroke="var(--drive-accent)"
          strokeWidth="0.85"
        />
      )}
    </svg>
  );
}

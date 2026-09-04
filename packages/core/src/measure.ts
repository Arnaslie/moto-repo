// Deriving an inseam from photographs. See ADR 0006.
//
// The rider marks head, crotch and floor on each photo; their known height
// scales pixels to millimetres, so camera distance doesn't matter.
//
// Marked by hand rather than by a pose model because an estimator returns the
// *hip joint* — roughly the greater trochanter, well above the crotch — which
// overestimates inseam systematically, on every rider, in the same direction.

/** A point marked on a photo, in fractions of the image (0–1, y down). */
export type Mark = { x: number; y: number };

export type PhotoMarks = {
  head: Mark;
  crotch: Mark;
  floor: Mark;
};

export const SHOT_KINDS = [
  { key: "side", label: "Side on", hint: "Stand side-on to the camera, arms relaxed." },
  { key: "front", label: "Front", hint: "Square to the camera, feet together." },
  { key: "farFront", label: "Front, further back", hint: "Same pose, camera a few steps further away." },
] as const;

export type ShotKind = (typeof SHOT_KINDS)[number]["key"];

/**
 * One photo's inseam estimate, in millimetres. Head-to-floor in pixels is the
 * rider's known height, so every other vertical distance in the same photo
 * converts at the same rate. Null on degenerate marks rather than dividing by
 * something near zero and producing a confident absurdity.
 */
export function inseamFromMarks(marks: PhotoMarks, heightMm: number): number | null {
  const span = marks.floor.y - marks.head.y;
  const legs = marks.floor.y - marks.crotch.y;
  if (!(span > 0.05) || !(legs > 0)) return null;
  if (legs >= span) return null; // crotch at or above the head — mismarked
  return Math.round(heightMm * (legs / span));
}

export type Combined = {
  /** Median of the shots — one bad mark can't drag it the way a mean would. */
  inseamMm: number;
  /** Half the range. This is the number that decides whether we commit to a
   *  verdict or send the rider to go sit on the bike. */
  spreadMm: number;
  used: number;
};

/**
 * The spread is the point of taking three, so don't average them away: the
 * dominant error is systematic (a camera at eye level foreshortens the legs the
 * same way every time), and the three shots are chosen to disagree when the
 * capture went wrong — the side view sees lean, the far front perturbs the
 * perspective. A wide spread is a signal to retake, not noise.
 */
export function combine(estimates: Array<number | null>): Combined | null {
  const ok = estimates.filter((v): v is number => typeof v === "number");
  if (ok.length === 0) return null;

  const sorted = [...ok].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

  return {
    inseamMm: median,
    spreadMm: Math.round((sorted[sorted.length - 1] - sorted[0]) / 2),
    used: ok.length,
  };
}

/** Above this, the three shots disagree enough that the capture is suspect. */
export const RETAKE_SPREAD_MM = 25;

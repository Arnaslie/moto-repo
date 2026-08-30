// Deriving an inseam from photographs (ADR 0006) — plain geometry, no imports.
//
// The rider marks three points on each photo: top of head, crotch, and the
// floor at their feet. Their known height scales pixels to millimetres, so the
// camera distance doesn't matter and nothing has to be held up for reference.
//
// Why marked by hand rather than by a pose model: a pose estimator returns the
// *hip joint* — roughly the greater trochanter, which sits well above the
// crotch. Inseam is measured from the crotch down. Taking a hip landmark as an
// inseam overestimates it systematically, on every rider, in the same
// direction, which is the one error shape this feature cannot afford. Marking
// the point directly sidesteps that, needs no model or download, and keeps the
// photo in the browser where it belongs.

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
 * One photo's inseam estimate, in millimetres.
 *
 * Head-to-floor in pixels is the rider's known height, so every other vertical
 * distance in the same photo converts at the same rate. Returns null when the
 * marks are degenerate (head below floor, zero span) rather than dividing by
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
 * Fold the per-photo estimates into one measurement plus its uncertainty.
 *
 * The spread is the point of taking three. Averaging three shots of the same
 * pose would only cancel random jitter, and the dominant error here is
 * systematic — a camera held at eye level foreshortens the legs the same way
 * every time. The three shots are chosen to disagree when the capture went
 * wrong (the side view sees lean; the far front perturbs the perspective), so
 * a wide spread is a signal to retake, not noise to average away.
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

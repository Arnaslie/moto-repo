// Seat-height fit estimate. See ADR 0006.
//
// The COLD-START path only: once a bike has three rider reports the boundary is
// read off those and nothing here is consulted, so the thresholds below are
// scaffolding with a short life.
//
// Scored on ONE foot — riders stop with one foot down and the other covering
// the rear brake; both-feet-flat is a comfort bonus, not the threshold.

import {
  SAG_DEFAULTS_MM,
  SPLAY_PENALTY_MM,
  type BikeSpec,
} from "./bikes";

export const FIT_BANDS = [
  { key: "bothFlat", label: "Both feet flat", min: 1.0 },
  { key: "oneFlat", label: "One foot flat", min: 0.95 },
  { key: "ballsOfFoot", label: "Balls of one foot", min: 0.9 },
  { key: "tiptoe", label: "Tiptoe", min: 0.85 },
  { key: "cannotReach", label: "Cannot reach", min: -Infinity },
] as const;

export type FitBand = (typeof FIT_BANDS)[number]["key"];

// Inseams are stored barefoot, so footwear is added here and must NOT be baked
// into the stored figure: counting it twice is worth about an inch, enough to
// turn a tiptoe verdict into a flat-foot one.
export const SOLE_MM: Record<"bare" | "sneakers" | "boots", number> = {
  bare: 0,
  sneakers: 20,
  boots: 30,
};

export type Footwear = keyof typeof SOLE_MM;

/** How far down the rider actually has to reach, once the spec sheet stops
 *  flattering the bike: sagged under a rider, penalised for a wide seat. */
export function reachRequiredMm(bike: BikeSpec): number {
  const sag = bike.sagMm ?? SAG_DEFAULTS_MM[bike.category];
  return bike.seatHeightMm - sag + SPLAY_PENALTY_MM[bike.seatWidth];
}

function bandFor(ratio: number): FitBand {
  return (FIT_BANDS.find((b) => ratio >= b.min) ?? FIT_BANDS[FIT_BANDS.length - 1]).key;
}

export type FitResult = {
  band: FitBand;
  label: string;
  ratio: number;
  reachRequiredMm: number;
  /** True when the measurement's own error spans a band edge — the honest
   *  answer is "go sit on one", not a verdict. */
  borderline: boolean;
  /** Always "estimate" here. Reports supersede this once a bike has three. */
  basis: "estimate";
};

export function fitFor(
  inseamMm: number,
  bike: BikeSpec,
  opts: { footwear?: Footwear; spreadMm?: number } = {},
): FitResult {
  const { footwear = "bare", spreadMm = 0 } = opts;

  const reach = reachRequiredMm(bike);
  const effectiveInseam = inseamMm + SOLE_MM[footwear];
  const ratio = effectiveInseam / reach;
  const band = bandFor(ratio);

  // If the band would change at either end of the measurement's own error, we
  // haven't earned a verdict.
  const borderline =
    spreadMm > 0 &&
    (bandFor((effectiveInseam - spreadMm) / reach) !== band ||
      bandFor((effectiveInseam + spreadMm) / reach) !== band);

  return {
    band,
    label: FIT_BANDS.find((b) => b.key === band)!.label,
    ratio,
    reachRequiredMm: reach,
    borderline,
    basis: "estimate",
  };
}

// --- unit helpers ----------------------------------------------------------
// Canonical storage is whole millimetres; riders quote inches or centimetres.

export const mmToInches = (mm: number) => mm / 25.4;
export const inchesToMm = (inches: number) => Math.round(inches * 25.4);
export const formatInseam = (mm: number) =>
  `${mmToInches(mm).toFixed(1)}in (${mm}mm)`;

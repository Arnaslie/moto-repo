// Inseam input validation, same shape as lib/auth.ts. Stored as whole
// millimetres. See ADR 0006 for why it's inseam rather than height, and private.

export const INSEAM_MIN_MM = 500; // ~19.7in
export const INSEAM_MAX_MM = 1100; // ~43.3in

export const INSEAM_SOURCES = ["typed", "photo"] as const;
export type InseamSource = (typeof INSEAM_SOURCES)[number];

export type InseamInput = {
  inseamMm: number;
  inseamSource: InseamSource;
  inseamSpreadMm: number | null;
};

export type Inseam = {
  inseamMm: number;
  inseamSource: InseamSource;
  inseamSpreadMm: number | null;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * The bounds exist to catch unit slips, not to police bodies: an inseam typed in
 * centimetres (76) or inches (30) lands far outside them, and accepting it would
 * hand the rider a confident, wrong verdict.
 */
export function parseInseamInput(body: unknown): Result<InseamInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request body." };
  }
  const { inseamMm, inseamSource, inseamSpreadMm } = body as Record<string, unknown>;

  if (typeof inseamMm !== "number" || !Number.isFinite(inseamMm)) {
    return { ok: false, error: "Inseam must be a number." };
  }
  const mm = Math.round(inseamMm);
  if (mm < INSEAM_MIN_MM || mm > INSEAM_MAX_MM) {
    return {
      ok: false,
      error: `That doesn't look like an inseam — expected between ${INSEAM_MIN_MM}mm and ${INSEAM_MAX_MM}mm. Check the units.`,
    };
  }

  if (typeof inseamSource !== "string" || !INSEAM_SOURCES.includes(inseamSource as InseamSource)) {
    return { ok: false, error: "Unknown measurement source." };
  }
  const source = inseamSource as InseamSource;

  // Spread is the disagreement between the three captures, so it only means
  // something on the photo path.
  let spread: number | null = null;
  if (source === "photo") {
    if (typeof inseamSpreadMm !== "number" || !Number.isFinite(inseamSpreadMm) || inseamSpreadMm < 0) {
      return { ok: false, error: "A photo measurement must report its spread." };
    }
    spread = Math.round(inseamSpreadMm);
  } else if (inseamSpreadMm != null) {
    return { ok: false, error: "A typed measurement has no spread." };
  }

  return { ok: true, value: { inseamMm: mm, inseamSource: source, inseamSpreadMm: spread } };
}

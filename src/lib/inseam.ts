// Inseam input validation (no server/Prisma imports), same shape as lib/auth.ts.
//
// One number, stored as whole millimetres. See ADR 0006 for why it's inseam
// rather than height, and why it's private.

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
 * The bounds exist to catch unit slips, not to police bodies. Someone typing
 * their inseam in centimetres (76) or inches (30) instead of millimetres lands
 * far outside a plausible human range, and silently accepting it would hand
 * them a confident, wrong verdict — the exact failure this feature is for.
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

  // Spread only means something on the photo path — it's the disagreement
  // between the three captures. A typed measurement has no spread to report.
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

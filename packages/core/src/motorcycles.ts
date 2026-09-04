// Client-agnostic motorcycle types + validation (no server/Prisma imports),
// reusable by the API, web UI, and a future mobile app.

export type Motorcycle = {
  id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
};

export const MAKE_MAX = 40;
export const MODEL_MAX = 40;
export const NICKNAME_MAX = 40;

// The first commercial motorcycle (Daimler Reitwagen) was 1885. Allow next
// year for upcoming model-year bikes.
export const MIN_YEAR = 1885;
export const maxYear = (now: Date = new Date()) => now.getFullYear() + 1;

// A convenience list for the make datalist. Free text is still allowed.
export const COMMON_MAKES = [
  "Aprilia",
  "BMW",
  "Ducati",
  "Harley-Davidson",
  "Honda",
  "Husqvarna",
  "Indian",
  "Kawasaki",
  "KTM",
  "Moto Guzzi",
  "Royal Enfield",
  "Suzuki",
  "Triumph",
  "Yamaha",
];

export type MotorcycleInput = {
  year: number;
  make: string;
  model: string;
  nickname: string | null;
};

export type ParseResult =
  | { ok: true; value: MotorcycleInput }
  | { ok: false; error: string };

export function parseMotorcycleInput(
  body: unknown,
  now: Date = new Date(),
): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request body." };
  }
  const { year, make, model, nickname } = body as Record<string, unknown>;

  // Accept year as a number or a numeric string (form inputs send strings).
  const yearNum = typeof year === "string" ? Number(year) : year;
  if (
    typeof yearNum !== "number" ||
    !Number.isInteger(yearNum) ||
    yearNum < MIN_YEAR ||
    yearNum > maxYear(now)
  ) {
    return { ok: false, error: `Enter a year between ${MIN_YEAR} and ${maxYear(now)}.` };
  }

  const makeStr = typeof make === "string" ? make.trim() : "";
  if (!makeStr) return { ok: false, error: "Make is required." };
  if (makeStr.length > MAKE_MAX) {
    return { ok: false, error: `Make must be ${MAKE_MAX} characters or fewer.` };
  }

  const modelStr = typeof model === "string" ? model.trim() : "";
  if (!modelStr) return { ok: false, error: "Model is required." };
  if (modelStr.length > MODEL_MAX) {
    return { ok: false, error: `Model must be ${MODEL_MAX} characters or fewer.` };
  }

  const nickStr =
    typeof nickname === "string" && nickname.trim()
      ? nickname.trim().slice(0, NICKNAME_MAX)
      : null;

  return {
    ok: true,
    value: { year: yearNum, make: makeStr, model: modelStr, nickname: nickStr },
  };
}

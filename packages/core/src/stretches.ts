export type StretchKind = "surface" | "hazard" | "character" | "stop";

const DAY_MS = 24 * 60 * 60 * 1000;

export const STRETCH_KINDS = {
  surface: { name: "Surface", hint: "what the road is made of right now", halfLifeMs: 21 * DAY_MS },
  hazard: { name: "Hazard", hint: "what will hurt you that isn't the surface", halfLifeMs: 45 * DAY_MS },
  character: { name: "Character", hint: "what it's like to ride", halfLifeMs: null },
  stop: { name: "Stop", hint: "somewhere worth pulling into", halfLifeMs: 365 * DAY_MS },
} as const satisfies Record<StretchKind, { name: string; hint: string; halfLifeMs: number | null }>;

export const STRETCH_KIND_KEYS = Object.keys(STRETCH_KINDS) as StretchKind[];

export const MAX_LABEL_LENGTH = 32;
export const MIN_PATH_POINTS = 2;
export const MAX_PATH_POINTS = 40;
export const MIN_RENDER_ZOOM = 11;
export const FADE_FLOOR = 0.1;
export const CELL_DEG = 0.5;
export const MAX_CELLS_PER_QUERY = 64;
export const MAX_STRETCHES_PER_QUERY = 200;

export type LatLng = { lat: number; lng: number };
export type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };

export type StretchInput = {
  kind: StretchKind;
  label: string;
  slug: string;
  path: LatLng[];
};

export type Stretch = StretchInput & {
  id: string;
  author: string;
  score: number;
  myVote: number;
  createdAt: string;
  lastConfirmedAt: string;
};

export type TrendingTag = {
  slug: string;
  label: string;
  kind: StretchKind;
  count: number;
  computedAt: string;
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isStretchKind(value: unknown): value is StretchKind {
  return typeof value === "string" && value in STRETCH_KINDS;
}

export function slugify(label: string): string {
  return label
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^\p{L}\p{N}]+$/u, "")
    .trim();
}

export function boundsOf(path: LatLng[]): Bounds {
  const lats = path.map((p) => p.lat);
  const lngs = path.map((p) => p.lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

export function parseStretchInput(body: unknown): ParseResult<StretchInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be an object." };
  }

  const { kind, label, path } = body as Record<string, unknown>;

  if (!isStretchKind(kind)) {
    return { ok: false, error: `kind must be one of ${STRETCH_KIND_KEYS.join(", ")}.` };
  }

  const trimmedLabel = typeof label === "string" ? label.replace(/\s+/g, " ").trim() : "";
  if (!trimmedLabel) {
    return { ok: false, error: "A label is required." };
  }
  if (trimmedLabel.length > MAX_LABEL_LENGTH) {
    return { ok: false, error: `A label is at most ${MAX_LABEL_LENGTH} characters.` };
  }

  const slug = slugify(trimmedLabel);
  if (!slug) {
    return { ok: false, error: "A label needs at least one letter or number." };
  }

  if (!Array.isArray(path) || path.length < MIN_PATH_POINTS) {
    return { ok: false, error: `A stretch needs at least ${MIN_PATH_POINTS} points.` };
  }
  if (path.length > MAX_PATH_POINTS) {
    return { ok: false, error: `A stretch is at most ${MAX_PATH_POINTS} points.` };
  }

  const points: LatLng[] = [];
  for (const point of path) {
    if (typeof point !== "object" || point === null) {
      return { ok: false, error: "Every path point must be an object." };
    }
    const { lat, lng } = point as Record<string, unknown>;
    if (!isFiniteNumber(lat) || lat < -90 || lat > 90) {
      return { ok: false, error: "lat must be a number between -90 and 90." };
    }
    if (!isFiniteNumber(lng) || lng < -180 || lng > 180) {
      return { ok: false, error: "lng must be a number between -180 and 180." };
    }
    points.push({ lat, lng });
  }

  return { ok: true, value: { kind, label: trimmedLabel, slug, path: points } };
}

export function parseBounds(params: URLSearchParams): ParseResult<Bounds> {
  const read = (key: string) => {
    const raw = params.get(key);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  };

  const minLat = read("minLat");
  const maxLat = read("maxLat");
  const minLng = read("minLng");
  const maxLng = read("maxLng");

  if (minLat === null || maxLat === null || minLng === null || maxLng === null) {
    return { ok: false, error: "minLat, maxLat, minLng and maxLng are all required." };
  }
  if (minLat > maxLat || minLng > maxLng) {
    return { ok: false, error: "Bounds are inverted." };
  }
  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) {
    return { ok: false, error: "Bounds are outside the world." };
  }

  return { ok: true, value: { minLat, maxLat, minLng, maxLng } };
}

export function cellFor(lat: number, lng: number): string {
  const snap = (value: number) => (Math.floor(value / CELL_DEG) * CELL_DEG).toFixed(1);
  return `${snap(lat)}:${snap(lng)}`;
}

export function cellsWithin(bounds: Bounds): string[] {
  const start = (value: number) => Math.floor(value / CELL_DEG) * CELL_DEG;
  const cells: string[] = [];
  for (let lat = start(bounds.minLat); lat <= bounds.maxLat; lat += CELL_DEG) {
    for (let lng = start(bounds.minLng); lng <= bounds.maxLng; lng += CELL_DEG) {
      cells.push(cellFor(lat, lng));
      if (cells.length >= MAX_CELLS_PER_QUERY) return cells;
    }
  }
  return cells;
}

export function freshness(
  kind: StretchKind,
  lastConfirmedAt: string,
  now: number = Date.now(),
): number {
  const { halfLifeMs } = STRETCH_KINDS[kind];
  if (halfLifeMs === null) return 1;
  const age = now - new Date(lastConfirmedAt).getTime();
  if (!Number.isFinite(age) || age <= 0) return 1;
  return Math.pow(0.5, age / halfLifeMs);
}

export function isFaded(kind: StretchKind, lastConfirmedAt: string, now?: number): boolean {
  return freshness(kind, lastConfirmedAt, now) < FADE_FLOOR;
}

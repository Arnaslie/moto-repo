// Client-agnostic location types + validation.
//
// Nothing here imports Next.js, React, or Prisma, so this module can be shared
// as-is with a future React Native / Expo app (which would hit the same API).

// A rider's live position as serialized over the API.
export type RiderLocation = {
  rider: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  sharing: boolean;
  updatedAt: string;
};

// How long a position stays "live" before we consider the rider stale and drop
// them from the map. Kept here so web and mobile agree on freshness.
export const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export const MAX_RIDER_LENGTH = 40;

// The validated shape accepted by POST /api/locations.
export type LocationInput = {
  rider: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  sharing: boolean;
};

export type ParseResult =
  | { ok: true; value: LocationInput }
  | { ok: false; error: string };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// Validate an untrusted request body into a LocationInput. Shared by the API
// route today and reusable for optimistic client-side checks later.
export function parseLocationInput(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be an object." };
  }

  const { rider, lat, lng, accuracy, sharing } = body as Record<string, unknown>;

  const trimmedRider = typeof rider === "string" ? rider.trim() : "";
  if (!trimmedRider) {
    return { ok: false, error: "A rider handle is required." };
  }

  if (!isFiniteNumber(lat) || lat < -90 || lat > 90) {
    return { ok: false, error: "lat must be a number between -90 and 90." };
  }
  if (!isFiniteNumber(lng) || lng < -180 || lng > 180) {
    return { ok: false, error: "lng must be a number between -180 and 180." };
  }

  return {
    ok: true,
    value: {
      rider: trimmedRider.slice(0, MAX_RIDER_LENGTH),
      lat,
      lng,
      accuracy: isFiniteNumber(accuracy) ? accuracy : null,
      // Default to sharing unless explicitly set false (used to go invisible).
      sharing: sharing === false ? false : true,
    },
  };
}

// True if a position is recent enough to show as an active rider.
export function isActive(updatedAt: string, now: number = Date.now()): boolean {
  return now - new Date(updatedAt).getTime() <= ACTIVE_WINDOW_MS;
}

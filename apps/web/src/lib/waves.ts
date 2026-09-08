// TEMPORARY: signing in to wave is optional while this flag is on.
//
// A signed-out visitor is identified only by a random id in the cookie below,
// so clearing cookies makes them a new stranger: the tally is a floor, not a
// headcount. Turning the flag off leaves existing guest waves counting.
//
// Next inlines a NEXT_PUBLIC_ variable at build time, so a production build
// freezes whatever the value was when it was built.
export const ANONYMOUS_WAVES_ENABLED =
  process.env.NEXT_PUBLIC_ALLOW_ANONYMOUS_WAVES === "true";

export const GUEST_WAVE_COOKIE = "moto_guest";

// A year — long enough that a guest's waves survive between visits.
export const GUEST_WAVE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Who's asking, for wave purposes: a signed-in rider, a cookie-identified
// guest, or neither. Passed to postInclude().
export type WaveViewer = {
  userId?: string | null;
  guestId?: string | null;
};

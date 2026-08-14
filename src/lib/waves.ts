// TEMPORARY: signing in to wave is optional while this flag is on.
//
// Set NEXT_PUBLIC_ALLOW_ANONYMOUS_WAVES="true" in .env and a signed-out visitor
// can wave straight from the feed. They're identified by a random id parked in
// the cookie below — enough to keep one wave per visitor per post and to let
// them take it back, but not tied to any account. Clearing cookies makes a
// visitor a new stranger, so the tally is a floor, not a headcount.
//
// To turn it back off: drop the variable and restart. Nothing else changes —
// existing guest waves stay in the database and keep counting.
//
// The NEXT_PUBLIC_ prefix is what lets the button read it in the browser; note
// that Next inlines it at build time, so a production build freezes whatever
// the value was when it was built.
export const ANONYMOUS_WAVES_ENABLED =
  process.env.NEXT_PUBLIC_ALLOW_ANONYMOUS_WAVES === "true";

export const GUEST_WAVE_COOKIE = "moto_guest";

// A year — long enough that a guest's waves survive between visits.
export const GUEST_WAVE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Who's asking, for wave purposes: a signed-in rider, a cookie-identified
// guest, or neither. Passed to postInclude() so a post comes back already
// knowing whether this visitor has waved at it.
export type WaveViewer = {
  userId?: string | null;
  guestId?: string | null;
};

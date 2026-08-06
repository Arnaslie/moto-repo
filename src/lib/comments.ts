// Comment rules and pure helpers. Deliberately free of Next/React/Prisma
// imports so a future mobile client can share this module (same convention as
// lib/motorcycles.ts and lib/gear.ts).

// Shorter than a post's 500 — comments crawl past in a ticker, so they have to
// stay readable at a glance.
export const MAX_COMMENT_LENGTH = 280;

// How many of the newest comments ride along with each post in the feed
// payload. Anything beyond this is fetched on demand when the thread expands.
export const TICKER_COMMENT_LIMIT = 12;

// Characters shown per ticker item before it's cut off.
export const TICKER_PREVIEW_CHARS = 90;

// Shorten a comment for the scrolling strip, breaking on a word boundary when
// there's a reasonable one nearby so we don't slice words in half.
export function truncateForTicker(
  text: string,
  limit = TICKER_PREVIEW_CHARS,
): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= limit) return collapsed;

  const cut = collapsed.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  // Only honour the word boundary if it isn't throwing away most of the line.
  const body = lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${body.trimEnd()}…`;
}

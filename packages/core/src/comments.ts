// Comment rules and pure helpers. Keep it free of Next/React/Prisma imports.

// Shorter than a post's 500 — comments crawl past in a ticker, so they have to
// stay readable at a glance.
export const MAX_COMMENT_LENGTH = 280;

// How many of the newest comments ride along in the feed payload; the rest are
// fetched when the thread expands.
export const TICKER_COMMENT_LIMIT = 12;

export const TICKER_PREVIEW_CHARS = 90;

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

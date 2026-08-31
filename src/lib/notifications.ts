// See ADR 0007. Keep this half free of React/Next/Prisma imports.
//
// Unread DMs are not notifications and never become rows — they're a counter on
// Participant. The badge adds the two counts.

/** "wave" | "comment" — bare strings with a guard, not an enum, per house
 *  convention. */
export const NOTIFICATION_TYPES = ["wave", "comment"] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const TYPE_VALUES = NOTIFICATION_TYPES as readonly string[];

/**
 * `Notification.type` is a bare column, so a row can hold a value this build
 * doesn't know. The panel skips what it can't render rather than throwing.
 */
export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && TYPE_VALUES.includes(value);
}

/** Comments cap at 280, which is three lines in a dropdown that wants to be
 *  one; 90 still identifies the comment. */
export const EXCERPT_MAX = 90;

/** Runs server-side before serializing, so the wire payload carries the
 *  excerpt rather than the whole comment. */
export function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= EXCERPT_MAX ? flat : `${flat.slice(0, EXCERPT_MAX - 1).trimEnd()}…`;
}

/**
 * A notification as the panel sees it.
 *
 * No avatar, unlike a `Correspondent`: adding one costs the equipped-gear join
 * per row. Nothing about the actor is stored on the row, so `actor` is joined
 * on read and a handle change is reflected rather than frozen.
 */
export type NotificationDTO = {
  id: string;
  type: NotificationType;
  /** Always present — the schema makes both ends accounts, so there is no
   *  "Someone waved". */
  actor: string;
  actorDisplayName: string | null;
  /** Null only if the post was deleted, which the cascade should prevent. */
  postId: string | null;
  /** Null on a wave. */
  commentId: string | null;
  /** The comment, already trimmed by `excerpt`. Null on a wave. */
  quote: string | null;
  createdAt: string;
  /** Null until the rider has seen it. Set once, never unset. */
  readAt: string | null;
};

/**
 * Parts rather than one finished string: the handle is a profile link inside a
 * row that is itself a link, so the component must render them separately.
 * `did` is written to follow the handle directly.
 */
export type NotificationLine = {
  actor: string;
  did: string;
  quote: string | null;
};

export function notificationLine(n: NotificationDTO): NotificationLine {
  return {
    actor: n.actor,
    did: n.type === "wave" ? "waved at your post" : "commented on your post",
    quote: n.type === "comment" ? n.quote : null,
  };
}

/**
 * The same row as one string, for the places that can't take parts: the row's
 * `aria-label`, and the `role="status"` announcement when one arrives.
 */
export function notificationSentence(n: NotificationDTO): string {
  const line = notificationLine(n);
  const base = `@${line.actor} ${line.did}`;
  return line.quote ? `${base}: ${line.quote}` : base;
}

/**
 * There is no post permalink — no `/posts/[id]` route, and the feed is
 * paginated. A notification is always about a post the viewer owns, and a
 * profile renders all of its rider's posts with no `take`, so the anchor there
 * is guaranteed to land. Requires `PostCard` to render an `id`.
 */
export function notificationHref(n: NotificationDTO, viewerHandle: string): string {
  const profile = `/profile/${viewerHandle}`;
  return n.postId ? `${profile}#post-${n.postId}` : profile;
}

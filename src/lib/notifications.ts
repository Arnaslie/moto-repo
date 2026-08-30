// Notifications — the rules and the shapes (ADR 0007).
//
// The pure half: no React, no Next, no Prisma imports, so route handlers,
// components and a future mobile client can all share it. Same two-tier split
// as messages.ts / conversations.ts and comms.ts / rooms.ts.
//
// What's in here is *activity on your own posts* — a wave or a comment. Unread
// DMs are not notifications and never become rows: they're a counter on
// Participant, because forty messages from one rider is one conversation
// waiting on you while a wave and a comment are genuinely two things. The badge
// adds the two counts. See the Notification model comment for the same point
// from the database's side.

/** The two things that can happen to a post. Bare strings with a guard beside
 *  them rather than an enum, per house convention. */
export const NOTIFICATION_TYPES = ["wave", "comment"] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const TYPE_VALUES = NOTIFICATION_TYPES as readonly string[];

/**
 * `Notification.type` is a bare column, so a row can in principle hold anything
 * — a type added by a later branch, or something hand-written into the database
 * during a test. The panel skips what it can't render rather than throwing, and
 * this guard is what lets the DTO's narrow type be honest about that.
 */
export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && TYPE_VALUES.includes(value);
}

/** How much of a comment a panel row carries. Comments cap at 280, which is
 *  three lines in a dropdown that wants to be one — long enough to recognise
 *  which comment it was, short enough that ten rows still fit on screen. */
export const EXCERPT_MAX = 90;

/** Collapses whitespace and trims to EXCERPT_MAX, ellipsis included. Runs
 *  server-side before serializing, so the wire payload carries the excerpt
 *  rather than the whole comment. */
export function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= EXCERPT_MAX ? flat : `${flat.slice(0, EXCERPT_MAX - 1).trimEnd()}…`;
}

/**
 * A notification as the panel sees it.
 *
 * No avatar, deliberately, and this is where it differs from an inbox row: a
 * `Correspondent` carries one because an inbox is a list of *people*, while
 * this is a list of *things that happened* — ten rows deep, on a dropdown, with
 * the handle already naming who. Adding one means the equipped-gear join per
 * row for a picture nobody is scanning for.
 *
 * Nothing about the actor is stored on the row, so `actor` here is joined on
 * read and a handle change is reflected rather than frozen. Same as Message.
 */
export type NotificationDTO = {
  id: string;
  type: NotificationType;
  /** The rider who did it. Always present — both ends of a notification are
   *  accounts, which the schema enforces, so there is no "Someone waved". */
  actor: string;
  actorDisplayName: string | null;
  /** The post it happened to. Null only for a row whose post has since been
   *  deleted, which the cascade means shouldn't happen — belt and braces. */
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
 * The parts of a panel row, rather than one finished string.
 *
 * The handle is a link to a profile sitting inside a row that is itself a link
 * to the post, so the component has to render them separately — handing it a
 * sentence would mean parsing the handle back out of it. `did` is written to
 * follow the handle directly.
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
 * `aria-label`, and the `role="status"` announcement when one arrives. Kept
 * beside `notificationLine` so the two can't drift into saying different
 * things about the same row.
 */
export function notificationSentence(n: NotificationDTO): string {
  const line = notificationLine(n);
  const base = `@${line.actor} ${line.did}`;
  return line.quote ? `${base}: ${line.quote}` : base;
}

/**
 * Where a row goes when it's clicked.
 *
 * There is no post permalink in this app — no `/posts/[id]` route, and the feed
 * is paginated — but a notification is always about a post the *viewer* owns,
 * and a profile renders every one of its rider's posts, newest first, with no
 * `take`. So the rider's own profile is a page guaranteed to contain the post,
 * and the anchor is what puts it on screen. It needs `PostCard` to render an
 * `id`, which is the UI step's one line.
 *
 * If a post permalink is ever built, this function is the only thing that has
 * to know.
 */
export function notificationHref(n: NotificationDTO, viewerHandle: string): string {
  const profile = `/profile/${viewerHandle}`;
  return n.postId ? `${profile}#post-${n.postId}` : profile;
}

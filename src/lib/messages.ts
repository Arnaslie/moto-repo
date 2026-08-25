// Direct messages — the rules and the shapes.
//
// The pure half: no React, no Next, no Prisma imports, so route handlers,
// components and a future mobile client can all share it (same two-tier split
// as comms.ts / rooms.ts).
//
// A DM is the app's first private channel. Everything else here — the feed,
// Comms, the map — is a public space where the worst anyone can do is do it
// where everyone can see. That's worth remembering when this grows: the
// constraints below are about keeping a thread readable, not about safety.

import { HANDLE_RE } from "./auth";
import type { PostAuthorAvatar } from "./types";

/**
 * Longer than a post's 500 and much longer than a comment's 280. Those two are
 * broadcast — they're read by people scrolling past, so brevity is a courtesy.
 * A DM is read by exactly one person who chose to be in the conversation, and
 * it's where the long answer to "why is it doing that?" ends up. The cap is
 * only here to stop a paste of the whole service manual.
 */
export const MAX_MESSAGE_LENGTH = 2000;

/** Two user ids sorted and joined — see the Conversation model comment. The
 *  sort is what makes it symmetric, so A→B and B→A land on the same row. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

/** The other rider, as a thread needs to show them. Carries the avatar because
 *  an inbox is a list of *people* — in an app where every rider builds one,
 *  rows of bare handles are the one screen where nobody has a face. */
export type Correspondent = {
  handle: string;
  displayName: string | null;
  avatar: PostAuthorAvatar | null;
};

export type MessageDTO = {
  id: string;
  body: string;
  /** Handle of whoever sent it. The client compares it against its own rather
   *  than the server marking each line "mine" — the same payload then serves
   *  both sides of the thread. */
  sender: string;
  createdAt: string;
};

/** A conversation as the inbox and the thread header see it. */
export type ConversationSummary = {
  id: string;
  with: Correspondent;
  /** Null only for a thread that was started but never spoken in. */
  lastMessage: MessageDTO | null;
  lastMessageAt: string;
  /** Unread messages waiting for *this* viewer. */
  unreadCount: number;
};

export type MessageInput = { body: string };
export type StartConversationInput = { handle: string };

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * A message is one field, so this is mostly about what counts as empty. Inner
 * whitespace is left alone — unlike a room title, which gets collapsed: a DM is
 * where someone pastes a torque sequence, and the line breaks are the content.
 */
export function parseMessageInput(body: unknown): Parsed<MessageInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Expected a JSON object." };
  }
  const { body: text } = body as Record<string, unknown>;

  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) {
    return { ok: false, error: "Write something first." };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `Messages are ${MAX_MESSAGE_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value: { body: trimmed } };
}

/**
 * Starting a thread names the other rider by handle, not by id — the handle is
 * what a rider actually knows about someone, and it's what the profile link
 * already carries. Validated against the same pattern signup enforces, so a
 * malformed handle is a 400 here rather than a pointless lookup.
 */
export function parseStartConversationInput(
  body: unknown,
): Parsed<StartConversationInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Expected a JSON object." };
  }
  const { handle } = body as Record<string, unknown>;

  const normalized = typeof handle === "string" ? handle.trim().toLowerCase() : "";
  if (!HANDLE_RE.test(normalized)) {
    return { ok: false, error: "That isn't a rider handle." };
  }
  return { ok: true, value: { handle: normalized } };
}

// See ADR 0003. Keep this half free of React/Next/Prisma imports.
//
// A DM is the app's only private channel, and nothing below is a safety
// control — the caps here are about keeping a thread readable.

import { HANDLE_RE } from "./auth";
import type { PostAuthorAvatar } from "./types";

/**
 * Longer than a post's 500 or a comment's 280: those are broadcast, a DM is read
 * by one person who chose to be there. The cap only stops a paste of the whole
 * service manual.
 */
export const MAX_MESSAGE_LENGTH = 2000;

/** Two user ids sorted and joined — see the Conversation model comment. The
 *  sort is what makes it symmetric, so A→B and B→A land on the same row. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

/** The other rider, as a thread needs to show them. Carries the avatar because
 *  an inbox is a list of *people*, unlike a notification row. */
export type Correspondent = {
  handle: string;
  displayName: string | null;
  avatar: PostAuthorAvatar | null;
};

export type MessageDTO = {
  id: string;
  body: string;
  /** Handle of whoever sent it. The client compares it against its own, so the
   *  same payload serves both sides of the thread — don't mark lines "mine"
   *  server-side. */
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
 * Inner whitespace is left alone — unlike a room title, which gets collapsed. A
 * DM is where someone pastes a torque sequence, and the line breaks are content.
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
 * Threads are started by handle, not id — that's what a profile link carries.
 * Validated against the same pattern signup enforces, so a malformed handle is
 * a 400 rather than a lookup.
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

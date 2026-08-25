// Prisma query shapes for direct messages, and the serializers that turn rows
// into the DTOs in lib/messages.ts. Same split as rooms.ts sitting beside
// comms.ts: the rules are pure, the `select`s live here.

import type { ConversationSummary, MessageDTO } from "./messages";
import { authorAvatar } from "./posts";

// Everything a message needs to render. The sender's handle is joined rather
// than denormalized onto the row — see the Message model comment.
export const messageSelect = {
  id: true,
  body: true,
  createdAt: true,
  sender: { select: { handle: true } },
} as const;

// A conversation together with both sides and its newest line. `messages` takes
// exactly one: the inbox shows a preview, and loading a whole thread to render
// a single line of it is how an inbox gets slow.
export const conversationSelect = {
  id: true,
  lastMessageAt: true,
  participants: {
    select: {
      userId: true,
      unreadCount: true,
      // The gear join is the same one the feed does for a post author, so an
      // inbox row can render the rider rather than just name them.
      user: {
        select: {
          handle: true,
          displayName: true,
          avatarSkin: true,
          gear: {
            where: { equipped: true },
            select: { gearItem: { select: { slot: true, asset: true, color: true } } },
          },
        },
      },
    },
  },
  messages: {
    take: 1,
    orderBy: { createdAt: "desc" },
    select: messageSelect,
  },
} as const;

// The subsets the serializers need, structural so Prisma results pass straight
// in without a cast.
type MessageRow = {
  id: string;
  body: string;
  createdAt: Date;
  sender: { handle: string };
};

type ConversationRow = {
  id: string;
  lastMessageAt: Date;
  participants: {
    userId: string;
    unreadCount: number;
    user: {
      handle: string;
      displayName: string | null;
      avatarSkin: string;
      gear: { gearItem: { slot: string; asset: string; color: string | null } }[];
    };
  }[];
  messages: MessageRow[];
};

export function serializeMessage(message: MessageRow): MessageDTO {
  return {
    id: message.id,
    body: message.body,
    sender: message.sender.handle,
    createdAt: message.createdAt.toISOString(),
  };
}

/**
 * Viewer-specific, unavoidably: which side is "the other rider" and how many
 * messages are waiting both depend on who's asking. Callers pass the viewer's
 * id, the same way postInclude() takes a wave viewer.
 *
 * The `?? row.participants[0]` fallback is for a row where the viewer somehow
 * isn't a participant. Route handlers reject that with a 403 before they get
 * here, so it's belt-and-braces — but a serializer that can throw is a
 * serializer that takes the page down.
 */
export function serializeConversation(
  row: ConversationRow,
  viewerId: string,
): ConversationSummary {
  const mine = row.participants.find((p) => p.userId === viewerId);
  const other = row.participants.find((p) => p.userId !== viewerId) ?? row.participants[0];

  return {
    id: row.id,
    with: {
      handle: other.user.handle,
      displayName: other.user.displayName,
      avatar: authorAvatar(other.user),
    },
    lastMessage: row.messages[0] ? serializeMessage(row.messages[0]) : null,
    lastMessageAt: row.lastMessageAt.toISOString(),
    unreadCount: mine?.unreadCount ?? 0,
  };
}

/** The inbox's one query: every thread I'm in, most recently spoken in first. */
export function inboxQuery(userId: string) {
  return {
    where: { participants: { some: { userId } } },
    orderBy: { lastMessageAt: "desc" },
    select: conversationSelect,
  } as const;
}

/**
 * A thread's messages, oldest first — the order they're read in.
 *
 * `after` is the poll's cursor, and it's deliberately inclusive (`gte`, not
 * `gt`): timestamps are millisecond-precision, so two messages can in principle
 * share one, and an exclusive cursor would silently drop the second forever.
 * The cost is that each tick re-sends the message the client already has, which
 * it discards by id. Re-sending one line beats losing one.
 */
export function threadMessagesQuery(conversationId: string, after?: Date | null) {
  return {
    where: {
      conversationId,
      ...(after ? { createdAt: { gte: after } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: messageSelect,
  } as const;
}

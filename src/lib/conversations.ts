// The Prisma half of lib/messages.ts: the `select`s and the serializers.

import type { ConversationSummary, MessageDTO } from "./messages";
import { authorAvatar } from "./posts";

// The sender's handle is joined rather than denormalized onto the row — see the
// Message model comment.
export const messageSelect = {
  id: true,
  body: true,
  createdAt: true,
  sender: { select: { handle: true } },
} as const;

// `messages` takes exactly one: the inbox only shows a preview, and loading a
// whole thread to render one line of it is how an inbox gets slow.
export const conversationSelect = {
  id: true,
  lastMessageAt: true,
  participants: {
    select: {
      userId: true,
      unreadCount: true,
      // The same equipped-gear join the feed does for a post author.
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

// Structural, so Prisma results pass straight in without a cast.
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
 * Viewer-specific: which side is "the other rider" and how many messages wait
 * both depend on who's asking.
 *
 * The `?? row.participants[0]` fallback covers a row where the viewer isn't a
 * participant. Handlers 403 that before it gets here, so it is belt-and-braces
 * — but a serializer that can throw takes the page down.
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

export function inboxQuery(userId: string) {
  return {
    where: { participants: { some: { userId } } },
    orderBy: { lastMessageAt: "desc" },
    select: conversationSelect,
  } as const;
}

/**
 * `after` is the poll's cursor, and it's deliberately inclusive (`gte`, not
 * `gt`): timestamps are millisecond-precision, so two messages can share one and
 * an exclusive cursor would drop the second forever. The cost is re-sending the
 * message the client already has, which it discards by id.
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

import type { Comment, Post, PostAuthorAvatar } from "./types";
import type { SlotKey } from "./gear";
import { TICKER_COMMENT_LIMIT } from "./comments";

// Prisma `include` for an author together with their equipped gear — the data
// the Avatar component needs. Shared by posts and comments.
const authorInclude = {
  gear: {
    where: { equipped: true },
    include: { gearItem: true },
  },
} as const;

// Comments ride along with the post so the ticker can render immediately, with
// no round-trip. Bounded to the newest few; the thread fetches the rest on
// demand when it's expanded.
export const commentsInclude = {
  comments: {
    take: TICKER_COMMENT_LIMIT,
    orderBy: { createdAt: "desc" },
    include: { user: { include: authorInclude } },
  },
  _count: { select: { comments: true } },
} as const;

// Prisma `include` for loading a post together with its author's equipped gear.
// Shared so every query that feeds serializePost() selects the same shape.
export const postInclude = {
  user: { include: authorInclude },
  ...commentsInclude,
} as const;

// The subset of a row that the serializers need. Kept as structural types so
// callers can pass Prisma results directly.
type AuthorRow = {
  avatarSkin: string;
  gear: { gearItem: { slot: string; asset: string; color: string | null } }[];
} | null;

type CommentRow = {
  id: string;
  author: string;
  content: string;
  createdAt: Date;
  user: AuthorRow;
};

type PostRow = {
  id: string;
  author: string;
  content: string;
  imageUrl: string | null;
  createdAt: Date;
  user: AuthorRow;
  comments: CommentRow[];
  _count: { comments: number };
};

export function authorAvatar(user: AuthorRow): PostAuthorAvatar | null {
  if (!user) return null;
  return {
    skin: user.avatarSkin,
    equipped: user.gear.map((g) => ({
      slot: g.gearItem.slot as SlotKey,
      asset: g.gearItem.asset,
      color: g.gearItem.color,
    })),
  };
}

export function serializeComment(comment: CommentRow): Comment {
  return {
    id: comment.id,
    author: comment.author,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    avatar: authorAvatar(comment.user),
  };
}

export function serializePost(post: PostRow): Post {
  return {
    id: post.id,
    author: post.author,
    content: post.content,
    imageUrl: post.imageUrl,
    createdAt: post.createdAt.toISOString(),
    avatar: authorAvatar(post.user),
    // The query takes the *newest* N; flip to oldest-first so the ticker reads
    // in chronological order as it crawls.
    comments: [...post.comments].reverse().map(serializeComment),
    commentCount: post._count.comments,
  };
}

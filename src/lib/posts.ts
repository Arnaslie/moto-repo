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

// Prisma `include` for loading a post together with its author's equipped gear,
// its newest comments, and its wave tally. Shared so every query that feeds
// serializePost() selects the same shape.
//
// Unlike the other includes here this one is viewer-specific: whether a post is
// already waved at depends on who's asking, so callers pass the signed-in
// rider's id (or nothing, for signed-out readers).
export function postInclude(viewerId?: string | null) {
  return {
    user: { include: authorInclude },
    // Comments ride along with the post so the ticker can render immediately,
    // with no round-trip. Bounded to the newest few; the thread fetches the
    // rest on demand when it's expanded.
    comments: {
      take: TICKER_COMMENT_LIMIT,
      orderBy: { createdAt: "desc" },
      include: { user: { include: authorInclude } },
    },
    // The viewer's own wave, if they've left one — at most a single row, given
    // the unique [postId, userId] pair. Signed-out readers get an id that can
    // never match, which keeps this one query shape instead of two.
    waves: {
      where: { userId: viewerId ?? "" },
      select: { id: true },
    },
    _count: { select: { comments: true, waves: true } },
  } as const;
}

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
  waves: { id: string }[];
  _count: { comments: number; waves: number };
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
    waveCount: post._count.waves,
    // The query only ever selects the viewer's own wave, so any row means yes.
    waved: post.waves.length > 0,
  };
}

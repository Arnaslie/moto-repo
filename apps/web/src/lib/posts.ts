import type { Comment, Post, PostAuthorAvatar } from "@moto/core/types";
import type { SlotKey } from "@moto/core/gear";
import { TICKER_COMMENT_LIMIT } from "@moto/core/comments";
import type { WaveViewer } from "./waves";

// The author fields an Avatar needs, and nothing else. Shared by posts and
// comments.
//
// A `select` rather than an `include`, deliberately. `include` on a relation
// loads every scalar column the model has, which here means every post in the
// public feed — readable signed out — carrying its author's email, their
// private inseam measurement and their bcrypt password hash into the route
// handler. None of it was ever emitted: authorAvatar() and the serializers
// below build fresh objects field by field. But that made the guarantee a
// convention applied at four call sites rather than a property of the query,
// and one future `<Something user={user} />` is all it would take. Fetch what
// gets used.
const authorSelect = {
  avatarSkin: true,
  gear: {
    where: { equipped: true },
    select: { gearItem: { select: { slot: true, asset: true, color: true } } },
  },
} as const;

// A comment as the ticker and the thread render it. Exported because the
// comments route needs the identical shape, and two hand-kept copies of a
// select is how one of them quietly grows an `include` again.
export const commentSelect = {
  id: true,
  author: true,
  content: true,
  createdAt: true,
  user: { select: authorSelect },
} as const;

// Matches the one wave this viewer could have left. An account wins over a
// guest cookie; with neither, `id: ""` matches nothing (cuids are never empty).
function viewerWaveFilter(viewer?: WaveViewer | null) {
  if (viewer?.userId) return { userId: viewer.userId };
  if (viewer?.guestId) return { guestId: viewer.guestId };
  return { id: "" };
}

// Shared so every query that feeds serializePost() selects the same shape.
//
// Viewer-specific, unlike the other includes here: whether a post is already
// waved at depends on who's asking, so callers pass what getWaveViewer() hands
// them (or nothing, for readers with neither an account nor a guest id).
export function postInclude(viewer?: WaveViewer | null) {
  return {
    user: { select: authorSelect },
    // Comments ride along with the post so the ticker can render immediately,
    // with no round-trip. Bounded to the newest few; the thread fetches the
    // rest on demand when it's expanded.
    comments: {
      take: TICKER_COMMENT_LIMIT,
      orderBy: { createdAt: "desc" },
      select: commentSelect,
    },
    // At most one row, given the unique pairs on Wave. A reader with no
    // identity gets a filter that can never match, which keeps this one query
    // shape instead of two.
    waves: {
      where: viewerWaveFilter(viewer),
      select: { id: true },
    },
    _count: { select: { comments: true, waves: true } },
  } as const;
}

// Structural, so callers can pass Prisma results directly.
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

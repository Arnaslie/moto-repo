import type { Comment, Post, PostAuthorAvatar } from "./types";
import type { SlotKey } from "./gear";
import { TICKER_COMMENT_LIMIT } from "./comments";
import type { WaveViewer } from "./waves";

// The author data the Avatar component needs. Shared by posts and comments.
const authorInclude = {
  gear: {
    where: { equipped: true },
    include: { gearItem: true },
  },
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
    user: { include: authorInclude },
    // Comments ride along so the ticker renders with no round-trip; the thread
    // fetches the rest on demand when it's expanded.
    comments: {
      take: TICKER_COMMENT_LIMIT,
      orderBy: { createdAt: "desc" },
      include: { user: { include: authorInclude } },
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

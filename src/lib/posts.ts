import type { Post, PostAuthorAvatar } from "./types";
import type { SlotKey } from "./gear";

// Prisma `include` for loading a post together with its author's equipped gear.
// Shared so every query that feeds serializePost() selects the same shape.
export const postInclude = {
  user: {
    include: {
      gear: {
        where: { equipped: true },
        include: { gearItem: true },
      },
    },
  },
} as const;

// The subset of a post-with-author row that serializePost needs. Kept as a
// structural type so callers can pass Prisma results directly.
type PostRow = {
  id: string;
  author: string;
  content: string;
  imageUrl: string | null;
  createdAt: Date;
  user: {
    avatarSkin: string;
    gear: { gearItem: { slot: string; asset: string; color: string | null } }[];
  } | null;
};

export function authorAvatar(
  user: PostRow["user"],
): PostAuthorAvatar | null {
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

export function serializePost(post: PostRow): Post {
  return {
    id: post.id,
    author: post.author,
    content: post.content,
    imageUrl: post.imageUrl,
    createdAt: post.createdAt.toISOString(),
    avatar: authorAvatar(post.user),
  };
}

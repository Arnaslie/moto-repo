import type { SlotKey } from "./gear";

// The author's customized avatar, attached to a post so the feed can render it.
// Same shape as the Avatar component's EquippedItem list.
export type PostAuthorAvatar = {
  skin: string;
  equipped: { slot: SlotKey; asset: string; color: string | null }[];
};

// A post as serialized over the API / to the client (dates as ISO strings).
export type Post = {
  id: string;
  author: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  // Present for posts by a real account; null for anonymous/legacy posts.
  avatar: PostAuthorAvatar | null;
};

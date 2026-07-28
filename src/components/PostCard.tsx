import Link from "next/link";
import type { Post } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { Avatar } from "./Avatar";

// Fallback accent color per author for anonymous/legacy posts without an avatar.
const AVATAR_COLORS = [
  "bg-orange-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-violet-500",
];

function avatarColor(author: string): string {
  let hash = 0;
  for (let i = 0; i < author.length; i++) {
    hash = (hash + author.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash];
}

export function PostCard({ post }: { post: Post }) {
  const initial = post.author.trim().charAt(0).toUpperCase() || "?";
  const profileHref = post.avatar ? `/profile/${post.author}` : null;

  const avatar = post.avatar ? (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/10">
      <Avatar skin={post.avatar.skin} equipped={post.avatar.equipped} size={40} />
    </div>
  ) : (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColor(
        post.author,
      )}`}
      aria-hidden
    >
      {initial}
    </div>
  );

  return (
    <article className="flex gap-3 border-b border-black/10 px-4 py-4 dark:border-white/10">
      {profileHref ? (
        <Link href={profileHref} aria-label={`@${post.author}'s profile`}>
          {avatar}
        </Link>
      ) : (
        avatar
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          {profileHref ? (
            <Link href={profileHref} className="truncate font-semibold hover:underline">
              @{post.author}
            </Link>
          ) : (
            <span className="truncate font-semibold">@{post.author}</span>
          )}
          <span
            className="text-sm text-black/50 dark:text-white/50"
            suppressHydrationWarning
          >
            · {timeAgo(post.createdAt)}
          </span>
        </div>
        {post.content && (
          <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
            {post.content}
          </p>
        )}
        {post.imageUrl && (
          // Plain img: user-uploaded content served from /uploads at runtime.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.imageUrl}
            alt="Post attachment"
            loading="lazy"
            className="mt-2 max-h-[32rem] w-full rounded-xl border border-black/10 object-cover dark:border-white/10"
          />
        )}
      </div>
    </article>
  );
}

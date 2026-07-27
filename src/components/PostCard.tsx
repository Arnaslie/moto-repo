import type { Post } from "@/lib/types";
import { timeAgo } from "@/lib/format";

// A subtle deterministic accent color per author, so avatars feel distinct.
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

  return (
    <article className="flex gap-3 border-b border-black/10 px-4 py-4 dark:border-white/10">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColor(
          post.author,
        )}`}
        aria-hidden
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-semibold">@{post.author}</span>
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

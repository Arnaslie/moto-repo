import { prisma } from "@/lib/prisma";
import { Feed } from "@/components/Feed";
import { SiteHeader } from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/session";
import type { Post } from "@/lib/types";

// Always render fresh from the database.
export const dynamic = "force-dynamic";

export default async function Home() {
  const rows = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
  });

  const initialPosts: Post[] = rows.map((p) => ({
    id: p.id,
    author: p.author,
    content: p.content,
    createdAt: p.createdAt.toISOString(),
  }));

  const user = await getCurrentUser();
  const headerUser = user ? { handle: user.handle, displayName: user.displayName } : null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl border-x border-black/10 dark:border-white/10">
      <SiteHeader user={headerUser} />
      <Feed initialPosts={initialPosts} currentUser={user ? { handle: user.handle } : null} />
    </main>
  );
}

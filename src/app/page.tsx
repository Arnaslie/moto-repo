import { prisma } from "@/lib/prisma";
import { Feed } from "@/components/Feed";
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

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl border-x border-black/10 dark:border-white/10">
      <header className="sticky top-0 z-10 border-b border-black/10 bg-background/80 px-4 py-3 backdrop-blur dark:border-white/10">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <span aria-hidden>🏍️</span>
          moto<span className="text-orange-500">repo</span>
        </h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          The feed for riders &amp; wrenches
        </p>
      </header>
      <Feed initialPosts={initialPosts} />
    </main>
  );
}

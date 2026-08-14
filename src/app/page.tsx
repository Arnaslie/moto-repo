import { prisma } from "@/lib/prisma";
import { Feed } from "@/components/Feed";
import { SiteHeader } from "@/components/SiteHeader";
import { getCurrentUser, getWaveViewer } from "@/lib/session";
import { postInclude, serializePost } from "@/lib/posts";
import { blobUploadsEnabled } from "@/lib/uploads";

// Always render fresh from the database.
export const dynamic = "force-dynamic";

export default async function Home() {
  // The viewer comes first: which posts they've already waved at is part of the
  // feed query, not something the client patches in afterwards.
  const user = await getCurrentUser();

  const rows = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    include: postInclude(await getWaveViewer(user)),
  });

  const initialPosts = rows.map(serializePost);

  const headerUser = user ? { handle: user.handle, displayName: user.displayName } : null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl border-x border-black/10 dark:border-white/10">
      <SiteHeader user={headerUser} />
      <Feed
        initialPosts={initialPosts}
        currentUser={user ? { handle: user.handle } : null}
        blobUploads={blobUploadsEnabled()}
      />
    </main>
  );
}

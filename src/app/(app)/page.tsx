import { prisma } from "@/lib/prisma";
import { Feed } from "@/components/Feed";
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

  return (
    <Feed
      initialPosts={initialPosts}
      currentUser={user ? { handle: user.handle } : null}
      blobUploads={blobUploadsEnabled()}
    />
  );
}

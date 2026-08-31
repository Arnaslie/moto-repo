import { prisma } from "@/lib/prisma";
import { Feed } from "@/components/Feed";
import { getCurrentUser, getWaveViewer } from "@/lib/session";
import { postInclude, serializePost } from "@/lib/posts";
import { blobUploadsEnabled } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Which posts the viewer has waved at is part of the feed query below, not
  // something the client patches in afterwards.
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

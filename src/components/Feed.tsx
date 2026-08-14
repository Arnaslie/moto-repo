"use client";

import { useState } from "react";
import type { Post } from "@/lib/types";
import { Composer } from "./Composer";
import { PostCard } from "./PostCard";

export function Feed({
  initialPosts,
  currentUser,
  blobUploads,
}: {
  initialPosts: Post[];
  currentUser: { handle: string } | null;
  // Which upload backend is live, decided on the server at request time so it
  // isn't frozen into the build the way a NEXT_PUBLIC_ var would be.
  blobUploads: boolean;
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);

  function handlePosted(post: Post) {
    setPosts((prev) => [post, ...prev]);
  }

  return (
    <div>
      <Composer
        onPosted={handlePosted}
        currentUser={currentUser}
        blobUploads={blobUploads}
      />
      {posts.length === 0 ? (
        <p className="px-4 py-10 text-center text-black/40 dark:text-white/40">
          No posts yet. Be the first to share a ride.
        </p>
      ) : (
        <div>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} currentUser={currentUser} />
          ))}
        </div>
      )}
    </div>
  );
}

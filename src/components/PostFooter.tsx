"use client";

import { useId, useState } from "react";
import type { Post } from "@/lib/types";
import { CommentTicker } from "./CommentTicker";
import { WaveButton } from "./WaveButton";
import { ChatIcon } from "./icons";

// Everything below a post's text: the action row, then the comment ticker.
//
// They're one component because they share two pieces of state — whether the
// thread is open, and how many comments there are. The count lives up here so
// that posting a comment in the thread moves the number in the action row.
export function PostFooter({
  post,
  currentUser,
}: {
  post: Post;
  currentUser: { handle: string } | null;
}) {
  const threadId = useId();
  const [expanded, setExpanded] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount);

  return (
    <>
      {/* Indented to line up with the post's text, not its avatar. */}
      <div className="flex items-center gap-1 pb-2 pl-[68px] pr-4">
        <WaveButton
          postId={post.id}
          waveCount={post.waveCount}
          waved={post.waved}
          currentUser={currentUser}
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={threadId}
          aria-label={`${commentCount} ${
            commentCount === 1 ? "comment" : "comments"
          } — ${expanded ? "hide" : "show"} thread`}
          className="flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm tabular-nums text-black/60 transition-colors hover:bg-orange-500/10 hover:text-orange-500 dark:text-white/60"
        >
          <ChatIcon size={20} />
          {commentCount > 0 && <span>{commentCount}</span>}
        </button>
      </div>

      <CommentTicker
        postId={post.id}
        comments={post.comments}
        commentCount={commentCount}
        onCountChange={setCommentCount}
        expanded={expanded}
        onExpandedChange={setExpanded}
        threadId={threadId}
        currentUser={currentUser}
      />
    </>
  );
}

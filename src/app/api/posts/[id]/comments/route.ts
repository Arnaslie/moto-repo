import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { commentSelect, serializeComment } from "@/lib/posts";
import { MAX_COMMENT_LENGTH } from "@/lib/comments";
import { emitComment } from "@/lib/notify";

// The feed only ships the newest handful of comments with each post, so this
// unpaginated read is what backs "load all".
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const post = await prisma.post.findUnique({ where: { id }, select: { id: true } });
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const comments = await prisma.comment.findMany({
    where: { postId: id },
    orderBy: { createdAt: "asc" },
    select: commentSelect,
  });

  return NextResponse.json({ comments: comments.map(serializeComment) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to comment." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const { content } = (body ?? {}) as { content?: unknown };
  const trimmed = typeof content === "string" ? content.trim() : "";

  if (!trimmed) {
    return NextResponse.json({ error: "Write something first." }, { status: 400 });
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json(
      { error: `Comments must be ${MAX_COMMENT_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  const { id } = await params;
  // `userId` is selected here and not in the GET above: it's the post's author,
  // which is who the notification goes to. Null on a seeded or anonymous post —
  // a post with nobody to tell.
  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  // The emit is inside the transaction: a comment that tells nobody is one the
  // author only finds by scrolling back, which is what this layer exists to stop.
  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        postId: id,
        userId: user.id,
        author: user.handle,
        content: trimmed,
      },
      select: commentSelect,
    });

    // No dedupe, unlike a wave: someone who comments three times has said
    // three things. Suppressed only for your own post, or one with no author.
    await emitComment(tx, {
      postId: id,
      postAuthorId: post.userId,
      actorId: user.id,
      commentId: created.id,
    });

    return created;
  });

  return NextResponse.json({ comment: serializeComment(comment) }, { status: 201 });
}

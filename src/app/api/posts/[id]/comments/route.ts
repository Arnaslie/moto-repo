import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { serializeComment } from "@/lib/posts";
import { MAX_COMMENT_LENGTH } from "@/lib/comments";

// The author + equipped gear each comment needs to render an Avatar.
const commentInclude = {
  user: {
    include: {
      gear: { where: { equipped: true }, include: { gearItem: true } },
    },
  },
} as const;

// GET /api/posts/[id]/comments — the full thread, oldest first. The feed only
// ships the newest handful with each post, so this backs "load all".
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
    include: commentInclude,
  });

  return NextResponse.json({ comments: comments.map(serializeComment) });
}

// POST /api/posts/[id]/comments — add a comment. Signed-in users only.
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
  const post = await prisma.post.findUnique({ where: { id }, select: { id: true } });
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const comment = await prisma.comment.create({
    data: {
      postId: id,
      userId: user.id,
      author: user.handle,
      content: trimmed,
    },
    include: commentInclude,
  });

  return NextResponse.json({ comment: serializeComment(comment) }, { status: 201 });
}

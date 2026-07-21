import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const MAX_CONTENT_LENGTH = 500;
const MAX_AUTHOR_LENGTH = 40;

// GET /api/posts — newest posts first.
export async function GET() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ posts });
}

// POST /api/posts — create a new post.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const { author, content } = (body ?? {}) as {
    author?: unknown;
    content?: unknown;
  };

  const trimmedContent = typeof content === "string" ? content.trim() : "";
  if (!trimmedContent) {
    return NextResponse.json(
      { error: "Post content is required." },
      { status: 400 },
    );
  }
  if (trimmedContent.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Post content must be ${MAX_CONTENT_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  // Signed-in posts are attributed to the account (handle wins over any
  // client-supplied author); anonymous posting still works otherwise.
  const currentUser = await getCurrentUser();
  const resolvedAuthor = currentUser
    ? currentUser.handle
    : typeof author === "string" && author.trim()
      ? author.trim().slice(0, MAX_AUTHOR_LENGTH)
      : "anonymous_rider";

  const post = await prisma.post.create({
    data: {
      author: resolvedAuthor,
      content: trimmedContent,
      userId: currentUser?.id ?? null,
    },
  });

  return NextResponse.json({ post }, { status: 201 });
}

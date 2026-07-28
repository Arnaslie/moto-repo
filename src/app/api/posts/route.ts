import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isValidUploadUrl } from "@/lib/uploads";
import { postInclude, serializePost } from "@/lib/posts";

const MAX_CONTENT_LENGTH = 500;
const MAX_AUTHOR_LENGTH = 40;

// GET /api/posts — newest posts first.
export async function GET() {
  const rows = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    include: postInclude,
  });
  return NextResponse.json({ posts: rows.map(serializePost) });
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

  const { author, content, imageUrl } = (body ?? {}) as {
    author?: unknown;
    content?: unknown;
    imageUrl?: unknown;
  };

  const trimmedContent = typeof content === "string" ? content.trim() : "";
  if (trimmedContent.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Post content must be ${MAX_CONTENT_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  const currentUser = await getCurrentUser();

  // Validate an optional attached image. Only a local /uploads path (produced
  // by our own upload endpoint) is accepted, and only for signed-in users.
  let resolvedImageUrl: string | null = null;
  if (imageUrl != null && imageUrl !== "") {
    if (typeof imageUrl !== "string" || !isValidUploadUrl(imageUrl)) {
      return NextResponse.json({ error: "Invalid image reference." }, { status: 400 });
    }
    if (!currentUser) {
      return NextResponse.json(
        { error: "You must be signed in to attach an image." },
        { status: 401 },
      );
    }
    resolvedImageUrl = imageUrl;
  }

  // A post needs text, an image, or both.
  if (!trimmedContent && !resolvedImageUrl) {
    return NextResponse.json(
      { error: "Add some text or an image to post." },
      { status: 400 },
    );
  }

  // Signed-in posts are attributed to the account (handle wins over any
  // client-supplied author); anonymous posting still works otherwise.
  const resolvedAuthor = currentUser
    ? currentUser.handle
    : typeof author === "string" && author.trim()
      ? author.trim().slice(0, MAX_AUTHOR_LENGTH)
      : "anonymous_rider";

  const post = await prisma.post.create({
    data: {
      author: resolvedAuthor,
      content: trimmedContent,
      imageUrl: resolvedImageUrl,
      userId: currentUser?.id ?? null,
    },
    include: postInclude,
  });

  return NextResponse.json({ post: serializePost(post) }, { status: 201 });
}

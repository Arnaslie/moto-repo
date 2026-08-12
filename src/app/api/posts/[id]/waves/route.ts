import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Both handlers answer with the same shape so the client never has to guess at
// the result of its own optimistic update — it just adopts what came back.
async function waveState(postId: string, waved: boolean) {
  const waveCount = await prisma.wave.count({ where: { postId } });
  return NextResponse.json({ waveCount, waved });
}

// Shared guard: waving needs an account and a post that still exists.
async function resolve(postId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return {
      error: NextResponse.json(
        { error: "You must be signed in to wave." },
        { status: 401 },
      ),
    };
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true },
  });
  if (!post) {
    return { error: NextResponse.json({ error: "Post not found." }, { status: 404 }) };
  }

  return { userId: user.id };
}

// POST /api/posts/[id]/waves — wave at a post. Idempotent: waving twice leaves
// the single row from the first wave in place rather than erroring, so a double
// tap or a retried request can't inflate the count.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error, userId } = await resolve(id);
  if (error) return error;

  await prisma.wave.upsert({
    where: { postId_userId: { postId: id, userId } },
    create: { postId: id, userId },
    update: {},
  });

  return waveState(id, true);
}

// DELETE /api/posts/[id]/waves — take the wave back. Also idempotent:
// deleteMany simply matches nothing if it was already withdrawn.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error, userId } = await resolve(id);
  if (error) return error;

  await prisma.wave.deleteMany({ where: { postId: id, userId } });

  return waveState(id, false);
}

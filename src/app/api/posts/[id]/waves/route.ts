import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ensureGuestWaverId,
  getCurrentUser,
  getGuestWaverId,
} from "@/lib/session";
import { ANONYMOUS_WAVES_ENABLED } from "@/lib/waves";

// Both handlers answer with the same shape so the client never has to guess at
// the result of its own optimistic update — it just adopts what came back.
async function waveState(postId: string, waved: boolean) {
  const waveCount = await prisma.wave.count({ where: { postId } });
  return NextResponse.json({ waveCount, waved });
}

// Shared guard: waving needs a post that still exists, plus someone to pin the
// wave on. Normally that's an account; while ANONYMOUS_WAVES_ENABLED is on it
// can instead be the guest id from the visitor's cookie. `mint` says whether
// we're allowed to hand out a new one — true when they're waving, false when
// they're taking one back (no cookie means there was nothing to take back).
async function resolve(postId: string, mint: boolean) {
  const user = await getCurrentUser();

  let guestId: string | null = null;
  if (!user) {
    if (!ANONYMOUS_WAVES_ENABLED) {
      return {
        error: NextResponse.json(
          { error: "You must be signed in to wave." },
          { status: 401 },
        ),
      };
    }
    guestId = mint ? await ensureGuestWaverId() : await getGuestWaverId();
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true },
  });
  if (!post) {
    return { error: NextResponse.json({ error: "Post not found." }, { status: 404 }) };
  }

  return { userId: user?.id ?? null, guestId };
}

// POST /api/posts/[id]/waves — wave at a post. Idempotent: waving twice leaves
// the single row from the first wave in place rather than erroring, so a double
// tap or a retried request can't inflate the count.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error, userId, guestId } = await resolve(id, true);
  if (error) return error;

  // One branch per identity: each has its own unique pair, and Prisma wants the
  // matching compound key by name.
  if (userId) {
    await prisma.wave.upsert({
      where: { postId_userId: { postId: id, userId } },
      create: { postId: id, userId },
      update: {},
    });
  } else if (guestId) {
    await prisma.wave.upsert({
      where: { postId_guestId: { postId: id, guestId } },
      create: { postId: id, guestId },
      update: {},
    });
  }

  return waveState(id, true);
}

// DELETE /api/posts/[id]/waves — take the wave back. Also idempotent:
// deleteMany simply matches nothing if it was already withdrawn.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error, userId, guestId } = await resolve(id, false);
  if (error) return error;

  if (userId) {
    await prisma.wave.deleteMany({ where: { postId: id, userId } });
  } else if (guestId) {
    await prisma.wave.deleteMany({ where: { postId: id, guestId } });
  }

  return waveState(id, false);
}

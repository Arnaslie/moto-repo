import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ensureGuestWaverId,
  getCurrentUser,
  getGuestWaverId,
} from "@/lib/session";
import { ANONYMOUS_WAVES_ENABLED } from "@/lib/waves";
import { emitWave } from "@/lib/notify";

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

  // `userId` is the post's *author*, not the waver — it's who gets told. Null
  // on a seeded or anonymous post, which is a post with nobody to tell.
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, userId: true },
  });
  if (!post) {
    return { error: NextResponse.json({ error: "Post not found." }, { status: 404 }) };
  }

  return { userId: user?.id ?? null, guestId, postAuthorId: post.userId };
}

// POST /api/posts/[id]/waves — wave at a post. Idempotent: waving twice leaves
// the single row from the first wave in place rather than erroring, so a double
// tap or a retried request can't inflate the count.
//
// createMany with skipDuplicates rather than the upsert this used to do, for
// one reason: an upsert with `update: {}` succeeds identically whether it
// inserted or found a row, so the route could never tell a new wave from a
// repeat one. It didn't matter while nothing happened on a wave. Now something
// does, and `count` is the difference between telling someone once and telling
// them on every double tap.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error, userId, guestId, postAuthorId } = await resolve(id, true);
  if (error) return error;

  // One branch per identity: each has its own unique pair, and skipDuplicates
  // leans on that constraint to make the insert idempotent.
  if (userId) {
    // The wave and the notification land together or not at all. A wave that
    // rings nobody is invisible — the same reason sending a message moves the
    // thread and the unread count inside one transaction.
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.wave.createMany({
        data: [{ postId: id, userId }],
        skipDuplicates: true,
      });
      // count === 0 is a repeat tap on a wave that's already standing. Note
      // this is NOT the whole guard: un-waving deletes the row, so a re-wave
      // gets count === 1 again. emitWave carries the rule that survives that.
      if (count === 1) {
        await emitWave(tx, { postId: id, postAuthorId, actorId: userId });
      }
    });
  } else if (guestId) {
    // No transaction and no emit: a guest wave has no account behind it, and
    // both ends of a notification are accounts. The row lands, the tally
    // moves, nobody is told. One statement is atomic on its own.
    await prisma.wave.createMany({
      data: [{ postId: id, guestId }],
      skipDuplicates: true,
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

  // The notification stays. It records that someone waved, which remains true
  // — and deleting it would mean a rider could withdraw a wave from someone's
  // panel before they'd looked at it. It's also what makes the un-wave/re-wave
  // cycle silent: emitWave finds the old row and says nothing.
  if (userId) {
    await prisma.wave.deleteMany({ where: { postId: id, userId } });
  } else if (guestId) {
    await prisma.wave.deleteMany({ where: { postId: id, guestId } });
  }

  return waveState(id, false);
}

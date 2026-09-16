import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { emitWave } from "@/lib/notify";

async function waveState(postId: string, waved: boolean) {
  const waveCount = await prisma.wave.count({ where: { postId } });
  return NextResponse.json({ waveCount, waved });
}

async function resolve(postId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to wave." },
      { status: 401 },
    );
  }

  // `userId` is the post's *author*, not the waver — it's who gets told. Null
  // on a seeded or anonymous post, which is a post with nobody to tell.
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, userId: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  return { userId: user.id, postAuthorId: post.userId };
}

// Don't "simplify" the createMany back to an upsert: an upsert with
// `update: {}` succeeds identically whether it inserted or found a row, so the
// route could no longer tell a new wave from a repeat tap, and `count` below is
// the difference between telling someone once and telling them every tap.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resolved = await resolve(id);
  if (resolved instanceof NextResponse) return resolved;
  const { userId, postAuthorId } = resolved;

  // skipDuplicates leans on the per-rider unique pair in the schema; without
  // that constraint these inserts are not idempotent.
  //
  // The emit is inside the transaction: a wave that rings nobody is invisible,
  // so both land or neither does.
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

  return waveState(id, true);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resolved = await resolve(id);
  if (resolved instanceof NextResponse) return resolved;

  // The notification deliberately stays: deleting it would let a rider withdraw
  // a wave from someone's panel before they'd read it, and it is what keeps the
  // un-wave/re-wave cycle silent — emitWave finds the old row and says nothing.
  await prisma.wave.deleteMany({
    where: { postId: id, userId: resolved.userId },
  });

  return waveState(id, false);
}

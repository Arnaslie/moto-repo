import "server-only";
import type { Prisma } from "@prisma/client";

// Writing notifications (ADR 0007). The only module under src/lib that
// performs a write, which is worth a word on why it isn't inline in the two
// routes that call it: both need the same suppression rules, and a rule that
// exists in two places is a rule that drifts. The wave route in particular
// gets one that isn't obvious (see emitWave), and it would not survive being
// re-derived from scratch in the comment route six months from now.
//
// Every function here takes a transaction client rather than importing
// `prisma`. A notification that isn't written alongside the thing that caused
// it is invisible — nobody knows to look for the wave that didn't ring — so
// the caller owns the transaction and these join it. That's the same argument
// the message POST makes for its own $transaction, and it's why ADR 0007
// dropped 0001's `after()`: with a 20-second badge tick, the milliseconds
// `after()` saves buy nothing a rider can perceive, and they cost atomicity.
//
// Both ends are accounts. `actorId` is required here and NOT NULL in the
// database, so the guest-wave path can't reach this module: an anonymous wave
// writes its Wave row, moves the tally, and notifies nobody.

type Tx = Prisma.TransactionClient;

/**
 * The two rules both emitters share.
 *
 * A post with no `userId` is a seeded or anonymous one — there is nobody to
 * tell. And nobody wants telling about their own wave: the app would otherwise
 * notify you every time you waved at yourself, which is both noise and the
 * first thing anyone tries.
 */
function hasRecipient(
  postAuthorId: string | null | undefined,
  actorId: string,
): postAuthorId is string {
  return !!postAuthorId && postAuthorId !== actorId;
}

/**
 * A wave landed on someone's post.
 *
 * The dedupe here is the part worth reading. `createMany({ skipDuplicates })`
 * in the route makes *waving* idempotent — a double tap collides with
 * `@@unique([postId, userId])` and returns `count: 0`, so the caller doesn't
 * even reach this function. What it does not survive is the toggle: un-waving
 * deletes the Wave row, so a re-wave inserts cleanly, `count` is 1 again, and
 * a naive emit rings the same rider a second time. Toggle it ten times and you
 * have rung it ten.
 *
 * The wave row is *state*; the notification is an *event*. Deleting the state
 * doesn't delete the event, so the state can't be the dedupe key across a
 * delete. The key is the notification itself: one wave notification per
 * (recipient, actor, post), ever, read or unread, whether or not the wave is
 * currently standing.
 *
 * Deliberately a lookup rather than a `@@unique`, because the same rule must
 * NOT apply to comments — two comments on your post are two notifications, and
 * collapsing them is grouping, which is a different feature.
 */
export async function emitWave(
  tx: Tx,
  input: { postId: string; postAuthorId: string | null; actorId: string },
): Promise<{ id: string } | null> {
  const { postId, postAuthorId, actorId } = input;
  if (!hasRecipient(postAuthorId, actorId)) return null;

  const already = await tx.notification.findFirst({
    where: { recipientId: postAuthorId, actorId, type: "wave", postId },
    select: { id: true },
  });
  if (already) return null;

  return tx.notification.create({
    data: { recipientId: postAuthorId, actorId, type: "wave", postId },
    select: { id: true },
  });
}

/**
 * A comment landed on someone's post. No dedupe: each comment is its own event,
 * and someone who comments three times has said three things.
 *
 * `commentId` is carried so a row can quote the comment it's about — a panel
 * row reading "commented on your post" with no idea which comment would send
 * the reader back to the post to find out.
 */
export async function emitComment(
  tx: Tx,
  input: {
    postId: string;
    postAuthorId: string | null;
    actorId: string;
    commentId: string;
  },
): Promise<{ id: string } | null> {
  const { postId, postAuthorId, actorId, commentId } = input;
  if (!hasRecipient(postAuthorId, actorId)) return null;

  return tx.notification.create({
    data: { recipientId: postAuthorId, actorId, type: "comment", postId, commentId },
    select: { id: true },
  });
}

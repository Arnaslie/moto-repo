import "server-only";
import type { Prisma } from "@prisma/client";

// Writing notifications. See ADR 0007.
//
// Every function takes a transaction client rather than importing `prisma`: a
// notification not written alongside the thing that caused it is invisible,
// since nobody knows to look for the wave that didn't ring. Don't move these
// writes out of the caller's transaction (0007 dropped 0001's `after()` for
// the same reason).
//
// `actorId` is NOT NULL in the database, so the guest-wave path can't reach
// this module: an anonymous wave writes its Wave row and notifies nobody.

type Tx = Prisma.TransactionClient;

/**
 * A post with no `userId` is a seeded or anonymous one — there is nobody to
 * tell. And nobody wants telling about their own wave.
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
 * The Wave row can't be the dedupe key: un-waving deletes it, so a re-wave
 * inserts cleanly past the route's `skipDuplicates` and a naive emit rings the
 * same rider again — ten toggles, ten rings. The key is this notification
 * itself: one per (recipient, actor, post), ever, read or unread, whether or
 * not the wave is currently standing.
 *
 * Deliberately a lookup rather than a `@@unique`, because the same rule must
 * NOT apply to comments — two comments on your post stay two notifications.
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
 * A comment landed on someone's post. No dedupe, unlike `emitWave`: each
 * comment is its own event. `commentId` is carried so a row can quote it.
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

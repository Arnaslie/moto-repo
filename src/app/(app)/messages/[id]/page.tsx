import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { Thread } from "@/components/messages/Thread";
import {
  conversationSelect,
  serializeConversation,
  serializeMessage,
  threadMessagesQuery,
} from "@/lib/conversations";

export const dynamic = "force-dynamic";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Carry the thread along through login, the way a room link does — a DM
  // notification will eventually land as a link into here, and dropping someone
  // on the feed instead loses what they came for.
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/messages/${id}`)}`);

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: conversationSelect,
  });

  // Not a participant reads as not found, exactly as the API answers it — a
  // distinct "you're not allowed in here" page would confirm the thread exists
  // to anyone guessing ids. See lib/thread.ts.
  const isParticipant = conversation?.participants.some((p) => p.userId === user.id);
  if (!conversation || !isParticipant) notFound();

  const messages = await prisma.message.findMany(threadMessagesQuery(id));

  return (
    <Thread
      conversation={serializeConversation(conversation, user.id)}
      initialMessages={messages.map(serializeMessage)}
      me={user.handle}
    />
  );
}

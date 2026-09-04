import { redirect } from "next/navigation";
import { Inbox } from "@/components/messages/Inbox";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { inboxQuery, serializeConversation } from "@/lib/conversations";

export const metadata = {
  title: "Messages · moto-repo",
  description: "Direct messages between riders.",
};

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fmessages");

  // Server-rendered on purpose: an empty inbox is a real state here, so a client
  // fetch's empty first paint would read as "nobody's written to you".
  const conversations = await prisma.conversation.findMany(inboxQuery(user.id));

  return (
    <Inbox
      initialConversations={conversations.map((c) => serializeConversation(c, user.id))}
      me={user.handle}
    />
  );
}

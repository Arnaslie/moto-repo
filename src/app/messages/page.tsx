import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
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
  // No signed-out view at all, unlike Comms: there's nothing here that isn't
  // somebody's private mail, so there's nothing to show a visitor.
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fmessages");

  // Server-rendered so the list is in the HTML. An inbox that arrives after a
  // client fetch flashes empty first, and an empty inbox is a real state here —
  // the flash would read as "nobody's written to you".
  const conversations = await prisma.conversation.findMany(inboxQuery(user.id));

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl border-x border-black/10 dark:border-white/10">
      <SiteHeader user={{ handle: user.handle, displayName: user.displayName }} />
      <Inbox
        initialConversations={conversations.map((c) => serializeConversation(c, user.id))}
        me={user.handle}
      />
    </main>
  );
}

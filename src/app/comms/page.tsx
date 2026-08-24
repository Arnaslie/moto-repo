import { SiteHeader } from "@/components/SiteHeader";
import { RoomDirectory } from "@/components/comms/RoomDirectory";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { liveRoomsQuery, serializeRoom } from "@/lib/rooms";

export const metadata = {
  title: "Comms · moto-repo",
  description:
    "Voice rooms for riders — maintenance, rally planning, gear. Four on the mic, everyone else listening and typing.",
};

export const dynamic = "force-dynamic";

export default async function CommsPage() {
  const user = await getCurrentUser();
  const headerUser = user ? { handle: user.handle, displayName: user.displayName } : null;

  // Rendered on the server so the directory is in the HTML — the list is the
  // whole point of the page, and a client-side fetch would show an empty shell
  // first, which reads as "nobody's talking".
  const rooms = await prisma.room.findMany(liveRoomsQuery);
  const hostedRoom = user ? rooms.find((r) => r.host.handle === user.handle) : undefined;

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl border-x border-black/10 dark:border-white/10">
      <SiteHeader user={headerUser} />
      <RoomDirectory
        initialRooms={rooms.map(serializeRoom)}
        signedIn={Boolean(user)}
        hostedRoomId={hostedRoom?.id ?? null}
      />
    </main>
  );
}

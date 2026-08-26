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

  // Rendered on the server so the directory is in the HTML — the list is the
  // whole point of the page, and a client-side fetch would show an empty shell
  // first, which reads as "nobody's talking".
  const rooms = await prisma.room.findMany(liveRoomsQuery);
  const hostedRoom = user ? rooms.find((r) => r.host.handle === user.handle) : undefined;

  return (
    <RoomDirectory
      initialRooms={rooms.map(serializeRoom)}
      signedIn={Boolean(user)}
      hostedRoomId={hostedRoom?.id ?? null}
    />
  );
}

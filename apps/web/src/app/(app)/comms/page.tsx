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

  // Server-rendered on purpose: fetched from the client, the list flashes empty
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

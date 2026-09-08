import { RidersView } from "@/components/RidersView";
import { getCurrentUser } from "@/lib/session";

export const metadata = {
  title: "Riders · moto-repo",
  description: "See which riders are out and sharing their location right now.",
};

export const dynamic = "force-dynamic";

export default async function RidersPage() {
  const user = await getCurrentUser();
  return <RidersView viewerHandle={user?.handle ?? null} />;
}

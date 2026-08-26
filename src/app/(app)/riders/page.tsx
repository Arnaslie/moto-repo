import { RidersView } from "@/components/RidersView";

export const metadata = {
  title: "Riders · moto-repo",
  description: "See which riders are out and sharing their location right now.",
};

// The map is signed-out-readable and RidersView fetches its own riders, so the
// page itself has nothing to load. The header above it is what needs the
// session now, and the layout asks for it.
export const dynamic = "force-dynamic";

export default function RidersPage() {
  return <RidersView />;
}

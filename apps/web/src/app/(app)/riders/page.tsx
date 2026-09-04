import { RidersView } from "@/components/RidersView";

export const metadata = {
  title: "Riders · moto-repo",
  description: "See which riders are out and sharing their location right now.",
};

// RidersView fetches its own riders, so this page loads nothing itself; the
// dynamic marker is here for the session the layout's header reads.
export const dynamic = "force-dynamic";

export default function RidersPage() {
  return <RidersView />;
}

import { SiteHeader } from "@/components/SiteHeader";
import { RidersView } from "@/components/RidersView";

export const metadata = {
  title: "Riders · moto-repo",
  description: "See which riders are out and sharing their location right now.",
};

export default function RidersPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-xl border-x border-black/10 dark:border-white/10">
      <SiteHeader />
      <RidersView />
    </main>
  );
}

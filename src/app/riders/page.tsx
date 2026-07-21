import { SiteHeader } from "@/components/SiteHeader";
import { RidersView } from "@/components/RidersView";
import { getCurrentUser } from "@/lib/session";

export const metadata = {
  title: "Riders · moto-repo",
  description: "See which riders are out and sharing their location right now.",
};

export const dynamic = "force-dynamic";

export default async function RidersPage() {
  const user = await getCurrentUser();
  const headerUser = user ? { handle: user.handle, displayName: user.displayName } : null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl border-x border-black/10 dark:border-white/10">
      <SiteHeader user={headerUser} />
      <RidersView />
    </main>
  );
}

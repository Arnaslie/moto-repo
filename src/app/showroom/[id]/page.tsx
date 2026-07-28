import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { SiteHeader } from "@/components/SiteHeader";
import { ShowroomStage } from "@/components/showroom/ShowroomStage";

export const dynamic = "force-dynamic";

export default async function ShowroomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const bike = await prisma.motorcycle.findUnique({
    where: { id },
    include: { user: { select: { handle: true } } },
  });
  if (!bike) notFound();

  const viewer = await getCurrentUser();
  const headerUser = viewer
    ? { handle: viewer.handle, displayName: viewer.displayName }
    : null;

  // Stable seed so the bike's paint color is consistent across visits.
  const seed = `${bike.id}:${bike.make}:${bike.model}`;

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl border-x border-black/10 dark:border-white/10">
      <SiteHeader user={headerUser} />

      <div className="border-b border-black/10 px-4 py-4 dark:border-white/10">
        <h2 className="text-xl font-bold">
          {bike.year} {bike.make} {bike.model}
        </h2>
        <p className="text-sm text-black/50 dark:text-white/50">
          {bike.nickname ? `“${bike.nickname}” · ` : ""}
          from{" "}
          <Link href={`/profile/${bike.user.handle}`} className="text-orange-500 hover:underline">
            @{bike.user.handle}
          </Link>
          &rsquo;s garage
        </p>
      </div>

      <ShowroomStage seed={seed} />
    </main>
  );
}

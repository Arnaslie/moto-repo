import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { SiteHeader } from "@/components/SiteHeader";
import { Avatar, type EquippedItem } from "@/components/Avatar";
import { AvatarCustomizer, type OwnedItem } from "@/components/AvatarCustomizer";
import { PostCard } from "@/components/PostCard";
import type { SlotKey, Rarity } from "@/lib/gear";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  const user = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    include: {
      gear: { include: { gearItem: true } },
      posts: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!user) notFound();

  const viewer = await getCurrentUser();
  const isOwner = viewer?.id === user.id;
  const headerUser = viewer
    ? { handle: viewer.handle, displayName: viewer.displayName }
    : null;

  const equipped: EquippedItem[] = user.gear
    .filter((g) => g.equipped)
    .map((g) => ({
      slot: g.gearItem.slot as SlotKey,
      asset: g.gearItem.asset,
      color: g.gearItem.color,
    }));

  const joined = user.createdAt.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl border-x border-black/10 dark:border-white/10">
      <SiteHeader user={headerUser} />

      <section className="border-b border-black/10 px-4 py-5 dark:border-white/10">
        <div className="flex items-center gap-4">
          <div className="overflow-hidden rounded-2xl ring-1 ring-black/10 dark:ring-white/10">
            <Avatar skin={user.avatarSkin} equipped={equipped} size={96} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold">
              {user.displayName ?? `@${user.handle}`}
            </h2>
            <p className="text-black/50 dark:text-white/50">@{user.handle}</p>
            <p className="mt-1 text-sm text-black/50 dark:text-white/50">
              Joined {joined} · {user.posts.length} post
              {user.posts.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        {user.bio && <p className="mt-3 whitespace-pre-wrap text-[15px]">{user.bio}</p>}
      </section>

      {isOwner && (
        <>
          <div className="px-4 pt-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
              Customize your rider
            </h3>
          </div>
          <AvatarCustomizer
            owned={user.gear.map(
              (g): OwnedItem => ({
                id: g.gearItem.id,
                slot: g.gearItem.slot as SlotKey,
                name: g.gearItem.name,
                brand: g.gearItem.brand,
                rarity: g.gearItem.rarity as Rarity,
                asset: g.gearItem.asset,
                color: g.gearItem.color,
              }),
            )}
            initialEquipped={Object.fromEntries(
              user.gear
                .filter((g) => g.equipped)
                .map((g) => [g.gearItem.slot, g.gearItem.id]),
            )}
            initialSkin={user.avatarSkin}
          />
        </>
      )}

      <div>
        {user.posts.length === 0 ? (
          <p className="px-4 py-10 text-center text-black/40 dark:text-white/40">
            No posts yet.
          </p>
        ) : (
          user.posts.map((post) => (
            <PostCard
              key={post.id}
              post={{
                id: post.id,
                author: post.author,
                content: post.content,
                imageUrl: post.imageUrl,
                createdAt: post.createdAt.toISOString(),
                // All posts here belong to this profile's user.
                avatar: { skin: user.avatarSkin, equipped },
              }}
            />
          ))
        )}
      </div>
    </main>
  );
}

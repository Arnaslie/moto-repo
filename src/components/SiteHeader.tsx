"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Drivetrain } from "./Drivetrain";
import { MessagesLink } from "./messages/MessagesLink";

export type HeaderUser = { handle: string; displayName: string | null } | null;

export function SiteHeader({ user }: { user: HeaderUser }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-[1000] border-b border-black/10 bg-background/80 px-4 py-3 backdrop-blur dark:border-white/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <span aria-hidden>🏍️</span>
            moto<span className="text-orange-500">repo</span>
          </h1>
          <p className="text-sm text-black/50 dark:text-white/50">
            The feed for riders &amp; wrenches
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm">
          {user ? (
            <>
              <MessagesLink />
              <Link
                href={`/profile/${user.handle}`}
                className="font-medium text-black/70 hover:text-orange-500 dark:text-white/70"
              >
                @{user.handle}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-black/15 px-3 py-1 font-medium transition-colors hover:border-black/30 dark:border-white/20 dark:hover:border-white/40"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-3 py-1 font-medium text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-orange-500 px-3 py-1 font-semibold text-white transition-colors hover:bg-orange-600"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
      <div className="mt-2">
        <Drivetrain handle={user?.handle ?? null} />
      </div>
    </header>
  );
}

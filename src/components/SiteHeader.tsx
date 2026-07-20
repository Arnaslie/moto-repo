"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Feed" },
  { href: "/riders", label: "Riders" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-[1000] border-b border-black/10 bg-background/80 px-4 py-3 backdrop-blur dark:border-white/10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <span aria-hidden>🏍️</span>
            moto<span className="text-orange-500">repo</span>
          </h1>
          <p className="text-sm text-black/50 dark:text-white/50">
            The feed for riders &amp; wrenches
          </p>
        </div>
      </div>
      <nav className="mt-3 flex gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-orange-500 text-white"
                  : "text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

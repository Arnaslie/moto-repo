import Link from "next/link";
import { FAMILIES, TRICKS, difficulty, type Family } from "@moto/core/tricks";

export const metadata = {
  title: "Tricks · moto-repo",
  description: "What each trick takes: the strength, the skills to learn first, and the kit to wear.",
};

export default function TricksPage() {
  return (
    <div className="px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Tricks</h1>
        <p className="mt-1 max-w-prose text-sm text-[var(--anat-note)]">
          What each trick takes before you try it: the strength, the skills underneath it, and
          the kit. Practised on closed or private ground, never on the road.
        </p>
      </header>

      {(Object.keys(FAMILIES) as Family[]).map((family) => (
        <section key={family} className="mt-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--anat-note)]">
            {FAMILIES[family]}
          </h2>
          <ul className="mt-2 divide-y divide-[var(--drive-hair)] border-y border-[var(--drive-hair)]">
            {TRICKS.filter((t) => t.family === family).map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/tricks/${t.slug}`}
                  className="flex items-baseline gap-4 py-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                >
                  <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-[var(--anat-note)]">
                    LVL {difficulty(t.slug)}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{t.name}</span>
                    <span className="block text-sm text-black/60 dark:text-white/60">{t.summary}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

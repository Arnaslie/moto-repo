"use client";

import { STRETCH_KINDS, type StretchKind, type TrendingTag } from "@moto/core/stretches";

const HOUR_MS = 60 * 60 * 1000;

const KIND_DOT: Record<StretchKind, string> = {
  surface: "bg-[var(--chalk-surface)]",
  hazard: "bg-[var(--chalk-hazard)]",
  character: "bg-[var(--chalk-character)]",
  stop: "bg-[var(--chalk-stop)]",
};

function ageOf(computedAt: string): string {
  const hours = Math.floor((Date.now() - new Date(computedAt).getTime()) / HOUR_MS);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function StretchTrends({ tags }: { tags: TrendingTag[] }) {
  if (tags.length === 0) return null;

  return (
    <div className="border-t border-black/10 px-4 py-3 dark:border-white/10">
      <p className="text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50">
        What riders call it round here
      </p>
      <ul className="mt-2 space-y-1">
        {tags.map((tag) => (
          <li key={tag.slug} className="flex items-center gap-2 text-sm">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${KIND_DOT[tag.kind]}`}
              title={STRETCH_KINDS[tag.kind]?.name}
            />
            <span className="min-w-0 flex-1 truncate">{tag.label}</span>
            <span className="tabular-nums text-black/40 dark:text-white/40">
              ×{tag.count}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-black/40 dark:text-white/40">
        refreshed {ageOf(tags[0].computedAt)}
      </p>
    </div>
  );
}

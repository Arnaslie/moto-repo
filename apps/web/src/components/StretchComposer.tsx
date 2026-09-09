"use client";

import { useState } from "react";
import {
  MAX_LABEL_LENGTH,
  STRETCH_KINDS,
  STRETCH_KIND_KEYS,
  type LatLng,
  type Stretch,
  type StretchKind,
} from "@moto/core/stretches";

const DAY_MS = 24 * 60 * 60 * 1000;

function fadeHint(kind: StretchKind): string {
  const { halfLifeMs } = STRETCH_KINDS[kind];
  if (halfLifeMs === null) return "Stays until riders vote it down.";
  const days = Math.round(halfLifeMs / DAY_MS);
  const spell = days >= 300 ? "a year" : `${Math.round(days / 7)} weeks`;
  return `Fades in ~${spell} unless another rider confirms it.`;
}

export function StretchComposer({
  path,
  onCancel,
  onCreated,
}: {
  path: LatLng[];
  onCancel: () => void;
  onCreated: (stretch: Stretch) => void;
}) {
  const [kind, setKind] = useState<StretchKind>("surface");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const remaining = MAX_LABEL_LENGTH - label.length;

  async function submit() {
    if (!label.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/stretches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, label, path }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save that.");
        return;
      }
      onCreated(data.stretch);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-black/10 px-4 py-4 dark:border-white/10">
      <p className="text-sm font-semibold">Chalk this stretch</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {STRETCH_KIND_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setKind(key)}
            aria-pressed={kind === key}
            title={STRETCH_KINDS[key].hint}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              kind === key
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-black/15 text-black/70 hover:border-orange-500 dark:border-white/20 dark:text-white/70"
            }`}
          >
            {STRETCH_KINDS[key].name}
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-black/50 dark:text-white/50">
        {STRETCH_KINDS[kind].hint}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, MAX_LABEL_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
          placeholder="gravel after the bridge"
          className="min-w-0 flex-1 rounded-full border border-black/15 bg-transparent px-4 py-2 text-sm outline-none focus:border-orange-500 dark:border-white/20"
        />
        <span
          className={`text-xs tabular-nums ${
            remaining <= 5 ? "text-orange-500" : "text-black/40 dark:text-white/40"
          }`}
        >
          {remaining}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={!label.trim() || saving}
          className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Chalk it"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold transition-colors hover:border-black/30 dark:border-white/20 dark:hover:border-white/40"
        >
          Cancel
        </button>
      </div>

      <p className="mt-2 text-xs text-black/50 dark:text-white/50">
        {error ?? `${path.length} points · ${fadeHint(kind)}`}
      </p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { CONTROLS, type Trick } from "@moto/core/tricks";
import { BikeSkeleton } from "@/components/anatomy/BikeSkeleton";

const BEAT_MS = 1800;

export function TrickSequence({ sequence }: { sequence: Trick["sequence"] }) {
  const [beat, setBeat] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setBeat((b) => (b + 1) % sequence.length), BEAT_MS);
    return () => clearInterval(id);
  }, [playing, sequence.length]);

  const current = sequence[beat];
  const pitches = sequence.map((b) => b.pitch ?? 0);
  const lift = pitches.some((p) => p > 0) ? "rear" : pitches.some((p) => p < 0) ? "front" : "level";

  return (
    <div>
      <BikeSkeleton
        pose={{ pitch: current.pitch ?? 0, dive: current.dive ?? 0, motion: current.motion }}
        lit={current.inputs.map((i) => i.control)}
        lift={lift}
      />

      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        className="mt-2 rounded-full border border-[var(--drive-hair)] px-3 py-1 text-sm"
      >
        {playing ? "Pause" : "Play"}
      </button>

      <ol className="mt-3 divide-y divide-[var(--drive-hair)] border-y border-[var(--drive-hair)]">
        {sequence.map((b, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => {
                setBeat(i);
                setPlaying(false);
              }}
              aria-current={i === beat ? "step" : undefined}
              className={`grid w-full grid-cols-[1.5rem_1fr] gap-x-3 py-2 text-left text-sm transition-opacity ${
                i === beat ? "" : "opacity-45 hover:opacity-80"
              }`}
            >
              <span className={`font-mono tabular-nums ${i === beat ? "text-[var(--anat-line)]" : ""}`}>
                {i + 1}
              </span>
              <span>
                {b.inputs.map((input) => (
                  <span key={input.control} className="block">
                    <span className="font-semibold">{CONTROLS[input.control].by}</span>
                    {" · "}
                    {CONTROLS[input.control].name}: {input.action}
                  </span>
                ))}
                <span className="mt-0.5 block text-[var(--anat-note)]">{b.bike}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

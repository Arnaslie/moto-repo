"use client";

import { useRef, useState } from "react";
import {
  SHOT_KINDS,
  combine,
  inseamFromMarks,
  RETAKE_SPREAD_MM,
  type Mark,
  type PhotoMarks,
  type ShotKind,
} from "@/lib/measure";
import { inchesToMm, mmToInches } from "@/lib/fit";

/**
 * Three photos, marked by hand, measured in the browser.
 *
 * The images are held as object URLs and read by this component alone. Nothing
 * is uploaded, nothing is written to Blob or disk, and the only value that ever
 * crosses the network is the millimetre figure at the end (ADR 0006). A
 * full-body photo of a rider is the most sensitive thing this app would touch,
 * and the right amount of it to retain is none.
 */

const STEPS = [
  { key: "head", label: "top of the head" },
  { key: "crotch", label: "crotch" },
  { key: "floor", label: "floor at the feet" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

type Shot = {
  url: string | null;
  marks: Partial<Record<StepKey, Mark>>;
};

const emptyShot = (): Shot => ({ url: null, marks: {} });

export function PhotoMeasure({
  onMeasured,
  busy,
}: {
  onMeasured: (inseamMm: number, spreadMm: number) => void;
  busy: boolean;
}) {
  const [heightIn, setHeightIn] = useState("");
  const [shots, setShots] = useState<Record<ShotKind, Shot>>({
    side: emptyShot(),
    front: emptyShot(),
    farFront: emptyShot(),
  });
  const [active, setActive] = useState<ShotKind>("side");

  const heightMm = inchesToMm(Number(heightIn));
  const heightOk = Number.isFinite(heightMm) && heightMm >= 1200 && heightMm <= 2200;

  const estimates = SHOT_KINDS.map(({ key }) => {
    const shot = shots[key];
    const { head, crotch, floor } = shot.marks;
    if (!heightOk || !head || !crotch || !floor) return null;
    return inseamFromMarks({ head, crotch, floor } as PhotoMarks, heightMm);
  });

  const result = combine(estimates);
  const complete = result?.used === 3;
  const retake = result != null && result.spreadMm > RETAKE_SPREAD_MM;

  function setPhoto(kind: ShotKind, file: File | null) {
    setShots((prev) => {
      const old = prev[kind].url;
      if (old) URL.revokeObjectURL(old);
      return {
        ...prev,
        // A new photo invalidates the marks that were made on the old one.
        [kind]: { url: file ? URL.createObjectURL(file) : null, marks: {} },
      };
    });
  }

  function nextStep(kind: ShotKind): StepKey | null {
    const marks = shots[kind].marks;
    return STEPS.find((s) => !marks[s.key])?.key ?? null;
  }

  function mark(kind: ShotKind, point: Mark) {
    const step = nextStep(kind);
    if (!step) return;
    setShots((prev) => ({
      ...prev,
      [kind]: { ...prev[kind], marks: { ...prev[kind].marks, [step]: point } },
    }));
  }

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="fit-height"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50"
        >
          Your height
        </label>
        <div className="flex items-center gap-2">
          <input
            id="fit-height"
            type="number"
            inputMode="decimal"
            step="0.5"
            value={heightIn}
            onChange={(e) => setHeightIn(e.target.value)}
            placeholder="68"
            className="w-28 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm tabular-nums outline-none focus:border-orange-500 dark:border-white/15"
          />
          <span className="text-sm text-black/50 dark:text-white/50">inches</span>
        </div>
        <p className="mt-1.5 text-xs text-black/50 dark:text-white/50">
          A photo has no scale of its own. Your height is what turns pixels into
          millimetres — it isn&rsquo;t stored.
        </p>
      </div>

      <div className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2.5 text-xs leading-relaxed text-black/60 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/60">
        <p className="mb-1 font-semibold text-black/70 dark:text-white/70">Before you shoot</p>
        <ul className="list-disc space-y-0.5 pl-4">
          <li>
            <strong>Camera at hip height.</strong> Held at eye level and angled down, it
            shortens your legs — the biggest error there is.
          </li>
          <li>Barefoot or socks. Boots get counted later, on the bike&rsquo;s side.</li>
          <li>Stand straight, feet together, whole body in frame.</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SHOT_KINDS.map(({ key, label }) => {
          const done = STEPS.every((s) => shots[key].marks[s.key]);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={`min-w-[6.5rem] flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                active === key
                  ? "border-orange-500 text-orange-600 dark:text-orange-400"
                  : "border-black/10 text-black/60 dark:border-white/10 dark:text-white/60"
              }`}
            >
              {label}
              {done ? " ✓" : ""}
            </button>
          );
        })}
      </div>

      <ShotPane
        kind={active}
        shot={shots[active]}
        step={nextStep(active)}
        estimate={estimates[SHOT_KINDS.findIndex((s) => s.key === active)]}
        onPhoto={(f) => setPhoto(active, f)}
        onMark={(p) => mark(active, p)}
        onReset={() => setShots((prev) => ({ ...prev, [active]: { ...prev[active], marks: {} } }))}
      />

      {result && (
        <div
          className={`rounded-lg border px-3 py-2.5 text-sm ${
            retake
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-black/10 dark:border-white/10"
          }`}
        >
          <p className="tabular-nums">
            <strong>{mmToInches(result.inseamMm).toFixed(1)}in</strong>{" "}
            <span className="text-black/50 dark:text-white/50">
              ({result.inseamMm}mm) ±{result.spreadMm}mm from {result.used} of 3
            </span>
          </p>
          {retake && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">
              Those three don&rsquo;t agree. Usually the camera height changed between
              shots — worth retaking before trusting this.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={!complete || busy}
        onClick={() => result && onMeasured(result.inseamMm, result.spreadMm)}
        className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-40"
      >
        {complete ? "Save this measurement" : `Mark all three shots (${result?.used ?? 0}/3)`}
      </button>
    </div>
  );
}

function ShotPane({
  kind,
  shot,
  step,
  estimate,
  onPhoto,
  onMark,
  onReset,
}: {
  kind: ShotKind;
  shot: Shot;
  step: StepKey | null;
  estimate: number | null;
  onPhoto: (file: File | null) => void;
  onMark: (point: Mark) => void;
  onReset: () => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const hint = SHOT_KINDS.find((s) => s.key === kind)!.hint;

  function handleClick(e: React.MouseEvent<HTMLImageElement>) {
    const el = imgRef.current;
    if (!el || !step) return;
    const r = el.getBoundingClientRect();
    onMark({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  }

  return (
    <div>
      <p className="mb-2 text-xs text-black/50 dark:text-white/50">{hint}</p>

      {!shot.url ? (
        <label className="flex h-40 cursor-pointer items-center justify-center rounded-lg border border-dashed border-black/20 text-sm text-black/50 dark:border-white/20 dark:text-white/50">
          Choose or take a photo
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
      ) : (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={shot.url}
              alt=""
              onClick={handleClick}
              className={`max-h-[420px] w-full object-contain ${step ? "cursor-crosshair" : ""}`}
            />
            {STEPS.map((s) => {
              const m = shot.marks[s.key];
              if (!m) return null;
              return (
                <span
                  key={s.key}
                  className="pointer-events-none absolute -ml-2 -mt-2 h-4 w-4 rounded-full border-2 border-orange-500 bg-orange-500/25"
                  style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-black/60 dark:text-white/60">
              {step ? (
                <>
                  Tap the <strong>{STEPS.find((s) => s.key === step)!.label}</strong>
                </>
              ) : estimate ? (
                <span className="tabular-nums">
                  This shot: {mmToInches(estimate).toFixed(1)}in ({estimate}mm)
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-500">
                  Those marks don&rsquo;t make sense — reset and try again.
                </span>
              )}
            </span>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={onReset} className="underline underline-offset-2">
                Reset marks
              </button>
              <label className="cursor-pointer underline underline-offset-2">
                Replace
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

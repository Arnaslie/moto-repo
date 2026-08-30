"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BIKE_CATALOG,
  SAG_DEFAULTS_MM,
  SPLAY_PENALTY_MM,
  bikeLabel,
  type BikeSpec,
} from "@/lib/bikes";
import {
  fitFor,
  reachRequiredMm,
  inchesToMm,
  mmToInches,
  SOLE_MM,
  type Footwear,
} from "@/lib/fit";
import { type Inseam } from "@/lib/inseam";
import { PhotoMeasure } from "./PhotoMeasure";

const FOOTWEAR: Array<{ key: Footwear; label: string }> = [
  { key: "bare", label: "Barefoot" },
  { key: "sneakers", label: "Sneakers" },
  { key: "boots", label: "Riding boots" },
];

export function FitView({ initialInseam }: { initialInseam: Inseam | null }) {
  const router = useRouter();
  const [inseam, setInseam] = useState(initialInseam);
  const [bikeId, setBikeId] = useState<string>(BIKE_CATALOG[0].id);
  const [footwear, setFootwear] = useState<Footwear>("boots");
  const [editing, setEditing] = useState(initialInseam == null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bike = BIKE_CATALOG.find((b) => b.id === bikeId)!;

  async function save(payload: Record<string, unknown> | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/fit/inseam", {
        method: payload ? "POST" : "DELETE",
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save.");
      setInseam(data.inseam);
      setEditing(data.inseam == null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="divide-y divide-black/10 dark:divide-white/10">
      <header className="px-4 py-4">
        <h1 className="text-lg font-semibold">Will I fit?</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Seat height on a spec sheet is measured with nobody sitting on the bike,
          and says nothing about how wide the seat is. Both of those decide whether
          you get a foot down. This works from your inseam instead.
        </p>
      </header>

      <section className="px-4 py-4">
        {inseam && !editing ? (
          <InseamSummary
            inseam={inseam}
            busy={busy}
            onEdit={() => setEditing(true)}
            onForget={() => save(null)}
          />
        ) : (
          <InseamEntry
            busy={busy}
            hasExisting={inseam != null}
            onCancel={inseam ? () => setEditing(false) : undefined}
            onSave={(payload) => save(payload)}
          />
        )}
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </section>

      <section className="px-4 py-4">
        <label
          htmlFor="fit-bike"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50"
        >
          The bike
        </label>
        <select
          id="fit-bike"
          value={bikeId}
          onChange={(e) => setBikeId(e.target.value)}
          className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-orange-500 dark:border-white/15"
        >
          {BIKE_CATALOG.map((b) => (
            <option key={b.id} value={b.id} className="bg-white dark:bg-neutral-900">
              {bikeLabel(b)} — {b.seatHeightMm}mm
            </option>
          ))}
        </select>

        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            What you&rsquo;ll be wearing
          </p>
          <div className="flex flex-wrap gap-1.5">
            {FOOTWEAR.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFootwear(f.key)}
                className={`min-w-[6.5rem] flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                  footwear === f.key
                    ? "border-orange-500 text-orange-600 dark:text-orange-400"
                    : "border-black/10 text-black/60 dark:border-white/10 dark:text-white/60"
                }`}
              >
                {f.label}
                {SOLE_MM[f.key] > 0 ? ` +${SOLE_MM[f.key]}mm` : ""}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-4">
        {inseam ? (
          <Verdict bike={bike} inseam={inseam} footwear={footwear} />
        ) : (
          <p className="text-sm text-black/50 dark:text-white/50">
            Add your inseam above and this will tell you where your feet land.
          </p>
        )}
      </section>
    </div>
  );
}

function InseamSummary({
  inseam,
  busy,
  onEdit,
  onForget,
}: {
  inseam: Inseam;
  busy: boolean;
  onEdit: () => void;
  onForget: () => void;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Your inseam
        </p>
        <p className="mt-0.5 tabular-nums">
          <strong className="text-lg">{mmToInches(inseam.inseamMm).toFixed(1)}in</strong>{" "}
          <span className="text-sm text-black/50 dark:text-white/50">
            ({inseam.inseamMm}mm)
            {inseam.inseamSource === "photo"
              ? ` from photos, ±${inseam.inseamSpreadMm ?? 0}mm`
              : " measured"}
          </span>
        </p>
        <p className="mt-1 text-xs text-black/40 dark:text-white/40">
          Private — only you can see this.
        </p>
      </div>
      <div className="flex gap-3 text-xs">
        <button type="button" onClick={onEdit} disabled={busy} className="underline underline-offset-2">
          Change
        </button>
        <button
          type="button"
          onClick={onForget}
          disabled={busy}
          className="underline underline-offset-2 text-black/50 dark:text-white/50"
        >
          Forget it
        </button>
      </div>
    </div>
  );
}

function InseamEntry({
  busy,
  hasExisting,
  onCancel,
  onSave,
}: {
  busy: boolean;
  hasExisting: boolean;
  onCancel?: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [mode, setMode] = useState<"typed" | "photo">("typed");
  const [typedIn, setTypedIn] = useState("");

  const typedMm = inchesToMm(Number(typedIn));
  const typedOk = typedIn !== "" && Number.isFinite(typedMm) && typedMm >= 500 && typedMm <= 1100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {(["typed", "photo"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                mode === m
                  ? "border-orange-500 text-orange-600 dark:text-orange-400"
                  : "border-black/10 text-black/60 dark:border-white/10 dark:text-white/60"
              }`}
            >
              {m === "typed" ? "I've measured it" : "Work it out from photos"}
            </button>
          ))}
        </div>
        {hasExisting && onCancel && (
          <button type="button" onClick={onCancel} className="text-xs underline underline-offset-2">
            Cancel
          </button>
        )}
      </div>

      {mode === "typed" ? (
        <div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              value={typedIn}
              onChange={(e) => setTypedIn(e.target.value)}
              placeholder="30"
              aria-label="Inseam in inches"
              className="w-28 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm tabular-nums outline-none focus:border-orange-500 dark:border-white/15"
            />
            <span className="text-sm text-black/50 dark:text-white/50">inches</span>
            <button
              type="button"
              disabled={!typedOk || busy}
              onClick={() => onSave({ inseamMm: typedMm, inseamSource: "typed" })}
              className="ml-auto rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-40"
            >
              Save
            </button>
          </div>
          <p className="mt-1.5 text-xs text-black/50 dark:text-white/50">
            Barefoot, back to a wall, book pulled up snug. Floor to crotch — not
            your trouser size, which is cut shorter.
          </p>
        </div>
      ) : (
        <PhotoMeasure
          busy={busy}
          onMeasured={(inseamMm, spreadMm) =>
            onSave({ inseamMm, inseamSource: "photo", inseamSpreadMm: spreadMm })
          }
        />
      )}
    </div>
  );
}

function Verdict({
  bike,
  inseam,
  footwear,
}: {
  bike: BikeSpec;
  inseam: Inseam;
  footwear: Footwear;
}) {
  const fit = fitFor(inseam.inseamMm, bike, {
    footwear,
    spreadMm: inseam.inseamSpreadMm ?? 0,
  });
  const reach = reachRequiredMm(bike);
  const sag = bike.sagMm ?? SAG_DEFAULTS_MM[bike.category];
  const splay = SPLAY_PENALTY_MM[bike.seatWidth];

  return (
    <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        {bikeLabel(bike)}
      </p>
      <p className="mt-1 text-2xl font-semibold">{fit.label}</p>

      {fit.borderline && (
        <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-500">
          This one is close enough that your measurement&rsquo;s own margin
          (±{inseam.inseamSpreadMm}mm) spans the answer. Go sit on one.
        </p>
      )}

      <dl className="mt-3 space-y-1 text-sm tabular-nums">
        <Row label="Published seat height" value={`${bike.seatHeightMm}mm`} />
        <Row label="Sinks under you" value={`−${sag}mm`} note="suspension sag" />
        {splay > 0 && (
          <Row
            label="Seat splays your legs"
            value={`+${splay}mm`}
            note={`${bike.seatWidth} at the nose`}
            emphasis={bike.seatWidth === "wide"}
          />
        )}
        <Row label="What you actually reach for" value={`${reach}mm`} strong />
        <Row
          label="Your reach"
          value={`${inseam.inseamMm + SOLE_MM[footwear]}mm`}
          note={SOLE_MM[footwear] > 0 ? `inseam + ${SOLE_MM[footwear]}mm of sole` : undefined}
        />
      </dl>

      {bike.seatWidth === "wide" && (
        <p className="mt-2 text-xs text-black/60 dark:text-white/60">
          Its {bike.seatWidth} seat costs you {splay}mm, so it rides taller than the
          {" "}{bike.seatHeightMm}mm on the spec sheet suggests.
        </p>
      )}

      <p className="mt-3 border-t border-black/10 pt-3 text-xs text-black/50 dark:border-white/10 dark:text-white/50">
        Estimated from published specs — no rider has reported on this one yet.
        Once three riders have, the answer comes from them instead.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  note,
  strong,
  emphasis,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${
        strong ? "border-t border-black/10 pt-1 font-semibold dark:border-white/10" : ""
      }`}
    >
      <dt className={emphasis ? "text-amber-700 dark:text-amber-500" : "text-black/60 dark:text-white/60"}>
        {label}
      </dt>
      <dd className={`text-right ${emphasis ? "text-amber-700 dark:text-amber-500" : ""}`}>
        {value}
        {note && (
          <span className="ml-1.5 text-xs text-black/40 dark:text-white/40">({note})</span>
        )}
      </dd>
    </div>
  );
}

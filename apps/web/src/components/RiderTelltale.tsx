"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WheelIcon } from "@/components/icons";
import { NotificationPanel } from "@/components/NotificationPanel";
import { waitingSentence } from "@moto/core/notifications";

/**
 * The wheel in the header cluster: lit when activity is waiting, with a count
 * beside it. See ADR 0007, and 0012 for the split.
 *
 * Purely the wheel now. Messages have their own instrument beside it, and the
 * poll that feeds both lives in DashCluster.
 */

export function RiderTelltale({
  handle,
  activity,
  detents,
}: {
  handle: string;
  activity: number;
  detents: number;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Escape lives here rather than in the panel because the wheel is where focus
  // goes back to, and this is what holds the ref. Outside-click stays in the
  // panel, which is the thing that knows what counts as outside.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Stable, so the panel's outside-click listener isn't torn down and rebuilt
  // on every tick.
  const close = useCallback(() => setOpen(false), []);


  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        // The wheel keeps the header's text ramp in both states. Turning the
        // whole icon orange would paint over the stripe with the colour the
        // stripe is, and the stripe is the signal.
        className="flex items-center gap-1.5 font-medium text-black/70 transition-colors hover:text-orange-500 dark:text-white/70"
      >
        <span key={detents} className={detents > 0 ? "wheel-detent" : undefined}>
          <WheelIcon lit={activity > 0} size={24} />
        </span>
        {activity > 0 && (
          <span className="text-sm font-semibold tabular-nums text-orange-500">{activity}</span>
        )}
        <span role="status" aria-live="polite" className="sr-only">
          {waitingSentence({ conversations: 0, activity })}
        </span>
      </button>

      {open && (
        <NotificationPanel handle={handle} onClose={close} />
      )}
    </div>
  );
}

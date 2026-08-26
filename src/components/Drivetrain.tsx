"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import * as D from "@/lib/drivetrain";

/* ---------------------------------------------------------------------------
   The six-speed nav.

   Two states, one component. At rest it's a gear-position readout — six dash
   tiles, 40px, out of the way while you read. Reach for it and the whole
   drivetrain drops down over the feed: cast sprockets, a chain that drives,
   and room to aim at.

   The gear numbers hold the same six columns in both states, so opening the
   nav doesn't cross-fade one thing into another — the numbers travel down and
   the parts assemble around them.

   Two notes on how it's put together:

   - React renders the structure once. Everything that moves (the open amount,
     the chain phase, the slack) is written straight onto the nodes from a
     single rAF loop. Re-rendering ~100 chain links a frame through React would
     be silly, and none of it is state anyone else needs.
   - The chain rides geometry sampled in lib/drivetrain, not a measured <path>,
     so the resting state is in the server HTML and hydration has nothing to
     disagree about.
--------------------------------------------------------------------------- */

/**
 * The draw pass has to run before the browser paints, not after.
 *
 * React owns the attributes it writes over, so on the frame a new page mounts
 * the panel is rendered at its resting height and `--grow` isn't set yet. As a
 * passive effect the correction lands one painted frame late, which is a visible
 * flick of the panel collapsing and reopening mid-shift. useLayoutEffect closes
 * that gap; the alias is so it doesn't warn while this renders on the server.
 */
const useDrawEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

type Channel = "open" | "phase" | "sag";
type Tween = { key: string; to?: number; from?: number; t0: number; ms: number; custom?: (t: number) => void };

type Rig = {
  open: number;
  phase: number;
  sag: number;
  jolt: { i: number; dy: number };
  scale: number;
  tweens: Tween[];
  raf: number;
  reduced: boolean;
  draw: (() => void) | undefined;
};

/* ---------------------------------------------------------------------------
   The animation loop. Module scope on purpose: these run from effects and
   event handlers, never during a render, and keeping them out of the component
   body keeps that guarantee honest.
--------------------------------------------------------------------------- */
function startLoop(r: Rig) {
  if (r.raf) return;
  const frame = (now: number) => {
    r.tweens = r.tweens.filter((tw) => {
      const t = Math.min(1, (now - tw.t0) / tw.ms);
      if (tw.custom) tw.custom(t);
      else r[tw.key as Channel] = lerp(tw.from!, tw.to!, easeOut(t));
      return t < 1;
    });
    r.draw?.();
    r.raf = r.tweens.length ? requestAnimationFrame(frame) : 0;
  };
  r.raf = requestAnimationFrame(frame);
}

/** Starting a tween on a channel replaces whatever was already running on it. */
function tween(r: Rig, key: Channel, to: number, ms: number) {
  r.tweens = r.tweens.filter((t) => t.key !== key);
  if (r.reduced || ms === 0) {
    r[key] = to;
    r.draw?.();
    return;
  }
  r.tweens.push({ key, from: r[key], to, t0: performance.now(), ms });
  startLoop(r);
}

function custom(r: Rig, key: string, fn: (t: number) => void, ms: number) {
  r.tweens = r.tweens.filter((t) => t.key !== key);
  r.tweens.push({ key, custom: fn, t0: performance.now(), ms });
  startLoop(r);
}

/* ---------------------------------------------------------------------------
   The shift runs before the navigation, not across it.

   This was written when every page mounted its own SiteHeader and therefore its
   own Drivetrain, so a gear click that navigated immediately unmounted the
   component the animation was running in and the chain never got to turn.
   Carrying the rig across that remount was one way out and it worked, but only
   by making the animation depend on state surviving a teardown, and on nothing
   else closing the panel in between. Something always was: the arriving page's
   scroll-to-top, for one. So a real gear was made to do what the placeholder
   gears do — run the animation in a component that is staying put — and only
   then go.

   The chrome now lives in app/(app)/layout.tsx and this component doesn't
   unmount on an in-app navigation at all, so the teardown it was avoiding no
   longer happens. The order stays: running the shift where you can see it
   finish, and navigating when it's done, is the behaviour that was wanted — it
   just no longer depends on the remount to enforce it. The panel is closed
   explicitly on the way out, which is what a layout that persists requires.
--------------------------------------------------------------------------- */

export function Drivetrain({ handle }: { handle: string | null }) {
  const pathname = usePathname();
  const gears = D.gearsFor(handle);
  const engaged = D.gearForPath(gears, pathname);

  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Everything that animates. Refs, not state: none of it drives a re-render.
  const rig = useRef<Rig>({
    open: 0,
    phase: 0,
    sag: D.SAG_DRIVE,
    jolt: { i: -1, dy: 0 },
    scale: 1,
    tweens: [],
    raf: 0,
    reduced: false,
    draw: undefined,
  });

  // The gear the chain is sitting on. Only ever differs from `engaged` between
  // a click and the navigation it defers.
  const prevGear = useRef(engaged);

  const dockRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lampRef = useRef<SVGGElement>(null);
  const chainRef = useRef<SVGGElement>(null);
  const linkRefs = useRef<(SVGGElement | null)[]>([]);
  const gearRefs = useRef<(SVGGElement | null)[]>([]);
  const spinRefs = useRef<(SVGGElement | null)[]>([]);
  const numRefs = useRef<(SVGTextElement | null)[]>([]);
  const labelRefs = useRef<(SVGTextElement | null)[]>([]);
  const tileRefs = useRef<(SVGGElement | null)[]>([]);

  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScroll = useRef(0);
  // Per-gear dimming, read by the draw pass — which owns opacity frame to
  // frame, so it can't be left to a JSX attribute.
  const dim = useRef<number[]>(gears.map(() => 1));

  /* ---------------- the draw pass ---------------- */
  useDrawEffect(() => {
    const r = rig.current;

    const draw = () => {
      const k = clamp01(r.open);

      // The panel grows over the feed; the dock keeps the resting height, so
      // opening the nav never reflows the page underneath it.
      if (panelRef.current) {
        panelRef.current.style.setProperty(
          "--grow",
          `${(D.FULL_H - D.DASH_H) * r.scale * k}px`
        );
      }

      const tileFade = clamp01(1 - k * 2.4);
      const partFade = clamp01((k - 0.18) / 0.5);
      const chainFade = clamp01((k - 0.4) / 0.45);
      const numY = lerp(D.NUM_Y_DASH, D.CY, k);
      const labelY = lerp(D.LABEL_Y_DASH, D.LABEL_Y_OPEN, k);
      const spScale = lerp(0.28, 1, k);

      if (lampRef.current) lampRef.current.style.opacity = String(tileFade);
      if (chainRef.current) chainRef.current.style.opacity = String(chainFade);

      for (let i = 0; i < D.COUNT; i++) {
        const d = dim.current[i] ?? 1;
        const tile = tileRefs.current[i];
        if (tile) tile.style.opacity = String(tileFade * d);

        const gear = gearRefs.current[i];
        if (gear) {
          gear.style.opacity = String(partFade * d);
          const dy = r.jolt.i === i ? r.jolt.dy : 0;
          gear.setAttribute(
            "transform",
            `translate(${D.cx(i)} ${D.CY + dy}) scale(${spScale.toFixed(3)})`
          );
        }

        numRefs.current[i]?.setAttribute("y", numY.toFixed(2));
        labelRefs.current[i]?.setAttribute("y", labelY.toFixed(2));
      }

      // The loop inflates: both runs start collapsed onto one line and separate
      // as the panel opens, so the chain is drawn on rather than faded on.
      const loop = D.sampleLoop(
        lerp(4, D.RADIUS, k),
        lerp(D.NUM_Y_DASH + 3, D.CY, k),
        r.sag * k
      );
      const step = loop.total / D.LINK_COUNT;
      for (let i = 0; i < D.LINK_COUNT; i++) {
        const p = D.pointAt(loop, i * step + r.phase);
        linkRefs.current[i]?.setAttribute(
          "transform",
          `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.deg.toFixed(2)})`
        );
      }

      // Every sprocket turns at the rate the chain feeds it: one pitch of
      // travel is one tooth, and its own place along the top run sets the
      // phase. Through the transform attribute, not CSS — a CSS transform on
      // an SVG group pivots about the viewBox origin, not the part.
      for (let i = 0; i < D.COUNT; i++) {
        const deg = (((r.phase + i * D.SPAN) / D.RADIUS) * 180) / Math.PI;
        spinRefs.current[i]?.setAttribute("transform", `rotate(${deg.toFixed(2)})`);
      }
    };

    r.draw = draw;
    r.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The nav scales with the column, so the panel's grown height has to as well.
    const measure = () => {
      r.scale = (dockRef.current?.clientWidth ?? D.VIEW_W) / D.VIEW_W;
      draw();
    };
    measure();

    // Unmounting cancelled the frame but left the tweens on the shared rig, so
    // a shift interrupted by a navigation is picked up here and finished.
    if (r.tweens.length) startLoop(r);

    const ro = new ResizeObserver(measure);
    if (dockRef.current) ro.observe(dockRef.current);
    return () => {
      ro.disconnect();
      if (r.raf) cancelAnimationFrame(r.raf);
      r.raf = 0;
      // This one's closure calls setOpen on a component that's going away, and
      // tweens a rig that isn't. Left running it would shut the panel the next
      // mount is meant to inherit.
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };

  }, []);

  // Re-apply the animated values after every commit. React owns the attributes
  // the draw pass writes over (the numerals' y, the panel's height variable),
  // so a re-render for any reason — a shift, a session change — snaps them back
  // to their resting values. Mid-tween the next frame hides that; at rest,
  // nothing would.
  useDrawEffect(() => {
    rig.current.draw?.();
  });

  // Signing in or out changes which gears are reachable.
  useEffect(() => {
    dim.current = D.gearsFor(handle).map((g) => (g.href === null && g.auth ? 0.5 : 1));
    rig.current.draw?.();
  }, [handle]);

  /* ---------------- open and close ---------------- */
  const setOpenTo = (want: boolean, delay = 0) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const go = () => {
      setOpen(want);
      tween(rig.current, "open", want ? 1 : 0, want ? 300 : 220);
    };
    if (delay) hoverTimer.current = setTimeout(go, delay);
    else go();
  };

  /* ---------------- shifting ----------------
     One shift, two ways in.

     `runShift` is the animation itself: the chain runs the real distance
     between two sprockets, and it returns how long that takes so the caller can
     decide what happens after. A gear click calls it and *then* navigates (see
     the Link below) — that's what keeps the whole thing inside a component
     that isn't about to be torn down.

     The effect is the other way in, for a path that changed without going
     through the click — a redirect, or moving between two pages that share a
     component so React keeps the instance. It is deliberately *not* a fallback
     for the back button: that remounts, which starts prevGear equal to the gear
     arrived at, so nothing runs. Animating an arrival you didn't ask for is the
     thing this component kept trying to do and kept getting wrong; a shift you
     watch is one you asked for. The guard is also what stops a click's own
     shift being run a second time on the far side. */
  const runShift = useCallback((to: number) => {
    const from = prevGear.current;
    prevGear.current = to;

    if (to === 0) {
      // Nothing engaged, so nothing driving: the return run goes slack.
      tween(rig.current, "sag", D.SAG_LOOSE, 420);
      tween(rig.current, "phase", rig.current.phase + 6, 420);
      return 420;
    }
    const start = from === 0 ? to : from;
    const steps = Math.abs(to - start);
    const ms = 260 + 110 * steps;
    tween(rig.current, "phase", rig.current.phase + (to - start) * D.SPAN, ms);
    tween(rig.current, "sag", D.SAG_DRIVE, 300);
    return ms;
  }, []);

  useEffect(() => {
    if (prevGear.current !== engaged) runShift(engaged);
  }, [engaged, runShift]);

  useEffect(() => {
    // Reading, not navigating. Also stops the panel flapping open under a
    // cursor that happens to be resting on it while the feed moves.
    const onScroll = () => {
      lastScroll.current = performance.now();
      if (rig.current.open > 0) setOpenTo(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && rig.current.open > 0) setOpenTo(false);
    };
    // Touch has no pointer-leave to close on, so anywhere else does it.
    const onDown = (e: PointerEvent) => {
      if (rig.current.open > 0 && !panelRef.current?.contains(e.target as Node)) {
        setOpenTo(false);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
     
  }, []);

  // A gear that isn't there: the chain takes up, shudders, and drops back. The
  // jolt goes into the rig rather than onto the node, because the draw pass
  // rewrites every sprocket transform on the same frame.
  const grind = (i: number) => {
    const r = rig.current;
    if (r.reduced) return;
    const start = r.phase;
    custom(
      r,
      "grind",
      (t) => {
        const damp = 1 - t;
        r.phase = start + Math.sin(t * Math.PI * 6) * 5 * damp;
        r.jolt = { i, dy: Math.sin(t * Math.PI * 8) * 1.6 * damp };
        if (t >= 1) {
          r.phase = start;
          r.jolt = { i: -1, dy: 0 };
        }
      },
      300
    );
  };

  const columnStyle = (i: number) => ({
    left: `${((D.cx(i) - D.SPAN / 2) / D.VIEW_W) * 100}%`,
    width: `${(D.SPAN / D.VIEW_W) * 100}%`,
  });

  const spin = D.sprocketPath();
  const windows = Array.from({ length: D.WINDOW_COUNT }, (_, w) => D.windowArc(1, w));

  // Two different kinds of unavailable, and they must not look alike: a gear
  // with no page yet is a blank waiting to be cut (dashed, unfilled), while the
  // sixth gear signed out is a finished part you just can't reach — so it stays
  // whole and is only dimmed, which `dim` above handles.
  const notBuilt = (g: D.Gear) => g.href === null && !g.auth;

  return (
    <div
      ref={dockRef}
      className="relative"
      style={{ aspectRatio: `${D.VIEW_W} / ${D.DASH_H}` }}
    >
      {/* The panel's height rides a CSS variable the draw pass writes, and it
          comes from a class rather than a style prop on purpose: React rewrites
          the whole style attribute when it re-renders, which wipes the
          variable. Mid-tween the next frame puts it back — but under
          prefers-reduced-motion there is no next frame, and the panel would
          simply never open. */}
      <nav
        ref={panelRef}
        aria-label="Pages"
        data-open={open}
        onMouseEnter={() => {
          if (performance.now() - lastScroll.current < 500) return;
          setOpenTo(true, 120);
        }}
        onMouseLeave={() => setOpenTo(false, 200)}
        onFocus={() => setOpenTo(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpenTo(false, 120);
        }}
        className="absolute inset-x-0 top-0 h-[calc(100%+var(--grow,0px))] overflow-hidden rounded-b-md bg-background transition-shadow data-[open=true]:shadow-[0_16px_38px_rgba(0,0,0,0.18)] dark:data-[open=true]:shadow-[0_16px_38px_rgba(0,0,0,0.6)]"
      >
        <svg
          viewBox={`0 0 ${D.VIEW_W} ${D.FULL_H}`}
          className="block h-auto w-full select-none"
          aria-hidden
        >
          {/* the neutral lamp — a dash fixture, unlit until you're off-route,
              sitting in the margin rather than pretending to be a seventh tab */}
          <g ref={lampRef}>
            <rect
              x={2}
              y={D.TILE_Y}
              width={19}
              height={D.TILE_H}
              rx={3}
              fill={engaged === 0 ? "var(--drive-lamp-soft)" : "none"}
              stroke={engaged === 0 ? "var(--drive-lamp)" : "var(--drive-hair)"}
              strokeWidth={1}
            />
            <text
              x={11.5}
              y={D.TILE_Y + D.TILE_H / 2}
              textAnchor="middle"
              dominantBaseline="central"
              className="font-mono text-[11px] font-bold"
              fill={engaged === 0 ? "var(--drive-lamp)" : "var(--drive-dim)"}
            >
              N
            </text>
          </g>

          {/* resting state: the dash tiles */}
          {gears.map((gear, i) => {
            const on = gear.n === engaged;
            const blank = notBuilt(gear);
            return (
              <g key={`tile-${gear.n}`} ref={(n) => void (tileRefs.current[i] = n)}>
                <rect
                  x={D.cx(i) - D.TILE_W / 2}
                  y={D.TILE_Y}
                  width={D.TILE_W}
                  height={D.TILE_H}
                  rx={3}
                  fill={on ? "var(--drive-accent-soft)" : blank ? "none" : "var(--drive-tile)"}
                  stroke={on ? "var(--drive-accent)" : blank ? "var(--drive-steel-edge)" : "none"}
                  strokeWidth={1}
                  strokeDasharray={blank ? "3 2.5" : undefined}
                />
                {on && (
                  <rect
                    x={D.cx(i) - D.TILE_W / 2}
                    y={D.TILE_Y}
                    width={D.TILE_W}
                    height={2}
                    fill="var(--drive-accent)"
                  />
                )}
              </g>
            );
          })}

          {/* open state: the sprockets */}
          {gears.map((gear, i) => {
            const on = gear.n === engaged;
            const blank = notBuilt(gear);
            return (
              <g
                key={`sprocket-${gear.n}`}
                ref={(n) => void (gearRefs.current[i] = n)}
                transform={`translate(${D.cx(i)} ${D.CY}) scale(0.28)`}
                opacity={0}
              >
                <g ref={(n) => void (spinRefs.current[i] = n)}>
                  <path
                    d={spin}
                    fill={on ? "var(--drive-accent)" : blank ? "none" : "var(--drive-steel)"}
                    stroke={on ? "var(--drive-accent-edge)" : "var(--drive-steel-edge)"}
                    strokeWidth={blank ? 1.3 : 1.1}
                    strokeDasharray={blank ? "3 2.5" : undefined}
                    strokeLinejoin="round"
                  />
                  {!blank &&
                    windows.map((d, w) => (
                      <path
                        key={w}
                        d={d}
                        fill="none"
                        stroke="var(--background)"
                        strokeWidth={D.webWidth()}
                        strokeLinecap="round"
                      />
                    ))}
                  <circle
                    r={D.HUB_R}
                    fill={blank ? "none" : on ? "var(--background)" : "var(--drive-tile)"}
                    stroke={on ? "var(--drive-accent-edge)" : "var(--drive-steel-edge)"}
                    strokeWidth={1}
                    strokeDasharray={blank ? "2.5 2.5" : undefined}
                  />
                </g>
              </g>
            );
          })}

          {/* the chain, over the parts it's driving */}
          <g ref={chainRef} opacity={0}>
            {Array.from({ length: D.LINK_COUNT }, (_, i) => {
              const outer = i % 2 === 0;
              return (
                <g key={i} ref={(n) => void (linkRefs.current[i] = n)}>
                  <path
                    d={D.platePath(outer)}
                    fill={outer ? "var(--drive-chain)" : "none"}
                    stroke="var(--drive-chain-edge)"
                    strokeWidth={outer ? 0.7 : 0.9}
                  />
                  <circle
                    r={D.ROLLER_R}
                    fill="var(--background)"
                    stroke="var(--drive-chain-edge)"
                    strokeWidth={0.9}
                  />
                  {outer && (
                    <circle
                      cx={D.PITCH}
                      r={D.ROLLER_R}
                      fill="var(--background)"
                      stroke="var(--drive-chain-edge)"
                      strokeWidth={0.9}
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* the numbers and names — the one thing both states share, so they
              travel between the two instead of being swapped out */}
          {gears.map((gear, i) => {
            const on = gear.n === engaged;
            const blank = gear.href === null;
            const tone = on ? "var(--drive-accent-text)" : "var(--drive-dim)";
            return (
              <g key={`text-${gear.n}`} opacity={blank ? 0.55 : 1}>
                <text
                  ref={(n) => void (numRefs.current[i] = n)}
                  x={D.cx(i)}
                  y={D.NUM_Y_DASH}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={tone}
                  className="font-mono text-[13px] font-bold tabular-nums"
                >
                  {gear.n}
                </text>
                <text
                  ref={(n) => void (labelRefs.current[i] = n)}
                  x={D.cx(i)}
                  y={D.LABEL_Y_DASH}
                  textAnchor="middle"
                  fill={tone}
                  className="text-[10px] font-semibold uppercase tracking-wider"
                >
                  {gear.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hit targets are real anchors laid over the art, so the gears
            prefetch, open in a new tab, and read as links — none of which an
            SVG rect with a click handler would do. */}
        {gears.map((gear, i) => {
          const label = `Gear ${gear.n}, ${gear.label}`;
          const common = "absolute top-0 bottom-0 rounded focus-visible:outline-2 focus-visible:outline-orange-500";

          if (gear.href) {
            return (
              <Link
                key={gear.n}
                href={gear.href}
                aria-label={label}
                aria-current={gear.n === engaged ? "page" : undefined}
                className={common}
                style={columnStyle(i)}
                onClick={(e) => {
                  // No hover to open with, so on a touch screen the first tap
                  // opens the panel and the second picks a gear — 40px is too
                  // tight to aim at once.
                  if (window.matchMedia("(hover: none)").matches && rig.current.open < 0.5) {
                    e.preventDefault();
                    setOpenTo(true);
                    return;
                  }

                  // A modified click is someone opening the page in a tab or
                  // a window, which is half of why these are links at all.
                  // Nothing is about to unmount, so there's nothing to defer.
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

                  // Nothing to watch: the panel is shut, or you picked the
                  // gear you're already in. Let the Link do what a link does.
                  if (rig.current.open <= 0 || rig.current.reduced || gear.n === engaged) {
                    setOpenTo(false, 380);
                    return;
                  }

                  // Otherwise hold the navigation open just long enough to run
                  // the shift in front of you. `prefetch` means the page is
                  // usually already sitting there when the chain stops, so what
                  // this costs is the animation and nothing else.
                  e.preventDefault();
                  const ms = runShift(gear.n);
                  setOpenTo(false, ms);
                  window.setTimeout(() => router.push(gear.href!), ms + 90);
                }}
              />
            );
          }

          // Signed out, the sixth gear is real but locked: send them to log in
          // rather than grinding at them, which is what the wave button does.
          if (gear.auth) {
            return (
              <Link
                key={gear.n}
                href="/login"
                aria-label={`${label} — log in first`}
                className={common}
                style={columnStyle(i)}
                onClick={() => setOpenTo(false, 380)}
              />
            );
          }

          return (
            <button
              key={gear.n}
              type="button"
              aria-label={`${label} — not built yet`}
              aria-disabled
              className={`${common} cursor-not-allowed`}
              style={columnStyle(i)}
              onClick={() => grind(i)}
            />
          );
        })}
      </nav>
    </div>
  );
}

// Drivetrain geometry for the six-speed nav. Keep it free of React/Next
// imports: the nav renders its resting state in the HTML, before any JS runs.
//
// The chain pitch is the only number picked by eye. Deriving the pitch radius
// from the pitch and the tooth count (rather than the other way round) is what
// makes the rollers seat in the valleys instead of near them.

export const PITCH = 10.5; // distance between roller centres
export const TEETH = 13; // per sprocket
export const RADIUS = (TEETH * PITCH) / (2 * Math.PI); // ≈ 21.7
export const ROOT = RADIUS - 2.9; // bottom of the roller seat
export const TIP = RADIUS + 2.9; // tooth tip, just inside the plate edge, so
//                                  the chain covers the teeth it sits on
export const SPAN = 8 * PITCH; // 84 — a whole number of pitches between centres
export const COUNT = 6;

export const VIEW_W = 544; // the app column, less the header's padding
const CX0 = (VIEW_W - SPAN * (COUNT - 1)) / 2;

/** Centre of gear `i`, in view units. */
export const cx = (i: number) => CX0 + i * SPAN;

// Resting state — the dash.
export const DASH_H = 40;
export const TILE_Y = 4;
export const TILE_H = 32;
export const TILE_W = 74;
export const NUM_Y_DASH = 15;
export const LABEL_Y_DASH = 31;

// Open state — the drivetrain.
export const CY = 40;
export const LABEL_Y_OPEN = CY + RADIUS + 28; // clear of the chain at full slack
export const FULL_H = LABEL_Y_OPEN + 8;

export const SAG_DRIVE = 7; // slack on the return run while a gear is driving
export const SAG_LOOSE = 12; // ...and with nothing engaged

/**
 * The tooth profile is sampled, not drawn: radius as a function of position
 * within one tooth pitch. The smoothstep is what gives flat-bottomed valleys
 * and flat tips; a plain cosine gives pointed spikes — that's a gear, not a
 * sprocket.
 *
 * u = 0 sits at the centre of a roller seat, so a valley points straight up
 * when the sprocket is at angle 0.
 */
export function sprocketPath(scale = 1, steps = 20): string {
  const rRoot = ROOT * scale;
  const rTip = TIP * scale;
  const pts: string[] = [];
  for (let t = 0; t < TEETH; t++) {
    for (let s = 0; s < steps; s++) {
      const u = s / steps;
      const base = (1 - Math.cos(2 * Math.PI * u)) / 2;
      const k = Math.min(1, Math.max(0, (base - 0.22) / 0.56));
      const lift = k * k * (3 - 2 * k);
      const rad = rRoot + (rTip - rRoot) * lift;
      const a = ((t + u) / TEETH) * Math.PI * 2 - Math.PI / 2;
      pts.push(`${(Math.cos(a) * rad).toFixed(2)},${(Math.sin(a) * rad).toFixed(2)}`);
    }
  }
  return `M${pts.join("L")}Z`;
}

/**
 * A lightening window. Only reads as a kidney hole when stroked at `webWidth`
 * with round caps — it is an arc, not an outline.
 */
export function windowArc(scale: number, index: number): string {
  const rMid = ((ROOT + 10.5) / 2) * scale;
  const a0 = (index / 5) * Math.PI * 2 + 0.3;
  const a1 = ((index + 1) / 5) * Math.PI * 2 - 0.3;
  const p = (a: number) => `${(Math.cos(a) * rMid).toFixed(2)},${(Math.sin(a) * rMid).toFixed(2)}`;
  return `M${p(a0)} A${rMid.toFixed(2)},${rMid.toFixed(2)} 0 0,1 ${p(a1)}`;
}

/** Stroke width of the web the windows are punched through. */
export const webWidth = (scale = 1) => (ROOT * scale - 11 * scale) * 0.62;

export const WINDOW_COUNT = 5;
export const HUB_R = 9.6;

/**
 * One chain link, from its roller to the next. Callers must alternate outer and
 * inner plates, as a real chain does.
 */
export function platePath(outer: boolean, scale = 1): string {
  const ro = (outer ? 3.1 : 2.4) * scale;
  const waist = (outer ? 2.1 : 1.6) * scale;
  const p = PITCH * scale;
  return (
    `M0,${-ro} Q${p / 2},${-waist} ${p},${-ro} A${ro},${ro} 0 0,1 ${p},${ro} ` +
    `Q${p / 2},${waist} 0,${ro} A${ro},${ro} 0 0,1 0,${-ro} Z`
  );
}

export const ROLLER_R = 1.85;

/* ---------------------------------------------------------------------------
   The chain loop.

   Sampled into a polyline rather than measured off a rendered <path>: no
   getTotalLength, no layout read, so the same numbers come out on the server
   and in the browser and there is no hydration mismatch.
--------------------------------------------------------------------------- */

export type Loop = { xs: number[]; ys: number[]; cum: number[]; total: number };

const ARC_STEPS = 22;
const SAG_STEPS = 40;

export function sampleLoop(rr: number, cy: number, sag: number): Loop {
  const left = cx(0);
  const right = cx(COUNT - 1);
  const mid = (left + right) / 2;
  const xs: number[] = [];
  const ys: number[] = [];
  const push = (x: number, y: number) => {
    xs.push(x);
    ys.push(y);
  };

  // taut top run, driving every sprocket
  push(left, cy - rr);
  push(right, cy - rr);

  // wrap the last sprocket, top to bottom
  for (let i = 1; i <= ARC_STEPS; i++) {
    const a = -Math.PI / 2 + (i / ARC_STEPS) * Math.PI;
    push(right + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }

  // the return run, hanging
  for (let i = 1; i <= SAG_STEPS; i++) {
    const t = i / SAG_STEPS;
    const u = 1 - t;
    push(
      u * u * right + 2 * u * t * mid + t * t * left,
      u * u * (cy + rr) + 2 * u * t * (cy + rr + sag * 2) + t * t * (cy + rr)
    );
  }

  // wrap the first sprocket, bottom to top, closing the loop
  for (let i = 1; i < ARC_STEPS; i++) {
    const a = Math.PI / 2 + (i / ARC_STEPS) * Math.PI;
    push(left + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }

  const cum = [0];
  for (let i = 1; i < xs.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
  }
  const total = cum[cum.length - 1] + Math.hypot(xs[0] - xs[xs.length - 1], ys[0] - ys[ys.length - 1]);
  return { xs, ys, cum, total };
}

export type LoopPoint = { x: number; y: number; deg: number };

/** Point and heading at arc length `s` along the loop, wrapping past the end. */
export function pointAt(loop: Loop, s: number): LoopPoint {
  const { xs, ys, cum, total } = loop;
  const d = ((s % total) + total) % total;
  const n = xs.length;

  // binary search for the segment holding `d`
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi - 1) {
    const m = (lo + hi) >> 1;
    if (cum[m] <= d) lo = m;
    else hi = m;
  }

  const i = lo;
  const j = (i + 1) % n;
  const segStart = cum[i];
  const segEnd = i + 1 < cum.length ? cum[i + 1] : total;
  const t = segEnd > segStart ? (d - segStart) / (segEnd - segStart) : 0;
  const dx = xs[j] - xs[i];
  const dy = ys[j] - ys[i];
  return {
    x: xs[i] + dx * t,
    y: ys[i] + dy * t,
    deg: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

/**
 * Fixed at what the fully open loop needs, so opening and closing never rebuilds
 * the chain — the links ride a shorter path and bunch up while it inflates.
 */
export const LINK_COUNT = Math.round(sampleLoop(RADIUS, CY, SAG_DRIVE).total / PITCH);

export type Gear = {
  n: number;
  label: string;
  /** null until the page exists — the nav shows it as a blank waiting to be cut. */
  href: string | null;
  /** Needs a session; signed out, the gear sends you to log in instead. */
  auth?: boolean;
};

/**
 * The order is deliberate and written down nowhere else — there is no ADR for
 * the gearbox. First is where you pull away, so it's the feed. Fifth is Comms,
 * because an intercom is what you're in once you've stopped moving. Sixth is
 * the cruising gear, so it's you.
 *
 * Gear 3 is Fit (ADR 0006) and gear 4 is Anatomy (ADR 0008); Garage is still
 * unplaced and has no blank left to take.
 */
export function gearsFor(handle: string | null): Gear[] {
  return [
    { n: 1, label: "Feed", href: "/" },
    { n: 2, label: "Riders", href: "/riders" },
    { n: 3, label: "Fit", href: "/fit" },
    { n: 4, label: "Anatomy", href: "/anatomy" },
    { n: 5, label: "Comms", href: "/comms" },
    { n: 6, label: "Profile", href: handle ? `/profile/${handle}` : null, auth: true },
  ];
}

/**
 * The engaged gear for a path, or 0 for neutral — anywhere outside the six.
 *
 * A page nested under a gear counts as that gear. The trailing slash is what
 * keeps it to *child* paths: without it `/` prefix-matches every route, and
 * `/profile/someone` would engage `/profile/you`.
 */
export function gearForPath(gears: Gear[], pathname: string): number {
  const engaged = gears.find(
    (g) => g.href && (g.href === pathname || pathname.startsWith(`${g.href}/`)),
  );
  return engaged?.n ?? 0;
}

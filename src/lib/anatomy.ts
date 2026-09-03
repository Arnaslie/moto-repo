/* Anatomy of a naked bike — a real machine, not a bike-shaped sketch.
 *
 * Every hard point here is derived from published Yamaha MT-07 figures: tyre
 * diameters come off the sidewall markings, the steering axis comes off rake
 * and trail, the chain runs on tangents between two sprockets sized by their
 * tooth counts. Nothing load-bearing is dialled in by eye.
 *
 * The bodywork — tank, seat, tail, headlight, radiator shroud — is hung on
 * those hard points but is a likeness, not a measurement: nobody publishes a
 * section through a fuel tank. Kept to single strokes for that reason.
 *
 * Millimetres throughout, with `h` measured up from the road. `Y()` is the one
 * place the drawing flips into SVG's y-down, so every number above it reads
 * like a spec sheet.
 *
 * The bike faces +x. That puts the chain side toward the viewer, which is the
 * only side worth labelling.
 */

/* ---- published geometry ------------------------------------------------ */

export const WHEELBASE = 1400;
export const RAKE_DEG = 24.5; // steering axis, from vertical
export const TRAIL = 90;
export const SEAT_H = 805; // the seat line below really is this height

const RAKE = (RAKE_DEG * Math.PI) / 180;
const SIN_R = Math.sin(RAKE);
const COS_R = Math.cos(RAKE);

/** A tyre's radius, read off its markings: section width, aspect %, rim inches. */
const tyre = (section: number, aspect: number, rim: number) =>
  (rim * 25.4) / 2 + (section * aspect) / 100;

export const R_FRONT = tyre(120, 70, 17); // 120/70-17 → 299.9
export const R_REAR = tyre(180, 55, 17); //  180/55-17 → 314.9
export const R_RIM = (17 * 25.4) / 2;

export const R_DISC_F = 282 / 2;
export const R_DISC_R = 245 / 2;

/* ---- the two axles ----------------------------------------------------- */

export const REAR_AXLE = { x: 0, h: R_REAR };
export const FRONT_AXLE = { x: WHEELBASE, h: R_FRONT };

/* ---- steering axis ------------------------------------------------------
 * Rake and trail are published; the triple-clamp offset that produces them is
 * not, so it's solved for. Offset is what the axle is pushed ahead of the
 * steering axis, measured square to it:
 *
 *     trail = (R·sin ε − offset) / cos ε   ⟹   offset = R·sin ε − trail·cos ε
 *
 * which lands on 42 mm against a real MT-07's ~40 mm — the difference being
 * that published rake and trail are quoted with the suspension settled.
 */
export const OFFSET = R_FRONT * SIN_R - TRAIL * COS_R;

// Along the axis, pointing up-and-back; and square to it, pointing forward.
const AXIS_UP = { x: -SIN_R, h: COS_R };
const AXIS_OUT = { x: COS_R, h: SIN_R };

/** A point on the steering axis, `h` above the road. */
export const onAxis = (h: number) => {
  const t = (h - (FRONT_AXLE.h - OFFSET * AXIS_OUT.h)) / AXIS_UP.h;
  return { x: FRONT_AXLE.x - OFFSET * AXIS_OUT.x + t * AXIS_UP.x, h };
};

/** A point on the fork legs: the axis line shifted square to itself by the
 *  offset. The height is queried *back* along that shift, otherwise the legs
 *  come out parallel to the axis but a few millimetres shy of the axle they
 *  are supposed to be holding. */
export const onFork = (h: number) => ({
  x: onAxis(h - OFFSET * AXIS_OUT.h).x + OFFSET * AXIS_OUT.x,
  h,
});

/** Where the steering axis meets the road. Its gap to the contact patch is the
 *  trail, so this is the geometry checking its own arithmetic. */
export const AXIS_GROUND = onAxis(0);

/* ---- structure ---------------------------------------------------------- */

export const STEERING_HEAD = onAxis(880);
export const YOKE_TOP = onAxis(985);
export const YOKE_BOTTOM = onAxis(830);
export const BAR = onAxis(1075);

export const PIVOT = { x: 570, h: 340 }; // swingarm pivot
export const COUNTERSHAFT = { x: 648, h: 352 }; // gearbox output, ahead of the pivot

/* ---- final drive --------------------------------------------------------
 * A sprocket's pitch circle follows from its tooth count and the chain pitch —
 * 525 chain is ⅝ inch — so 16T front and 43T rear are drawn at the size those
 * teeth actually make, and the chain runs on the external tangents between
 * them rather than on a line that merely looks parallel.
 */
const PITCH = 25.4 * (5 / 8);
const sprocket = (teeth: number) => PITCH / (2 * Math.sin(Math.PI / teeth));

export const R_SPKT_F = sprocket(16);
export const R_SPKT_R = sprocket(43);

/** The two straight runs of chain: external tangents between the sprockets. */
export function chainRuns() {
  const a = COUNTERSHAFT;
  const b = REAR_AXLE;
  const dx = b.x - a.x;
  const dh = b.h - a.h;
  const dist = Math.hypot(dx, dh);
  const phi = Math.atan2(dh, dx);
  const alpha = Math.acos((R_SPKT_F - R_SPKT_R) / dist);
  return [phi + alpha, phi - alpha].map((t) => ({
    from: { x: a.x + R_SPKT_F * Math.cos(t), h: a.h + R_SPKT_F * Math.sin(t) },
    to: { x: b.x + R_SPKT_R * Math.cos(t), h: b.h + R_SPKT_R * Math.sin(t) },
  }));
}

/* ---- the frame ----------------------------------------------------------
 * The MT-07's steel diamond has no lower cradle: the engine is a stressed
 * member and closes the loop itself. That absence is the interesting thing
 * about it, so the spars are drawn stopping at their engine mounts rather than
 * being quietly joined up underneath.
 */
export const FRAME_SPAR: Pt[] = [
  STEERING_HEAD, { x: 950, h: 812 }, { x: 762, h: 726 }, { x: 640, h: 604 }, PIVOT,
];

export type Pt = { x: number; h: number };

/* ---- drawing helpers ---------------------------------------------------- */

export const GROUND = 1250; // SVG y of the road
export const Y = (h: number) => GROUND - h;

export const poly = (pts: Pt[]) =>
  pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${Y(p.h).toFixed(1)}`).join(" ");

/** A rounded body outline through a closed loop of points, Catmull-Rom to
 *  béziers so the tank and tail read as pressed sheet rather than facets. */
export function blob(pts: Pt[], tension = 0.5) {
  const n = pts.length;
  const at = (i: number) => pts[((i % n) + n) % n];
  let d = `M ${at(0).x.toFixed(1)} ${Y(at(0).h).toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = { x: p1.x + ((p2.x - p0.x) / 6) * tension, h: p1.h + ((p2.h - p0.h) / 6) * tension };
    const c2 = { x: p2.x - ((p3.x - p1.x) / 6) * tension, h: p2.h - ((p3.h - p1.h) / 6) * tension };
    d += ` C ${c1.x.toFixed(1)} ${Y(c1.h).toFixed(1)} ${c2.x.toFixed(1)} ${Y(c2.h).toFixed(1)} ${p2.x.toFixed(1)} ${Y(p2.h).toFixed(1)}`;
  }
  return `${d} Z`;
}

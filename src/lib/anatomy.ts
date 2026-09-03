export type Pt = { x: number; h: number };

export const WHEELBASE = 1400;
export const RAKE_DEG = 24.5;
export const TRAIL = 90;
export const SEAT_H = 805;

const RAKE = (RAKE_DEG * Math.PI) / 180;
const SIN_R = Math.sin(RAKE);
const COS_R = Math.cos(RAKE);

const tyreRadius = (sectionMm: number, aspectPct: number, rimIn: number) =>
  (rimIn * 25.4) / 2 + (sectionMm * aspectPct) / 100;

export const R_FRONT = tyreRadius(120, 70, 17);
export const R_REAR = tyreRadius(180, 55, 17);
export const R_RIM = (17 * 25.4) / 2;

export const R_DISC_F = 282 / 2;
export const R_DISC_R = 245 / 2;

export const REAR_AXLE: Pt = { x: 0, h: R_REAR };
export const FRONT_AXLE: Pt = { x: WHEELBASE, h: R_FRONT };

const TRIPLE_CLAMP_OFFSET = R_FRONT * SIN_R - TRAIL * COS_R;

const AXIS_UP = { x: -SIN_R, h: COS_R };
const AXIS_OUT = { x: COS_R, h: SIN_R };

export const onAxis = (h: number): Pt => {
  const t = (h - (FRONT_AXLE.h - TRIPLE_CLAMP_OFFSET * AXIS_OUT.h)) / AXIS_UP.h;
  return { x: FRONT_AXLE.x - TRIPLE_CLAMP_OFFSET * AXIS_OUT.x + t * AXIS_UP.x, h };
};

// Queried back along the offset shift: onAxis(h).x + offset leaves the legs 8mm off the axle.
export const onFork = (h: number): Pt => ({
  x: onAxis(h - TRIPLE_CLAMP_OFFSET * AXIS_OUT.h).x + TRIPLE_CLAMP_OFFSET * AXIS_OUT.x,
  h,
});

export const STEERING_HEAD = onAxis(880);
export const YOKE_TOP = onAxis(985);

export const PIVOT: Pt = { x: 570, h: 340 };
export const COUNTERSHAFT: Pt = { x: 648, h: 352 };

const CHAIN_PITCH = 25.4 * (5 / 8);
const sprocketRadius = (teeth: number) => CHAIN_PITCH / (2 * Math.sin(Math.PI / teeth));

export const R_SPKT_F = sprocketRadius(16);
export const R_SPKT_R = sprocketRadius(43);

export function chainRuns() {
  const a = COUNTERSHAFT;
  const b = REAR_AXLE;
  const dist = Math.hypot(b.x - a.x, b.h - a.h);
  const phi = Math.atan2(b.h - a.h, b.x - a.x);
  const alpha = Math.acos((R_SPKT_F - R_SPKT_R) / dist);
  return [phi + alpha, phi - alpha].map((t) => ({
    from: { x: a.x + R_SPKT_F * Math.cos(t), h: a.h + R_SPKT_F * Math.sin(t) },
    to: { x: b.x + R_SPKT_R * Math.cos(t), h: b.h + R_SPKT_R * Math.sin(t) },
  }));
}

const GROUND = 1250;
export const Y = (h: number) => GROUND - h;

export const poly = (pts: Pt[]) =>
  pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${Y(p.h).toFixed(1)}`).join(" ");

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

import * as A from "@/lib/anatomy";

const { Y, poly, blob } = A;
const f = (n: number) => n.toFixed(1);

function Wheel({ at, r, phase }: { at: A.Pt; r: number; phase: number }) {
  const cx = at.x;
  const cy = Y(at.h);
  const spokes = Array.from({ length: 5 }, (_, i) => {
    const a = phase + (i * 2 * Math.PI) / 5;
    return [-0.085, 0.085].map((d) => {
      const t = a + d;
      return `M ${f(cx + 46 * Math.cos(a))} ${f(cy + 46 * Math.sin(a))} ` +
             `L ${f(cx + A.R_RIM * Math.cos(t))} ${f(cy + A.R_RIM * Math.sin(t))}`;
    }).join(" ");
  });
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} />
      <circle cx={cx} cy={cy} r={A.R_RIM} />
      <circle cx={cx} cy={cy} r={A.R_RIM - 16} />
      <circle cx={cx} cy={cy} r={46} />
      <g strokeWidth={7}>{spokes.map((d) => <path key={d} d={d} />)}</g>
    </g>
  );
}

const CHAIN = A.chainRuns()
  .map((r) => `M ${f(r.from.x)} ${f(Y(r.from.h))} L ${f(r.to.x)} ${f(Y(r.to.h))}`)
  .join(" ");

const SHOCK_TOP = { x: 628, h: 628 };
const SHOCK_BOT = { x: 536, h: 334 };

const SPRING = (() => {
  const dx = SHOCK_BOT.x - SHOCK_TOP.x;
  const dh = SHOCK_BOT.h - SHOCK_TOP.h;
  const len = Math.hypot(dx, dh);
  const ux = dx / len, uh = dh / len;
  const turns = 7;
  const w = 32;
  const pts: string[] = [];
  for (let i = 0; i <= turns * 2; i++) {
    const t = i / (turns * 2);
    const s = (i % 2 ? 1 : -1) * w;
    const x = SHOCK_TOP.x + ux * len * t - uh * s;
    const h = SHOCK_TOP.h + uh * len * t + ux * s;
    pts.push(`${i ? "L" : "M"} ${f(x)} ${f(Y(h))}`);
  }
  return pts.join(" ");
})();

const LINKAGE = poly([SHOCK_BOT, { x: 470, h: 306 }]);

const SWINGARM = poly([
  A.PIVOT, { x: 360, h: 382 }, { x: 60, h: 352 }, { x: -24, h: 330 },
  { x: 20, h: 284 }, { x: 340, h: 296 }, { x: 552, h: 290 },
]) + " Z";

const TANK = blob([
  { x: 1092, h: 838 }, { x: 1076, h: 902 }, { x: 980, h: 928 },
  { x: 850, h: 922 }, { x: 720, h: 876 }, { x: 664, h: 820 },
  { x: 730, h: 748 }, { x: 900, h: 730 }, { x: 1040, h: 756 },
]);

const SEAT = blob([
  { x: 664, h: 830 }, { x: 520, h: 812 }, { x: 370, h: 806 },
  { x: 266, h: 816 }, { x: 254, h: 772 }, { x: 400, h: 756 },
  { x: 560, h: 760 }, { x: 658, h: 776 },
]);

const TAIL = blob([
  { x: 262, h: 822 }, { x: 100, h: 856 }, { x: -90, h: 884 },
  { x: -232, h: 898 }, { x: -272, h: 862 }, { x: -220, h: 808 },
  { x: -40, h: 786 }, { x: 180, h: 774 }, { x: 258, h: 770 },
]);

const HEADLIGHT = blob([
  { x: 1160, h: 1000 }, { x: 1270, h: 986 }, { x: 1322, h: 928 },
  { x: 1300, h: 858 }, { x: 1190, h: 844 }, { x: 1136, h: 880 },
  { x: 1130, h: 950 },
], 0.4);

const SUBFRAME = poly([{ x: 652, h: 660 }, { x: 470, h: 702 }, { x: 296, h: 738 }]) +
  " " + poly([{ x: 600, h: 582 }, { x: 472, h: 700 }]);

const CASES = poly([
  { x: 600, h: 540 }, { x: 700, h: 566 }, { x: 880, h: 560 },
  { x: 975, h: 500 }, { x: 990, h: 360 }, { x: 920, h: 258 },
  { x: 760, h: 238 }, { x: 640, h: 270 }, { x: 592, h: 400 },
]) + " Z";

const BARREL = poly([
  { x: 880, h: 560 }, { x: 936, h: 706 }, { x: 1046, h: 672 }, { x: 994, h: 526 },
]);

const HEAD = poly([
  { x: 936, h: 706 }, { x: 952, h: 756 }, { x: 1078, h: 722 }, { x: 1046, h: 672 },
]) + " Z";

const RADIATOR = poly([
  { x: 1090, h: 646 }, { x: 1186, h: 620 }, { x: 1156, h: 372 }, { x: 1064, h: 398 },
]) + " Z";

const EXHAUST =
  `M 1058 ${f(Y(720))} C 1104 ${f(Y(700))} 1122 ${f(Y(674))} 1124 ${f(Y(648))} ` +
  `M 1128 ${f(Y(366))} C 1060 ${f(Y(300))} 880 ${f(Y(252))} 700 ${f(Y(236))}`;

const MUFFLER = blob([
  { x: 706, h: 250 }, { x: 640, h: 268 }, { x: 452, h: 262 },
  { x: 372, h: 228 }, { x: 400, h: 170 }, { x: 600, h: 158 },
  { x: 698, h: 196 },
], 0.4);

const FOOTPEG = poly([{ x: 702, h: 406 }, { x: 634, h: 392 }, { x: 610, h: 358 }]);

const BAR = poly([A.onAxis(1000), { x: 960, h: 1058 }, { x: 876, h: 1072 }, { x: 800, h: 1076 }]);

const yoke = (h: number, half: number) => {
  const c = A.onAxis(h);
  const nx = Math.cos((A.RAKE_DEG * Math.PI) / 180);
  const nh = Math.sin((A.RAKE_DEG * Math.PI) / 180);
  return `M ${f(c.x - nx * half * 0.55)} ${f(Y(c.h - nh * half * 0.55))} ` +
         `L ${f(c.x + nx * half)} ${f(Y(c.h + nh * half))}`;
};

const FRAME_VISIBLE = poly([
  { x: 786, h: 740 }, { x: 700, h: 692 }, { x: 640, h: 604 }, A.PIVOT,
]);

const FORK_SLIDER = poly([A.onFork(322), A.onFork(612)]);
const FORK_STANCHION = poly([A.onFork(600), A.onFork(1000)]);

const CALIPER = blob([
  { x: 1266, h: 452 }, { x: 1330, h: 430 }, { x: 1344, h: 366 },
  { x: 1300, h: 336 }, { x: 1252, h: 372 },
], 0.4);

const FENDER = blob([
  { x: 1276, h: 648 }, { x: 1400, h: 684 }, { x: 1524, h: 644 },
  { x: 1528, h: 604 }, { x: 1400, h: 640 }, { x: 1280, h: 608 },
], 0.35);

type Label = { name: string; note?: string; at: A.Pt; to: A.Pt; anchor: "start" | "middle" | "end" };

const LABELS: Label[] = [
  { name: "Seat", note: "805 mm", at: { x: 500, h: 807 }, to: { x: 300, h: 1240 }, anchor: "middle" },
  { name: "Handlebar", at: { x: 876, h: 1072 }, to: { x: 690, h: 1240 }, anchor: "middle" },
  { name: "Fuel tank", at: { x: 950, h: 926 }, to: { x: 1030, h: 1240 }, anchor: "middle" },
  { name: "Frame", note: "steel diamond", at: { x: 706, h: 696 }, to: { x: 1400, h: 1240 }, anchor: "middle" },
  { name: "Steering head", note: "rake 24.5°", at: A.STEERING_HEAD, to: { x: 1760, h: 1240 }, anchor: "middle" },

  { name: "Top yoke", note: "42 mm offset", at: A.YOKE_TOP, to: { x: 2010, h: 1090 }, anchor: "start" },
  { name: "Headlight", at: { x: 1290, h: 946 }, to: { x: 2010, h: 940 }, anchor: "start" },
  { name: "Fork stanchion", note: "41 mm", at: A.onFork(800), to: { x: 2010, h: 790 }, anchor: "start" },
  { name: "Fork slider", at: A.onFork(470), to: { x: 2010, h: 640 }, anchor: "start" },
  { name: "Brake caliper", at: { x: 1330, h: 420 }, to: { x: 2010, h: 490 }, anchor: "start" },
  { name: "Brake rotor", note: "282 mm", at: { x: 1500, h: 200 }, to: { x: 2010, h: 340 }, anchor: "start" },
  { name: "Front axle", at: A.FRONT_AXLE, to: { x: 2010, h: 190 }, anchor: "start" },
  { name: "Front tyre", note: "120/70-17", at: { x: 1666, h: 214 }, to: { x: 2010, h: 40 }, anchor: "start" },

  { name: "Tail light", at: { x: -288, h: 848 }, to: { x: -840, h: 1050 }, anchor: "end" },
  { name: "Subframe", at: { x: 420, h: 716 }, to: { x: -840, h: 900 }, anchor: "end" },
  { name: "Rear shock", note: "monoshock", at: { x: 582, h: 490 }, to: { x: -840, h: 750 }, anchor: "end" },
  { name: "Chain", note: "525", at: { x: 330, h: 408 }, to: { x: -840, h: 600 }, anchor: "end" },
  { name: "Rear sprocket", note: "43T", at: { x: -74, h: 392 }, to: { x: -840, h: 450 }, anchor: "end" },
  { name: "Rear tyre", note: "180/55-17", at: { x: -302, h: 262 }, to: { x: -840, h: 300 }, anchor: "end" },

    { name: "Swingarm", at: { x: 250, h: 300 }, to: { x: -200, h: -350 }, anchor: "middle" },
  { name: "Muffler", at: { x: 520, h: 168 }, to: { x: 210, h: -170 }, anchor: "middle" },
  { name: "Swingarm pivot", at: A.PIVOT, to: { x: 560, h: -350 }, anchor: "middle" },
  { name: "Footpeg", at: { x: 664, h: 396 }, to: { x: 880, h: -170 }, anchor: "middle" },
  { name: "Crankcase", at: { x: 800, h: 300 }, to: { x: 1160, h: -350 }, anchor: "middle" },
  { name: "Exhaust header", at: { x: 1010, h: 284 }, to: { x: 1500, h: -170 }, anchor: "middle" },
  { name: "Radiator", at: { x: 1140, h: 500 }, to: { x: 1860, h: -350 }, anchor: "middle" },
];

function Leader({ l }: { l: Label }) {
  const dx = l.at.x - l.to.x;
  const dh = l.at.h - l.to.h;
  const len = Math.hypot(dx, dh);
  const ux = dx / len, uh = dh / len;
  const pad = l.anchor === "middle" ? 46 : 30;
  const x1 = l.to.x + ux * pad + (l.anchor === "start" ? -14 : l.anchor === "end" ? 14 : 0);
  const h1 = l.to.h + uh * pad;
  return (
    <line
      x1={f(x1)} y1={f(Y(h1))}
      x2={f(l.at.x - ux * 14)} y2={f(Y(l.at.h - uh * 14))}
      markerEnd="url(#anat-arrow)"
    />
  );
}

export function BikeSkeleton() {
  return (
    <svg
      viewBox="-1400 -80 3900 1800"
      className="block h-auto w-full select-none"
      role="img"
      aria-label="Side view of a naked motorcycle with its major parts labelled"
    >
      <defs>
        <marker
          id="anat-arrow" markerUnits="userSpaceOnUse"
          markerWidth={26} markerHeight={26} refX={13} refY={6.5} orient="auto"
        >
          <path d="M 0 0 L 13 6.5 L 0 13" fill="none"
            stroke="var(--anat-lead)" strokeWidth={2.2}
            strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>

      {}
      <g fill="none" stroke="var(--anat-line)" strokeLinecap="round" strokeLinejoin="round">
        <g strokeWidth={9}>
          <Wheel at={A.REAR_AXLE} r={A.R_REAR} phase={0.35} />
          <Wheel at={A.FRONT_AXLE} r={A.R_FRONT} phase={0.1} />
        </g>

        <g strokeWidth={5} opacity={0.85}>
          <circle cx={A.FRONT_AXLE.x} cy={Y(A.FRONT_AXLE.h)} r={A.R_DISC_F} />
          <circle cx={A.REAR_AXLE.x} cy={Y(A.REAR_AXLE.h)} r={A.R_DISC_R} />
          <circle cx={A.COUNTERSHAFT.x} cy={Y(A.COUNTERSHAFT.h)} r={A.R_SPKT_F} />
          <circle cx={A.REAR_AXLE.x} cy={Y(A.REAR_AXLE.h)} r={A.R_SPKT_R} />
        </g>

        <g strokeWidth={9}>
          <path d={SWINGARM} />
          <path d={CHAIN} />
          <path d={SPRING} strokeWidth={6} />
          <path d={LINKAGE} strokeWidth={6} />
          <path d={poly([A.PIVOT, SHOCK_TOP])} strokeWidth={6} />

          <path d={CASES} />
          <path d={BARREL} />
          <path d={HEAD} />
          <path d={RADIATOR} strokeWidth={5} />
          <path d={EXHAUST} strokeWidth={7} />
          <path d={MUFFLER} />
          <path d={FOOTPEG} strokeWidth={7} />

          <path d={FRAME_VISIBLE} />
          <path d={SUBFRAME} strokeWidth={6} />

          <path d={TANK} />
          <path d={SEAT} />
          <path d={TAIL} />
          <path d={HEADLIGHT} strokeWidth={7} />

          <path d={FORK_SLIDER} strokeWidth={13} />
          <path d={FORK_STANCHION} strokeWidth={8} />
          <path d={yoke(985, 92)} strokeWidth={11} />
          <path d={yoke(838, 86)} strokeWidth={11} />
          <path d={BAR} strokeWidth={8} />
          <path d={CALIPER} strokeWidth={6} />
          <path d={FENDER} strokeWidth={6} />

          {}
          <g strokeWidth={6} opacity={0.5}>
            <path d={`M -170 ${Y(0)} L 170 ${Y(0)}`} />
            <path d={`M 1235 ${Y(0)} L 1565 ${Y(0)}`} />
          </g>
        </g>
      </g>

      {}
      <g>
        {LABELS.map((l) => (
          <g key={l.name} className="group">
            <g
              fill="none" stroke="var(--anat-lead)" strokeWidth={2.6}
              className="transition-opacity group-hover:opacity-100" opacity={0.75}
            >
              <Leader l={l} />
            </g>
            <text
              x={l.to.x} y={Y(l.to.h)} textAnchor={l.anchor}
              className="fill-[var(--anat-text)] text-[38px] font-semibold uppercase tracking-[0.08em]"
            >
              {l.name}
            </text>
            {l.note && (
              <text
                x={l.to.x} y={Y(l.to.h) + 42} textAnchor={l.anchor}
                className="fill-[var(--anat-note)] font-mono text-[30px] tabular-nums"
              >
                {l.note}
              </text>
            )}
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   The mark: a pod filter, drawn off a K&N RE-series.

   Four parts stacked on one axis, which is the whole shape of the thing:

   - a moulded rubber end cap, closed, radiused where the top face rolls into
     the side;
   - the media cone, pleated, tapering in about a fifth from base to top;
   - the rubber base ring it's bonded into, a touch wider than the media;
   - and under that the machined inlet flange, narrower, so all you see of it
     is the crescent that clears the base ring's near rim.

   Everything is projected through one camera: every circle on the part becomes
   an ellipse with the same ry/rx, so the whole thing is seen from one height
   just above the axis. That single ratio is what stops the parts from looking
   like they were each drawn from a different angle. It's also what puts the
   chrome crescent at the bottom — that isn't a highlight, it's the flange
   showing under the rim, and it's there because the camera says it should be.

   The pleats are the part that has to be right. A pod's pleats are evenly
   spaced *in angle* around the media, so what you see from the side isn't a
   set of even stripes — the spacing goes as sin θ, bunching toward the
   silhouette. And because the media is a cone, every pleat converges upward.
   Both fall straight out of taking the angle and projecting it, which is why
   they're computed here rather than eyeballed into a path string.
--------------------------------------------------------------------------- */

const CX = 12;

/** ry/rx for every ellipse on the part — one camera, tipped just above the axis. */
const TILT = 0.28;

// Radii. Proportions are off an RE-series pod: the media tapers ~20% over its
// length, the caps overhang it at both ends, the inlet flange steps back in.
const R_CAP = 5.7;
const R_CAP_FACE = 4.9; // the top face, inset by the radiused shoulder
const R_MEDIA_TOP = 5.2;
const R_MEDIA_BOT = 6.4;
const R_BASE = 6.9;
const R_INLET = 6.1;

// Heights, top down. Media two thirds of the length, caps a sixth each — which
// is where they land on the real part.
const Y_CAP_TOP = 3.9;
const Y_CAP_BOT = 6.2;
const Y_BASE_TOP = 16.5;
const Y_BASE_BOT = 18.2;
const Y_INLET_BOT = 19.7;

const ry = (r: number) => r * TILT;

/* Half of the ellipse at radius `r` centred on the axis at `y`. Both go the
   same way round the part — down the near side and back along the far side —
   so both carry the same sweep flag; it's the direction of travel that picks
   which half you get. */

/** Left rim to right rim, along the near (lower) half. */
const nearLR = (r: number, y: number) => `A ${r} ${ry(r)} 0 0 0 ${CX + r} ${y}`;

/** Right rim back to left rim, along the far (upper) half. */
const farRL = (r: number, y: number) => `A ${r} ${ry(r)} 0 0 0 ${CX - r} ${y}`;

/** Right rim back to left rim, along the near (lower) half — for an outline
    that ran up the far side and has to come home under the part. */
const nearRL = (r: number, y: number) => `A ${r} ${ry(r)} 0 0 1 ${CX - r} ${y}`;

/** How far the near edge of that ellipse hangs below `y`, `dx` off the axis. */
const drop = (r: number, dx: number) => ry(r) * Math.sqrt(Math.max(0, 1 - (dx / r) ** 2));

/** A plain turned band: straight sides, far rim across the top, near rim under. */
const band = (r: number, top: number, bot: number) =>
  `M ${CX - r} ${top} L ${CX - r} ${bot} ${nearLR(r, bot)} L ${CX + r} ${top} ` +
  `${farRL(r, top)} Z`;

const INLET = band(R_INLET, Y_BASE_BOT, Y_INLET_BOT);
const BASE = band(R_BASE, Y_BASE_TOP, Y_BASE_BOT);

/* The media cone. Its top is left square: the cap overhangs it and covers the
   join, the same way it does on the part. */
const MEDIA_TOP_Y = Y_CAP_BOT + 0.5;
const MEDIA = (() => {
  const t = (MEDIA_TOP_Y - Y_BASE_TOP) / (Y_CAP_BOT - Y_BASE_TOP);
  const rTop = R_MEDIA_BOT + (R_MEDIA_TOP - R_MEDIA_BOT) * t;
  // Bounded below by the near half of its own base rim — the far half is
  // behind the cone, not under it, so closing on it would leave the pleats
  // hanging past the fill.
  return (
    `M ${CX - R_MEDIA_BOT} ${Y_BASE_TOP} ${nearLR(R_MEDIA_BOT, Y_BASE_TOP)} ` +
    `L ${CX + rTop} ${MEDIA_TOP_Y} L ${CX - rTop} ${MEDIA_TOP_Y} Z`
  );
})();

/* The pleat valleys. Eleven of the ~50 on the real part — the count you can
   still tell apart at the size this gets used. They stop ±66° off the axis
   rather than running to ±90°, because past that they've closed up into the
   silhouette edge and there's nothing left to draw. Each one dies under the
   cap's lip at the top and on the base ring at the bottom, so the ends are
   tucked into a join rather than floating on the fill. */
const PLEAT_COUNT = 11;
const PLEAT_SPAN = (66 * Math.PI) / 180;
const PLEATS = Array.from({ length: PLEAT_COUNT }, (_, i) => {
  const theta = -PLEAT_SPAN + (i * 2 * PLEAT_SPAN) / (PLEAT_COUNT - 1);
  const sin = Math.sin(theta);
  const xTop = CX + R_MEDIA_TOP * sin;
  const xBot = CX + R_MEDIA_BOT * sin;
  const yTop = Y_CAP_BOT + drop(R_CAP, xTop - CX);
  const yBot = Y_BASE_TOP + ry(R_MEDIA_BOT) * Math.cos(theta);
  return `M ${xTop.toFixed(2)} ${yTop.toFixed(2)} L ${xBot.toFixed(2)} ${yBot.toFixed(2)}`;
});

/* The end cap: a short band whose top face is inset and joined by a radius, so
   the corner rolls over the way moulded rubber does instead of ending square. */
const SHOULDER = 0.85;
const CAP =
  `M ${CX - R_CAP} ${Y_CAP_BOT} L ${CX - R_CAP} ${Y_CAP_TOP + SHOULDER} ` +
  `Q ${CX - R_CAP} ${Y_CAP_TOP} ${CX - R_CAP_FACE} ${Y_CAP_TOP} ` +
  `A ${R_CAP_FACE} ${ry(R_CAP_FACE)} 0 0 1 ${CX + R_CAP_FACE} ${Y_CAP_TOP} ` +
  `Q ${CX + R_CAP} ${Y_CAP_TOP} ${CX + R_CAP} ${Y_CAP_TOP + SHOULDER} ` +
  `L ${CX + R_CAP} ${Y_CAP_BOT} ${nearRL(R_CAP, Y_CAP_BOT)} Z`;

export function PodFilter({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0">
      {/* back to front: the flange is behind the ring that hides most of it */}
      <path d={INLET} fill="var(--pod-inlet)" />
      <path d={BASE} fill="var(--pod-rubber)" />

      <path d={MEDIA} fill="var(--pod-media)" />
      <g stroke="var(--pod-pleat)" strokeWidth={0.6} strokeLinecap="round">
        {PLEATS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      <path d={CAP} fill="var(--pod-rubber)" />
      <ellipse
        cx={CX}
        cy={Y_CAP_TOP}
        rx={R_CAP_FACE}
        ry={ry(R_CAP_FACE)}
        fill="var(--pod-rubber-face)"
      />
    </svg>
  );
}

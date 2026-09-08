/* The mark: a pod filter, turned onto its cap and leaned, in one weight of
   orange line. Unfilled, so every stroke has to be an edge you could actually
   see on the part — nothing is drawn where one piece merely passes behind
   another, and nothing is hidden by a fill. */

const CX = 12;
const CY = 12;

/** ry/rx for every ellipse on the part — one camera, tipped just above the axis. */
const TILT = 0.28;

/** Lean, counter-clockwise. The 180 turns it over: it's built cap-up, because
    that's the end its heights are measured down from. Both are rigid rotations
    of the finished projection, so neither costs a line of geometry. */
const LEAN = 22;
const SPIN = 180 - LEAN;

// Off an RE-series pod: media tapering ~20% over its length, cap overhanging
// it. R_BODY serves the media's base and the ring both — on the real part the
// ring stands slightly proud, but that lip is under a pixel at the 18px the
// Garage heading uses, so it can only draw as a smudge.
const R_CAP = 5.7;
const R_CAP_FACE = 4.9; // the top face, inset by the radiused shoulder
const R_MEDIA_TOP = 5.2;
const R_BODY = 6.4;

const Y_CAP_TOP = 3.9;
const Y_CAP_BOT = 6.2;
const Y_BASE_TOP = 16.5;
const Y_BASE_BOT = 19.2;

const ry = (r: number) => r * TILT;

/* Halves of the ellipse at radius `r`, centred on the axis at `y`. All three
   run the same way round the part, so it's the direction of travel that picks
   which half you get — not the sweep flag alone. */
const nearLR = (r: number, y: number) => `A ${r} ${ry(r)} 0 0 0 ${CX + r} ${y}`;
const nearRL = (r: number, y: number) => `A ${r} ${ry(r)} 0 0 1 ${CX - r} ${y}`;
const farLR = (r: number, y: number) => `A ${r} ${ry(r)} 0 0 1 ${CX + r} ${y}`;

/** How far the near edge of that ellipse hangs below `y`, `dx` off the axis. */
const drop = (r: number, dx: number) => ry(r) * Math.sqrt(Math.max(0, 1 - (dx / r) ** 2));

const SHOULDER = 0.85; // the radius the moulded corner rolls over
const CAP =
  `M ${CX - R_CAP} ${Y_CAP_BOT} L ${CX - R_CAP} ${Y_CAP_TOP + SHOULDER} ` +
  `Q ${CX - R_CAP} ${Y_CAP_TOP} ${CX - R_CAP_FACE} ${Y_CAP_TOP} ` +
  `${farLR(R_CAP_FACE, Y_CAP_TOP)} ` +
  `Q ${CX + R_CAP} ${Y_CAP_TOP} ${CX + R_CAP} ${Y_CAP_TOP + SHOULDER} ` +
  `L ${CX + R_CAP} ${Y_CAP_BOT} ${nearRL(R_CAP, Y_CAP_BOT)} Z`;

const CAP_FACE = `M ${CX - R_CAP_FACE} ${Y_CAP_TOP} ${nearLR(R_CAP_FACE, Y_CAP_TOP)}`;

/** The cone's sides start where they come out from under the cap's lip. */
const Y_EMERGE = Y_CAP_BOT + drop(R_CAP, R_MEDIA_TOP);
const MEDIA =
  `M ${CX - R_MEDIA_TOP} ${Y_EMERGE} L ${CX - R_BODY} ${Y_BASE_TOP} ` +
  `M ${CX + R_MEDIA_TOP} ${Y_EMERGE} L ${CX + R_BODY} ${Y_BASE_TOP}`;

/** One rim, two jobs: bottom of the media, top of the ring. */
const RIM = `M ${CX - R_BODY} ${Y_BASE_TOP} ${nearLR(R_BODY, Y_BASE_TOP)}`;

const BASE =
  `M ${CX - R_BODY} ${Y_BASE_TOP} L ${CX - R_BODY} ${Y_BASE_BOT} ` +
  `${nearLR(R_BODY, Y_BASE_BOT)} L ${CX + R_BODY} ${Y_BASE_TOP}`;

/* Seven of the ~50 real pleats — more closes into hatching at this size. They
   sit evenly spaced in *angle*, so projected the spacing goes as sin θ and
   bunches toward the silhouette instead of reading as even stripes, and each
   converges upward because the media is a cone. That's why they're computed.
   Past ±64° they've folded into the silhouette, so there's nothing to draw. */
const PLEAT_COUNT = 7;
const PLEAT_SPAN = (64 * Math.PI) / 180;
const PLEATS = Array.from({ length: PLEAT_COUNT }, (_, i) => {
  const theta = -PLEAT_SPAN + (i * 2 * PLEAT_SPAN) / (PLEAT_COUNT - 1);
  const xTop = CX + R_MEDIA_TOP * Math.sin(theta);
  const xBot = CX + R_BODY * Math.sin(theta);
  const yTop = Y_CAP_BOT + drop(R_CAP, xTop - CX);
  const yBot = Y_BASE_TOP + ry(R_BODY) * Math.cos(theta);
  return `M ${xTop.toFixed(2)} ${yTop.toFixed(2)} L ${xBot.toFixed(2)} ${yBot.toFixed(2)}`;
});

/* Centre, shrink to clear the viewBox once spun, then spin. Measured rather
   than dialled in, so LEAN stays a knob you can turn. */
const PLACE = (() => {
  const top = Y_CAP_TOP - ry(R_CAP_FACE);
  const bot = Y_BASE_BOT + ry(R_BODY);
  const mid = (top + bot) / 2;
  const rad = (SPIN * Math.PI) / 180;
  const halfH = (bot - top) / 2;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const room = CY - 1.1; // stroke half-width plus air
  const fit = Math.min(
    room / (R_BODY * cos + halfH * sin),
    room / (R_BODY * sin + halfH * cos),
    1
  );
  return (
    `rotate(${SPIN} ${CX} ${CY}) translate(${CX} ${CY}) scale(${fit.toFixed(4)}) ` +
    `translate(${-CX} ${-CY}) translate(0 ${(CY - mid).toFixed(3)})`
  );
})();

export function PodFilter({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0">
      <g
        transform={PLACE}
        fill="none"
        stroke="var(--pod-line)"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g strokeWidth={1.15}>
          <path d={CAP} />
          <path d={CAP_FACE} />
          <path d={MEDIA} />
          <path d={RIM} />
          <path d={BASE} />
        </g>
        <g strokeWidth={0.7}>
          {PLEATS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>
    </svg>
  );
}

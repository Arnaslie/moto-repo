/* ---------------------------------------------------------------------------
   The mark: a pod filter, leaned over, in one weight of orange line.

   Monoline and unfilled, which is a stricter brief than it sounds. With
   nothing to hide behind, every stroke here has to be an edge you could
   actually see on the part — no fills papering over the joins, no line drawn
   where one part merely passes behind another. So the media's sides start
   where they come out from under the cap's lip, and the inlet's start where
   they clear the base ring's rim. Both are the same calculation: find where a
   vertical at that radius meets the ellipse of the rim above it.

   Everything is still projected through one camera. Every circle on the part
   becomes an ellipse with the same ry/rx, so no two parts look drawn from
   different angles, and turning it over onto its cap and leaning it is a rigid
   rotation of the finished projection — the camera rolled, not the part
   distorted. That's why it can be one transform on the whole group and nothing
   needs redrawing.

   The pleats are the part that has to be right. They sit evenly spaced in
   *angle* around the media, so from the side the spacing goes as sin θ and
   bunches toward the silhouette rather than reading as even stripes, and every
   one converges upward because the media is a cone. Both fall out of taking
   the angle and projecting it, which is why they're computed rather than
   eyeballed into a path string.

   Two things on the real part aren't drawn, both for the same reason. Its
   base ring stands slightly proud of the media, and a narrower machined inlet
   flange steps down under that. Rendered honestly they'd put three rims inside
   the bottom eighth of the mark — arcs a third of a unit apart, which at 18px
   is well under a pixel each. They can't draw as steps, only as a smudge that
   costs the shape its bottom edge. So the ring runs flush with the media and
   carries the base on its own.
--------------------------------------------------------------------------- */

const CX = 12;
const CY = 12;

/** ry/rx for every ellipse on the part — one camera, tipped just above the axis. */
const TILT = 0.28;

/* The whole mark rides one rotation, and it does two things at once. The part
   is built cap-up, because that's the end its heights are measured down from;
   the mark wants it cap-down and leaned, so SPIN turns it over and leans it in
   the same move. Both are rigid — the camera rolled, not the part distorted —
   which is why neither needs a line of the geometry redrawn. */

/** Degrees of lean, counter-clockwise, once it's the right way up. */
const LEAN = 22;

/** What actually gets applied: over onto its cap, then leaned. */
const SPIN = 180 - LEAN;

// Radii. Off an RE-series pod: the media tapers ~20% over its length and the
// cap overhangs it.
const R_CAP = 5.7;
const R_CAP_FACE = 4.9; // the top face, inset by the radiused shoulder
const R_MEDIA_TOP = 5.2;
const R_BODY = 6.4; // media at its base, and the ring bonded flush to it

// Heights, top down. Media two thirds of the length, ends a sixth each.
const Y_CAP_TOP = 3.9;
const Y_CAP_BOT = 6.2;
const Y_BASE_TOP = 16.5;
const Y_BASE_BOT = 19.2;

const ry = (r: number) => r * TILT;

/* Halves of the ellipse at radius `r` centred on the axis at `y`. All three go
   the same way round the part, so it's the direction of travel that picks
   which half you get, not the sweep flag on its own. */
const nearLR = (r: number, y: number) => `A ${r} ${ry(r)} 0 0 0 ${CX + r} ${y}`;
const nearRL = (r: number, y: number) => `A ${r} ${ry(r)} 0 0 1 ${CX - r} ${y}`;
const farLR = (r: number, y: number) => `A ${r} ${ry(r)} 0 0 1 ${CX + r} ${y}`;

/** How far the near edge of that ellipse hangs below `y`, `dx` off the axis. */
const drop = (r: number, dx: number) => ry(r) * Math.sqrt(Math.max(0, 1 - (dx / r) ** 2));

/* The end cap: a short band whose top face is inset and joined by a radius, so
   the corner rolls over the way moulded rubber does instead of ending square. */
const SHOULDER = 0.85;
const CAP =
  `M ${CX - R_CAP} ${Y_CAP_BOT} L ${CX - R_CAP} ${Y_CAP_TOP + SHOULDER} ` +
  `Q ${CX - R_CAP} ${Y_CAP_TOP} ${CX - R_CAP_FACE} ${Y_CAP_TOP} ` +
  `${farLR(R_CAP_FACE, Y_CAP_TOP)} ` +
  `Q ${CX + R_CAP} ${Y_CAP_TOP} ${CX + R_CAP} ${Y_CAP_TOP + SHOULDER} ` +
  `L ${CX + R_CAP} ${Y_CAP_BOT} ${nearRL(R_CAP, Y_CAP_BOT)} Z`;

/** The near half of the top face, closing the ellipse the outline started. */
const CAP_FACE = `M ${CX - R_CAP_FACE} ${Y_CAP_TOP} ${nearLR(R_CAP_FACE, Y_CAP_TOP)}`;

/* The media cone: two sides and the rim it stands on. Each side starts on the
   cap's bottom rim, where the media stops being hidden by the lip. */
const Y_EMERGE = Y_CAP_BOT + drop(R_CAP, R_MEDIA_TOP);
const MEDIA =
  `M ${CX - R_MEDIA_TOP} ${Y_EMERGE} L ${CX - R_BODY} ${Y_BASE_TOP} ` +
  `M ${CX + R_MEDIA_TOP} ${Y_EMERGE} L ${CX + R_BODY} ${Y_BASE_TOP}`;

/* One rim doing two jobs: the bottom of the media and the top of the ring. */
const RIM = `M ${CX - R_BODY} ${Y_BASE_TOP} ${nearLR(R_BODY, Y_BASE_TOP)}`;

const BASE =
  `M ${CX - R_BODY} ${Y_BASE_TOP} L ${CX - R_BODY} ${Y_BASE_BOT} ` +
  `${nearLR(R_BODY, Y_BASE_BOT)} L ${CX + R_BODY} ${Y_BASE_TOP}`;

/* Seven of the ~50 pleats on the real part — the count that still reads as
   pleats at the size this gets used instead of closing into hatching. They
   stop ±64° off the axis because past that they've folded into the silhouette
   and there's nothing left to draw. Each dies under the cap's lip at the top
   and on the rim at the bottom, so no end floats. */
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

/* Centre the part, shrink it just enough that the spun box still clears the
   viewBox with room for the stroke, then spin it. Derived rather than dialled
   in, so LEAN is a knob you can turn without the mark falling off its edges. */
const PLACE = (() => {
  const top = Y_CAP_TOP - ry(R_CAP_FACE);
  const bot = Y_BASE_BOT + ry(R_BODY);
  const mid = (top + bot) / 2;
  const rad = (SPIN * Math.PI) / 180;
  const halfH = (bot - top) / 2;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const room = CY - 1.1; // the 1.1 is the stroke's half-width plus air
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

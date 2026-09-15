export const CONTROLS = {
  throttle: "Throttle",
  "front-brake": "Front brake",
  clutch: "Clutch",
  "rear-brake": "Rear brake",
  shifter: "Gear shifter",
  footpegs: "Footpegs",
} as const;

export type Control = keyof typeof CONTROLS;

export const FAMILIES = {
  foundations: "Foundations",
  wheelies: "Wheelies",
  stoppies: "Stoppies",
  slides: "Slides",
} as const;

export type Family = keyof typeof FAMILIES;

export type TrickSlug =
  | "friction-zone"
  | "rear-brake-cover"
  | "front-brake-modulation"
  | "slow-u-turn"
  | "power-wheelie"
  | "clutch-up-wheelie"
  | "stoppie"
  | "burnout"
  | "rear-brake-slide";

export type Strength = { area: string; test: string };

export type TrickKit = { protective: string[]; bike: string[] };

export type Trick = {
  slug: TrickSlug;
  name: string;
  family: Family;
  summary: string;
  controls: Control[];
  requires: TrickSlug[];
  strength: Strength[];
  kit: TrickKit;
  progression: string[];
  bailOut: string;
};

const BASIC = ["Full-face helmet", "Gloves", "Boots"];
const ARMOURED = [...BASIC, "Armoured jacket", "Armoured trousers"];
const AIRBORNE = [...ARMOURED, "Back protector"];

const hang = (seconds: number): Strength => ({ area: "Grip", test: `Dead hang for ${seconds} seconds` });
const plank = (seconds: number): Strength => ({ area: "Core", test: `Plank for ${seconds} seconds` });
const wallSit = (seconds: number): Strength => ({ area: "Legs", test: `Wall sit for ${seconds} seconds` });
const balance = (seconds: number): Strength => ({
  area: "Balance",
  test: `Stand on one leg for ${seconds} seconds, each side`,
});

const CATALOG: Record<TrickSlug, Omit<Trick, "slug">> = {
  "friction-zone": {
    name: "Friction zone",
    family: "foundations",
    summary: "Holding the clutch part-way, where the plates start to bite, to feed in drive without stalling or lurching.",
    controls: ["clutch", "throttle"],
    requires: [],
    strength: [hang(20)],
    kit: { protective: BASIC, bike: ["Clutch lever reach adjusted to your fingers"] },
    progression: [
      "Stationary in first, find the bite point and hold it until the bike just starts to creep",
      "Walk the bike forward on the clutch alone, no throttle",
      "Ride at walking pace with the throttle held steady, speed set only by the clutch",
      "Stop and pull away on a slope without touching the brakes",
    ],
    bailOut: "Pull the clutch in fully. Drive is gone the moment the plates separate.",
  },
  "rear-brake-cover": {
    name: "Covering the rear brake",
    family: "foundations",
    summary: "Riding with the ball of the right foot over the pedal, so the rear brake goes on without moving the foot.",
    controls: ["rear-brake", "footpegs"],
    requires: [],
    strength: [balance(30)],
    kit: { protective: BASIC, bike: ["Rear brake pedal height set to your foot on the peg"] },
    progression: [
      "Set the pedal height so your foot rests over it without pressing",
      "Ride at walking pace with the foot covering the pedal the whole time",
      "Drag the rear brake lightly against a steady throttle",
      "Stop from 20 km/h on the rear brake alone",
    ],
    bailOut: "Lift your foot off the pedal.",
  },
  "front-brake-modulation": {
    name: "Front brake modulation",
    family: "foundations",
    summary: "Squeezing the front brake progressively, loading the tyre before braking hard instead of grabbing the lever.",
    controls: ["front-brake"],
    requires: [],
    strength: [hang(30), plank(45)],
    kit: { protective: ARMOURED, bike: ["Front brake lever reach adjusted to your fingers"] },
    progression: [
      "Ride with two fingers covering the lever",
      "Progressive stops from 30 km/h, feeling the fork compress before squeezing harder",
      "Brace on the tank with your knees so your arms carry none of the stop",
      "Hard stops from 50 km/h, as short as you can make them",
    ],
    bailOut: "Ease off the lever. A locked front wheel regains grip as soon as it is released.",
  },
  "slow-u-turn": {
    name: "Slow-speed U-turn",
    family: "foundations",
    summary: "A full-lock turn inside two lanes' width, balanced on the clutch, throttle and rear brake.",
    controls: ["clutch", "throttle", "rear-brake"],
    requires: ["friction-zone", "rear-brake-cover"],
    strength: [plank(45), balance(30)],
    kit: { protective: BASIC, bike: ["Frame sliders"] },
    progression: [
      "Figure-eights at walking pace in an empty car park",
      "Turn your head to where the turn exits, not the ground in front of the wheel",
      "Tighten the figure-eights until the bars reach full lock",
      "U-turns inside a 6 m box",
    ],
    bailOut: "Feed out the clutch. Drive stands the bike back up; grabbing the front brake at full lock drops it.",
  },
  "power-wheelie": {
    name: "Power wheelie",
    family: "wheelies",
    summary: "Lifting the front wheel on the throttle alone, by rolling off and snapping back on to pump the fork.",
    controls: ["throttle", "rear-brake", "footpegs"],
    requires: ["rear-brake-cover"],
    strength: [hang(30), plank(60), wallSit(60)],
    kit: {
      protective: AIRBORNE,
      bike: ["Crash cages", "One tooth smaller front sprocket"],
    },
    progression: [
      "In first at 15 km/h, roll off and back on to feel the fork compress and rebound",
      "Time the throttle to the rebound for small lifts",
      "Hold the throttle steady at the top of a lift instead of rolling off",
      "Bring every lift down with the rear brake, not by rolling off",
    ],
    bailOut: "Press the rear brake. Slowing the rear wheel pitches the front down; rolling off alone is not enough near the balance point.",
  },
  "clutch-up-wheelie": {
    name: "Clutch-up wheelie",
    family: "wheelies",
    summary: "Raising the revs with the clutch in and slipping it out fast, so the drive lifts the front wheel.",
    controls: ["clutch", "throttle", "rear-brake", "footpegs"],
    requires: ["power-wheelie", "friction-zone"],
    strength: [hang(45), plank(60), wallSit(60)],
    kit: {
      protective: AIRBORNE,
      bike: [
        "Crash cages",
        "12 o'clock bar",
        "Hand-operated rear brake",
        "One tooth smaller front sprocket",
      ],
    },
    progression: [
      "In first at walking pace, raise the revs a little and slip the clutch out quickly for small lifts",
      "Raise the revs in steps until the front comes up without pumping the fork",
      "Hold a steady height with the throttle, covering the rear brake",
      "Fit a 12 o'clock bar before practising near the balance point",
    ],
    bailOut: "Press the rear brake. Pulling the clutch in cuts drive too, but only the rear brake brings the front down quickly.",
  },
  stoppie: {
    name: "Stoppie",
    family: "stoppies",
    summary: "Braking hard on the front at low speed until the rear wheel lifts, pivoting the bike on the front tyre.",
    controls: ["front-brake", "footpegs"],
    requires: ["front-brake-modulation"],
    strength: [hang(30), plank(60), wallSit(60)],
    kit: {
      protective: AIRBORNE,
      bike: [
        "Frame sliders",
        "ABS that allows the rear to lift, or can be switched off",
        "A front tyre in good condition",
      ],
    },
    progression: [
      "Hard stops from 30 km/h until the rear goes light",
      "Knees gripping the tank and arms locked, so your weight stays behind the bars",
      "Short lifts from 25 km/h, releasing the lever the moment the rear rises",
      "Hold the lift longer by easing the lever, not by squeezing harder",
    ],
    bailOut: "Release the front brake. The rear drops as soon as the braking load goes.",
  },
  burnout: {
    name: "Burnout",
    family: "slides",
    summary: "Spinning the rear tyre while the front brake holds the bike still.",
    controls: ["front-brake", "clutch", "throttle"],
    requires: ["friction-zone", "front-brake-modulation"],
    strength: [hang(30), wallSit(45)],
    kit: {
      protective: ARMOURED,
      bike: ["A rear tyre you are prepared to lose", "Short bursts, so the clutch and engine stay cool"],
    },
    progression: [
      "In first with the front brake held hard, feed the clutch until the bike pushes against the brake",
      "Raise the revs before feeding the clutch, until the rear tyre breaks traction",
      "Keep each burst to a few seconds",
      "Hold the bike straight with your body, not the bars",
    ],
    bailOut: "Pull the clutch in. The rear stops being driven and the front brake keeps the bike where it is.",
  },
  "rear-brake-slide": {
    name: "Rear-brake slide",
    family: "slides",
    summary: "Locking the rear wheel so the back steps out, then releasing to straighten up.",
    controls: ["rear-brake", "clutch"],
    requires: ["rear-brake-cover", "friction-zone"],
    strength: [balance(30), plank(45)],
    kit: {
      protective: ARMOURED,
      bike: ["Frame sliders", "Rear ABS switched off, where the bike allows it"],
    },
    progression: [
      "On gravel or dirt at walking pace, pull the clutch in and lock the rear",
      "Let the slide run straight, then release",
      "Steer slightly into the turn before locking, so the rear steps out",
      "Release while the bike still points where you are going",
    ],
    bailOut: "Release the rear brake early, while the bike is still pointed where you are going. Releasing once it is sideways can throw you over the high side.",
  },
};

export const TRICKS: Trick[] = Object.entries(CATALOG).map(([slug, trick]) => ({
  slug: slug as TrickSlug,
  ...trick,
}));

export const trickBySlug = (slug: string): Trick | undefined =>
  Object.hasOwn(CATALOG, slug) ? { slug: slug as TrickSlug, ...CATALOG[slug as TrickSlug] } : undefined;

export const difficulty = (slug: TrickSlug): number =>
  1 + Math.max(0, ...CATALOG[slug].requires.map(difficulty));

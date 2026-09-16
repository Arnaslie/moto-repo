export const CONTROLS = {
  throttle: { name: "Throttle", by: "Right hand" },
  frontBrake: { name: "Front brake", by: "Right hand" },
  clutch: { name: "Clutch", by: "Left hand" },
  rearBrake: { name: "Rear brake", by: "Right foot" },
  shifter: { name: "Gear shifter", by: "Left foot" },
  footpegs: { name: "Footpegs", by: "Feet" },
  tank: { name: "Tank", by: "Knees" },
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

export type Motion = "still" | "rolling" | "burnout" | "skid";

export type Input = { control: Control; action: string };

export type Beat = {
  inputs: [Input, ...Input[]];
  bike: string;
  motion: Motion;
  pitch?: number;
  dive?: number;
};

export type Trick = {
  slug: TrickSlug;
  name: string;
  family: Family;
  summary: string;
  requires: TrickSlug[];
  strength: Strength[];
  kit: TrickKit;
  sequence: [Beat, ...Beat[]];
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
    summary: "Letting the clutch out only part of the way, to the spot where it starts to pull, so the bike moves off smoothly without stalling or jerking.",
    requires: [],
    strength: [hang(20)],
    kit: { protective: BASIC, bike: ["Clutch adjusted so it sits in easy reach of your fingers"] },
    sequence: [
      {
        inputs: [
          { control: "clutch", action: "pull all the way in" },
          { control: "shifter", action: "press down into first" },
        ],
        bike: "Stopped, in first gear",
        motion: "still",
      },
      {
        inputs: [{ control: "clutch", action: "let out slowly until you feel it start to pull" }],
        bike: "The engine note drops and the bike wants to creep forward",
        motion: "still",
      },
      {
        inputs: [
          { control: "clutch", action: "hold it right there" },
          { control: "throttle", action: "hold a little gas" },
        ],
        bike: "Rolls forward at walking pace",
        motion: "rolling",
      },
      {
        inputs: [
          { control: "clutch", action: "pull back in" },
          { control: "rearBrake", action: "press gently" },
        ],
        bike: "Rolls to a stop",
        motion: "still",
      },
    ],
    progression: [
      "Sitting still in first, let the clutch out slowly until you feel the bike start to pull, then pull it back in. Repeat until you can find that spot without thinking",
      "Walk the bike forward using only the clutch, with no gas",
      "Ride at walking pace with a little steady gas, controlling your speed with the clutch alone",
      "Stop and set off again on a slope without using the brakes",
    ],
    bailOut: "Pull the clutch all the way in. The engine stops driving the wheel straight away.",
  },
  "rear-brake-cover": {
    name: "Covering the rear brake",
    family: "foundations",
    summary: "Riding with your right foot hovering over the rear brake pedal, so you can brake without moving your foot first.",
    requires: [],
    strength: [balance(30)],
    kit: { protective: BASIC, bike: ["Rear brake pedal height set so your foot rests over it"] },
    sequence: [
      {
        inputs: [
          { control: "throttle", action: "hold steady" },
          { control: "rearBrake", action: "rest your foot over it without pressing" },
        ],
        bike: "Rolling at walking pace",
        motion: "rolling",
      },
      {
        inputs: [{ control: "rearBrake", action: "press lightly" }],
        bike: "Slows down and stays level",
        motion: "rolling",
      },
      {
        inputs: [
          { control: "rearBrake", action: "press firmly" },
          { control: "clutch", action: "pull in" },
        ],
        bike: "Comes to a stop",
        motion: "still",
      },
    ],
    progression: [
      "Adjust the pedal so your foot can rest over it without pressing",
      "Ride slowly with your right foot hovering over the pedal the whole time",
      "Press the rear brake pedal lightly while holding a little gas, and feel the bike slow",
      "Stop from 20 km/h using only the rear brake",
    ],
    bailOut: "Lift your foot off the pedal.",
  },
  "front-brake-modulation": {
    name: "Front brake modulation",
    family: "foundations",
    summary: "Squeezing the front brake gradually, gently first and then harder, instead of grabbing it all at once.",
    requires: [],
    strength: [hang(30), plank(45)],
    kit: { protective: ARMOURED, bike: ["Front brake adjusted so it sits in easy reach of your fingers"] },
    sequence: [
      {
        inputs: [
          { control: "throttle", action: "close" },
          { control: "frontBrake", action: "rest two fingers on it" },
        ],
        bike: "Rolling at 30 km/h",
        motion: "rolling",
      },
      {
        inputs: [
          { control: "frontBrake", action: "squeeze gently" },
          { control: "tank", action: "grip" },
        ],
        bike: "The front fork starts to sink",
        motion: "rolling",
        dive: 0.35,
      },
      {
        inputs: [
          { control: "frontBrake", action: "squeeze harder, smoothly" },
          { control: "clutch", action: "pull in" },
        ],
        bike: "The fork sinks most of the way and the bike slows hard",
        motion: "rolling",
        dive: 0.85,
      },
      {
        inputs: [{ control: "frontBrake", action: "ease off as the bike stops" }],
        bike: "Stops, and the fork rises back up",
        motion: "still",
      },
    ],
    progression: [
      "Ride with two fingers resting on the front brake",
      "Stop from 30 km/h, squeezing the front brake gently at first and harder once you feel the front of the bike dip",
      "Grip the tank with your knees so your arms stay relaxed while you stop",
      "Stop from 50 km/h in as short a distance as you can, still squeezing the front brake smoothly",
    ],
    bailOut: "Ease off the front brake. A front wheel that has stopped turning grips again as soon as you let go of the brake.",
  },
  "slow-u-turn": {
    name: "Slow-speed U-turn",
    family: "foundations",
    summary: "Turning the bike around within two lanes' width, with the handlebars turned all the way, kept steady by the clutch, gas and rear brake.",
    requires: ["friction-zone", "rear-brake-cover"],
    strength: [plank(45), balance(30)],
    kit: { protective: BASIC, bike: ["Frame sliders"] },
    sequence: [
      {
        inputs: [
          { control: "clutch", action: "hold where it starts to pull" },
          { control: "throttle", action: "hold a little gas" },
          { control: "rearBrake", action: "drag lightly" },
        ],
        bike: "Walking pace, handlebars turned all the way",
        motion: "rolling",
      },
      {
        inputs: [{ control: "rearBrake", action: "press a little more" }],
        bike: "Slows and tightens the turn",
        motion: "rolling",
      },
      {
        inputs: [
          { control: "clutch", action: "let out a touch" },
          { control: "rearBrake", action: "ease off" },
        ],
        bike: "Stands itself back up if it starts leaning into the turn",
        motion: "rolling",
      },
    ],
    progression: [
      "Ride figure-eights at walking pace in an empty car park",
      "Turn your head and look where you want to end up, not at the ground in front of you",
      "Make the figure-eights tighter until the handlebars are turned all the way",
      "Do U-turns inside a 6 m box",
    ],
    bailOut: "Let the clutch out a little. Pulling the bike forward stands it back up; grabbing the front brake with the bars turned drops it.",
  },
  "power-wheelie": {
    name: "Power wheelie",
    family: "wheelies",
    summary: "Lifting the front wheel with the gas alone: close it so the front dips, then open it as the front springs back up.",
    requires: ["rear-brake-cover"],
    strength: [hang(30), plank(60), wallSit(60)],
    kit: {
      protective: AIRBORNE,
      bike: ["Crash cages", "One tooth smaller front sprocket"],
    },
    sequence: [
      {
        inputs: [
          { control: "throttle", action: "hold steady" },
          { control: "rearBrake", action: "rest your foot over it" },
        ],
        bike: "Rolling in first at 15 km/h",
        motion: "rolling",
      },
      {
        inputs: [{ control: "throttle", action: "snap closed" }],
        bike: "The front fork sinks",
        motion: "rolling",
        dive: 0.5,
      },
      {
        inputs: [{ control: "throttle", action: "snap wide open as the fork springs back" }],
        bike: "The front wheel lifts",
        motion: "rolling",
        pitch: 18,
      },
      {
        inputs: [
          { control: "throttle", action: "hold steady" },
          { control: "footpegs", action: "keep your weight on them, not the handlebars" },
        ],
        bike: "The front wheel stays up",
        motion: "rolling",
        pitch: 22,
      },
      {
        inputs: [
          { control: "rearBrake", action: "press" },
          { control: "throttle", action: "close gently" },
        ],
        bike: "The front wheel comes back down",
        motion: "rolling",
      },
    ],
    progression: [
      "In first at 15 km/h, close the gas and open it again, and feel the front of the bike dip and spring back",
      "Open the gas right as the front springs back up, for small lifts",
      "Keep the gas steady at the top of a lift instead of closing it",
      "Bring every lift down with the rear brake, until it's a habit",
    ],
    bailOut: "Press the rear brake. Slowing the rear wheel brings the front down; closing the gas alone isn't enough once the front is high.",
  },
  "clutch-up-wheelie": {
    name: "Clutch-up wheelie",
    family: "wheelies",
    summary: "Raising the revs with the clutch pulled in, then letting it out quickly so the jolt of power lifts the front wheel.",
    requires: ["power-wheelie", "friction-zone"],
    strength: [hang(45), plank(60), wallSit(60)],
    kit: {
      protective: AIRBORNE,
      bike: [
        "Crash cages",
        "12 o'clock bar",
        "Hand-operated rear brake, for when your foot comes off the peg",
        "One tooth smaller front sprocket",
      ],
    },
    sequence: [
      {
        inputs: [
          { control: "clutch", action: "pull in" },
          { control: "throttle", action: "raise the revs" },
          { control: "rearBrake", action: "rest your foot over it" },
        ],
        bike: "Rolling in first at walking pace",
        motion: "rolling",
      },
      {
        inputs: [{ control: "clutch", action: "let out quickly, about halfway" }],
        bike: "The front wheel lifts",
        motion: "rolling",
        pitch: 25,
      },
      {
        inputs: [
          { control: "clutch", action: "let out the rest of the way" },
          { control: "throttle", action: "hold steady" },
        ],
        bike: "The front wheel stays up",
        motion: "rolling",
        pitch: 30,
      },
      {
        inputs: [
          { control: "rearBrake", action: "press" },
          { control: "throttle", action: "close gently" },
        ],
        bike: "The front wheel comes back down",
        motion: "rolling",
      },
    ],
    progression: [
      "In first at walking pace, raise the revs a little and let the clutch out quickly for small lifts",
      "Raise the revs a bit more each time, until the front comes up on its own",
      "Hold the front up at a steady height with the gas, foot ready on the rear brake",
      "Fit a 12 o'clock bar before going anywhere near the point where the bike would tip over backwards",
    ],
    bailOut: "Press the rear brake. Pulling the clutch in cuts the power too, but only the rear brake brings the front down quickly.",
  },
  stoppie: {
    name: "Stoppie",
    family: "stoppies",
    summary: "Braking hard on the front at low speed until the rear wheel lifts, so the bike balances on its front tyre.",
    requires: ["front-brake-modulation"],
    strength: [hang(30), plank(60), wallSit(60)],
    kit: {
      protective: AIRBORNE,
      bike: [
        "Frame sliders",
        "ABS that lets the rear wheel lift, or can be switched off",
        "A front tyre in good condition",
      ],
    },
    sequence: [
      {
        inputs: [
          { control: "throttle", action: "close" },
          { control: "tank", action: "grip hard" },
        ],
        bike: "Rolling at 25 km/h",
        motion: "rolling",
      },
      {
        inputs: [
          { control: "frontBrake", action: "squeeze gently" },
          { control: "clutch", action: "pull in" },
        ],
        bike: "The front fork sinks",
        motion: "rolling",
        dive: 0.6,
      },
      {
        inputs: [
          { control: "frontBrake", action: "squeeze harder" },
          { control: "footpegs", action: "push against them to keep your weight back" },
        ],
        bike: "The rear wheel lifts and the bike tips forward over the front tyre",
        motion: "rolling",
        dive: 1,
        pitch: -12,
      },
      {
        inputs: [{ control: "frontBrake", action: "let go" }],
        bike: "The rear wheel drops and the fork rises back up",
        motion: "rolling",
      },
    ],
    progression: [
      "Stop hard from 30 km/h until you feel the back of the bike go light",
      "Grip the tank with your knees and keep your arms straight, so your body doesn't slide forward",
      "From 25 km/h, let the rear lift a few centimetres, then let go of the front brake straight away",
      "Keep the rear up longer by easing off the front brake slightly, not by squeezing it harder",
    ],
    bailOut: "Let go of the front brake. The rear wheel drops as soon as the braking stops.",
  },
  burnout: {
    name: "Burnout",
    family: "slides",
    summary: "Spinning the rear tyre on the spot while the front brake holds the bike still.",
    requires: ["friction-zone", "front-brake-modulation"],
    strength: [hang(30), wallSit(45)],
    kit: {
      protective: ARMOURED,
      bike: ["A rear tyre you are prepared to wear out", "Short bursts only, so the clutch and engine don't overheat"],
    },
    sequence: [
      {
        inputs: [
          { control: "frontBrake", action: "squeeze hard and hold" },
          { control: "clutch", action: "pull in" },
        ],
        bike: "Stopped, in first gear",
        motion: "still",
      },
      {
        inputs: [
          { control: "frontBrake", action: "keep holding" },
          { control: "throttle", action: "open to about half" },
        ],
        bike: "The revs rise but the bike doesn't move",
        motion: "still",
      },
      {
        inputs: [
          { control: "frontBrake", action: "keep holding" },
          { control: "clutch", action: "let out slowly" },
        ],
        bike: "The rear tyre spins while the front brake holds the bike in place",
        motion: "burnout",
      },
      {
        inputs: [
          { control: "frontBrake", action: "keep holding" },
          { control: "clutch", action: "pull in" },
          { control: "throttle", action: "close" },
        ],
        bike: "The rear tyre stops spinning",
        motion: "still",
      },
    ],
    progression: [
      "Stopped in first with the front brake held hard, let the clutch out until the bike pushes against the brake, then pull it back in",
      "Raise the revs first, then let the clutch out until the rear tyre starts to spin",
      "Keep each burnout to a few seconds",
      "Keep the bike upright with your body rather than the handlebars",
    ],
    bailOut: "Pull the clutch in. The rear tyre stops being driven and the front brake keeps the bike where it is.",
  },
  "rear-brake-slide": {
    name: "Rear-brake slide",
    family: "slides",
    summary: "Stamping on the rear brake so the rear wheel stops turning and the back of the bike slides out, then letting go of the rear brake to straighten up.",
    requires: ["rear-brake-cover", "friction-zone"],
    strength: [balance(30), plank(45)],
    kit: {
      protective: ARMOURED,
      bike: ["Frame sliders", "Rear ABS switched off, where the bike allows it"],
    },
    sequence: [
      {
        inputs: [
          { control: "throttle", action: "close" },
          { control: "clutch", action: "pull in" },
        ],
        bike: "Rolling on gravel at 20 km/h",
        motion: "rolling",
      },
      {
        inputs: [{ control: "rearBrake", action: "stamp down and hold" }],
        bike: "The rear wheel stops turning and skids",
        motion: "skid",
      },
      {
        inputs: [{ control: "rearBrake", action: "keep holding" }],
        bike: "The back of the bike swings out to one side, which a side view can't show",
        motion: "skid",
      },
      {
        inputs: [{ control: "rearBrake", action: "let go while the bike still points straight ahead" }],
        bike: "The rear tyre grips again and the bike straightens up",
        motion: "rolling",
      },
    ],
    progression: [
      "On gravel or dirt at walking pace, pull the clutch in and stamp on the rear brake",
      "Let the skid run in a straight line, then let go of the rear brake",
      "Turn slightly before stamping on the brake, so the back swings out",
      "Make the slides longer only once letting go of the rear brake early feels automatic. Always let go of it before the back swings far out, because if the tyre grips while the bike is sideways it can throw you off",
    ],
    bailOut: "Let go of the rear brake early, while the bike still points where you're going. Letting go of the brake once the bike is sideways can throw you off.",
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

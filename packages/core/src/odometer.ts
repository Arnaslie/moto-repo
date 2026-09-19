export const PLACES = 3;
export const MAX_READING = 10 ** PLACES - 1;

export type Segment = "a" | "b" | "c" | "d" | "e" | "f" | "g";

export const SEGMENTS: readonly Segment[] = ["a", "b", "c", "d", "e", "f", "g"];

const LIT: Record<string, readonly Segment[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "g", "c", "d"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "c", "d"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
};

export const CELL_W = 11;
export const CELL_H = 19;
export const CELL_GAP = 3.4;
export const THICK = 2.4;
export const MITRE_GAP = 0.55;

export const DIGITS_W = CELL_W * PLACES + CELL_GAP * (PLACES - 1);

export function digitsOf(count: number, places: number = PLACES): string[] {
  const clamped = Math.max(0, Math.min(MAX_READING, Math.trunc(count) || 0));
  return String(clamped).padStart(places, "0").split("");
}

export function isLit(digit: string, segment: Segment): boolean {
  return LIT[digit]?.includes(segment) ?? false;
}

export function cellX(index: number): number {
  return index * (CELL_W + CELL_GAP);
}

const half = THICK / 2;

function bar(x0: number, x1: number, y: number): string {
  return [
    `M${x0} ${y}`,
    `L${x0 + half} ${y - half}`,
    `L${x1 - half} ${y - half}`,
    `L${x1} ${y}`,
    `L${x1 - half} ${y + half}`,
    `L${x0 + half} ${y + half}`,
    "Z",
  ].join("");
}

function post(x: number, y0: number, y1: number): string {
  return [
    `M${x} ${y0}`,
    `L${x + half} ${y0 + half}`,
    `L${x + half} ${y1 - half}`,
    `L${x} ${y1}`,
    `L${x - half} ${y1 - half}`,
    `L${x - half} ${y0 + half}`,
    "Z",
  ].join("");
}

const LEFT = half;
const RIGHT = CELL_W - half;
const TOP = half;
const MID = CELL_H / 2;
const BOTTOM = CELL_H - half;
const barX0 = LEFT + MITRE_GAP;
const barX1 = RIGHT - MITRE_GAP;

const PATHS: Record<Segment, string> = {
  a: bar(barX0, barX1, TOP),
  g: bar(barX0, barX1, MID),
  d: bar(barX0, barX1, BOTTOM),
  f: post(LEFT, TOP + MITRE_GAP, MID - MITRE_GAP),
  b: post(RIGHT, TOP + MITRE_GAP, MID - MITRE_GAP),
  e: post(LEFT, MID + MITRE_GAP, BOTTOM - MITRE_GAP),
  c: post(RIGHT, MID + MITRE_GAP, BOTTOM - MITRE_GAP),
};

export function segmentPath(segment: Segment): string {
  return PATHS[segment];
}

export function readingSentence(count: number): string {
  if (count <= 0) return "Messages — nothing waiting";
  if (count === 1) return "Messages — 1 conversation waiting";
  if (count > MAX_READING) return `Messages — ${MAX_READING}+ conversations waiting`;
  return `Messages — ${count} conversations waiting`;
}

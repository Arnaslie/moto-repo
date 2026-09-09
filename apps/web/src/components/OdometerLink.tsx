"use client";

import Link from "next/link";
import {
  CELL_H,
  DIGITS_W,
  SEGMENTS,
  cellX,
  digitsOf,
  isLit,
  readingSentence,
  segmentPath,
} from "@moto/core/odometer";

const PAD_X = 3.5;
const PAD_Y = 3;
const VIEW_W = DIGITS_W + PAD_X * 2;
const VIEW_H = CELL_H + PAD_Y * 2;

export function OdometerLink({ count }: { count: number }) {
  const digits = digitsOf(count);
  const waiting = count > 0;

  return (
    <Link
      href="/messages"
      aria-label={readingSentence(count)}
      data-waiting={waiting}
      className="odo group flex items-center transition-colors"
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        height={24}
        className="block"
        aria-hidden
      >
        <rect
          x={0.5}
          y={0.5}
          width={VIEW_W - 1}
          height={VIEW_H - 1}
          rx={2.5}
          className="odo-ground"
        />
        {digits.map((digit, i) => (
          <g key={i} transform={`translate(${PAD_X + cellX(i)} ${PAD_Y})`}>
            {SEGMENTS.map((segment) => (
              <path
                key={segment}
                d={segmentPath(segment)}
                className={isLit(digit, segment) ? "odo-lit" : "odo-ghost"}
              />
            ))}
          </g>
        ))}
      </svg>
      <span role="status" aria-live="polite" className="sr-only">
        {readingSentence(count)}
      </span>
    </Link>
  );
}

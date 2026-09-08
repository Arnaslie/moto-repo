import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  cellsWithin,
  parseBounds,
  type StretchKind,
  type TrendingTag,
} from "@moto/core/stretches";

const MAX_ROWS = 400;
const MAX_TAGS = 12;

export async function GET(request: Request) {
  const parsed = parseBounds(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const rows = await prisma.tagTrend.findMany({
    where: { cell: { in: cellsWithin(parsed.value) } },
    orderBy: { count: "desc" },
    take: MAX_ROWS,
  });

  const merged = new Map<string, TrendingTag>();
  for (const row of rows) {
    const seen = merged.get(row.slug);
    if (seen) {
      seen.count += row.count;
      continue;
    }
    merged.set(row.slug, {
      slug: row.slug,
      label: row.label,
      kind: row.kind as StretchKind,
      count: row.count,
      computedAt: row.computedAt.toISOString(),
    });
  }

  const tags = [...merged.values()].sort((a, b) => b.count - a.count).slice(0, MAX_TAGS);
  return NextResponse.json({ tags });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cellFor } from "@moto/core/stretches";

const BATCH = 1000;

type Tally = {
  cell: string;
  slug: string;
  count: number;
  labels: Map<string, number>;
  kinds: Map<string, number>;
};

function bump(counter: Map<string, number>, key: string) {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

function commonest(counter: Map<string, number>): string {
  let best = "";
  let bestCount = -1;
  for (const [key, count] of counter) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const byCell = new Map<string, Map<string, Tally>>();
  let cursor: string | undefined;

  for (;;) {
    const batch = await prisma.stretch.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        kind: true,
        label: true,
        slug: true,
        minLat: true,
        maxLat: true,
        minLng: true,
        maxLng: true,
      },
    });
    if (batch.length === 0) break;

    for (const row of batch) {
      const cell = cellFor((row.minLat + row.maxLat) / 2, (row.minLng + row.maxLng) / 2);
      let bySlug = byCell.get(cell);
      if (!bySlug) {
        bySlug = new Map();
        byCell.set(cell, bySlug);
      }
      let tally = bySlug.get(row.slug);
      if (!tally) {
        tally = { cell, slug: row.slug, count: 0, labels: new Map(), kinds: new Map() };
        bySlug.set(row.slug, tally);
      }
      tally.count += 1;
      bump(tally.labels, row.label);
      bump(tally.kinds, row.kind);
    }

    cursor = batch[batch.length - 1].id;
    if (batch.length < BATCH) break;
  }

  const data = [...byCell.values()].flatMap((bySlug) =>
    [...bySlug.values()].map((tally) => ({
      cell: tally.cell,
      slug: tally.slug,
      label: commonest(tally.labels),
      kind: commonest(tally.kinds),
      count: tally.count,
    })),
  );

  await prisma.$transaction([
    prisma.tagTrend.deleteMany({}),
    ...(data.length ? [prisma.tagTrend.createMany({ data })] : []),
  ]);

  return NextResponse.json({ cells: byCell.size, tags: data.length });
}

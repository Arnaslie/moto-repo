import { prisma } from "@/lib/prisma";
import {
  MAX_STRETCHES_PER_QUERY,
  type Bounds,
  type LatLng,
  type Stretch,
  type StretchKind,
} from "@moto/core/stretches";

const CANDIDATE_CAP = 500;

const stretchSelect = {
  id: true,
  kind: true,
  label: true,
  slug: true,
  path: true,
  createdAt: true,
  author: { select: { handle: true } },
} as const;

export async function stretchesWithin(
  bounds: Bounds,
  viewerId: string | null,
): Promise<Stretch[]> {
  const rows = await prisma.stretch.findMany({
    where: {
      minLat: { lte: bounds.maxLat },
      maxLat: { gte: bounds.minLat },
      minLng: { lte: bounds.maxLng },
      maxLng: { gte: bounds.minLng },
    },
    orderBy: { createdAt: "desc" },
    take: CANDIDATE_CAP,
    select: stretchSelect,
  });

  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);

  const [sums, confirms, mine] = await Promise.all([
    prisma.stretchVote.groupBy({
      by: ["stretchId"],
      where: { stretchId: { in: ids } },
      _sum: { value: true },
    }),
    prisma.stretchVote.groupBy({
      by: ["stretchId"],
      where: { stretchId: { in: ids }, value: 1 },
      _max: { createdAt: true },
    }),
    viewerId
      ? prisma.stretchVote.findMany({
          where: { stretchId: { in: ids }, userId: viewerId },
          select: { stretchId: true, value: true },
        })
      : Promise.resolve([]),
  ]);

  const scoreBy = new Map(sums.map((row) => [row.stretchId, row._sum.value ?? 0]));
  const confirmedBy = new Map(confirms.map((row) => [row.stretchId, row._max.createdAt]));
  const myVoteBy = new Map(mine.map((row) => [row.stretchId, row.value]));

  return rows
    .map((row) => ({
      id: row.id,
      author: row.author.handle,
      kind: row.kind as StretchKind,
      label: row.label,
      slug: row.slug,
      path: row.path as unknown as LatLng[],
      score: scoreBy.get(row.id) ?? 0,
      myVote: myVoteBy.get(row.id) ?? 0,
      createdAt: row.createdAt.toISOString(),
      lastConfirmedAt: (confirmedBy.get(row.id) ?? row.createdAt).toISOString(),
    }))
    .sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_STRETCHES_PER_QUERY);
}

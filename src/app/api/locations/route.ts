import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ACTIVE_WINDOW_MS,
  parseLocationInput,
  type RiderLocation,
} from "@/lib/locations";

function serialize(row: {
  rider: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  sharing: boolean;
  updatedAt: Date;
}): RiderLocation {
  return {
    rider: row.rider,
    lat: row.lat,
    lng: row.lng,
    accuracy: row.accuracy,
    sharing: row.sharing,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// GET /api/locations — riders currently sharing a fresh position.
export async function GET() {
  const since = new Date(Date.now() - ACTIVE_WINDOW_MS);
  const rows = await prisma.location.findMany({
    where: { sharing: true, updatedAt: { gte: since } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ locations: rows.map(serialize) });
}

// POST /api/locations — upsert my current position (or set sharing=false to
// go invisible). One row per rider handle.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = parseLocationInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { rider, lat, lng, accuracy, sharing } = parsed.value;
  const row = await prisma.location.upsert({
    where: { rider },
    create: { rider, lat, lng, accuracy, sharing },
    update: { lat, lng, accuracy, sharing },
  });

  return NextResponse.json({ location: serialize(row) });
}

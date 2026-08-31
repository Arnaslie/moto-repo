import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { parseMotorcycleInput, type Motorcycle } from "@/lib/motorcycles";

function serialize(m: {
  id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
}): Motorcycle {
  return { id: m.id, year: m.year, make: m.make, model: m.model, nickname: m.nickname };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = parseMotorcycleInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const bike = await prisma.motorcycle.create({
    data: { ...parsed.value, userId: user.id },
  });

  return NextResponse.json({ motorcycle: serialize(bike) }, { status: 201 });
}

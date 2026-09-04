import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parseLogin } from "@moto/core/auth";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = parseLogin(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { email, password } = parsed.value;

  // Explicit select: this row is only ever used to check a password and answer
  // with an id and a handle. Loading it whole pulls the rider's email and their
  // private body measurements into a request that has no use for either.
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, handle: true, passwordHash: true },
  });

  // Compare against a hash even when the user is missing, so a login for an
  // address with no account costs the same as one for an address with an
  // account. Otherwise the response time answers "is this person a member
  // here?" for anyone who cares to ask, which turns a breached-password list
  // into a short list of people worth trying it against.
  //
  // The dummy MUST be a well-formed bcrypt hash: exactly 60 characters, `$2a$`
  // then the cost, then 53 of salt and digest from bcrypt's own alphabet.
  // bcrypt rejects a malformed string immediately rather than running the KDF,
  // so a dummy of the wrong length returns in microseconds while the real path
  // takes ~85ms — and the mitigation reads as present while doing nothing,
  // which is worse than not having written it. The previous string here was 58
  // characters and did exactly that.
  //
  // Measured on this machine, bcryptjs at cost 10: 0.001ms for the old
  // 58-character string, 0.04ms at 62, 87.8ms for the 60 below, 84.2ms for a
  // real hash. If you edit this literal, time it — the length is the whole
  // mechanism and nothing else will tell you it broke.
  const hash =
    user?.passwordHash ??
    "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const valid = await bcrypt.compare(password, hash);
  if (!user || !valid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const session = await getSession();
  session.userId = user.id;
  await session.save();

  return NextResponse.json({ user: { id: user.id, handle: user.handle } });
}

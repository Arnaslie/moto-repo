import "server-only";
import { randomUUID } from "node:crypto";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  ANONYMOUS_WAVES_ENABLED,
  GUEST_WAVE_COOKIE,
  GUEST_WAVE_COOKIE_MAX_AGE,
  type WaveViewer,
} from "@/lib/waves";

export type SessionData = {
  userId?: string;
};

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error(
    "SESSION_SECRET must be set to at least 32 characters (see .env.example).",
  );
}

export const sessionOptions: SessionOptions = {
  password: sessionSecret,
  cookieName: "moto_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

// The currently authenticated user, or null. Safe to call in server
// components and route handlers.
export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      handle: true,
      displayName: true,
      bio: true,
      avatarSkin: true,
      createdAt: true,
    },
  });

  // Session points at a user that no longer exists — treat as logged out.
  // Cookie writes throw during a server-component render, so best-effort only.
  if (!user) {
    try {
      session.destroy();
      await session.save();
    } catch {
      /* not in a writable context — ignore */
    }
    return null;
  }

  return user;
}

// The guest id a signed-out visitor waves under, if they already have one.
// Read-only, so it's safe in a server component. Null means they've never
// waved (or the toggle is off) — either way there's nothing to match against.
export async function getGuestWaverId() {
  if (!ANONYMOUS_WAVES_ENABLED) return null;
  const cookieStore = await cookies();
  return cookieStore.get(GUEST_WAVE_COOKIE)?.value ?? null;
}

// Same, but mints one when it's missing. Writes a cookie, so this is only
// callable from a route handler or server function — a guest's first wave is
// what gives them their identity.
export async function ensureGuestWaverId() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_WAVE_COOKIE)?.value;
  if (existing) return existing;

  const guestId = randomUUID();
  cookieStore.set(GUEST_WAVE_COOKIE, guestId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_WAVE_COOKIE_MAX_AGE,
  });
  return guestId;
}

// Who to check waves against for this request. A signed-in rider wins; only a
// signed-out one falls back to their guest cookie.
export async function getWaveViewer(
  user: { id: string } | null,
): Promise<WaveViewer> {
  if (user) return { userId: user.id };
  return { guestId: await getGuestWaverId() };
}

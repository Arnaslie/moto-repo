import "server-only";
import { cache } from "react";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

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

// The currently authenticated user, or null. Safe in server components and
// route handlers. cache()d because the app layout asks for the header's rider
// and the page below it asks again — otherwise two identical lookups a render.
export const getCurrentUser = cache(async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      // No email. Nothing reads it — every call site takes id, handle or
      // displayName — and this is the object that is in scope on every page in
      // the app and the one most likely to be handed to a client component by
      // mistake. What isn't loaded can't be leaked.
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
      // No save() after destroy() — see the note in api/auth/logout. destroy()
      // writes the expiring cookie itself; saving would put a fresh one back.
      session.destroy();
    } catch {
      /* not in a writable context — ignore */
    }
    return null;
  }

  return user;
});

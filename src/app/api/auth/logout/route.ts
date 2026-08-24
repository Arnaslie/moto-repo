import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  // destroy() does both halves itself: it strips the keys off the session and
  // writes the cookie back with maxAge 0 so the browser drops it. Calling
  // save() after would re-seal the now-empty session into a fresh, full-expiry
  // cookie — replacing the deletion with a perfectly valid empty session, and
  // leaving a moto_session behind on the device forever.
  session.destroy();
  return NextResponse.json({ ok: true });
}

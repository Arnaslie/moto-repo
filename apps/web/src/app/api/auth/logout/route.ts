import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  // No save() after this: destroy() already writes the cookie back with maxAge
  // 0, and saving would re-seal the empty session into a fresh full-expiry
  // cookie, leaving a valid moto_session on the device forever.
  session.destroy();
  return NextResponse.json({ ok: true });
}

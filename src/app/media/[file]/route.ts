import { NextResponse } from "next/server";
import { readUpload } from "@/lib/uploads";

// GET /media/[file] — serve a user-uploaded image from the private uploads dir
// at request time. Reliable in dev and `next start` (unlike static public/
// serving, which only covers files present at build time).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const found = await readUpload(file);
  if (!found) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(found.body), {
    status: 200,
    headers: {
      "Content-Type": found.contentType,
      // Filenames are random + content-addressed enough to cache hard.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

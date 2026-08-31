import { NextResponse } from "next/server";
import { readUpload } from "@/lib/uploads";

// Served at request time out of the private uploads dir: static public/ serving
// only covers files present at build time, so runtime-written files need this.
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

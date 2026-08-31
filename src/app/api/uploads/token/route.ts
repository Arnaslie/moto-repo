import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  blobUploadsEnabled,
} from "@/lib/uploads";

// The browser uploads straight to Vercel Blob to skip the 4.5 MB request-body
// limit a file passing through this function would hit.
//
// This route never sees the image; it only decides whether the caller may
// upload and under what constraints, so the auth check below is the whole
// security boundary. Without it the store is open to anyone.
export async function POST(request: Request): Promise<NextResponse> {
  if (!blobUploadsEnabled()) {
    return NextResponse.json(
      { error: "Blob uploads are not configured. Uploads go to disk here." },
      { status: 404 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const user = await getCurrentUser();
        if (!user) {
          throw new Error("You must be signed in to upload images.");
        }
        return {
          // Blob enforces both of these itself, which is what makes it safe to
          // let the browser upload directly.
          allowedContentTypes: Object.keys(ALLOWED_IMAGE_TYPES),
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      onUploadCompleted: async () => {
        // Deliberately empty: the browser sends the blob URL on to POST
        // /api/posts, which is what persists it. Blob can't reach localhost
        // anyway, so anything living here would never run in dev.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}

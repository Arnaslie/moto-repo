import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  blobUploadsEnabled,
} from "@/lib/uploads";

// POST /api/uploads/token — hands the browser a short-lived token so it can
// upload an image straight to Vercel Blob, skipping the 4.5 MB request-body
// limit that a file passing through this function would hit.
//
// This route never sees the image itself. It only decides *whether* the caller
// may upload and under what constraints — so the auth check below is the whole
// security boundary. Without it the store would be open to anyone.
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
        // Deliberately empty. The browser gets the blob URL back from upload()
        // and sends it to POST /api/posts, which is what persists it — so
        // there's nothing to record here. (Blob can't reach localhost anyway,
        // so anything that lived here wouldn't run in dev.)
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

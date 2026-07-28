import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { saveUpload } from "@/lib/uploads";

// POST /api/uploads — accept a single image file (multipart/form-data, field
// "file") and return its public URL. Requires a signed-in user.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to upload images." },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form data." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const result = await saveUpload(file);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ url: result.url }, { status: 201 });
}

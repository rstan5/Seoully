import { NextResponse } from "next/server";
import { createPost } from "@/server/dal/social";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

export async function POST(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("invalid_media");
    const post = await createPost({
      file,
      caption: form.get("caption") ?? undefined,
      location: form.get("location") ?? undefined,
      taggedUserIds: [],
      taggedTemplateIds: [],
    }, client);
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "post_create_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

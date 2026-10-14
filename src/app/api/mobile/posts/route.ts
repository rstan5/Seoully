import { NextResponse } from "next/server";
import { createPost } from "@/server/dal/social";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

export async function POST(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (file !== null && !(file instanceof File)) throw new Error("invalid_media");
    const post = await createPost({
      file: file instanceof File ? file : undefined,
      caption: form.get("caption") ?? undefined,
      location: form.get("location") ?? undefined,
      taggedUserIds: JSON.parse(String(form.get("taggedUserIds") ?? "[]")),
      taggedTemplateIds: JSON.parse(String(form.get("taggedTemplateIds") ?? "[]")),
    }, client);
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    const allowed = new Set(["unauthenticated", "invalid_media", "invalid_post_content", "invalid_user_tag", "invalid_collectible_tag", "post_create_failed", "post_media_upload_failed", "post_media_record_failed", "post_user_tag_failed", "post_collectible_tag_failed", "post_read_failed"]);
    const reason = error instanceof Error && allowed.has(error.message) ? error.message : error instanceof SyntaxError || (error instanceof Error && error.name === "ZodError") ? "invalid_post_payload" : "post_create_failed";
    if (process.env.NODE_ENV !== "production") console.info("seoully_post_publish", { stage: "request_failed", status: reason === "unauthenticated" ? 401 : 400, code: reason });
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

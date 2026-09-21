import { NextResponse } from "next/server";
import { createPost } from "@/server/dal/social";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const taggedUserIds = parseIds(form.get("taggedUserIds"));
    const taggedTemplateIds = parseIds(form.get("taggedTemplateIds"));
    const post = await createPost({
      file: file instanceof File ? file : (undefined as never),
      caption: form.get("caption") ?? undefined,
      location: form.get("location") ?? undefined,
      taggedUserIds,
      taggedTemplateIds,
    });
    return NextResponse.json({ post }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "post_create_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400, headers: { "Cache-Control": "no-store" } });
  }
}

function parseIds(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; }
  catch { throw new Error("invalid_tags"); }
}

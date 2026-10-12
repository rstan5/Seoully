import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentIdentityFromClient } from "@/server/dal/profile";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";
export async function POST(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const identity = await getCurrentIdentityFromClient(client);
    if (!identity) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    const body = await request.formData();
    const parsed = z.string().uuid().safeParse(body.get("submissionId"));
    const file = body.get("file");
    if (!parsed.success || !(file instanceof File) || file.type !== "image/jpeg" || file.size < 4 || file.size > 5242880) return NextResponse.json({ error: "invalid_photo" }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) return NextResponse.json({ error: "invalid_photo" }, { status: 400 });
    const path = `${identity.user.id}/${parsed.data}.jpg`;
    const bucket = client.storage.from("profile-avatars");
    const { error } = await bucket.upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (error) {
      if (String((error as { statusCode?: string }).statusCode) !== "409") throw new Error("avatar_upload_failed");
      const existing = await bucket.createSignedUrl(path, 60);
      if (existing.error || !existing.data?.signedUrl) throw new Error("avatar_upload_failed");
    }
    return NextResponse.json({ avatarSubmissionId: parsed.data }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "avatar_upload_failed" }, { status: 400 }); }
}

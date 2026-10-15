import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";
const safe=new Set(["upload_canceled","upload_busy","invalid_upload_payload","unauthenticated","upload_not_authorized","invalid_user_tag","invalid_collectible_tag","upload_retry_changed","upload_expired","upload_not_found","upload_metadata_mismatch","upload_verification_failed","invalid_media","upload_payload_too_large","upload_unavailable","upload_copy_failed","upload_completion_failed","upload_delivery_failed","post_read_failed"]);
export async function uploadResponse(request: Request,run:(client:SupabaseClient)=>Promise<unknown>) {
  const client=createSupabaseBearerClient(request);
  if(!client) return NextResponse.json({error:"unauthenticated"},{status:401});
  try {return NextResponse.json(await run(client),{headers:{"Cache-Control":"private, no-store"}});}
  catch(error) {
    const code=error instanceof Error && safe.has(error.message)?error.message:error instanceof SyntaxError || (error instanceof Error && error.name==="ZodError")?"invalid_upload_payload":"upload_unavailable";
    return NextResponse.json({error:code},{status:code==="unauthenticated"?401:code==="upload_not_authorized"?403:400});
  }
}

import "server-only";
import { createClient } from "@supabase/supabase-js";
/** Call only after caller-auth ownership checks; never use for public response projection. */
export function createMediaStorageAdmin() {
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !key) throw new Error("upload_configuration_missing");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}

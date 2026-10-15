import { abandonPostUpload } from "@/server/media/direct-upload";
import { uploadResponse } from "@/server/media/upload-response";
export const runtime = "nodejs";
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  return uploadResponse(request,async client=>abandonPostUpload((await context.params).id,client));
}

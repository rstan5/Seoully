import { authorizeUpload } from "@/server/media/direct-upload";
import { uploadResponse } from "@/server/media/upload-response";
import { readUploadJson } from "@/server/media/read-upload-json";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return uploadResponse(request, async client => {
    return authorizeUpload(await readUploadJson(request),client);
  });
}

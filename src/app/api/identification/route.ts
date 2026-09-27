import { NextResponse } from "next/server";
import { getCurrentIdentity } from "@/server/dal/profile";
import { identifyAndSynthesize } from "@/server/identification/service";
import { persistIdentificationTrace, type IdentificationTrace } from "@/server/identification/trace";
import { randomUUID } from "node:crypto";

export async function POST(request: Request) {
  const trace: IdentificationTrace = { request: { traceId: randomUUID(), timestamp: new Date().toISOString() } };
  try {
    const identity = await getCurrentIdentity();
    if (!identity) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0) return NextResponse.json({ error: "invalid_media" }, { status: 400 });
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type) || file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "invalid_media" }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesImageSignature(file.type, bytes)) return NextResponse.json({ error: "invalid_media" }, { status: 400 });
    if (process.env.NODE_ENV === "development") {
      console.info("[identification] image_received", { mimeType: file.type, bytes: bytes.byteLength, signatureValid: true });
    }
    trace.image = { mimeType: file.type, bytes: bytes.byteLength, signatureValid: true, decoded: true, dimensions: null };
    const dataUrl = `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`;
    const result = await identifyAndSynthesize({ dataUrl, mimeType: file.type }, trace);
    if (process.env.NODE_ENV === "development") {
      console.info("[identification] final_response", result);
    }
    return NextResponse.json(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "identification_unavailable";
    trace.error = reason;
    return NextResponse.json({ error: reason, manualFallback: true }, { status: 503 });
  } finally {
    await persistIdentificationTrace(trace).catch(() => undefined);
  }
}

function matchesImageSignature(mime: string, bytes: Uint8Array): boolean {
  if (mime === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

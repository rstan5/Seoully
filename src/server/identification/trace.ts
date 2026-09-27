import "server-only";

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export interface IdentificationTrace {
  request: { traceId: string; timestamp: string };
  image?: Record<string, unknown>;
  openai?: Record<string, unknown>;
  catalog?: Record<string, unknown>;
  visual?: Record<string, unknown>;
  final?: Record<string, unknown>;
  error?: string;
}

export async function persistIdentificationTrace(trace: IdentificationTrace): Promise<void> {
  if (process.env.NODE_ENV !== "development") return;
  const file = path.join(process.cwd(), ".tmp", "identification-trace.jsonl");
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(trace)}\n`, "utf8");
}

/** Structural diagnostics only: no payloads, IDs, SQL messages or credentials. */
export function reportOperationFailure(operation: string, error: unknown) {
  const candidate = error as { code?: unknown; name?: unknown } | null;
  const code = typeof candidate?.code === "string" && /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(candidate.code) ? candidate.code : "unclassified";
  console.warn("seoully_operation_failed", { operation, code, validation: candidate?.name === "ZodError" });
}

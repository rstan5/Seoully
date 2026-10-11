/** Only allowlisted structural codes enter diagnostics; never log bodies or IDs. */
export async function apiFailure(response: Response, operation: string): Promise<never> {
  const allowed = new Set(['unauthenticated', 'holding_create_failed', 'holding_read_failed', 'holding_unavailable', 'template_not_found', 'invalid_media', 'unsupported_media_type', 'media_too_large', 'media_upload_failed', 'media_record_failed', 'media_delivery_failed']);
  let reason = 'request_failed';
  try { const body = await response.json(); if (allowed.has(body.error)) reason = body.error; } catch { /* Non-JSON errors remain structural. */ }
  console.warn('seoully_api_failure', { operation, status: response.status, reason });
  throw new Error(`${operation}:${response.status}:${reason}`);
}

export function apiTransportFailure(operation: string): never {
  console.warn('seoully_api_failure', { operation, status: 0, reason: 'network_failure' });
  throw new Error(`${operation}:000:network_failure`);
}

import { BillStoreError } from "./bill-store";

export const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export function jsonError(
  message: string,
  status: number,
  headers?: HeadersInit
) {
  return Response.json({ error: message }, { status, headers });
}

/**
 * Storage outages are safe to describe; every other failure is logged server
 * side and answered with a generic message so internal details stay private.
 */
export function routeErrorResponse(
  error: unknown,
  fallbackMessage: string,
  defaultStatus: number,
  headers?: HeadersInit
) {
  if (error instanceof BillStoreError) {
    return jsonError(error.message, 503, headers);
  }
  console.error(fallbackMessage, error);
  return jsonError(fallbackMessage, defaultStatus, headers);
}

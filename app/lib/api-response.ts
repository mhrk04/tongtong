import { BillStoreError } from "./bill-store";

export const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

/** Rejected because the request itself is malformed: always safe to echo back. */
export class ValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ValidationError";
  }
}

/** A dependency TongTong calls out to failed, not the caller's request. */
export class UpstreamError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "UpstreamError";
  }
}

export function jsonError(
  message: string,
  status: number,
  headers?: HeadersInit
) {
  return Response.json({ error: message }, { status, headers });
}

/**
 * Maps a thrown error onto a JSON response. Client mistakes and known
 * dependency failures keep their message; anything else is a bug or an
 * unexpected failure, so it is logged with its cause chain and answered with a
 * generic 500 instead of leaking internals to the caller.
 */
export function routeErrorResponse(
  error: unknown,
  fallbackMessage: string,
  headers?: HeadersInit
) {
  if (error instanceof ValidationError) {
    return jsonError(error.message, 400, headers);
  }
  if (error instanceof SyntaxError) {
    return jsonError("Request body must be valid JSON", 400, headers);
  }

  console.error(error);
  if (error instanceof BillStoreError) {
    return jsonError(error.message, 503, headers);
  }
  if (error instanceof UpstreamError) {
    return jsonError(error.message, 502, headers);
  }
  return jsonError(fallbackMessage, 500, headers);
}

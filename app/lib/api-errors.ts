import { BillStoreError } from "./bill-store";

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

/**
 * Maps a thrown error onto a JSON response. Client mistakes and known
 * dependency failures keep their message; anything else is a bug or an
 * unexpected failure, so it is logged with its cause chain and answered with a
 * generic 500 instead of leaking internals to the caller.
 */
export function errorResponse(
  error: unknown,
  fallbackMessage: string,
  init?: ResponseInit
) {
  const respond = (message: string, status: number) =>
    Response.json({ error: message }, { ...init, status });

  if (error instanceof ValidationError) {
    return respond(error.message, 400);
  }
  if (error instanceof SyntaxError) {
    return respond("Request body must be valid JSON", 400);
  }
  if (error instanceof BillStoreError) {
    console.error(error);
    return respond(error.message, 503);
  }
  if (error instanceof UpstreamError) {
    console.error(error);
    return respond(error.message, 502);
  }

  console.error(error);
  return respond(fallbackMessage, 500);
}

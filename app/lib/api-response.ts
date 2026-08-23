import { BillStoreError } from "./bill-store";
import { errorMessage } from "./errors";

export const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export function jsonError(
  message: string,
  status: number,
  headers?: HeadersInit
) {
  return Response.json({ error: message }, { status, headers });
}

export function routeErrorResponse(
  error: unknown,
  fallbackMessage: string,
  defaultStatus: number
) {
  return jsonError(
    errorMessage(error, fallbackMessage),
    error instanceof BillStoreError ? 503 : defaultStatus
  );
}

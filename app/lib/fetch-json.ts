export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Fetches JSON and turns every failure mode — offline, non-JSON body, error
 * status — into an `ApiError` carrying a message that is safe to show a user
 * and the status the retry logic needs. `status` is 0 when the request never
 * reached the server.
 */
export async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    throw new ApiError(
      "Could not reach TongTong. Check your connection and retry.",
      0,
      { cause }
    );
  }

  let body: string;
  try {
    body = await response.text();
  } catch (cause) {
    throw new ApiError(
      "The TongTong response was interrupted. Retry in a moment.",
      response.status,
      { cause }
    );
  }

  let payload: unknown;
  try {
    payload = body ? JSON.parse(body) : undefined;
  } catch (cause) {
    if (response.ok) {
      throw new ApiError(
        "TongTong returned an unexpected response.",
        response.status,
        { cause }
      );
    }
    payload = undefined;
  }

  if (!response.ok) {
    throw new ApiError(
      readErrorMessage(payload) ?? `Request failed (HTTP ${response.status})`,
      response.status
    );
  }
  if (payload === undefined) {
    throw new ApiError("TongTong returned an empty response.", response.status);
  }
  return payload as T;
}

function readErrorMessage(payload: unknown) {
  if (payload && typeof payload === "object") {
    const message = (payload as { error?: unknown }).error;
    if (typeof message === "string" && message) return message;
  }
  return undefined;
}

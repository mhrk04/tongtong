import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  errorResponse,
  UpstreamError,
  ValidationError,
} from "../app/lib/api-errors";
import { BillStoreError } from "../app/lib/bill-store";
import { parseTransactionError } from "../app/lib/errors";
import { ApiError, errorMessage, fetchJson } from "../app/lib/fetch-json";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetch(response: Response | Error) {
  globalThis.fetch = vi.fn(() =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response)
  ) as typeof fetch;
}

test("errorResponse maps validation, dependency, and unknown failures", async () => {
  const validation = errorResponse(
    new ValidationError("Invalid item 2"),
    "Could not create bill"
  );
  expect(validation.status).toBe(400);
  expect(await validation.json()).toEqual({ error: "Invalid item 2" });

  const badJson = errorResponse(new SyntaxError("Unexpected token <"), "nope");
  expect(badJson.status).toBe(400);
  expect(await badJson.json()).toEqual({
    error: "Request body must be valid JSON",
  });

  const storage = errorResponse(
    new BillStoreError("Bill storage is temporarily unavailable"),
    "nope"
  );
  expect(storage.status).toBe(503);

  const upstream = errorResponse(
    new UpstreamError("Devnet unreachable"),
    "nope"
  );
  expect(upstream.status).toBe(502);
});

test("errorResponse hides unexpected errors behind a 500", async () => {
  const response = errorResponse(
    new TypeError("bill.participants is not iterable"),
    "Could not verify payment"
  );

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Could not verify payment" });
  expect(console.error).toHaveBeenCalled();
});

test("fetchJson reports the API error message with its status", async () => {
  mockFetch(Response.json({ error: "Bill not found" }, { status: 404 }));

  const error = await fetchJson("/api/bills/TT-1").catch((reason) => reason);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).status).toBe(404);
  expect((error as ApiError).message).toBe("Bill not found");
});

test("fetchJson surfaces a status when the error body is not JSON", async () => {
  mockFetch(new Response("<html>gateway timeout</html>", { status: 504 }));

  const error = (await fetchJson("/api/bills").catch(
    (reason) => reason
  )) as ApiError;
  expect(error.status).toBe(504);
  expect(error.message).toBe("Request failed (HTTP 504)");
});

test("fetchJson reports unreachable and empty responses", async () => {
  mockFetch(new TypeError("Failed to fetch"));
  const offline = (await fetchJson("/api/bills").catch(
    (reason) => reason
  )) as ApiError;
  expect(offline.status).toBe(0);
  expect(offline.message).toContain("Could not reach TongTong");

  mockFetch(new Response("", { status: 200 }));
  const empty = (await fetchJson("/api/bills").catch(
    (reason) => reason
  )) as ApiError;
  expect(empty.message).toBe("TongTong returned an empty response.");
});

test("fetchJson returns the parsed payload on success", async () => {
  mockFetch(Response.json({ bill: { id: "TT-1" } }, { status: 200 }));

  await expect(
    fetchJson<{ bill: { id: string } }>("/api/bills")
  ).resolves.toEqual({ bill: { id: "TT-1" } });
});

test("errorMessage falls back when the failure carries no message", () => {
  expect(errorMessage(new Error("boom"), "fallback")).toBe("boom");
  expect(errorMessage(new Error(""), "fallback")).toBe("fallback");
  expect(errorMessage("boom", "fallback")).toBe("fallback");
});

test("parseTransactionError reads messages off wrapped non-Error rejections", () => {
  expect(parseTransactionError({ cause: { message: "User rejected" } })).toBe(
    "Transaction was rejected by the wallet."
  );
  expect(
    parseTransactionError(new Error("outer", { cause: { message: "inner" } }))
  ).toBe("inner");
  expect(parseTransactionError({})).toBe(
    "The transaction failed for an unknown reason."
  );
});

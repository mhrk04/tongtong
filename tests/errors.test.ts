import { describe, expect, test } from "vitest";
import { parseTransactionError } from "../app/lib/errors";

describe("parseTransactionError", () => {
  test("reports wallet rejections", () => {
    expect(parseTransactionError(new Error("User rejected the request"))).toBe(
      "Transaction was rejected by the wallet."
    );
  });

  test("prefers the last simulation logs found on the error chain", () => {
    const error = Object.assign(new Error("send failed"), {
      cause: Object.assign(new Error("simulation failed"), {
        logs: ["one", "two", "three", "four"],
      }),
    });

    expect(parseTransactionError(error)).toBe(
      "Transaction simulation failed: two | three | four"
    );
  });

  test("ignores empty and non-string logs", () => {
    expect(
      parseTransactionError(Object.assign(new Error("x"), { logs: [] }))
    ).toBe("x");
    expect(
      parseTransactionError(Object.assign(new Error("x"), { logs: [1, 2] }))
    ).toBe("x");
  });

  test("stops walking a cyclic cause chain", () => {
    const error: Record<string, unknown> = { message: "cyclic" };
    error.cause = error;

    expect(parseTransactionError(error)).toBe("cyclic");
  });

  test("explains insufficient funds from the deepest cause", () => {
    const error = new Error("send failed", {
      cause: new Error("Attempt to debit an account but found no record"),
    });

    expect(parseTransactionError(error)).toBe(
      "Not enough devnet SOL for transaction fees or token-account setup. Use the Solana faucet, then retry."
    );
  });

  test("keeps the deepest error message when causes are nested", () => {
    const error = new Error("outer", {
      cause: new Error("middle", { cause: new Error("inner") }),
    });

    expect(parseTransactionError(error)).toBe("inner");
  });

  test("keeps the outer message when the cause is not an Error", () => {
    expect(parseTransactionError(new Error("outer", { cause: "inner" }))).toBe(
      "outer"
    );
  });

  test("stringifies non-Error values", () => {
    expect(parseTransactionError("boom")).toBe("boom");
    expect(parseTransactionError(undefined)).toBe(
      "The transaction failed for an unknown reason."
    );
  });

  test("truncates long messages", () => {
    const message = parseTransactionError(new Error("a".repeat(250)));

    expect(message).toHaveLength(203);
    expect(message.endsWith("...")).toBe(true);
  });
});

import { describe, expect, test } from "vitest";
import { ellipsify, getExplorerUrl } from "../app/lib/explorer";

describe("getExplorerUrl", () => {
  test("omits the cluster query for mainnet", () => {
    expect(getExplorerUrl("/tx/abc", "mainnet")).toBe(
      "https://explorer.solana.com/tx/abc"
    );
  });

  test("passes named clusters through as a query parameter", () => {
    expect(getExplorerUrl("/address/abc", "devnet")).toBe(
      "https://explorer.solana.com/address/abc?cluster=devnet"
    );
  });

  test("points localnet at the local validator", () => {
    const url = new URL(getExplorerUrl("/tx/abc", "localnet"));

    expect(url.searchParams.get("cluster")).toBe("custom");
    expect(url.searchParams.get("customUrl")).toBe("http://localhost:8899");
  });
});

describe("ellipsify", () => {
  test("returns short strings unchanged", () => {
    expect(ellipsify("abcdefghijk")).toBe("abcdefghijk");
  });

  test("keeps the leading and trailing characters", () => {
    expect(ellipsify("abcdefghijkl")).toBe("abcd...ijkl");
  });

  test("honours a custom character count", () => {
    expect(ellipsify("abcdefghijkl", 2)).toBe("ab...kl");
  });
});

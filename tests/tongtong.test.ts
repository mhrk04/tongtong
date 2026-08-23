import { expect, test } from "vitest";
import { calculateQuote } from "../app/components/tongtong-flow";

test("calculates a fee-inclusive USDC share", () => {
  const quote = calculateQuote(240, 4, 4.7, 1);

  expect(quote.share).toBe(60);
  expect(quote.feeAmount).toBeCloseTo(0.6, 6);
  expect(quote.localTotal).toBeCloseTo(60.6, 6);
  expect(quote.usdc).toBeCloseTo(12.8936, 4);
});

test("falls back to safe defaults for empty inputs", () => {
  expect(calculateQuote(NaN, 0, 0, NaN)).toEqual({
    share: 0,
    feeAmount: 0,
    localTotal: 0,
    usdc: 0,
  });
});

test("treats a negative fee as no fee", () => {
  const quote = calculateQuote(100, 2, 5, -10);

  expect(quote.feeAmount).toBe(0);
  expect(quote.localTotal).toBe(50);
  expect(quote.usdc).toBe(10);
});

test("never splits a bill across fewer than one person", () => {
  expect(calculateQuote(100, -3, 1, 0).share).toBe(100);
});

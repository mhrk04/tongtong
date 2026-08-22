import { expect, test } from "vitest";
import { calculateQuote } from "../app/components/tongtong-flow";

test("calculates a fee-inclusive USDC share", () => {
  const quote = calculateQuote(240, 4, 4.7, 1);

  expect(quote.share).toBe(60);
  expect(quote.feeAmount).toBeCloseTo(0.6, 6);
  expect(quote.localTotal).toBeCloseTo(60.6, 6);
  expect(quote.usdc).toBeCloseTo(12.8936, 4);
});

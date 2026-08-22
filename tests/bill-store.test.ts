import { expect, test } from "vitest";
import { calculateParticipantAmount } from "../app/lib/bill-store";

test("calculates itemized shares and applies the fee", () => {
  const items = [
    { id: "food", name: "Food", amountMyr: 30, assigneeIds: ["p1", "p2"] },
    { id: "ride", name: "Ride", amountMyr: 10, assigneeIds: ["p1"] },
  ];

  const p1 = calculateParticipantAmount(items, "p1", 5, 1);
  const p2 = calculateParticipantAmount(items, "p2", 5, 1);

  expect(p1.amountMyr).toBeCloseTo(25.25, 6);
  expect(p1.amountUsdc).toBeCloseTo(5.05, 6);
  expect(p1.amountBaseUnits).toBe("5050000");
  expect(p2.amountMyr).toBeCloseTo(15.15, 6);
  expect(p2.amountUsdc).toBeCloseTo(3.03, 6);
});

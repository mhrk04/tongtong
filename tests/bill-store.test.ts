import { expect, test } from "vitest";
import {
  calculateParticipantAmount,
  getBill,
  isValidBillId,
} from "../app/lib/bill-store";

test("rejects bill ids outside the generated format", () => {
  expect(isValidBillId("TT-A1B2C3D4")).toBe(true);
  expect(isValidBillId("TT-A1B2C3D4E5F60718")).toBe(true);
  expect(isValidBillId("../../secrets")).toBe(false);
  expect(isValidBillId("TT-../../secrets")).toBe(false);
  expect(isValidBillId("tt-a1b2c3d4")).toBe(false);
});

test("does not read storage for traversal ids", async () => {
  await expect(getBill("../../secrets")).rejects.toThrow("Invalid bill id");
});

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

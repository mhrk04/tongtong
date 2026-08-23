import { afterEach, describe, expect, test } from "vitest";
import {
  BillStoreConfigurationError,
  BillStoreError,
  calculateParticipantAmount,
  createBill,
  getBill,
  saveBill,
  type Bill,
  type BillItem,
} from "../app/lib/bill-store";

const items: BillItem[] = [
  { id: "food", name: "Food", amountMyr: 30, assigneeIds: ["p1", "p2"] },
  { id: "ride", name: "Ride", amountMyr: 10, assigneeIds: ["p1"] },
];

afterEach(() => {
  delete process.env.VERCEL;
});

test("calculates itemized shares and applies the fee", () => {
  const p1 = calculateParticipantAmount(items, "p1", 5, 1);
  const p2 = calculateParticipantAmount(items, "p2", 5, 1);

  expect(p1.amountMyr).toBeCloseTo(25.25, 6);
  expect(p1.amountUsdc).toBeCloseTo(5.05, 6);
  expect(p1.amountBaseUnits).toBe("5050000");
  expect(p2.amountMyr).toBeCloseTo(15.15, 6);
  expect(p2.amountUsdc).toBeCloseTo(3.03, 6);
});

describe("calculateParticipantAmount", () => {
  test("charges nothing to an unassigned participant", () => {
    expect(calculateParticipantAmount(items, "p3", 5, 1)).toEqual({
      amountMyr: 0,
      amountUsdc: 0,
      amountBaseUnits: "0",
    });
  });

  test("skips the fee when the fee percent is zero", () => {
    const share = calculateParticipantAmount(items, "p2", 4, 0);

    expect(share.amountMyr).toBeCloseTo(15, 6);
    expect(share.amountBaseUnits).toBe("3750000");
  });

  test("rounds base units to whole USDC micro-units", () => {
    const share = calculateParticipantAmount(
      [
        {
          id: "i",
          name: "Item",
          amountMyr: 10,
          assigneeIds: ["p1", "p2", "p3"],
        },
      ],
      "p1",
      3,
      0
    );

    expect(share.amountBaseUnits).toBe("1111111");
  });
});

describe("createBill", () => {
  test("derives participants, references and the total", async () => {
    const bill = await createBill({
      title: "  Dinner  ",
      hostWallet: "HostWallet",
      rate: 5,
      feePercent: 1,
      items,
      participantNames: ["  Ada  ", "Bob"],
    });

    expect(bill.id).toMatch(/^TT-[0-9A-F]{8}$/);
    expect(bill.title).toBe("Dinner");
    expect(bill.totalMyr).toBe(40);
    expect(Date.parse(bill.createdAt)).not.toBeNaN();
    expect(bill.participants.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(bill.participants[0]).toMatchObject({
      name: "Ada",
      paymentReference: `${bill.id}/p1`,
      status: "pending",
      amountBaseUnits: "5050000",
    });
    expect(bill.participants[1].paymentReference).toBe(`${bill.id}/p2`);
  });

  test("falls back to placeholder names and title", async () => {
    const bill = await createBill({
      title: "   ",
      hostWallet: "HostWallet",
      rate: 5,
      feePercent: 0,
      items,
      participantNames: ["", " "],
    });

    expect(bill.title).toBe("Shared bill");
    expect(bill.participants.map((p) => p.name)).toEqual([
      "Friend 1",
      "Friend 2",
    ]);
  });

  test("stores the bill so it can be read back", async () => {
    const bill = await createBill({
      title: "Lunch",
      hostWallet: "HostWallet",
      rate: 5,
      feePercent: 1,
      items,
      participantNames: ["Ada", "Bob"],
    });

    expect(await getBill(bill.id)).toEqual(bill);
  });
});

describe("in-memory storage", () => {
  const bill: Bill = {
    id: "TT-STORE01",
    title: "Bill",
    hostWallet: "HostWallet",
    rate: 5,
    feePercent: 1,
    items,
    participants: [],
    totalMyr: 40,
    createdAt: new Date().toISOString(),
  };

  test("returns undefined for an unknown bill", async () => {
    expect(await getBill("TT-MISSING")).toBeUndefined();
  });

  test("round-trips a saved bill", async () => {
    expect(await saveBill(bill)).toBe(bill);
    expect(await getBill(bill.id)).toEqual(bill);
  });

  test("rejects reads and writes on Vercel without a blob token", async () => {
    process.env.VERCEL = "1";

    await expect(getBill(bill.id)).rejects.toThrow(BillStoreConfigurationError);
    await expect(saveBill(bill)).rejects.toBeInstanceOf(BillStoreError);
  });
});

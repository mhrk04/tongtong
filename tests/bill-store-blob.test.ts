import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Bill } from "../app/lib/bill-store";

const get = vi.fn();
const put = vi.fn();
class MockBlobPreconditionFailedError extends Error {}

vi.mock("@vercel/blob", () => ({
  BlobPreconditionFailedError: MockBlobPreconditionFailedError,
  get,
  put,
}));

// The store reads its token once at import time, so it has to be set before
// the dynamic import below to exercise the Blob-backed code path.
process.env.BLOB_READ_WRITE_TOKEN = "test-token";
const { BillStoreError, getBill, saveBill, settleBillShare } =
  await import("../app/lib/bill-store");

const bill: Bill = {
  id: "TT-B10B0001",
  title: "Dinner",
  hostWallet: "HostWallet",
  rate: 5,
  feePercent: 1,
  items: [{ id: "item-1", name: "Food", amountMyr: 30, assigneeIds: ["p1"] }],
  participants: [],
  totalMyr: 30,
  createdAt: "2024-01-01T00:00:00.000Z",
};

beforeEach(() => {
  get.mockReset();
  put.mockReset();
});

describe("getBill with Blob storage", () => {
  test("reads and parses the stored blob", async () => {
    get.mockResolvedValue({
      statusCode: 200,
      stream: new Response(JSON.stringify(bill)).body,
      blob: { etag: "etag-1" },
    });

    expect(await getBill(bill.id)).toEqual(bill);
    expect(get).toHaveBeenCalledWith("tongtong/bills/TT-B10B0001.json", {
      access: "private",
      token: "test-token",
      useCache: false,
    });
  });

  test.each([
    ["the blob is missing", undefined],
    ["the response is not a 200", { statusCode: 404, stream: null }],
    ["the response has no body", { statusCode: 200, stream: null }],
  ])("returns undefined when %s", async (_label, result) => {
    get.mockResolvedValue(result);

    expect(await getBill(bill.id)).toBeUndefined();
  });

  test("covers a legacy creator share and writes it back", async () => {
    const legacy: Bill = {
      ...bill,
      participants: [
        {
          id: "p1",
          name: "Ada",
          amountMyr: 30,
          amountUsdc: 6,
          amountBaseUnits: "6000000",
          paymentReference: `${bill.id}/p1`,
          status: "pending",
        },
      ],
    };
    get.mockResolvedValue({
      statusCode: 200,
      stream: new Response(JSON.stringify(legacy)).body,
      blob: { etag: "etag-legacy" },
    });
    put.mockResolvedValue({});

    const stored = await getBill(legacy.id);

    expect(stored?.participants[0]).toMatchObject({
      status: "paid",
      paidBy: legacy.hostWallet,
    });
    expect(put).toHaveBeenCalledOnce();
  });

  test("wraps read failures in a BillStoreError", async () => {
    get.mockRejectedValue(new Error("network down"));

    await expect(getBill(bill.id)).rejects.toThrow(
      new BillStoreError("Bill storage is temporarily unavailable")
    );
  });
});

describe("saveBill with Blob storage", () => {
  test("writes the bill as overwritable JSON", async () => {
    put.mockResolvedValue({});

    expect(await saveBill(bill)).toBe(bill);
    expect(put).toHaveBeenCalledWith(
      "tongtong/bills/TT-B10B0001.json",
      JSON.stringify(bill),
      {
        access: "private",
        allowOverwrite: true,
        contentType: "application/json",
        token: "test-token",
      }
    );
  });

  test("wraps write failures in a BillStoreError", async () => {
    put.mockRejectedValue(new Error("network down"));

    await expect(saveBill(bill)).rejects.toThrow(
      new BillStoreError("Bill storage is temporarily unavailable")
    );
  });
});

test("settles a Blob-backed share with an ETag precondition", async () => {
  const pending = {
    ...bill,
    participants: [
      {
        id: "p2",
        name: "Bob",
        amountMyr: 30,
        amountUsdc: 6,
        amountBaseUnits: "6000000",
        paymentReference: `${bill.id}/p2`,
        status: "pending" as const,
      },
    ],
  };
  get.mockResolvedValue({
    statusCode: 200,
    stream: new Response(JSON.stringify(pending)).body,
    blob: { etag: "etag-pending" },
  });
  put.mockResolvedValue({});

  const settled = await settleBillShare(bill.id, "p2", "5".repeat(64));

  expect(settled?.bill.participants[0]).toMatchObject({
    status: "paid",
    signature: "5".repeat(64),
  });
  expect(put).toHaveBeenCalledWith(
    "tongtong/bills/TT-B10B0001.json",
    expect.stringContaining('"status":"paid"'),
    expect.objectContaining({ ifMatch: "etag-pending" })
  );
});

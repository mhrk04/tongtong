import { describe, expect, test } from "vitest";
import { GET } from "../app/api/bills/[billId]/route";
import { POST } from "../app/api/bills/route";

const HOST_WALLET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

type BillPayload = Record<string, unknown>;

function postBill(body: BillPayload | null) {
  return POST(
    new Request("http://localhost/api/bills", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

function validBill(overrides: BillPayload = {}): BillPayload {
  return {
    title: "Dinner",
    hostWallet: HOST_WALLET,
    rate: 4.7,
    feePercent: 1,
    participantNames: ["Ada", "Bob"],
    items: [
      { name: "Food", amountMyr: 30, assigneeIds: ["p1", "p2"] },
      { name: "Ride", amountMyr: 10, assigneeIds: ["p2"] },
    ],
    ...overrides,
  };
}

describe("POST /api/bills", () => {
  test("creates a bill with normalized items", async () => {
    const response = await postBill(validBill());

    expect(response.status).toBe(201);
    const { bill } = await response.json();
    expect(bill.items.map((item: { id: string }) => item.id)).toEqual([
      "item-1",
      "item-2",
    ]);
    expect(bill.hostWallet).toBe(HOST_WALLET);
    expect(bill.participants).toHaveLength(2);
    expect(bill.totalMyr).toBe(40);
  });

  test.each([
    ["a non-string title", { title: 7 }],
    ["a non-string host wallet", { hostWallet: 7 }],
    ["participant names that are not an array", { participantNames: "Ada" }],
    ["fewer than two participants", { participantNames: ["Ada"] }],
    [
      "more than eight participants",
      { participantNames: Array.from({ length: 9 }, (_, i) => `p${i}`) },
    ],
    ["items that are not an array", { items: {} }],
    ["no items", { items: [] }],
    [
      "more than fifty items",
      {
        items: Array.from({ length: 51 }, () => ({
          name: "Food",
          amountMyr: 1,
          assigneeIds: ["p1", "p2"],
        })),
      },
    ],
    ["a non-numeric rate", { rate: "abc" }],
    ["a zero rate", { rate: 0 }],
    ["a non-numeric fee", { feePercent: "abc" }],
    ["a negative fee", { feePercent: -1 }],
  ])("rejects %s", async (_label, overrides) => {
    const response = await postBill(validBill(overrides));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid bill details" });
  });

  test("rejects a host wallet that is not a Solana address", async () => {
    const response = await postBill(
      validBill({ hostWallet: "not-an-address" })
    );

    expect(response.status).toBe(400);
  });

  test("rejects a malformed request body", async () => {
    const response = await POST(
      new Request("http://localhost/api/bills", {
        method: "POST",
        body: "{",
      })
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBeTruthy();
  });

  test("rejects a body that is not an object", async () => {
    const response = await postBill(null);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid bill details" });
  });

  test.each([
    ["a blank name", { name: "  " }],
    ["a non-numeric amount", { amountMyr: "abc" }],
    ["a zero amount", { amountMyr: 0 }],
    ["assignees that are not an array", { assigneeIds: "p1" }],
    ["no assignees", { assigneeIds: [] }],
  ])("rejects an item with %s", async (_label, itemOverrides) => {
    const response = await postBill(
      validBill({
        items: [
          { name: "Food", amountMyr: 30, assigneeIds: ["p1", "p2"] },
          {
            name: "Ride",
            amountMyr: 10,
            assigneeIds: ["p2"],
            ...itemOverrides,
          },
        ],
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid item 2" });
  });

  test("rejects items assigned to unknown participants", async () => {
    const response = await postBill(
      validBill({
        items: [{ name: "Food", amountMyr: 30, assigneeIds: ["p1", "p9"] }],
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid item assignment" });
  });

  test("rejects a participant with no assigned item", async () => {
    const response = await postBill(
      validBill({
        items: [{ name: "Food", amountMyr: 30, assigneeIds: ["p1"] }],
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Every person must have at least one assigned item",
    });
  });
});

describe("GET /api/bills/[billId]", () => {
  test("returns a stored bill without caching", async () => {
    const created = await (await postBill(validBill())).json();

    const response = await GET(
      new Request(`http://localhost/api/bills/${created.bill.id}`),
      { params: Promise.resolve({ billId: created.bill.id }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual(created);
  });

  test("returns 404 for a malformed bill id", async () => {
    const response = await GET(
      new Request("http://localhost/api/bills/does-not-exist"),
      { params: Promise.resolve({ billId: "does-not-exist" }) }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Bill not found" });
  });

  test("returns 404 for an unknown bill", async () => {
    const response = await GET(
      new Request("http://localhost/api/bills/TT-DEADBEEF"),
      { params: Promise.resolve({ billId: "TT-DEADBEEF" }) }
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Bill not found" });
  });

  test("surfaces storage misconfiguration as 503", async () => {
    process.env.VERCEL = "1";
    try {
      const response = await GET(
        new Request("http://localhost/api/bills/TT-DEADBEEF"),
        { params: Promise.resolve({ billId: "TT-DEADBEEF" }) }
      );

      expect(response.status).toBe(503);
      expect((await response.json()).error).toContain(
        "Persistent bill storage is not configured"
      );
    } finally {
      delete process.env.VERCEL;
    }
  });
});

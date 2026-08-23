import { beforeEach, describe, expect, test, vi } from "vitest";

const getTransaction = vi.fn();

vi.mock("@solana/kit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@solana/kit")>()),
  createSolanaRpc: () => ({
    getTransaction: (...args: unknown[]) => ({
      send: () => getTransaction(...args),
    }),
  }),
}));

const { createBill, USDC_DEVNET_MINT } = await import("../app/lib/bill-store");
const { POST } = await import("../app/api/bills/[billId]/verify/route");

const HOST_WALLET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const SIGNATURE = "5".repeat(64);

async function seedBill() {
  return createBill({
    title: "Dinner",
    hostWallet: HOST_WALLET,
    rate: 5,
    feePercent: 0,
    items: [{ id: "item-1", name: "Food", amountMyr: 30, assigneeIds: ["p1"] }],
    participantNames: ["Ada"],
  });
}

function verify(billId: string, body: unknown) {
  return POST(
    new Request(`http://localhost/api/bills/${billId}/verify`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ billId }) }
  );
}

function transferTransaction({
  amount = "6000000",
  owner = HOST_WALLET,
  mint = USDC_DEVNET_MINT,
  memo,
  err = null,
}: {
  amount?: string;
  owner?: string;
  mint?: string;
  memo?: unknown;
  err?: unknown;
}) {
  return {
    meta: {
      err,
      preTokenBalances: [
        { owner, mint, uiTokenAmount: { amount: "1000000" } },
        // Balances for other owners and mints must not count toward the share.
        { owner: "SomeoneElse", mint, uiTokenAmount: { amount: "9000000" } },
        { owner, mint: "OtherMint", uiTokenAmount: { amount: "9000000" } },
      ],
      postTokenBalances: [
        {
          owner,
          mint,
          uiTokenAmount: { amount: String(1_000_000n + BigInt(amount)) },
        },
      ],
    },
    transaction: {
      message: {
        instructions: [
          { program: "spl-token" },
          ...(memo === undefined
            ? []
            : [{ program: "spl-memo", parsed: memo }]),
        ],
      },
    },
  };
}

beforeEach(() => {
  getTransaction.mockReset();
});

describe("POST /api/bills/[billId]/verify", () => {
  test("returns 404 for an unknown bill", async () => {
    const response = await verify("TT-NOPE", {
      participantId: "p1",
      signature: SIGNATURE,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Bill not found" });
  });

  test.each([
    ["an unknown participant", { participantId: "p9", signature: SIGNATURE }],
    ["a missing signature", { participantId: "p1" }],
  ])("rejects %s", async (_label, body) => {
    const bill = await seedBill();

    const response = await verify(bill.id, body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid payment details",
    });
  });

  test("returns 409 while the transaction is unconfirmed", async () => {
    const bill = await seedBill();
    getTransaction.mockResolvedValue(null);

    const response = await verify(bill.id, {
      participantId: "p1",
      signature: SIGNATURE,
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Transaction is not confirmed yet",
    });
  });

  test("rejects a transaction that failed on chain", async () => {
    const bill = await seedBill();
    getTransaction.mockResolvedValue(
      transferTransaction({
        memo: bill.participants[0].paymentReference,
        err: {},
      })
    );

    const response = await verify(bill.id, {
      participantId: "p1",
      signature: SIGNATURE,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Transaction failed on devnet",
    });
  });

  test.each([
    ["the transferred amount differs", { amount: "5000000" }],
    ["the memo is missing", { memo: undefined }],
    ["the memo references another participant", { memo: "TT-OTHER/p1" }],
    ["the host wallet did not receive the funds", { owner: "SomeoneElse" }],
    ["the funds are not USDC", { mint: "OtherMint" }],
  ])("rejects a payment when %s", async (_label, overrides) => {
    const bill = await seedBill();
    getTransaction.mockResolvedValue(
      transferTransaction({
        memo: bill.participants[0].paymentReference,
        ...overrides,
      })
    );

    const response = await verify(bill.id, {
      participantId: "p1",
      signature: SIGNATURE,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Payment does not match this participant's bill share",
    });
  });

  test("marks the participant paid and is idempotent", async () => {
    const bill = await seedBill();
    getTransaction.mockResolvedValue(
      transferTransaction({
        memo: { memo: bill.participants[0].paymentReference },
      })
    );

    const response = await verify(bill.id, {
      participantId: "p1",
      signature: SIGNATURE,
    });

    expect(response.status).toBe(200);
    const paid = (await response.json()).bill;
    expect(paid.participants[0]).toMatchObject({
      status: "paid",
      signature: SIGNATURE,
    });

    getTransaction.mockRejectedValue(new Error("should not be called"));
    const replay = await verify(bill.id, {
      participantId: "p1",
      signature: SIGNATURE,
    });

    expect(replay.status).toBe(200);
    expect((await replay.json()).bill).toEqual(paid);
  });

  test("surfaces RPC failures", async () => {
    const bill = await seedBill();
    getTransaction.mockRejectedValue(new Error("rpc unavailable"));

    const response = await verify(bill.id, {
      participantId: "p1",
      signature: SIGNATURE,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "rpc unavailable" });
  });
});

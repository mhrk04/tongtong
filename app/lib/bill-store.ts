export const USDC_DEVNET_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export type BillItem = {
  id: string;
  name: string;
  amountMyr: number;
  assigneeIds: string[];
};

export type BillParticipant = {
  id: string;
  name: string;
  amountMyr: number;
  amountUsdc: number;
  amountBaseUnits: string;
  paymentReference: string;
  status: "pending" | "paid";
  signature?: string;
  paidBy?: string;
};

export type Bill = {
  id: string;
  title: string;
  hostWallet: string;
  rate: number;
  feePercent: number;
  items: BillItem[];
  participants: BillParticipant[];
  totalMyr: number;
  createdAt: string;
};

declare global {
  // ponytail: local fallback only; Vercel uses Redis for cross-instance state.
  var __tongtongBills: Map<string, Bill> | undefined;
}

const bills = (globalThis.__tongtongBills ??= new Map<string, Bill>());
const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export class BillStoreError extends Error {}

export class BillStoreConfigurationError extends BillStoreError {
  constructor() {
    super(
      "Persistent bill storage is not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel."
    );
  }
}

function assertStorageAvailable() {
  if (process.env.VERCEL === "1" && (!redisUrl || !redisToken)) {
    throw new BillStoreConfigurationError();
  }
}

async function redisCommand<T>(command: string[]) {
  if (!redisUrl || !redisToken) {
    assertStorageAvailable();
    return undefined as T;
  }

  try {
    const response = await fetch(redisUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      result?: T;
      error?: string;
    };

    if (!response.ok || payload.error) {
      throw new Error("Redis request failed");
    }
    return payload.result as T;
  } catch {
    throw new BillStoreError("Bill storage is temporarily unavailable");
  }
}

function billKey(id: string) {
  return `tongtong:bill:${id}`;
}

export async function getBill(id: string) {
  if (!redisUrl || !redisToken) {
    assertStorageAvailable();
    return bills.get(id);
  }

  const stored = await redisCommand<string | null>(["GET", billKey(id)]);
  if (!stored) return undefined;

  try {
    return JSON.parse(stored) as Bill;
  } catch {
    throw new BillStoreError("Stored bill data is invalid");
  }
}

export async function saveBill(bill: Bill) {
  if (!redisUrl || !redisToken) {
    assertStorageAvailable();
    bills.set(bill.id, bill);
    return bill;
  }

  await redisCommand(["SET", billKey(bill.id), JSON.stringify(bill)]);
  return bill;
}

export function calculateParticipantAmount(
  items: BillItem[],
  participantId: string,
  rate: number,
  feePercent: number
) {
  const baseMyr = items.reduce((total, item) => {
    if (!item.assigneeIds.includes(participantId)) return total;
    return total + item.amountMyr / item.assigneeIds.length;
  }, 0);
  const amountMyr = baseMyr * (1 + feePercent / 100);
  const amountUsdc = amountMyr / rate;

  return {
    amountMyr,
    amountUsdc,
    amountBaseUnits: String(Math.round(amountUsdc * 1_000_000)),
  };
}

export async function createBill(input: {
  title: string;
  hostWallet: string;
  rate: number;
  feePercent: number;
  items: BillItem[];
  participantNames: string[];
}) {
  const id = `TT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const participants = input.participantNames.map((name, index) => {
    const participantId = `p${index + 1}`;
    const amount = calculateParticipantAmount(
      input.items,
      participantId,
      input.rate,
      input.feePercent
    );

    return {
      id: participantId,
      name: name.trim() || `Friend ${index + 1}`,
      ...amount,
      paymentReference: `${id}/${participantId}`,
      status: "pending" as const,
    };
  });

  return saveBill({
    id,
    title: input.title.trim() || "Shared bill",
    hostWallet: input.hostWallet,
    rate: input.rate,
    feePercent: input.feePercent,
    items: input.items,
    participants,
    totalMyr: input.items.reduce((total, item) => total + item.amountMyr, 0),
    createdAt: new Date().toISOString(),
  });
}

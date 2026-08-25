import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

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
  // ponytail: local fallback only; Vercel uses Blob for cross-instance state.
  var __tongtongBills: Map<string, Bill> | undefined;
}

const bills = (globalThis.__tongtongBills ??= new Map<string, Bill>());
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

export class BillStoreError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BillStoreError";
  }
}

export class InvalidBillIdError extends Error {
  constructor() {
    super("Invalid bill id");
  }
}

const BILL_ID_PATTERN = /^TT-[0-9A-F]{8,16}$/;

export function isValidBillId(id: unknown): id is string {
  return typeof id === "string" && BILL_ID_PATTERN.test(id);
}

function assertValidBillId(id: string) {
  if (!isValidBillId(id)) throw new InvalidBillIdError();
}

export class BillStoreConfigurationError extends BillStoreError {
  constructor() {
    super(
      "Persistent bill storage is not configured. Create a Vercel Blob store and connect it to this project."
    );
    this.name = "BillStoreConfigurationError";
  }
}

function assertStorageAvailable() {
  if (process.env.VERCEL === "1" && !blobToken) {
    throw new BillStoreConfigurationError();
  }
}

function blobPath(id: string) {
  assertValidBillId(id);
  return `tongtong/bills/${id}.json`;
}

function coverCreatorShare(bill: Bill) {
  const creator = bill.participants.find(
    (participant) => participant.id === "p1"
  );
  if (!creator || creator.status !== "pending") return false;
  creator.status = "paid";
  creator.paidBy = bill.hostWallet;
  return true;
}

async function readBlobBill(id: string) {
  let serialized: string;
  let etag: string;
  try {
    const result = await get(blobPath(id), {
      access: "private",
      token: blobToken,
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return undefined;
    }
    etag = result.blob.etag;
    serialized = await new Response(result.stream).text();
  } catch (cause) {
    throw new BillStoreError("Bill storage is temporarily unavailable", {
      cause,
    });
  }

  try {
    return { bill: JSON.parse(serialized) as Bill, etag };
  } catch (cause) {
    throw new BillStoreError(`Stored bill ${id} is corrupted`, { cause });
  }
}

export async function getBill(id: string) {
  assertValidBillId(id);
  if (!blobToken) {
    assertStorageAvailable();
    const bill = bills.get(id);
    if (bill) coverCreatorShare(bill);
    return bill;
  }
  const stored = await readBlobBill(id);
  if (stored && coverCreatorShare(stored.bill)) await saveBill(stored.bill);
  return stored?.bill;
}

export async function saveBill(bill: Bill) {
  assertValidBillId(bill.id);
  if (!blobToken) {
    assertStorageAvailable();
    bills.set(bill.id, bill);
    return bill;
  }

  try {
    await put(blobPath(bill.id), JSON.stringify(bill), {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
      token: blobToken,
    });
  } catch (cause) {
    throw new BillStoreError("Bill storage is temporarily unavailable", {
      cause,
    });
  }
  return bill;
}

export async function settleBillShare(
  billId: string,
  participantId: string,
  signature: string
) {
  assertValidBillId(billId);

  if (!blobToken) {
    assertStorageAvailable();
    const bill = bills.get(billId);
    const participant = bill?.participants.find(
      (candidate) => candidate.id === participantId
    );
    if (!bill || !participant) return undefined;
    if (participant.status === "paid") {
      return { bill, replay: participant.signature === signature };
    }
    participant.status = "paid";
    participant.signature = signature;
    return { bill, replay: false };
  }

  const stored = await readBlobBill(billId);
  const participant = stored?.bill.participants.find(
    (candidate) => candidate.id === participantId
  );
  if (!stored || !participant) return undefined;
  if (participant.status === "paid") {
    return { bill: stored.bill, replay: participant.signature === signature };
  }

  const settledBill = {
    ...stored.bill,
    participants: stored.bill.participants.map((candidate) =>
      candidate.id === participantId
        ? { ...candidate, status: "paid" as const, signature }
        : candidate
    ),
  };
  try {
    await put(blobPath(billId), JSON.stringify(settledBill), {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
      ifMatch: stored.etag,
      token: blobToken,
    });
    return { bill: settledBill, replay: false };
  } catch (error) {
    if (!(error instanceof BlobPreconditionFailedError)) throw error;
    const latest = await readBlobBill(billId);
    const latestParticipant = latest?.bill.participants.find(
      (candidate) => candidate.id === participantId
    );
    if (!latest || !latestParticipant) return undefined;
    return {
      bill: latest.bill,
      replay: latestParticipant.signature === signature,
    };
  }
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
  const id = `TT-${Array.from(
    crypto.getRandomValues(new Uint8Array(8)),
    (byte) => byte.toString(16).padStart(2, "0")
  )
    .join("")
    .toUpperCase()}`;
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
      status: index === 0 ? ("paid" as const) : ("pending" as const),
      paidBy: index === 0 ? input.hostWallet : undefined,
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

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
  // ponytail: in-memory demo store; use a database before deployment.
  var __tongtongBills: Map<string, Bill> | undefined;
}

const bills = (globalThis.__tongtongBills ??= new Map<string, Bill>());

export function getBill(id: string) {
  return bills.get(id);
}

export function saveBill(bill: Bill) {
  bills.set(bill.id, bill);
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

export function createBill(input: {
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

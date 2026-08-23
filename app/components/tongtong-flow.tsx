"use client";

import { useEffect, useMemo, useState } from "react";
import { address, nonDivisibleSequentialInstructionPlan } from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { toast } from "sonner";
import type { Bill, BillItem, BillParticipant } from "../lib/bill-store";
import { USDC_DEVNET_MINT } from "../lib/bill-store";
import { useAppClient } from "../lib/client-provider";
import { useSend } from "../lib/hooks/use-send";
import { useBalance } from "../lib/hooks/use-balance";
import { ApiError, errorMessage, fetchJson } from "../lib/fetch-json";
import { parseTransactionError } from "../lib/errors";

const formatter = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type DraftParticipant = { id: string; name: string };
type DraftItem = BillItem;

const initialParticipants: DraftParticipant[] = [
  { id: "p1", name: "You" },
  { id: "p2", name: "Friend 1" },
  { id: "p3", name: "Friend 2" },
];

const initialItems: DraftItem[] = [
  {
    id: "item-1",
    name: "Nasi lemak",
    amountMyr: 36,
    assigneeIds: ["p1", "p2", "p3"],
  },
  { id: "item-2", name: "Grab ride", amountMyr: 24, assigneeIds: ["p1", "p2"] },
  {
    id: "item-3",
    name: "Drinks",
    amountMyr: 18,
    assigneeIds: ["p1", "p2", "p3"],
  },
];

export function calculateQuote(
  total: number,
  people: number,
  rate: number,
  feePercent: number
) {
  const count = Math.max(1, people || 1);
  const rateValue = rate || 1;
  const fee = Math.max(0, feePercent || 0);
  const share = (total || 0) / count;
  const feeAmount = (share * fee) / 100;
  const localTotal = share + feeAmount;
  return { share, feeAmount, localTotal, usdc: localTotal / rateValue };
}

function money(value: number) {
  return formatter.format(Number.isFinite(value) ? value : 0);
}

function shareLink(billId: string, participantId: string) {
  if (typeof window === "undefined") return `/bill/${billId}/${participantId}`;
  return `${window.location.origin}/bill/${billId}/${participantId}`;
}

function billLink(billId: string) {
  if (typeof window === "undefined") return `/bill/${billId}`;
  return `${window.location.origin}/bill/${billId}`;
}

function QrCode({ value }: { value: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- QR service returns a generated raster image.
    <img
      src={`https://quickchart.io/qr?size=220&margin=2&text=${encodeURIComponent(value)}`}
      alt="QR code for the TongTong payment link"
      className="h-44 w-44 rounded-xl bg-white p-2"
    />
  );
}

export function BillCreated({
  bill,
  onReset,
}: {
  bill: Bill;
  onReset: () => void;
}) {
  const [currentBill, setCurrentBill] = useState(bill);
  const [copied, setCopied] = useState<string>();
  const [qrFor, setQrFor] = useState<string>();
  const [refreshError, setRefreshError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const { bill: latest } = await fetchJson<{ bill: Bill }>(
          `/api/bills/${bill.id}`,
          { cache: "no-store" }
        );
        if (cancelled) return;
        setCurrentBill(latest);
        setRefreshError(undefined);
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setRefreshError(
          errorMessage(error, "Could not refresh the payment status")
        );
      }
    };
    const interval = window.setInterval(refresh, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [bill.id]);

  const copy = async (participant: BillParticipant) => {
    try {
      await navigator.clipboard.writeText(
        shareLink(currentBill.id, participant.id)
      );
      setCopied(participant.id);
      window.setTimeout(() => setCopied(undefined), 1800);
    } catch (error) {
      console.error(error);
      toast.error("Could not copy the payment link");
    }
  };

  const paidCount = currentBill.participants.filter(
    (participant) => participant.status === "paid"
  ).length;

  return (
    <section className="space-y-5 rounded-3xl border border-border-low bg-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Bill created · {currentBill.id}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">
            {currentBill.title}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {paidCount}/{currentBill.participants.length} paid · share one link
            per friend.
          </p>
          <a
            href={billLink(currentBill.id)}
            className="mt-2 inline-block text-xs font-bold text-primary underline"
          >
            Host status link · refresh-safe
          </a>
          {refreshError && (
            <p
              role="status"
              className="mt-2 text-xs font-semibold text-destructive"
            >
              {refreshError} · showing the last known status.
            </p>
          )}
        </div>
        <button
          onClick={onReset}
          className="cursor-pointer rounded-xl border border-border-low px-4 py-2 text-xs font-bold transition hover:bg-cream"
        >
          Create another
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {currentBill.participants.map((participant) => {
          const link = shareLink(currentBill.id, participant.id);
          return (
            <div
              key={participant.id}
              className="rounded-2xl border border-border-low p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{participant.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    RM {money(participant.amountMyr)} ·{" "}
                    {participant.amountUsdc.toFixed(2)} USDC
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${participant.status === "paid" ? "bg-green-500/10 text-green-700 dark:text-green-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}
                >
                  {participant.status}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => copy(participant)}
                  className="flex-1 cursor-pointer rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                >
                  {copied === participant.id ? "Copied" : "Copy link"}
                </button>
                <button
                  onClick={() =>
                    setQrFor(
                      qrFor === participant.id ? undefined : participant.id
                    )
                  }
                  className="cursor-pointer rounded-lg border border-border-low px-3 py-2 text-xs font-bold"
                >
                  QR
                </button>
              </div>
              {qrFor === participant.id && (
                <div className="mt-4 flex justify-center rounded-xl bg-white p-2">
                  <QrCode value={link} />
                </div>
              )}
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block truncate text-[10px] text-muted underline"
              >
                {link}
              </a>
            </div>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-muted">
        On Vercel, bill links stay available through the connected Blob store.
        Local development uses temporary in-memory storage.
      </p>
    </section>
  );
}

export function TongTongFlow() {
  const client = useAppClient();
  const connected = useConnectedWallet(client);
  const [title, setTitle] = useState("KL dinner");
  const [rate, setRate] = useState("4.70");
  const [feePercent, setFeePercent] = useState("1");
  const [participants, setParticipants] = useState(initialParticipants);
  const [items, setItems] = useState(initialItems);
  const [bill, setBill] = useState<Bill>();
  const [isCreating, setIsCreating] = useState(false);

  const totalMyr = useMemo(
    () => items.reduce((total, item) => total + Number(item.amountMyr || 0), 0),
    [items]
  );

  const updateItem = (id: string, patch: Partial<DraftItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const toggleAssignee = (item: DraftItem, participantId: string) => {
    const assigneeIds = item.assigneeIds.includes(participantId)
      ? item.assigneeIds.filter((id) => id !== participantId)
      : [...item.assigneeIds, participantId];
    updateItem(item.id, { assigneeIds });
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      {
        id: `item-${Date.now()}`,
        name: "New item",
        amountMyr: 0,
        assigneeIds: participants.map((participant) => participant.id),
      },
    ]);
  };

  const addParticipant = () => {
    const id = `p${participants.length + 1}`;
    setParticipants((current) => [
      ...current,
      { id, name: `Friend ${current.length}` },
    ]);
    setItems((current) =>
      current.map((item) => ({
        ...item,
        assigneeIds: item.assigneeIds.includes(id)
          ? item.assigneeIds
          : [...item.assigneeIds, id],
      }))
    );
  };

  const removeParticipant = (participantId: string) => {
    if (participants.length <= 2) return;
    const remaining = participants.filter(
      (participant) => participant.id !== participantId
    );
    const idMap = new Map(
      remaining.map((participant, index) => [participant.id, `p${index + 1}`])
    );
    const normalizedParticipants = remaining.map((participant, index) => ({
      ...participant,
      id: `p${index + 1}`,
    }));

    setParticipants(normalizedParticipants);
    setItems((current) =>
      current.map((item) => {
        const assigneeIds = item.assigneeIds
          .filter((id) => id !== participantId)
          .map((id) => idMap.get(id))
          .filter((id): id is string => Boolean(id));
        return {
          ...item,
          assigneeIds:
            assigneeIds.length > 0
              ? assigneeIds
              : [normalizedParticipants[0].id],
        };
      })
    );
  };

  const createBill = async () => {
    const hostWallet = connected?.account.address;
    if (!hostWallet) {
      toast.error("Connect the host wallet first");
      return;
    }
    if (
      !items.every(
        (item) =>
          item.name.trim() &&
          Number(item.amountMyr) > 0 &&
          item.assigneeIds.length > 0
      )
    ) {
      toast.error("Every item needs a name, amount, and at least one person");
      return;
    }
    if (
      participants.some(
        (participant) =>
          !items.some((item) => item.assigneeIds.includes(participant.id))
      )
    ) {
      toast.error("Assign at least one item to every person");
      return;
    }

    setIsCreating(true);
    try {
      const result = await fetchJson<{ bill: Bill }>("/api/bills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          hostWallet,
          rate: Number(rate),
          feePercent: Number(feePercent),
          items,
          participantNames: participants.map((participant) => participant.name),
        }),
      });
      setBill(result.bill);
      toast.success("Bill created. Share a friend link.");
    } catch (error) {
      console.error(error);
      toast.error(errorMessage(error, "Could not create bill"));
    } finally {
      setIsCreating(false);
    }
  };

  if (bill)
    return <BillCreated bill={bill} onReset={() => setBill(undefined)} />;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border-low bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Create shared bill
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">
              Itemize it once. Share every share.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Assign items to friends, then TongTong creates a personal payment
              link for each person.
            </p>
          </div>
          <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-600 dark:text-blue-300">
            DEVNET
          </span>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-[1fr_140px_120px]">
          <label className="block text-sm font-semibold">
            Bill name
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full rounded-xl border border-border-low bg-background px-4 py-3 outline-none focus:border-ring"
            />
          </label>
          <label className="block text-sm font-semibold">
            MYR / USDC
            <input
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              inputMode="decimal"
              className="mt-2 w-full rounded-xl border border-border-low bg-background px-4 py-3 outline-none focus:border-ring"
            />
          </label>
          <label className="block text-sm font-semibold">
            Fee %
            <input
              value={feePercent}
              onChange={(event) => setFeePercent(event.target.value)}
              inputMode="decimal"
              className="mt-2 w-full rounded-xl border border-border-low bg-background px-4 py-3 outline-none focus:border-ring"
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-border-low bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
              People
            </p>
            <h2 className="mt-2 text-xl font-black tracking-tight">
              Who was there?
            </h2>
          </div>
          <span className="text-sm font-bold">
            {participants.length} people
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {participants.map((participant) => (
            <div key={participant.id} className="relative">
              <label className="block text-sm font-semibold">
                Person {participant.id.slice(1)}
                <input
                  value={participant.name}
                  onChange={(event) =>
                    setParticipants((current) =>
                      current.map((candidate) =>
                        candidate.id === participant.id
                          ? { ...candidate, name: event.target.value }
                          : candidate
                      )
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-border-low bg-background px-4 py-3 pr-10 outline-none focus:border-ring"
                />
              </label>
              <button
                type="button"
                onClick={() => removeParticipant(participant.id)}
                disabled={participants.length <= 2}
                aria-label={`Remove ${participant.name}`}
                className="absolute right-2 top-8 cursor-pointer rounded-lg px-2 py-1 text-xs font-bold text-muted hover:bg-cream disabled:cursor-not-allowed disabled:opacity-30"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addParticipant}
            className="min-h-12 cursor-pointer rounded-xl border border-dashed border-border-low px-4 py-3 text-sm font-bold text-muted transition hover:bg-cream"
          >
            + Add person
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-border-low bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
              Manual itemization
            </p>
            <h2 className="mt-2 text-xl font-black tracking-tight">
              Assign the receipt
            </h2>
          </div>
          <span className="text-sm font-bold">RM {money(totalMyr)}</span>
        </div>

        <div className="mt-5 space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-border-low p-4"
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
                <input
                  value={item.name}
                  onChange={(event) =>
                    updateItem(item.id, { name: event.target.value })
                  }
                  placeholder="Item name"
                  className="rounded-xl border border-border-low bg-background px-4 py-3 text-sm outline-none focus:border-ring"
                />
                <input
                  value={item.amountMyr || ""}
                  onChange={(event) =>
                    updateItem(item.id, {
                      amountMyr: Number(event.target.value),
                    })
                  }
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount MYR"
                  className="rounded-xl border border-border-low bg-background px-4 py-3 text-sm outline-none focus:border-ring"
                />
                <button
                  onClick={() =>
                    setItems((current) =>
                      current.filter((candidate) => candidate.id !== item.id)
                    )
                  }
                  disabled={items.length === 1}
                  className="cursor-pointer rounded-xl border border-border-low px-3 py-2 text-xs font-bold text-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {participants.map((participant) => {
                  const selected = item.assigneeIds.includes(participant.id);
                  return (
                    <button
                      key={participant.id}
                      onClick={() => toggleAssignee(item, participant.id)}
                      className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "border border-border-low text-muted"
                      }`}
                    >
                      {selected ? "✓ " : ""}
                      {participant.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addItem}
          className="mt-4 cursor-pointer rounded-xl border border-border-low px-4 py-2.5 text-sm font-bold transition hover:bg-cream"
        >
          + Add item
        </button>
      </section>

      <section className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-60">
              Ready to share
            </p>
            <p className="mt-2 text-3xl font-black">RM {money(totalMyr)}</p>
            <p className="mt-1 text-sm opacity-70">
              Fee-inclusive amounts settle in devnet USDC.
            </p>
          </div>
          <button
            onClick={createBill}
            disabled={isCreating || !connected}
            className="cursor-pointer rounded-xl bg-white px-5 py-3.5 text-sm font-black text-slate-900 shadow-sm transition hover:bg-white/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {isCreating
              ? "Creating bill..."
              : connected
                ? "Create & share bill"
                : "Connect wallet to create"}
          </button>
        </div>
      </section>

      <p className="text-center text-xs text-muted">
        TongTong is a devnet demo. Configure Vercel Blob before deploying so
        shared bill links work across serverless requests.
      </p>
    </div>
  );
}

export function BillPayment({
  bill,
  participant,
}: {
  bill: Bill;
  participant: BillParticipant;
}) {
  const client = useAppClient();
  const connected = useConnectedWallet(client);
  const { run, isSending } = useSend();
  const [currentBill, setCurrentBill] = useState(bill);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string>();
  const payerBalance = useBalance(
    connected?.account.address ? address(connected.account.address) : undefined
  );

  const currentParticipant =
    currentBill.participants.find(
      (candidate) => candidate.id === participant.id
    ) ?? participant;
  const assignedItems = currentBill.items.filter((item) =>
    item.assigneeIds.includes(participant.id)
  );

  const verify = async (signature: string) => {
    setIsVerifying(true);
    setVerifyError(undefined);
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const result = await fetchJson<{ bill: Bill }>(
            `/api/bills/${currentBill.id}/verify`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                participantId: participant.id,
                signature,
              }),
            }
          );
          setCurrentBill(result.bill);
          toast.success("Your share is verified and marked paid");
          return;
        } catch (error) {
          // 409 means devnet has not surfaced the transaction yet; anything
          // else is a real failure the payer has to see.
          if (!(error instanceof ApiError) || error.status !== 409) throw error;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 900));
      }
      throw new Error(
        "Transaction is still syncing. Refresh this page in a moment."
      );
    } catch (error) {
      console.error(error);
      const message = errorMessage(error, "Payment verification failed");
      // The transfer already landed on devnet, so the failure has to stay
      // visible after the toast times out.
      setVerifyError(message);
      toast.error(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const pay = async () => {
    if (BigInt(currentParticipant.amountBaseUnits) <= 0n) {
      toast.error("This person has no assigned items yet");
      return;
    }
    if (!connected?.signer) {
      toast.error("Connect the wallet that will pay this share");
      return;
    }
    if (payerBalance.error) {
      toast.error(
        `Could not read your devnet SOL balance: ${parseTransactionError(payerBalance.error)}`
      );
      return;
    }
    if (payerBalance.lamports == null) {
      toast.error("Checking your devnet SOL balance. Try again in a moment.");
      return;
    }
    if (payerBalance.lamports < 3_000_000n) {
      toast.error(
        "You need about 0.003 devnet SOL for fees and token-account setup"
      );
      return;
    }

    let recipient;
    try {
      recipient = address(currentBill.hostWallet);
    } catch {
      toast.error("This bill has an invalid host wallet");
      return;
    }

    const sent = await run(() => {
      const transfer = client.token.instructions.transferToATA({
        mint: address(USDC_DEVNET_MINT),
        authority: connected.signer!,
        recipient,
        amount: BigInt(currentParticipant.amountBaseUnits),
        decimals: 6,
      });
      const memo = client.memo.instructions.addMemo({
        memo: currentParticipant.paymentReference,
        signers: [connected.signer!],
      });
      return transfer.then((resolvedTransfer) =>
        client.sendTransaction(
          nonDivisibleSequentialInstructionPlan([memo, resolvedTransfer])
        )
      );
    }, "Payment sent; verifying on devnet");

    if (sent) await verify(sent);
  };

  return (
    <section className="space-y-6 rounded-3xl border border-border-low bg-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            TongTong bill · {currentBill.id}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            {currentBill.title}
          </h1>
          <p className="mt-2 text-sm text-muted">
            This link is for {currentParticipant.name}.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${currentParticipant.status === "paid" ? "bg-green-500/10 text-green-700 dark:text-green-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}
        >
          {currentParticipant.status}
        </span>
      </div>

      <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
        <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-60">
          Your exact share
        </p>
        <p className="mt-2 text-5xl font-black">
          {currentParticipant.amountUsdc.toFixed(2)}{" "}
          <span className="text-xl">USDC</span>
        </p>
        <p className="mt-2 text-sm opacity-70">
          RM {money(currentParticipant.amountMyr)} including the{" "}
          {currentBill.feePercent}% conversion fee
        </p>
      </div>

      <div>
        <p className="text-sm font-bold">Your items</p>
        <div className="mt-3 space-y-2">
          {assignedItems.map((item) => (
            <div
              key={item.id}
              className="flex justify-between gap-4 rounded-xl border border-border-low px-4 py-3 text-sm"
            >
              <span>
                {item.name}{" "}
                <span className="text-xs text-muted">
                  ÷ {item.assigneeIds.length}
                </span>
              </span>
              <span className="font-bold">
                RM {money(item.amountMyr / item.assigneeIds.length)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border-low bg-background p-4 text-xs leading-relaxed text-muted">
        TongTong verifies the confirmed transaction matches the host wallet,
        devnet USDC mint, exact amount, and this bill&apos;s unique payment
        reference before marking you paid.
      </div>

      {verifyError && (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs leading-relaxed text-destructive"
        >
          {verifyError} Your transfer may already be on devnet — refresh this
          page before paying again.
        </div>
      )}

      {connected && payerBalance.error != null && (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs leading-relaxed text-destructive"
        >
          Could not read this wallet&apos;s devnet SOL balance:{" "}
          {parseTransactionError(payerBalance.error)} Reload the page to retry.
        </div>
      )}

      {connected &&
        payerBalance.lamports != null &&
        payerBalance.lamports < 3_000_000n && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
            This wallet has{" "}
            {(Number(payerBalance.lamports) / 1_000_000_000).toFixed(4)} SOL.
            Get devnet SOL from the{" "}
            <a
              href="https://faucet.solana.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline"
            >
              Solana faucet
            </a>{" "}
            before paying.
          </div>
        )}

      {currentParticipant.signature ? (
        <a
          href={`https://explorer.solana.com/tx/${currentParticipant.signature}?cluster=devnet&view=receipt`}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl bg-green-500/10 px-4 py-3 text-center text-sm font-bold text-green-700 underline dark:text-green-300"
        >
          Verified on Solana · View transaction
        </a>
      ) : (
        <button
          onClick={pay}
          disabled={
            isSending ||
            isVerifying ||
            !connected ||
            payerBalance.lamports == null ||
            payerBalance.lamports < 3_000_000n ||
            BigInt(currentParticipant.amountBaseUnits) <= 0n
          }
          className="w-full cursor-pointer rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {isVerifying
            ? "Verifying payment..."
            : isSending
              ? "Confirming on devnet..."
              : BigInt(currentParticipant.amountBaseUnits) <= 0n
                ? "No items assigned"
                : !connected
                  ? "Connect wallet to pay"
                  : payerBalance.error != null
                    ? "SOL balance unavailable"
                    : payerBalance.lamports == null
                      ? "Checking SOL balance..."
                      : payerBalance.lamports < 3_000_000n
                        ? "Get devnet SOL to pay"
                        : `Pay ${currentParticipant.amountUsdc.toFixed(2)} USDC`}
        </button>
      )}
      <p className="text-center text-xs text-muted">
        Never send real funds here. This is devnet USDC.
      </p>
    </section>
  );
}

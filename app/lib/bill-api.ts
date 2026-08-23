"use client";

import { useEffect, useState } from "react";
import type { Bill } from "./bill-store";
import { errorMessage } from "./errors";

type BillApiResult = {
  bill?: Bill;
  error?: string;
};

export async function fetchBill(billId: string): Promise<Bill> {
  const response = await fetch(`/api/bills/${billId}`, { cache: "no-store" });
  const result = (await response.json()) as BillApiResult;
  if (!response.ok) throw new Error(result.error ?? "Bill not found");
  return result.bill as Bill;
}

export function useBill(billId: string) {
  const [bill, setBill] = useState<Bill>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    fetchBill(billId)
      .then(setBill)
      .catch((reason: unknown) =>
        setError(errorMessage(reason, "Bill not found"))
      );
  }, [billId]);

  return { bill, error };
}

export async function verifyPayment(
  billId: string,
  participantId: string,
  signature: string
) {
  const response = await fetch(`/api/bills/${billId}/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ participantId, signature }),
  });
  const result = (await response.json()) as BillApiResult;
  return { ok: response.ok, status: response.status, result };
}

export function billLink(billId: string, participantId?: string) {
  const path = participantId
    ? `/bill/${billId}/${participantId}`
    : `/bill/${billId}`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

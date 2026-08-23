"use client";

import { useEffect, useState } from "react";
import type { Bill } from "./bill-store";
import { errorMessage } from "./errors";
import { fetchJson } from "./fetch-json";

export async function fetchBill(billId: string): Promise<Bill> {
  const { bill } = await fetchJson<{ bill: Bill }>(`/api/bills/${billId}`, {
    cache: "no-store",
  });
  return bill;
}

export function useBill(billId: string) {
  const [bill, setBill] = useState<Bill>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    fetchBill(billId)
      .then((result) => {
        if (!cancelled) setBill(result);
      })
      .catch((reason: unknown) => {
        console.error(reason);
        if (!cancelled) setError(errorMessage(reason, "Bill not found"));
      });
    return () => {
      cancelled = true;
    };
  }, [billId]);

  return { bill, error };
}

export async function verifyPayment(
  billId: string,
  participantId: string,
  signature: string
) {
  const { bill } = await fetchJson<{ bill: Bill }>(
    `/api/bills/${billId}/verify`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantId, signature }),
    }
  );
  return bill;
}

export function billLink(billId: string, participantId?: string) {
  const path = participantId
    ? `/bill/${billId}/${participantId}`
    : `/bill/${billId}`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}
